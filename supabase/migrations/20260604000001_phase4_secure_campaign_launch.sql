/*
  Phase 4 — Secure Campaign Launch (sections E, F, O)

  1. STATUS CONSTRAINT FIX (critical latent bug)
     The phishing_campaigns_status_check constraint (added 2026-01-03) only allowed
     the legacy request-workflow statuses:
        SUBMITTED, APPROVED, RUNNING, COMPLETED, REJECTED
     But the campaign engine (2026-05-17 onward) writes DRAFT, SCHEDULED, PAUSED —
     and Phase 4 adds PARTIAL_FAILURE and FAILED. Any insert/update with one of
     those engine statuses would violate the CHECK constraint. This widens the
     constraint to the full lifecycle while preserving the legacy values.

  2. CAMPAIGN QUEUE WRITE LOCKDOWN (section E / M-RLS)
     campaign_email_queue rows must only ever be created/updated by the service
     role (launch-phishing-campaign + process-campaign Edge Functions). Company
     users get SELECT only. The original campaign_engine migration already created
     just `pa_queue_all` (platform admin, ALL) and `ca_queue_own` (company, SELECT).
     This block defensively drops any permissive write policy that may have been
     added on other branches, and re-asserts the SELECT-only company policy, so
     the security posture is explicit and self-documenting.

  3. SCHEDULER (section F)
     process-scheduled-campaigns flips due SCHEDULED campaigns to RUNNING. It is
     driven by pg_cron every minute, reading the Vault secrets (project_url +
     service_role_key) exactly like invoke_process_campaign.
*/

-- ── 1. Widen the campaign status constraint ──────────────────────────────────
ALTER TABLE phishing_campaigns DROP CONSTRAINT IF EXISTS phishing_campaigns_status_check;
ALTER TABLE phishing_campaigns
  ADD CONSTRAINT phishing_campaigns_status_check
  CHECK (status IN (
    -- engine lifecycle
    'DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED',
    'COMPLETED', 'PARTIAL_FAILURE', 'FAILED',
    -- legacy request-approval workflow (kept for backward compatibility)
    'SUBMITTED', 'APPROVED', 'REJECTED'
  ));

-- ── 2. campaign_email_queue: write lockdown (SELECT-only for company users) ───
DO $$
DECLARE
  pol record;
BEGIN
  -- Drop any company-facing policy that is NOT the intended SELECT-only one.
  FOR pol IN
    SELECT polname
    FROM pg_policy
    WHERE polrelid = 'public.campaign_email_queue'::regclass
      AND polname NOT IN ('pa_queue_all', 'ca_queue_own')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.campaign_email_queue', pol.polname);
  END LOOP;
END;
$$;

-- Re-assert the SELECT-only company policy (idempotent).
DROP POLICY IF EXISTS "ca_queue_own" ON public.campaign_email_queue;
CREATE POLICY "ca_queue_own" ON public.campaign_email_queue
  FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users
    WHERE id = auth.uid()
      AND role IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
  ));

-- ── 3. Scheduler: invoke process-scheduled-campaigns from pg_cron ────────────
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;

CREATE OR REPLACE FUNCTION invoke_process_scheduled_campaigns()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'project_url'      LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE '[process-scheduled-campaigns] vault secrets not configured — skipping';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url || '/functions/v1/process-scheduled-campaigns',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION invoke_process_scheduled_campaigns() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('process-scheduled-campaigns');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;
SELECT cron.schedule('process-scheduled-campaigns', '* * * * *', 'SELECT invoke_process_scheduled_campaigns()');
