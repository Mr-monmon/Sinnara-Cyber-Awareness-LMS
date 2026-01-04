/*
  # Platform Administrator Enhanced Features

  1. Enhanced Tables
    - `companies` table updates:
      - Add admin contact information (admin_name, admin_email, admin_phone)
      - Add subscription management (subscription_type, subscription_start, subscription_end, is_active)
      - Add billing information (total_amount, payment_status, invoice_number)
    
    - New `subscriptions` table for tracking subscription history
      - subscription_type (POC_3M, MONTHLY_6, YEARLY_1, YEARLY_2, CUSTOM)
      - start_date, end_date
      - amount, currency
      - status (ACTIVE, EXPIRED, CANCELLED)
    
    - New `invoices` table for billing management
      - invoice_number, issue_date, due_date
      - amount, tax, total
      - status (PENDING, PAID, OVERDUE, CANCELLED)
      - payment details
    
    - New `audit_logs` table for activity tracking
      - user_id, action_type, entity_type, entity_id
      - old_value, new_value (JSONB)
      - ip_address, user_agent
      - timestamp
    
    - Add `department` field to users table

  2. Security
    - Enable RLS on all new tables
    - Add policies for platform admins only
    - Ensure data security and access control

  3. Indexes
    - Add indexes for faster queries on company_id, user_id
    - Add indexes on timestamps for audit logs
*/

-- Add new fields to companies table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'admin_name') THEN
    ALTER TABLE companies ADD COLUMN admin_name text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'admin_email') THEN
    ALTER TABLE companies ADD COLUMN admin_email text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'admin_phone') THEN
    ALTER TABLE companies ADD COLUMN admin_phone text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'subscription_type') THEN
    ALTER TABLE companies ADD COLUMN subscription_type text DEFAULT 'POC_3M' CHECK (subscription_type IN ('POC_3M', 'MONTHLY_6', 'YEARLY_1', 'YEARLY_2', 'CUSTOM'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'subscription_start') THEN
    ALTER TABLE companies ADD COLUMN subscription_start timestamptz DEFAULT now();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'subscription_end') THEN
    ALTER TABLE companies ADD COLUMN subscription_end timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'is_active') THEN
    ALTER TABLE companies ADD COLUMN is_active boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'status') THEN
    ALTER TABLE companies ADD COLUMN status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED'));
  END IF;
END $$;

-- Add department to users table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'department') THEN
    ALTER TABLE users ADD COLUMN department text;
  END IF;
END $$;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_type text NOT NULL CHECK (subscription_type IN ('POC_3M', 'MONTHLY_6', 'YEARLY_1', 'YEARLY_2', 'CUSTOM')),
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL,
  license_count integer NOT NULL DEFAULT 10,
  amount decimal(10,2) DEFAULT 0,
  currency text DEFAULT 'SAR',
  status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING')),
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id),
  invoice_number text UNIQUE NOT NULL,
  issue_date timestamptz NOT NULL DEFAULT now(),
  due_date timestamptz NOT NULL,
  amount decimal(10,2) NOT NULL,
  tax decimal(10,2) DEFAULT 0,
  total decimal(10,2) NOT NULL,
  currency text DEFAULT 'SAR',
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED')),
  payment_method text,
  payment_date timestamptz,
  payment_reference text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  user_email text,
  user_role text,
  action_type text NOT NULL CHECK (action_type IN (
    'CREATE', 'UPDATE', 'DELETE', 
    'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
    'ROLE_CHANGE', 'ASSIGN_COURSE', 'ASSIGN_EXAM',
    'COMPLETE_COURSE', 'COMPLETE_EXAM',
    'CREATE_COMPANY', 'UPDATE_COMPANY', 'DELETE_COMPANY',
    'CREATE_USER', 'UPDATE_USER', 'DELETE_USER',
    'UPLOAD_EMPLOYEES', 'EXPORT_DATA'
  )),
  entity_type text CHECK (entity_type IN ('USER', 'COMPANY', 'COURSE', 'EXAM', 'SUBSCRIPTION', 'INVOICE', 'EMPLOYEE')),
  entity_id uuid,
  entity_name text,
  old_value jsonb DEFAULT '{}'::jsonb,
  new_value jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions (Platform Admin only)
CREATE POLICY "Platform admins can manage all subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'PLATFORM_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'PLATFORM_ADMIN'
    )
  );

CREATE POLICY "Company admins can view their subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'COMPANY_ADMIN'
      AND users.company_id = subscriptions.company_id
    )
  );

-- RLS Policies for invoices (Platform Admin only)
CREATE POLICY "Platform admins can manage all invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'PLATFORM_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'PLATFORM_ADMIN'
    )
  );

CREATE POLICY "Company admins can view their invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'COMPANY_ADMIN'
      AND users.company_id = invoices.company_id
    )
  );

-- RLS Policies for audit_logs (Platform Admin only)
CREATE POLICY "Platform admins can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'PLATFORM_ADMIN'
    )
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_dates ON subscriptions(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_dates ON invoices(issue_date, due_date);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Function to auto-generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  next_num integer;
  invoice_num text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS integer)), 0) + 1
  INTO next_num
  FROM invoices
  WHERE invoice_number LIKE 'INV-%';
  
  invoice_num := 'INV-' || LPAD(next_num::text, 6, '0');
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;
