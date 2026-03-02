/**
 * SupabaseService — server-side Supabase client for MenuPic AI.
 *
 * Intended for use in Expo API routes (app/api/**+api.ts) only.
 * Never import this from client-side components — the service-role key
 * must stay on the server.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL ?? 'https://tynernxpyjduotbetnec.supabase.co';

// Prefer the secret key on the server (full privileges).
// Falls back to the anon key if the secret is not set.
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5bmVybnhweWpkdW90YmV0bmVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MjYyMTEsImV4cCI6MjA4NzMwMjIxMX0.Lypz9Q23geSqPFRQNCw_dMayghEk7ZbgN_PFS9IfBR4';

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
