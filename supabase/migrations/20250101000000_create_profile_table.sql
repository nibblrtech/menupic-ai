-- Migration: create profile table
-- Run this in the Supabase SQL editor or via the Supabase CLI.

CREATE TABLE IF NOT EXISTS public.profile (
  user_id    TEXT                     NOT NULL PRIMARY KEY,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  scans      INTEGER                  NOT NULL DEFAULT 0
);

-- Automatically update updated_at on every row change.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profile_set_updated_at ON public.profile;

CREATE TRIGGER profile_set_updated_at
BEFORE UPDATE ON public.profile
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Optional: enable Row Level Security so only authenticated users
-- can read their own profile.
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profile
  FOR SELECT
  USING (user_id = auth.uid()::TEXT OR user_id = auth.email());
