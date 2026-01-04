/*
  # Enhanced Phishing Campaign Elements (Gophish-style)

  1. Schema Changes
    - Add Gophish-like elements to phishing_campaign_requests table
      - Email template fields (HTML body, text body, subject, from address)
      - Landing page HTML
      - SMTP profile configuration
      - Sending profile details
      - Track options (opens, clicks, credentials)
    
    - Enhance phishing_campaigns table
      - Add detailed metrics for analytics dashboard
      - Track credentials entered rate
      - Add comparison metrics
    
    - Enhance phishing_campaign_targets table
      - Add credential submission tracking
      - Add IP address and user agent for forensics
    
    - Create department_vulnerability_stats table
      - Track department performance over time
      - Calculate vulnerability scores
  
  2. New Features
    - Department vulnerability analysis
    - Campaign-to-campaign comparison
    - Enhanced tracking and analytics
  
  3. Security
    - All tables maintain existing RLS policies
*/

-- Add Gophish-style fields to phishing_campaign_requests
DO $$
BEGIN
  -- Email template fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_requests' AND column_name = 'email_subject') THEN
    ALTER TABLE phishing_campaign_requests ADD COLUMN email_subject text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_requests' AND column_name = 'email_html_body') THEN
    ALTER TABLE phishing_campaign_requests ADD COLUMN email_html_body text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_requests' AND column_name = 'email_text_body') THEN
    ALTER TABLE phishing_campaign_requests ADD COLUMN email_text_body text;
  END IF;
  
  -- Landing page
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_requests' AND column_name = 'landing_page_html') THEN
    ALTER TABLE phishing_campaign_requests ADD COLUMN landing_page_html text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_requests' AND column_name = 'redirect_url') THEN
    ALTER TABLE phishing_campaign_requests ADD COLUMN redirect_url text;
  END IF;
  
  -- Sending profile
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_requests' AND column_name = 'from_address') THEN
    ALTER TABLE phishing_campaign_requests ADD COLUMN from_address text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_requests' AND column_name = 'from_name') THEN
    ALTER TABLE phishing_campaign_requests ADD COLUMN from_name text;
  END IF;
  
  -- Tracking options
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_requests' AND column_name = 'track_opens') THEN
    ALTER TABLE phishing_campaign_requests ADD COLUMN track_opens boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_requests' AND column_name = 'track_clicks') THEN
    ALTER TABLE phishing_campaign_requests ADD COLUMN track_clicks boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_requests' AND column_name = 'capture_credentials') THEN
    ALTER TABLE phishing_campaign_requests ADD COLUMN capture_credentials boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_requests' AND column_name = 'capture_passwords') THEN
    ALTER TABLE phishing_campaign_requests ADD COLUMN capture_passwords boolean DEFAULT false;
  END IF;
END $$;

-- Add enhanced metrics to phishing_campaigns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaigns' AND column_name = 'credentials_entered') THEN
    ALTER TABLE phishing_campaigns ADD COLUMN credentials_entered integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaigns' AND column_name = 'click_rate') THEN
    ALTER TABLE phishing_campaigns ADD COLUMN click_rate decimal(5,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaigns' AND column_name = 'reporting_rate') THEN
    ALTER TABLE phishing_campaigns ADD COLUMN reporting_rate decimal(5,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaigns' AND column_name = 'credential_rate') THEN
    ALTER TABLE phishing_campaigns ADD COLUMN credential_rate decimal(5,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaigns' AND column_name = 'open_rate') THEN
    ALTER TABLE phishing_campaigns ADD COLUMN open_rate decimal(5,2) DEFAULT 0;
  END IF;
END $$;

-- Enhance phishing_campaign_targets with forensic data
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_targets' AND column_name = 'credentials_entered') THEN
    ALTER TABLE phishing_campaign_targets ADD COLUMN credentials_entered boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_targets' AND column_name = 'credentials_entered_at') THEN
    ALTER TABLE phishing_campaign_targets ADD COLUMN credentials_entered_at timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_targets' AND column_name = 'ip_address') THEN
    ALTER TABLE phishing_campaign_targets ADD COLUMN ip_address text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_targets' AND column_name = 'user_agent') THEN
    ALTER TABLE phishing_campaign_targets ADD COLUMN user_agent text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_targets' AND column_name = 'browser') THEN
    ALTER TABLE phishing_campaign_targets ADD COLUMN browser text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phishing_campaign_targets' AND column_name = 'os') THEN
    ALTER TABLE phishing_campaign_targets ADD COLUMN os text;
  END IF;
END $$;

-- Create department vulnerability statistics table
CREATE TABLE IF NOT EXISTS department_vulnerability_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES phishing_campaigns(id) ON DELETE CASCADE,
  total_targets integer DEFAULT 0,
  emails_opened integer DEFAULT 0,
  links_clicked integer DEFAULT 0,
  credentials_entered integer DEFAULT 0,
  emails_reported integer DEFAULT 0,
  vulnerability_score decimal(5,2) DEFAULT 0,
  calculated_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, department_id)
);

ALTER TABLE department_vulnerability_stats ENABLE ROW LEVEL SECURITY;

-- RLS for department_vulnerability_stats
CREATE POLICY "Platform admins can manage department stats"
  ON department_vulnerability_stats FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'PLATFORM_ADMIN'
  ));

