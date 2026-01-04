/*
  # Phishing Campaigns Management Schema

  1. New Tables
    - `phishing_campaign_quotas`
      - Tracks annual phishing campaign quota per company
      - Platform admin can adjust quota
    
    - `phishing_templates`
      - Email templates for phishing simulations
      - Created by platform admin
      - Used by companies in campaign requests
    
    - `phishing_campaign_requests`
      - Campaign requests submitted by company admins
      - Acts as support tickets for platform team
      - Tracks status: DRAFT, SUBMITTED, APPROVED, RUNNING, COMPLETED, REJECTED
    
    - `phishing_campaigns`
      - Actual campaigns executed via Gophish
      - Links to Gophish campaign ID
      - Stores campaign results and statistics
    
    - `phishing_campaign_targets`
      - Target employees for each campaign
      - Tracks individual results (opened, clicked, reported)
    
    - `phishing_domains`
      - Custom sending domains per company
      - DNS verification status
  
  2. Security
    - Enable RLS on all tables
    - Platform admins can access all data
    - Company admins can only access their company's data
*/

-- Phishing Campaign Quotas Table
CREATE TABLE IF NOT EXISTS phishing_campaign_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  annual_quota integer NOT NULL DEFAULT 4,
  used_campaigns integer NOT NULL DEFAULT 0,
  quota_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  last_reset_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, quota_year)
);

-- Phishing Email Templates Table
CREATE TABLE IF NOT EXISTS phishing_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  subject text NOT NULL,
  html_content text NOT NULL,
  category text NOT NULL DEFAULT 'GENERAL',
  difficulty_level text NOT NULL DEFAULT 'MEDIUM',
  language text NOT NULL DEFAULT 'en',
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Phishing Campaign Requests Table (Support Tickets)
CREATE TABLE IF NOT EXISTS phishing_campaign_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users(id),
  campaign_name text NOT NULL,
  template_id uuid REFERENCES phishing_templates(id),
  target_departments text[],
  target_employee_count integer DEFAULT 0,
  scheduled_date timestamptz,
  status text NOT NULL DEFAULT 'DRAFT',
  priority text DEFAULT 'NORMAL',
  notes text,
  admin_notes text,
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  rejected_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Phishing Campaigns Table (Gophish Integration)
CREATE TABLE IF NOT EXISTS phishing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES phishing_campaign_requests(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  gophish_campaign_id text,
  campaign_name text NOT NULL,
  template_id uuid REFERENCES phishing_templates(id),
  status text NOT NULL DEFAULT 'DRAFT',
  launch_date timestamptz,
  completion_date timestamptz,
  total_targets integer DEFAULT 0,
  emails_sent integer DEFAULT 0,
  emails_opened integer DEFAULT 0,
  links_clicked integer DEFAULT 0,
  data_submitted integer DEFAULT 0,
  emails_reported integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Phishing Campaign Targets Table
CREATE TABLE IF NOT EXISTS phishing_campaign_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES phishing_campaigns(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  department_id uuid REFERENCES departments(id),
  status text NOT NULL DEFAULT 'PENDING',
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  submitted_at timestamptz,
  reported_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, employee_id)
);

-- Phishing Domains Table
CREATE TABLE IF NOT EXISTS phishing_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  domain_name text NOT NULL,
  is_verified boolean DEFAULT false,
  dns_record text,
  verification_token text,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, domain_name)
);

-- Enable RLS
ALTER TABLE phishing_campaign_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE phishing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE phishing_campaign_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE phishing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE phishing_campaign_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE phishing_domains ENABLE ROW LEVEL SECURITY;

-- RLS Policies for phishing_campaign_quotas
CREATE POLICY "Platform admins can manage all quotas"
  ON phishing_campaign_quotas FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'PLATFORM_ADMIN'
  ));

CREATE POLICY "Company admins can view own quota"
  ON phishing_campaign_quotas FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid() AND role = 'COMPANY_ADMIN'
    )
  );

-- RLS Policies for phishing_templates
CREATE POLICY "Platform admins can manage templates"
  ON phishing_templates FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'PLATFORM_ADMIN'
  ));

CREATE POLICY "Company admins can view active templates"
  ON phishing_templates FOR SELECT
  TO authenticated
  USING (
    is_active = true AND
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('COMPANY_ADMIN', 'PLATFORM_ADMIN'))
  );

-- RLS Policies for phishing_campaign_requests
CREATE POLICY "Platform admins can manage all requests"
  ON phishing_campaign_requests FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'PLATFORM_ADMIN'
  ));

