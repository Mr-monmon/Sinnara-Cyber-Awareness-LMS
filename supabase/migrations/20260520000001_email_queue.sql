/*
  General-purpose email queue
  - email_queue: stores all outbound transactional emails
  - email_queue_config: holds supabase_url + service_role_key so the cron helper can call the edge function
  - invoke_process_email_queue(): pg_cron target — reads config and calls the edge function via pg_net
  - pg_cron job: every minute

  After deploying, add config rows via Supabase SQL editor:
    INSERT INTO email_queue_config (key, value) VALUES
      ('supabase_url',     'https://YOUR_PROJECT_REF.supabase.co'),
      ('service_role_key', 'YOUR_SERVICE_ROLE_KEY');
*/

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;

-- Config table (service_role only — no RLS policies intentionally)
CREATE TABLE IF NOT EXISTS email_queue_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE email_queue_config ENABLE ROW LEVEL SECURITY;

-- email_queue table
CREATE TABLE IF NOT EXISTS email_queue (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email            text        NOT NULL,
  subject             text        NOT NULL,
  html                text        NOT NULL,
  status              text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sending','sent','failed','retrying')),
  attempts            integer     NOT NULL DEFAULT 0,
  max_attempts        integer     NOT NULL DEFAULT 3,
  scheduled_at        timestamptz NOT NULL DEFAULT now(),
  sent_at             timestamptz,
  last_error          text,
  related_campaign_id uuid        REFERENCES phishing_campaigns(id) ON DELETE SET NULL,
  company_id          uuid        REFERENCES companies(id)          ON DELETE SET NULL,
  created_by          uuid        REFERENCES auth.users(id)         ON DELETE SET NULL,
  metadata            jsonb       NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_process
  ON email_queue(status, scheduled_at)
  WHERE status IN ('pending','retrying');

CREATE INDEX IF NOT EXISTS idx_email_queue_company
  ON email_queue(company_id, created_at DESC);

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pa_email_queue_all" ON email_queue FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN'));

-- Cron helper: reads config table and calls the edge function via pg_net
CREATE OR REPLACE FUNCTION invoke_process_email_queue()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  SELECT value INTO v_url FROM email_queue_config WHERE key = 'supabase_url';
  SELECT value INTO v_key FROM email_queue_config WHERE key = 'service_role_key';
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE '[email-queue] Config not configured — skipping';
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

-- Schedule cron job (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('process-email-queue');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;
SELECT cron.schedule('process-email-queue', '* * * * *', 'SELECT invoke_process_email_queue()');
