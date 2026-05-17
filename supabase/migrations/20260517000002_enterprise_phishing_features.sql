/*
  # Enterprise Phishing Simulation Features

  New tables:
  - smtp_profiles: SMTP sending profiles (per-company + platform-pushed)
  - phishing_groups: Target groups
  - phishing_group_members: Individual targets in groups
  - phishing_company_landing_pages: Company-specific landing pages
  - phishing_company_email_templates: Company-specific email templates
  - smtp_profile_company_access: Track which platform SMTP profiles are pushed to which companies

  Updates:
  - phishing_campaign_requests: add smtp_profile_id, group_ids, landing_page_id, email_template_id
*/

-- SMTP Profiles
CREATE TABLE IF NOT EXISTS smtp_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  host text NOT NULL,
  port integer NOT NULL DEFAULT 587,
  username text NOT NULL,
  password text NOT NULL,
  from_address text NOT NULL,
  from_name text NOT NULL,
  use_tls boolean DEFAULT true,
  use_starttls boolean DEFAULT false,
  ignore_cert_errors boolean DEFAULT false,
  custom_headers jsonb DEFAULT '[]'::jsonb,
  is_platform_profile boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE smtp_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admin_smtp_all" ON smtp_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
  );

CREATE POLICY "company_admin_smtp_own" ON smtp_profiles
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid() AND role = 'COMPANY_ADMIN'
    )
  );

-- Platform SMTP pushed to companies access table
CREATE TABLE IF NOT EXISTS smtp_profile_company_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smtp_profile_id uuid NOT NULL REFERENCES smtp_profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pushed_at timestamptz DEFAULT now(),
  UNIQUE(smtp_profile_id, company_id)
);

ALTER TABLE smtp_profile_company_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admin_smtp_access_all" ON smtp_profile_company_access
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
  );

CREATE POLICY "company_admin_smtp_access_view" ON smtp_profile_company_access
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid() AND role = 'COMPANY_ADMIN'
    )
  );

-- Phishing Groups
CREATE TABLE IF NOT EXISTS phishing_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  member_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE phishing_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admin_groups_all" ON phishing_groups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
  );

CREATE POLICY "company_admin_groups_own" ON phishing_groups
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid() AND role = 'COMPANY_ADMIN'
    )
  );

-- Phishing Group Members
CREATE TABLE IF NOT EXISTS phishing_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES phishing_groups(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text DEFAULT '',
  email text NOT NULL,
  position text DEFAULT '',
  department text DEFAULT '',
  custom_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE phishing_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admin_group_members_all" ON phishing_group_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
  );

CREATE POLICY "company_admin_group_members_own" ON phishing_group_members
  FOR ALL USING (
    group_id IN (
      SELECT id FROM phishing_groups WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid() AND role = 'COMPANY_ADMIN'
      )
    )
  );

-- Function to update group member count
CREATE OR REPLACE FUNCTION update_group_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE phishing_groups SET member_count = member_count + 1, updated_at = now() WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE phishing_groups SET member_count = GREATEST(member_count - 1, 0), updated_at = now() WHERE id = OLD.group_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_update_group_member_count
  AFTER INSERT OR DELETE ON phishing_group_members
  FOR EACH ROW EXECUTE FUNCTION update_group_member_count();

-- Company Landing Pages
CREATE TABLE IF NOT EXISTS phishing_company_landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  html_content text NOT NULL DEFAULT '',
  capture_credentials boolean DEFAULT false,
  capture_passwords boolean DEFAULT false,
  redirect_url text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE phishing_company_landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admin_landing_pages_all" ON phishing_company_landing_pages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
  );

CREATE POLICY "company_admin_landing_pages_own" ON phishing_company_landing_pages
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid() AND role = 'COMPANY_ADMIN'
    )
  );

-- Company Email Templates
CREATE TABLE IF NOT EXISTS phishing_company_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  html_content text NOT NULL DEFAULT '',
  text_content text DEFAULT '',
  envelope_sender text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE phishing_company_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admin_co_templates_all" ON phishing_company_email_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
  );

CREATE POLICY "company_admin_co_templates_own" ON phishing_company_email_templates
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid() AND role = 'COMPANY_ADMIN'
    )
  );

-- Update phishing_campaign_requests with new fields
ALTER TABLE phishing_campaign_requests
  ADD COLUMN IF NOT EXISTS smtp_profile_id uuid REFERENCES smtp_profiles(id),
  ADD COLUMN IF NOT EXISTS group_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS landing_page_id uuid REFERENCES phishing_company_landing_pages(id),
  ADD COLUMN IF NOT EXISTS email_template_id uuid REFERENCES phishing_company_email_templates(id),
  ADD COLUMN IF NOT EXISTS total_group_targets integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS launch_type text DEFAULT 'IMMEDIATE',
  ADD COLUMN IF NOT EXISTS scheduled_launch_at timestamptz,
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Riyadh';
