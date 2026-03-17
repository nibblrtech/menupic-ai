-- ============================================================================
-- Migration: Add subscription tracking fields to the profile table
--            + create a credit_scans RPC function for atomic scan crediting.
--
-- Run this in the Supabase SQL editor or via `supabase db push`.
-- ============================================================================

-- 1. Add new columns to the profile table
ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS subscription_product_id  text          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subscription_started_at  timestamptz   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_scan_credit_at      timestamptz   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subscription_active      boolean       DEFAULT false;

-- 2. Index for the cron job — quickly find active annual subscribers due for credits
CREATE INDEX IF NOT EXISTS idx_profile_active_annual
  ON profile (subscription_active, subscription_product_id, last_scan_credit_at)
  WHERE subscription_active = true;

-- 3. Atomic function to increment a user's scan count.
--    Used by the webhook handler and cron job to avoid race conditions.
CREATE OR REPLACE FUNCTION credit_scans(p_user_id text, p_amount int)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profile
     SET scans      = scans + p_amount,
         updated_at = now()
   WHERE user_id = p_user_id;
END;
$$;
