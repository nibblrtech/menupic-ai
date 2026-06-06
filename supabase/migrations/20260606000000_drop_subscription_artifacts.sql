-- ============================================================================
-- Migration: Remove legacy subscription artifacts from profile table.
--
-- The app is now consumables-only. Subscription lifecycle state is no longer
-- used by the application or webhook handling.
-- ============================================================================

-- Remove legacy index created for subscription cron crediting.
DROP INDEX IF EXISTS idx_profile_active_annual;

-- Unschedule the legacy annual-credit cron job if it exists.
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  BEGIN
    SELECT jobid
      INTO v_job_id
      FROM cron.job
     WHERE jobname = 'credit-annual-scans'
     LIMIT 1;

    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;
  EXCEPTION
    WHEN invalid_schema_name OR undefined_table OR undefined_function THEN
      -- pg_cron may not be installed or exposed in this environment.
      NULL;
  END;
END;
$$;

-- Remove legacy subscription crediting functions.
DROP FUNCTION IF EXISTS credit_annual_subscribers();
DROP FUNCTION IF EXISTS credit_scans(text, int);

-- Remove legacy subscription columns.
ALTER TABLE profile
  DROP COLUMN IF EXISTS subscription_product_id,
  DROP COLUMN IF EXISTS subscription_started_at,
  DROP COLUMN IF EXISTS last_scan_credit_at,
  DROP COLUMN IF EXISTS subscription_active;
