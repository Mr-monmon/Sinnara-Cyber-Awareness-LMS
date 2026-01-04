/*
  # Fix Quota Deduction and Add Activity Tracking
  
  1. Changes
    - Fix quota deduction to work on INSERT with SUBMITTED status
    - Add login tracking table for analytics
    - Add activity tracking for courses and exams
    - Add last_login to users table
  
  2. Security
    - RLS disabled to match system pattern
*/

-- Add last_login to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE users ADD COLUMN last_login timestamptz;
  END IF;
END $$;

-- Create login activity tracking table
CREATE TABLE IF NOT EXISTS login_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  login_time timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Disable RLS for login_activity
ALTER TABLE login_activity DISABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_login_activity_user ON login_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_login_activity_company ON login_activity(company_id);
CREATE INDEX IF NOT EXISTS idx_login_activity_date ON login_activity(login_time);

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trigger_deduct_campaign_quota ON phishing_campaign_requests;

-- Recreate quota deduction function to handle INSERT
CREATE OR REPLACE FUNCTION deduct_campaign_quota()
RETURNS TRIGGER AS $$
BEGIN
  -- Deduct on INSERT if status is SUBMITTED
  IF (TG_OP = 'INSERT' AND NEW.status = 'SUBMITTED') THEN
    UPDATE phishing_campaign_quotas
    SET used_campaigns = used_campaigns + 1,
        updated_at = now()
    WHERE company_id = NEW.company_id
      AND quota_year = EXTRACT(YEAR FROM CURRENT_DATE);
  END IF;
  
  -- Deduct on UPDATE if changing from DRAFT to SUBMITTED
  IF (TG_OP = 'UPDATE' AND OLD.status = 'DRAFT' AND NEW.status = 'SUBMITTED') THEN
    UPDATE phishing_campaign_quotas
    SET used_campaigns = used_campaigns + 1,
        updated_at = now()
    WHERE company_id = NEW.company_id
      AND quota_year = EXTRACT(YEAR FROM CURRENT_DATE);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER trigger_deduct_campaign_quota
  AFTER INSERT OR UPDATE ON phishing_campaign_requests
  FOR EACH ROW
  EXECUTE FUNCTION deduct_campaign_quota();

-- Add department_ids to courses table for department-specific assignment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'courses' AND column_name = 'department_ids'
  ) THEN
    ALTER TABLE courses ADD COLUMN department_ids text[];
  END IF;
END $$;

-- Add department_ids to exams table for department-specific assignment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'exams' AND column_name = 'department_ids'
  ) THEN
    ALTER TABLE exams ADD COLUMN department_ids text[];
  END IF;
END $$;

-- Function to track login activity
CREATE OR REPLACE FUNCTION track_user_login(p_user_id uuid, p_company_id uuid)
RETURNS void AS $$
BEGIN
  -- Update last_login
  UPDATE users 
  SET last_login = now() 
  WHERE id = p_user_id;
  
  -- Insert login activity
  INSERT INTO login_activity (user_id, company_id, login_time)
  VALUES (p_user_id, p_company_id, now());
END;
$$ LANGUAGE plpgsql;
