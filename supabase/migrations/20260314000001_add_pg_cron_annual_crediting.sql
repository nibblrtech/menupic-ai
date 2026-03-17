-- ============================================================================
-- Migration: pg_cron job to credit 30 scans monthly to annual subscribers.
--
-- Monthly subscribers are handled by the RevenueCat RENEWAL webhook (fires
-- every month). Annual subscribers only get RENEWAL once per year, so this
-- cron job covers months 2–12 by checking daily for annual subs whose
-- last_scan_credit_at is ≥ 30 days ago.
--
-- Prerequisites:
--   1. Enable the pg_cron extension in Supabase Dashboard → Database → Extensions.
--   2. The credit_scans(p_user_id, p_amount) function must already exist
--      (created in 20260314000000_add_subscription_fields.sql).
--
-- Run this in the Supabase SQL editor or via `supabase db push`.
-- ============================================================================

-- 1. Enable pg_cron (idempotent — no-op if already enabled via dashboard)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 2. Function that finds eligible annual subscribers and credits them
CREATE OR REPLACE FUNCTION credit_annual_subscribers()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
  credited INT := 0;
BEGIN
  FOR r IN
    SELECT user_id, last_scan_credit_at, subscription_started_at
      FROM profile
     WHERE subscription_active = true
       AND subscription_product_id = 'MENUPICAIPREMIUMANNUAL'
       AND (
             last_scan_credit_at  <= (now() - INTERVAL '30 days')
          OR (last_scan_credit_at IS NULL
              AND subscription_started_at <= (now() - INTERVAL '30 days'))
           )
  LOOP
    -- Credit 30 scans atomically
    PERFORM credit_scans(r.user_id, 30);

    -- Stamp last_scan_credit_at so we don't double-credit
    UPDATE profile
       SET last_scan_credit_at = now(),
           updated_at          = now()
     WHERE user_id = r.user_id;

    credited := credited + 1;
  END LOOP;

  RAISE LOG '[pg_cron] credit_annual_subscribers: credited % user(s)', credited;
END;
$$;

-- 3. Schedule the job to run daily at 3:00 AM UTC
SELECT cron.schedule(
  'credit-annual-scans',       -- job name (used to unschedule later if needed)
  '0 3 * * *',                 -- every day at 03:00 UTC
  'SELECT credit_annual_subscribers()'
);
