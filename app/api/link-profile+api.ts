/**
 * Link Profile API Route — POST /api/link-profile
 *
 * Migrates scans from a guest profile to a signed-in account profile.
 *
 * Request body: {
 *   "from_user_id": "guest:<revenuecat_app_user_id>",
 *   "to_user_id": "<signed_in_user_id>"
 * }
 *
 * Behavior:
 * - Ensures destination profile exists (creates with standard new-account policy)
 * - Adds source scans to destination scans
 * - Zeroes source scans to avoid double transfer
 */
import supabase from '../../services/SupabaseService';
import { getClientIp, isValidTrackedUserId } from './_identity';
import { checkRateLimit } from './_rateLimit';

const DEFAULT_FREE_SCANS = 3;

async function ensureDestinationProfile(userId: string) {
  const { data: existing, error: existingError } = await supabase
    .from('profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) return existing;

  const { data: tombstone, error: tombstoneError } = await supabase
    .from('deleted_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (tombstoneError) {
    throw new Error(tombstoneError.message);
  }

  const now = new Date().toISOString();
  const { data: created, error: createError } = await supabase
    .from('profile')
    .insert({
      user_id: userId,
      created_at: now,
      updated_at: now,
      scans: tombstone ? 0 : DEFAULT_FREE_SCANS,
    })
    .select('*')
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  return created;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fromUserId: string | undefined = body?.from_user_id;
    const toUserId: string | undefined = body?.to_user_id;

    if (!fromUserId || !toUserId) {
      return Response.json(
        { error: 'Missing required fields: from_user_id, to_user_id' },
        { status: 400 },
      );
    }

    if (!isValidTrackedUserId(fromUserId) || !isValidTrackedUserId(toUserId)) {
      return Response.json({ error: 'Invalid user_id format' }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const limiter = checkRateLimit(`link:${fromUserId}:${toUserId}:${clientIp}`, 12, 60_000);
    if (!limiter.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many link requests. Please try again shortly.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(limiter.retryAfterSeconds),
          },
        },
      );
    }

    if (!fromUserId.startsWith('guest:')) {
      return Response.json({ error: 'from_user_id must be a guest identity' }, { status: 400 });
    }

    if (toUserId.startsWith('guest:')) {
      return Response.json({ error: 'to_user_id must be a signed-in identity' }, { status: 400 });
    }

    if (fromUserId === toUserId) {
      return Response.json({ error: 'from_user_id and to_user_id cannot match' }, { status: 400 });
    }

    const { data: sourceProfile, error: sourceError } = await supabase
      .from('profile')
      .select('scans')
      .eq('user_id', fromUserId)
      .maybeSingle();

    if (sourceError) {
      return Response.json({ error: sourceError.message }, { status: 500 });
    }

    const sourceScans = sourceProfile?.scans ?? 0;

    const destinationProfile = await ensureDestinationProfile(toUserId);
    const destinationScans = destinationProfile.scans ?? 0;
    const mergedScans = destinationScans + sourceScans;

    const now = new Date().toISOString();

    const { error: destinationUpdateError } = await supabase
      .from('profile')
      .update({
        scans: mergedScans,
        updated_at: now,
      })
      .eq('user_id', toUserId);

    if (destinationUpdateError) {
      return Response.json({ error: destinationUpdateError.message }, { status: 500 });
    }

    if (sourceScans > 0) {
      const { error: sourceUpdateError } = await supabase
        .from('profile')
        .update({
          scans: 0,
          updated_at: now,
        })
        .eq('user_id', fromUserId);

      if (sourceUpdateError) {
        return Response.json({ error: sourceUpdateError.message }, { status: 500 });
      }
    }

    return Response.json({ scans: mergedScans, transferred: sourceScans });
  } catch (err: any) {
    return Response.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
