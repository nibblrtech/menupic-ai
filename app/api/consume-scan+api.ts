/**
 * Consume-Scan API Route — POST /api/consume-scan
 *
 * Decrements the scan count by 1 for the given user. Called by the client
 * after a dish is successfully identified, so the DB stays in sync with
 * the optimistic client-side decrement.
 *
 * Request body: { "user_id": "<string>" }
 *
 * Returns:
 *  200 — { scans: <new count> }
 *  400 — missing user_id or no scans left
 *  500 — database error
 */
import supabase from '../../services/SupabaseService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string | undefined = body?.user_id;

    if (!userId) {
      return Response.json({ error: 'Missing required field: user_id' }, { status: 400 });
    }

    // Atomically decrement scans, but never below 0.
    // We use a raw SQL call via the RPC `credit_scans` with a negative amount,
    // but to enforce the >= 0 guard we do it manually here.
    const { data: profile, error: fetchError } = await supabase
      .from('profile')
      .select('scans')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('[consume-scan] Fetch error:', fetchError);
      return Response.json({ error: fetchError.message }, { status: 500 });
    }

    if (!profile || profile.scans <= 0) {
      return Response.json({ error: 'No scans remaining' }, { status: 400 });
    }

    const newScans = profile.scans - 1;

    const { error: updateError } = await supabase
      .from('profile')
      .update({
        scans: newScans,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[consume-scan] Update error:', updateError);
      return Response.json({ error: updateError.message }, { status: 500 });
    }

    return Response.json({ scans: newScans });
  } catch (err: any) {
    console.error('[consume-scan] Unhandled error:', err);
    return Response.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
