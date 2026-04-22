/**
 * Profile API Route — GET /api/profile?user_id=<id>
 *
 * Accepts a `user_id` query parameter (email for Android, UUID for iOS)
 * and returns the matching row from the `profile` table in Supabase.
 *
 * Server-side only — uses SupabaseService (service-role key preferred).
 */
import supabase from '../../services/SupabaseService';
import { getClientIp, isValidTrackedUserId } from './_identity';
import { checkRateLimit } from './_rateLimit';

const DEFAULT_FREE_SCANS = 3;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');

    if (!userId) {
      return Response.json({ error: 'Missing required query parameter: user_id' }, { status: 400 });
    }

    if (!isValidTrackedUserId(userId)) {
      return Response.json({ error: 'Invalid user_id format' }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const limiter = checkRateLimit(`profile:${userId}:${clientIp}`, 60, 60_000);
    if (!limiter.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many profile requests. Please try again shortly.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(limiter.retryAfterSeconds),
          },
        },
      );
    }

    const { data, error } = await supabase
      .from('profile')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // PGRST116 = no rows found — create a new profile for this user
      if (error.code === 'PGRST116') {
        // Check if this user_id has previously deleted their account.
        // If so, they do not receive free scans on re-registration.
        const { data: tombstone } = await supabase
          .from('deleted_users')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();

        const now = new Date().toISOString();
        const newProfile = {
          user_id: userId,
          created_at: now,
          updated_at: now,
          scans: tombstone ? 0 : DEFAULT_FREE_SCANS,
        };

        const { data: created, error: insertError } = await supabase
          .from('profile')
          .insert(newProfile)
          .select()
          .single();

        if (insertError) {
          return Response.json({ error: insertError.message }, { status: 500 });
        }

        return Response.json({ profile: created }, { status: 201 });
      }

      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ profile: data });
  } catch (err: any) {
    return Response.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