CREATE POLICY "Company admins can view own department stats"
  ON department_vulnerability_stats FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid() AND role = 'COMPANY_ADMIN'
    )
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_dept_vuln_stats_company ON department_vulnerability_stats(company_id);
CREATE INDEX IF NOT EXISTS idx_dept_vuln_stats_dept ON department_vulnerability_stats(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_vuln_stats_campaign ON department_vulnerability_stats(campaign_id);

-- Function to calculate campaign rates
CREATE OR REPLACE FUNCTION calculate_campaign_rates()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate rates based on emails sent
  IF NEW.emails_sent > 0 THEN
    NEW.open_rate := ROUND((NEW.emails_opened::decimal / NEW.emails_sent::decimal * 100), 2);
    NEW.click_rate := ROUND((NEW.links_clicked::decimal / NEW.emails_sent::decimal * 100), 2);
    NEW.reporting_rate := ROUND((NEW.emails_reported::decimal / NEW.emails_sent::decimal * 100), 2);
    NEW.credential_rate := ROUND((COALESCE(NEW.credentials_entered, 0)::decimal / NEW.emails_sent::decimal * 100), 2);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate rates
DROP TRIGGER IF EXISTS trigger_calculate_campaign_rates ON phishing_campaigns;
CREATE TRIGGER trigger_calculate_campaign_rates
  BEFORE UPDATE ON phishing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION calculate_campaign_rates();

-- Function to calculate department vulnerability scores
CREATE OR REPLACE FUNCTION calculate_department_vulnerability(
  p_campaign_id uuid,
  p_department_id uuid
)
RETURNS decimal AS $$
DECLARE
  v_score decimal;
  v_total integer;
  v_clicked integer;
  v_credentials integer;
  v_reported integer;
BEGIN
  SELECT
    COUNT(*),
    SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN credentials_entered THEN 1 ELSE 0 END),
    SUM(CASE WHEN reported_at IS NOT NULL THEN 1 ELSE 0 END)
  INTO v_total, v_clicked, v_credentials, v_reported
  FROM phishing_campaign_targets
  WHERE campaign_id = p_campaign_id
    AND department_id = p_department_id;
  
  IF v_total = 0 THEN
    RETURN 0;
  END IF;
  
  -- Vulnerability score calculation:
  -- - Clicked: +30 points per click
  -- - Credentials: +50 points per credential entry
  -- - Reported: -40 points per report (reduces vulnerability)
  -- - Normalized to 0-100 scale
  
  v_score := (
    (v_clicked::decimal / v_total::decimal * 30) +
    (v_credentials::decimal / v_total::decimal * 50) -
    (v_reported::decimal / v_total::decimal * 20)
  );
  
  -- Ensure score is between 0 and 100
  v_score := GREATEST(0, LEAST(100, v_score));
  
  RETURN ROUND(v_score, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to update department vulnerability stats
CREATE OR REPLACE FUNCTION update_department_vulnerability_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_dept_id uuid;
  v_company_id uuid;
  v_campaign_id uuid;
BEGIN
  v_campaign_id := COALESCE(NEW.campaign_id, OLD.campaign_id);
  v_dept_id := COALESCE(NEW.department_id, OLD.department_id);
  
  -- Get company_id from campaign
  SELECT company_id INTO v_company_id
  FROM phishing_campaigns
  WHERE id = v_campaign_id;
  
  -- Update or insert department stats
  INSERT INTO department_vulnerability_stats (
    company_id,
    department_id,
    campaign_id,
    total_targets,
    emails_opened,
    links_clicked,
    credentials_entered,
    emails_reported,
    vulnerability_score,
    calculated_at
  )
  SELECT
    v_company_id,
    v_dept_id,
    v_campaign_id,
    COUNT(*),
    SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN credentials_entered THEN 1 ELSE 0 END),
    SUM(CASE WHEN reported_at IS NOT NULL THEN 1 ELSE 0 END),
    calculate_department_vulnerability(v_campaign_id, v_dept_id),
    now()
  FROM phishing_campaign_targets
  WHERE campaign_id = v_campaign_id
    AND department_id = v_dept_id
  ON CONFLICT (campaign_id, department_id)
  DO UPDATE SET
    total_targets = EXCLUDED.total_targets,
    emails_opened = EXCLUDED.emails_opened,
    links_clicked = EXCLUDED.links_clicked,
    credentials_entered = EXCLUDED.credentials_entered,
    emails_reported = EXCLUDED.emails_reported,
    vulnerability_score = EXCLUDED.vulnerability_score,
    calculated_at = now();
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update department stats when targets change
DROP TRIGGER IF EXISTS trigger_update_dept_vuln_stats ON phishing_campaign_targets;
CREATE TRIGGER trigger_update_dept_vuln_stats
  AFTER INSERT OR UPDATE ON phishing_campaign_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_department_vulnerability_stats();
