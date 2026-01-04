/*
  # Create Fraud Alerts Schema

  1. New Tables
    - `fraud_alerts`
      - `id` (uuid, primary key)
      - `title` (text) - Alert title
      - `fraud_type` (text) - Type of fraud (SMS, WhatsApp, Banking, etc.)
      - `severity` (text) - Severity level: LOW, MEDIUM, HIGH
      - `public_summary` (text) - Public-facing summary
      - `internal_content` (text) - Full internal details for employees
      - `video_url` (text) - Link to awareness video
      - `safety_tips` (text[]) - Array of safety tips for public
      - `internal_steps` (text[]) - Array of action steps for employees
      - `is_published` (boolean) - Whether alert is published
      - `created_by` (uuid) - Admin who created the alert
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `fraud_alert_acknowledgments`
      - `id` (uuid, primary key)
      - `alert_id` (uuid, foreign key to fraud_alerts)
      - `user_id` (uuid, foreign key to users)
      - `acknowledged_at` (timestamp)

  2. Security
    - RLS disabled for all tables (using custom auth)
    - Public can read published fraud_alerts
    - Employees can acknowledge alerts
    - Platform admins can manage all alerts

  3. Indexes
    - Index on `is_published` for performance
    - Index on `created_at` for sorting
    - Composite index on acknowledgments for quick lookup
*/

-- Create fraud_alerts table
CREATE TABLE IF NOT EXISTS fraud_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  fraud_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  public_summary text NOT NULL,
  internal_content text NOT NULL,
  video_url text,
  safety_tips text[] DEFAULT '{}',
  internal_steps text[] DEFAULT '{}',
  is_published boolean DEFAULT false,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create fraud_alert_acknowledgments table
CREATE TABLE IF NOT EXISTS fraud_alert_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES fraud_alerts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at timestamptz DEFAULT now(),
  UNIQUE(alert_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_published ON fraud_alerts(is_published);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_created ON fraud_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_acknowledgments_user ON fraud_alert_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_acknowledgments_alert ON fraud_alert_acknowledgments(alert_id);

-- Create updated_at trigger for fraud_alerts
CREATE OR REPLACE FUNCTION update_fraud_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_fraud_alerts_updated_at'
  ) THEN
    CREATE TRIGGER set_fraud_alerts_updated_at
      BEFORE UPDATE ON fraud_alerts
      FOR EACH ROW
      EXECUTE FUNCTION update_fraud_alerts_updated_at();
  END IF;
END $$;
