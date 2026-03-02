/**
 * Profile API Route — GET /api/profile?user_id=<id>
 *
 * Accepts a `user_id` query parameter (email for Android, UUID for iOS)
 * and returns the matching row from the `profile` table in Supabase.
 *
 * Server-side only — uses SupabaseService (service-role key preferred).
 */
import supabase from '../../services/SupabaseService';

const DEFAULT_FREE_SCANS = 5;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');

    if (!userId) {
      return Response.json({ error: 'Missing required query parameter: user_id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('profile')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // PGRST116 = no rows found — create a new profile for this user
      if (error.code === 'PGRST116') {
        const now = new Date().toISOString();
        const newProfile = {
          user_id: userId,
          created_at: now,
          updated_at: now,
          scans: DEFAULT_FREE_SCANS,
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
