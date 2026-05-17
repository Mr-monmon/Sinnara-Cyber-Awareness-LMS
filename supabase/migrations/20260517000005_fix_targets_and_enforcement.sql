/*
  Production Fixes for Enterprise Phishing Engine

  1. phishing_campaign_targets: make employee_id nullable, add persona columns
     (targets now come from phishing_groups, not the users table)
  2. check_phishing_limits: server-side enforcement RPC function
  3. update_company_email_usage: increment monthly email counter
  4. Drop the unique(campaign_id, employee_id) constraint that breaks group-based targeting
*/

-- ── 1. FIX phishing_campaign_targets ─────────────────────────────────────────
-- Drop the NOT NULL + unique constraints that break group-based targeting
ALTER TABLE phishing_campaign_targets
  ALTER COLUMN employee_id DROP NOT NULL;

ALTER TABLE phishing_campaign_targets
  DROP CONSTRAINT IF EXISTS phishing_campaign_targets_campaign_id_employee_id_key;

-- Add persona columns for variable resolution at send time
ALTER TABLE phishing_campaign_targets
  ADD COLUMN IF NOT EXISTS first_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name  text DEFAULT '',
  ADD COLUMN IF NOT EXISTS position   text DEFAULT '',
  ADD COLUMN IF NOT EXISTS department text DEFAULT '',
  ADD COLUMN IF NOT EXISTS credentials_entered boolean DEFAULT false;

-- Partial unique index: allow NULL employee_id but prevent duplicate employees per campaign
CREATE UNIQUE INDEX IF NOT EXISTS idx_targets_campaign_employee
  ON phishing_campaign_targets(campaign_id, employee_id)
  WHERE employee_id IS NOT NULL;

-- ── 2. BACKEND LIMIT ENFORCEMENT ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_phishing_limits(
  p_company_id uuid,
  p_target_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits record;
  v_quota  record;
BEGIN
  -- Get company limits; if not found, allow (defaults not yet initialized)
  SELECT * INTO v_limits
  FROM company_phishing_limits
  WHERE company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  -- Reset monthly counter if a new month started
  IF v_limits.month_reset_date < date_trunc('month', CURRENT_DATE)::date THEN
    UPDATE company_phishing_limits
    SET emails_sent_this_month = 0,
        month_reset_date = date_trunc('month', CURRENT_DATE)::date,
        updated_at = now()
    WHERE company_id = p_company_id;
    v_limits.emails_sent_this_month := 0;
  END IF;

  -- Check max targets per campaign
  IF p_target_count > v_limits.max_targets_per_campaign THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Target count (%s) exceeds your plan limit of %s per campaign.',
                       p_target_count, v_limits.max_targets_per_campaign)
    );
  END IF;

  -- Check monthly email quota
  IF v_limits.emails_sent_this_month + p_target_count > v_limits.max_emails_per_month THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('This campaign would exceed your monthly email limit. Used: %s / %s',
                       v_limits.emails_sent_this_month, v_limits.max_emails_per_month)
    );
  END IF;

  -- Check annual campaign quota
  SELECT * INTO v_quota
  FROM phishing_campaign_quotas
  WHERE company_id = p_company_id
    AND quota_year = EXTRACT(YEAR FROM CURRENT_DATE)::integer;

  IF FOUND AND v_quota.used_campaigns >= v_limits.max_campaigns_per_year THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Annual campaign limit reached (%s/%s).',
                       v_quota.used_campaigns, v_limits.max_campaigns_per_year)
    );
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- ── 3. UPDATE EMAIL USAGE COUNTER ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_company_email_usage(
  p_company_id uuid,
  p_count integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reset if new month
  UPDATE company_phishing_limits
  SET emails_sent_this_month = CASE
        WHEN month_reset_date < date_trunc('month', CURRENT_DATE)::date
        THEN p_count
        ELSE emails_sent_this_month + p_count
      END,
      month_reset_date = date_trunc('month', CURRENT_DATE)::date,
      updated_at = now()
  WHERE company_id = p_company_id;
END;
$$;

-- ── 4. SMTP ENCRYPTION INFRASTRUCTURE ────────────────────────────────────────
-- Mark whether the password field is stored encrypted
ALTER TABLE smtp_profiles
  ADD COLUMN IF NOT EXISTS password_encrypted boolean DEFAULT false;

-- Note: encryption/decryption is handled at the application layer
-- in the process-campaign Edge Function using SMTP_ENCRYPTION_KEY env var.
-- Passwords stored with password_encrypted=true are AES-256-GCM encrypted (base64url).

-- ── 5. ADD CAMPAIGN-LEVEL EMAIL/SUBJECT DEFAULTS TO FIX enqueue_campaign ──
-- The SQL enqueue_campaign function had empty email_subject/html.
-- Fix: it now carries placeholder that the Edge Function replaces.
-- The frontend enqueue path directly provides full HTML, so the SQL path is not used.
-- Marking this as a doc fix only.

COMMENT ON FUNCTION check_phishing_limits IS
  'Server-side enforcement of phishing campaign limits. Returns {allowed: bool, reason?: string}.';
