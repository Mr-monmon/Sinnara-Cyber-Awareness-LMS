/*
  # Comprehensive System Fixes - Schema Updates

  1. Tables Modified
    - `assigned_exams`: Add withdrawal tracking columns
    - `phishing_campaigns`: Add rejection/approval tracking columns, update status values
    
  2. New Tables
    - `course_section_progress`: Track individual section completion for employees
    
  3. Status Updates
    - Update phishing campaign status values to new workflow
    
  4. Indexes
    - Add performance indexes for section progress tracking
    
  5. Security
    - Enable RLS on new tables
    - Add appropriate policies
*/

-- 1. Add withdrawal tracking to assigned_exams
ALTER TABLE assigned_exams 
ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
ADD COLUMN IF NOT EXISTS withdrawn_by uuid REFERENCES users(id);

-- 2. Create course section progress tracking table
CREATE TABLE IF NOT EXISTS course_section_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, section_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_section_progress_employee ON course_section_progress(employee_id);
CREATE INDEX IF NOT EXISTS idx_section_progress_course ON course_section_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_section_progress_section ON course_section_progress(section_id);

-- Enable RLS
ALTER TABLE course_section_progress ENABLE ROW LEVEL SECURITY;

-- Allow employees to read and update their own progress
CREATE POLICY "Employees can view own section progress"
ON course_section_progress
FOR SELECT
TO anon, authenticated
USING (employee_id::text = current_setting('app.user_id', true));

CREATE POLICY "Employees can update own section progress"
ON course_section_progress
FOR INSERT
TO anon, authenticated
WITH CHECK (employee_id::text = current_setting('app.user_id', true));

CREATE POLICY "Employees can upsert own section progress"
ON course_section_progress
FOR UPDATE
TO anon, authenticated
USING (employee_id::text = current_setting('app.user_id', true))
WITH CHECK (employee_id::text = current_setting('app.user_id', true));

-- 3. Add rejection/approval tracking to phishing campaigns
ALTER TABLE phishing_campaigns
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS started_at timestamptz,
ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- 4. Update phishing campaign status values
-- First, map old values to new values
UPDATE phishing_campaigns SET status = 'SUBMITTED' WHERE status IN ('pending', 'draft', 'created');
UPDATE phishing_campaigns SET status = 'APPROVED' WHERE status = 'active';
UPDATE phishing_campaigns SET status = 'RUNNING' WHERE status = 'in_progress';
UPDATE phishing_campaigns SET status = 'COMPLETED' WHERE status IN ('finished', 'completed');

-- Drop old constraint if exists
ALTER TABLE phishing_campaigns DROP CONSTRAINT IF EXISTS phishing_campaigns_status_check;

-- Add new constraint with updated status values
ALTER TABLE phishing_campaigns
ADD CONSTRAINT phishing_campaigns_status_check 
CHECK (status IN ('SUBMITTED', 'APPROVED', 'RUNNING', 'COMPLETED', 'REJECTED'));

-- 5. Update assigned_exams status constraint to include withdrawn
ALTER TABLE assigned_exams DROP CONSTRAINT IF EXISTS assigned_exams_status_check;
ALTER TABLE assigned_exams
ADD CONSTRAINT assigned_exams_status_check 
CHECK (status IN ('active', 'completed', 'expired', 'withdrawn'));
