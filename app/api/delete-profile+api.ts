/**
 * Delete Profile API Route — DELETE /api/delete-profile?user_id=<id>
 *
 * 1. Records the user_id in `deleted_users` (tombstone) so that if the user
 *    re-registers they will NOT receive free scan credits again.
 * 2. Permanently deletes the row from the `profile` table.
 *
 * Server-side only — uses SupabaseService (service-role key preferred).
 */
import supabase from '../../services/SupabaseService';

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');

    if (!userId) {
      return Response.json(
        { error: 'Missing required query parameter: user_id' },
        { status: 400 },
      );
    }

    // 1. Write tombstone — upsert so it's idempotent if called more than once.
    const { error: tombstoneError } = await supabase
      .from('deleted_users')
      .upsert(
        { user_id: userId, deleted_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );

    if (tombstoneError) {
      return Response.json({ error: tombstoneError.message }, { status: 500 });
    }

    // 2. Delete the profile row.
    const { error: deleteError } = await supabase
      .from('profile')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      return Response.json({ error: deleteError.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