CREATE POLICY "Company admins can manage own requests"
  ON phishing_campaign_requests FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid() AND role = 'COMPANY_ADMIN'
    )
  );

-- RLS Policies for phishing_campaigns
CREATE POLICY "Platform admins can manage all campaigns"
  ON phishing_campaigns FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'PLATFORM_ADMIN'
  ));

CREATE POLICY "Company admins can view own campaigns"
  ON phishing_campaigns FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid() AND role = 'COMPANY_ADMIN'
    )
  );

-- RLS Policies for phishing_campaign_targets
CREATE POLICY "Platform admins can manage all targets"
  ON phishing_campaign_targets FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'PLATFORM_ADMIN'
  ));

CREATE POLICY "Company admins can view own campaign targets"
  ON phishing_campaign_targets FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM phishing_campaigns WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid() AND role = 'COMPANY_ADMIN'
      )
    )
  );

-- RLS Policies for phishing_domains
CREATE POLICY "Platform admins can manage all domains"
  ON phishing_domains FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'PLATFORM_ADMIN'
  ));

CREATE POLICY "Company admins can manage own domains"
  ON phishing_domains FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid() AND role = 'COMPANY_ADMIN'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_quotas_company ON phishing_campaign_quotas(company_id);
CREATE INDEX IF NOT EXISTS idx_campaign_requests_company ON phishing_campaign_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_campaign_requests_status ON phishing_campaign_requests(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_company ON phishing_campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_request ON phishing_campaigns(request_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign ON phishing_campaign_targets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_employee ON phishing_campaign_targets(employee_id);
CREATE INDEX IF NOT EXISTS idx_phishing_domains_company ON phishing_domains(company_id);

-- Function to auto-generate ticket numbers
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS text AS $$
DECLARE
  next_num integer;
  ticket_num text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 5) AS integer)), 0) + 1
  INTO next_num
  FROM phishing_campaign_requests
  WHERE ticket_number LIKE 'PHC-%';
  
  ticket_num := 'PHC-' || LPAD(next_num::text, 6, '0');
  RETURN ticket_num;
END;
$$ LANGUAGE plpgsql;

-- Function to deduct campaign quota
CREATE OR REPLACE FUNCTION deduct_campaign_quota()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'SUBMITTED' AND OLD.status = 'DRAFT' THEN
    UPDATE phishing_campaign_quotas
    SET used_campaigns = used_campaigns + 1,
        updated_at = now()
    WHERE company_id = NEW.company_id
      AND quota_year = EXTRACT(YEAR FROM CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-deduct quota on submission
CREATE TRIGGER trigger_deduct_campaign_quota
  AFTER UPDATE ON phishing_campaign_requests
  FOR EACH ROW
  EXECUTE FUNCTION deduct_campaign_quota();

-- Function to initialize quota for new companies
CREATE OR REPLACE FUNCTION initialize_phishing_quota()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO phishing_campaign_quotas (company_id, annual_quota, quota_year)
  VALUES (NEW.id, 4, EXTRACT(YEAR FROM CURRENT_DATE))
  ON CONFLICT (company_id, quota_year) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create quota for new companies
CREATE TRIGGER trigger_initialize_phishing_quota
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION initialize_phishing_quota();

-- Insert some default phishing templates
INSERT INTO phishing_templates (name, description, subject, html_content, category, difficulty_level) VALUES
('Password Reset Request', 'Fake password reset email', 'Urgent: Reset Your Password', '<html><body><h2>Password Reset Required</h2><p>Your password will expire in 24 hours. Click here to reset: <a href="{{.URL}}">Reset Password</a></p></body></html>', 'CREDENTIAL_HARVEST', 'EASY'),
('IT Support Ticket', 'Fake IT support email', 'IT Support: Action Required', '<html><body><h2>IT Support Request</h2><p>We need you to verify your account. Click here: <a href="{{.URL}}">Verify Account</a></p></body></html>', 'SOCIAL_ENGINEERING', 'MEDIUM'),
('CEO Urgent Request', 'Executive impersonation', 'URGENT: CEO Request', '<html><body><h2>Urgent Request from CEO</h2><p>I need you to complete this task immediately. Click here for details: <a href="{{.URL}}">View Request</a></p></body></html>', 'EXECUTIVE_IMPERSONATION', 'HARD'),
('Invoice Payment', 'Fake invoice email', 'Invoice Payment Due', '<html><body><h2>Payment Required</h2><p>Your invoice is overdue. View and pay here: <a href="{{.URL}}">View Invoice</a></p></body></html>', 'FINANCIAL', 'MEDIUM')
ON CONFLICT DO NOTHING;
