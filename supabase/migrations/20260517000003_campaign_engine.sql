/*
  Enterprise Phishing Campaign Engine Schema
  - phishing_events: per-target event tracking
  - campaign_email_queue: throttled sending queue
  - phishing_scenarios: predefined attack scenarios
  - company_phishing_limits: per-company feature limits
  - phishing_custom_variables: company-defined template variables
  - phishing_alerts: real-time alert log
*/

-- ── 1. EVENTS TABLE ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phishing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES phishing_campaigns(id) ON DELETE CASCADE,
  target_id uuid REFERENCES phishing_campaign_targets(id) ON DELETE SET NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'EMAIL_QUEUED','EMAIL_SENT','EMAIL_FAILED','EMAIL_OPENED',
    'LINK_CLICKED','FORM_SUBMITTED','ATTACHMENT_OPENED','EMAIL_REPORTED'
  )),
  recipient_id text NOT NULL,   -- unique per-recipient token (url-safe)
  email text,
  ip_address text,
  user_agent text,
  browser text,
  os text,
  device_type text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_phishing_events_campaign ON phishing_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_phishing_events_target ON phishing_events(target_id);
CREATE INDEX IF NOT EXISTS idx_phishing_events_type ON phishing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_phishing_events_recipient ON phishing_events(recipient_id);
ALTER TABLE phishing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_events_all" ON phishing_events FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role='PLATFORM_ADMIN'));
CREATE POLICY "ca_events_own" ON phishing_events FOR SELECT
  USING (company_id IN (SELECT company_id FROM users WHERE id=auth.uid() AND role='COMPANY_ADMIN'));

