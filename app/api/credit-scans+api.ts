/**
 * Credit-Scans API Route — POST /api/credit-scans
 *
 * Called immediately after a successful IAP purchase to persist the
 * scan credit in Supabase. The client optimistically updates the UI
 * before this call completes.
 *
 * Request body: { "user_id": "<string>", "scans": <number>, "product_id": "<string>" }
 *
 * Returns:
 *  200 — { scans: <new total> }
 *  400 — missing / invalid fields
 *  500 — database error
 */
import supabase from '../../services/SupabaseService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string | undefined = body?.user_id;
    const scansToAdd: number | undefined = body?.scans;
    const productId: string | undefined = body?.product_id;

    if (!userId) {
      return Response.json({ error: 'Missing required field: user_id' }, { status: 400 });
    }
    if (typeof scansToAdd !== 'number' || scansToAdd <= 0) {
      return Response.json({ error: 'Missing or invalid field: scans (must be a positive number)' }, { status: 400 });
    }

    // Fetch current scan count
    const { data: profile, error: fetchError } = await supabase
      .from('profile')
      .select('scans')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('[credit-scans] Fetch error:', fetchError);
      return Response.json({ error: fetchError.message }, { status: 500 });
    }

    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 400 });
    }

    const newScans = (profile.scans ?? 0) + scansToAdd;

    const { error: updateError } = await supabase
      .from('profile')
      .update({
        scans: newScans,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[credit-scans] Update error:', updateError);
      return Response.json({ error: updateError.message }, { status: 500 });
    }

    console.log(`[credit-scans] Credited ${scansToAdd} scans (product: ${productId ?? 'unknown'}) to user ${userId} — new total: ${newScans}`);

    return Response.json({ scans: newScans });
  } catch (err: any) {
    console.error('[credit-scans] Unhandled error:', err);
    return Response.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
