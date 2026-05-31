/*
  P-1 (Campaign Scheduler) + E-1 (Service Role Key Storage)

  P-1: process-campaign is now driven by pg_cron every minute. The worker already
       claims all due PENDING jobs across every RUNNING campaign (atomic optimistic
       lock), retries failed jobs, and marks a campaign COMPLETED when its queue is
       drained — it simply was never invoked on a schedule. This migration adds the
       recurring invoker + cron job.

  E-1: The service_role_key previously lived in plaintext in the email_queue_config
       table. It is now stored in Supabase Vault (encrypted at rest). Both cron
       invokers read it from vault.decrypted_secrets. The plaintext row is removed.

  ── One-time setup (only required for a FRESH project with no existing
     email_queue_config rows). Run in the Supabase SQL editor: ──

     SELECT vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
     SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');

  If email_queue_config already holds the values, the DO block below migrates them
  into the vault automatically — no manual step needed.
*/

-- Vault is available on Supabase by default; ensure the extension is present.
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;

-- ── E-1: migrate existing plaintext secrets into Vault, then drop the plaintext key ──
DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  -- email_queue_config may not exist yet on some branches; guard the whole block.
  IF to_regclass('public.email_queue_config') IS NULL THEN
    RAISE NOTICE '[vault-migration] email_queue_config not found — skipping migration of existing secrets';
    RETURN;
  END IF;

  SELECT value INTO v_url FROM public.email_queue_config WHERE key = 'supabase_url';
  SELECT value INTO v_key FROM public.email_queue_config WHERE key = 'service_role_key';

  IF v_url IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'project_url') THEN
    PERFORM vault.create_secret(v_url, 'project_url', 'Supabase project URL for cron invokers');
  END IF;

  IF v_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'service_role_key') THEN
    PERFORM vault.create_secret(v_key, 'service_role_key', 'Service role key for cron invokers');
  END IF;

  -- Remove the plaintext service-role key from the regular table (no longer read by anything).
  DELETE FROM public.email_queue_config WHERE key = 'service_role_key';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[vault-migration] skipped: %', SQLERRM;
END;
$$;

-- ── E-1: email-queue invoker now reads secrets from Vault ──
CREATE OR REPLACE FUNCTION invoke_process_email_queue()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'project_url'      LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE '[email-queue] vault secrets not configured — skipping';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url || '/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  );
END;
$$;

-- ── P-1: campaign worker invoker — drains all due PENDING jobs across RUNNING campaigns ──
CREATE OR REPLACE FUNCTION invoke_process_campaign()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'project_url'      LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE '[process-campaign] vault secrets not configured — skipping';
    RETURN;
  END IF;
  -- No campaign_id: the worker fans out over every due PENDING job (max 200 per run).
  PERFORM net.http_post(
    url     := v_url || '/functions/v1/process-campaign',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('batch_size', 200)
  );
END;
$$;

-- Lock down the invokers — only the cron owner / superuser should call them.
REVOKE EXECUTE ON FUNCTION invoke_process_email_queue() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION invoke_process_campaign()    FROM PUBLIC, anon, authenticated;

-- ── P-1: schedule the campaign worker every minute (idempotent) ──
DO $$
BEGIN
  PERFORM cron.unschedule('process-campaign');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;
SELECT cron.schedule('process-campaign', '* * * * *', 'SELECT invoke_process_campaign()');