-- ── 2. EMAIL QUEUE ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES phishing_campaigns(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES phishing_campaign_targets(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  smtp_profile_id uuid REFERENCES smtp_profiles(id),
  recipient_email text NOT NULL,
  recipient_id text NOT NULL,   -- unique tracking token
  email_subject text NOT NULL,
  email_html text NOT NULL,
  from_address text NOT NULL,
  from_name text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENDING','SENT','FAILED','SKIPPED')),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_queue_campaign ON campaign_email_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_queue_status_scheduled ON campaign_email_queue(status, scheduled_at);
ALTER TABLE campaign_email_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_queue_all" ON campaign_email_queue FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id=auth.uid() AND role='PLATFORM_ADMIN'));
CREATE POLICY "ca_queue_own" ON campaign_email_queue FOR SELECT
  USING (company_id IN (SELECT company_id FROM users WHERE id=auth.uid() AND role='COMPANY_ADMIN'));

-- ── 3. SCENARIOS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phishing_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'GENERAL',  -- CREDENTIAL_HARVEST, MALWARE, BEC, HR, IT, DELIVERY
  difficulty text NOT NULL DEFAULT 'MEDIUM',  -- EASY, MEDIUM, HARD, EXPERT
  email_subject text NOT NULL,
  email_html text NOT NULL,
  landing_page_html text NOT NULL DEFAULT '',
  capture_credentials boolean DEFAULT false,
  redirect_url text DEFAULT 'https://www.google.com',
  tags text[] DEFAULT '{}',
  thumbnail_description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE phishing_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_scenarios_all" ON phishing_scenarios FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id=auth.uid() AND role='PLATFORM_ADMIN'));
CREATE POLICY "ca_scenarios_read" ON phishing_scenarios FOR SELECT
  USING (is_active = true AND EXISTS (SELECT 1 FROM users WHERE id=auth.uid() AND role='COMPANY_ADMIN'));

-- ── 4. COMPANY PHISHING LIMITS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_phishing_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  max_campaigns_per_year integer DEFAULT 12,
  max_emails_per_month integer DEFAULT 5000,
  max_targets_per_campaign integer DEFAULT 500,
  can_use_custom_smtp boolean DEFAULT true,
  can_use_landing_pages boolean DEFAULT true,
  can_use_credential_capture boolean DEFAULT true,
  can_use_attachment_simulation boolean DEFAULT false,
  can_use_scenarios boolean DEFAULT true,
  emails_sent_this_month integer DEFAULT 0,
  month_reset_date date DEFAULT date_trunc('month', CURRENT_DATE)::date,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE company_phishing_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_limits_all" ON company_phishing_limits FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id=auth.uid() AND role='PLATFORM_ADMIN'));
CREATE POLICY "ca_limits_view" ON company_phishing_limits FOR SELECT
  USING (company_id IN (SELECT company_id FROM users WHERE id=auth.uid() AND role='COMPANY_ADMIN'));

-- Auto-create limits for new companies
CREATE OR REPLACE FUNCTION initialize_company_phishing_limits()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO company_phishing_limits(company_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;$$;

CREATE TRIGGER on_company_created_phishing_limits
  AFTER INSERT ON companies FOR EACH ROW
  EXECUTE FUNCTION initialize_company_phishing_limits();

-- ── 5. CUSTOM VARIABLES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phishing_custom_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  variable_name text NOT NULL,     -- e.g. "SupportEmail"
  variable_value text NOT NULL,    -- e.g. "it-support@company.com"
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, variable_name)
);
ALTER TABLE phishing_custom_variables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_customvars_all" ON phishing_custom_variables FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id=auth.uid() AND role='PLATFORM_ADMIN'));
CREATE POLICY "ca_customvars_own" ON phishing_custom_variables FOR ALL
  USING (company_id IN (SELECT company_id FROM users WHERE id=auth.uid() AND role='COMPANY_ADMIN'));

-- ── 6. PHISHING ALERTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phishing_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES phishing_campaigns(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  target_id uuid REFERENCES phishing_campaign_targets(id),
  event_id uuid REFERENCES phishing_events(id),
  alert_type text NOT NULL CHECK (alert_type IN ('LINK_CLICKED','CREDENTIALS_SUBMITTED','CAMPAIGN_COMPLETE','CAMPAIGN_STARTED')),
  priority text NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_company ON phishing_alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON phishing_alerts(company_id, is_read);
ALTER TABLE phishing_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_alerts_all" ON phishing_alerts FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id=auth.uid() AND role='PLATFORM_ADMIN'));
CREATE POLICY "ca_alerts_own" ON phishing_alerts FOR ALL
  USING (company_id IN (SELECT company_id FROM users WHERE id=auth.uid() AND role='COMPANY_ADMIN'));

-- ── 7. ADD COLUMNS TO EXISTING TABLES ─────────────────────────────────────────
-- phishing_campaigns: add engine columns
ALTER TABLE phishing_campaigns
  ADD COLUMN IF NOT EXISTS smtp_profile_id uuid REFERENCES smtp_profiles(id),
  ADD COLUMN IF NOT EXISTS group_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS landing_page_id uuid REFERENCES phishing_company_landing_pages(id),
  ADD COLUMN IF NOT EXISTS email_template_id uuid REFERENCES phishing_company_email_templates(id),
  ADD COLUMN IF NOT EXISTS scenario_id uuid REFERENCES phishing_scenarios(id),
  ADD COLUMN IF NOT EXISTS emails_per_minute integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS random_delay_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS random_delay_max_seconds integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS business_hours_only boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_hours_start integer DEFAULT 9,
  ADD COLUMN IF NOT EXISTS business_hours_end integer DEFAULT 17,
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Riyadh',
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS launched_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_queue_size integer DEFAULT 0;

-- phishing_campaign_targets: add recipient_id for tracking
ALTER TABLE phishing_campaign_targets
  ADD COLUMN IF NOT EXISTS recipient_id text UNIQUE DEFAULT encode(gen_random_bytes(12), 'base64url');

-- Also add credentials_entered column if not exists
ALTER TABLE phishing_campaigns
  ADD COLUMN IF NOT EXISTS credentials_entered integer DEFAULT 0;
