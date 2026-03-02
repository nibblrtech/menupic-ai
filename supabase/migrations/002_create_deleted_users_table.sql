-- Migration: create deleted_users tombstone table
-- Tracks user IDs that have previously deleted their account.
-- Used by the profile creation logic to deny free scan credits on re-registration.
-- Run this in the Supabase SQL editor or via the Supabase CLI.

CREATE TABLE IF NOT EXISTS public.deleted_users (
  user_id    TEXT                        NOT NULL PRIMARY KEY,
  deleted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- No public read access needed; the service-role key used by server-side
-- routes bypasses RLS automatically.
ALTER TABLE public.deleted_users ENABLE ROW LEVEL SECURITY;
