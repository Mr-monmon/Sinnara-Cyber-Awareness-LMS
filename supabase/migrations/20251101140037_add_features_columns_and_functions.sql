/*
  # Add New Features and Columns

  1. New Columns
    - Add visibility control columns to courses table
    - Add completion tracking to exams
    - Add phone and company to public_assessments
    - Add subscription reminder fields
  
  2. New Functions
    - Function to auto-issue certificates
    - Function to check course prerequisites
    - Function to calculate employee progress
  
  3. Triggers
    - Auto-issue certificates on course completion
    - Update analytics on exam completion
*/

-- Add visibility and approval columns to courses
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS is_visible_to_companies boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_company_approval boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS content_type text DEFAULT 'html' CHECK (content_type IN ('html', 'markdown', 'rich_text'));

-- Add completion tracking
ALTER TABLE employee_courses
ADD COLUMN IF NOT EXISTS completion_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz;

-- Add phone and company to public_assessments
ALTER TABLE public_assessments
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS company_name text;

-- Add subscription reminder fields
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS reminder_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- Add exam prerequisite tracking
ALTER TABLE exams
ADD COLUMN IF NOT EXISTS prerequisite_course_id uuid REFERENCES courses(id) ON DELETE SET NULL;

-- Function to auto-issue certificate
CREATE OR REPLACE FUNCTION issue_certificate_on_course_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_id uuid;
  v_cert_number text;
BEGIN
  IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN
    SELECT id INTO v_template_id
    FROM certificate_templates
    WHERE course_id = NEW.course_id
    AND is_active = true
    LIMIT 1;

    IF v_template_id IS NOT NULL THEN
      v_cert_number := 'CERT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 999999)::text, 6, '0');
      
      INSERT INTO issued_certificates (
        employee_id,
        course_id,
        template_id,
        certificate_number,
        issue_date,
        issued_by
      ) VALUES (
        NEW.employee_id,
        NEW.course_id,
        v_template_id,
        v_cert_number,
        NOW(),
        NEW.employee_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-issuing certificates
DROP TRIGGER IF EXISTS trigger_issue_certificate ON employee_courses;
CREATE TRIGGER trigger_issue_certificate
  AFTER UPDATE ON employee_courses
  FOR EACH ROW
  EXECUTE FUNCTION issue_certificate_on_course_completion();

-- Function to check if employee can take exam
CREATE OR REPLACE FUNCTION can_take_exam(p_employee_id uuid, p_exam_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prerequisite_course_id uuid;
  v_course_completed boolean;
BEGIN
  SELECT prerequisite_course_id INTO v_prerequisite_course_id
  FROM exams
  WHERE id = p_exam_id;

  IF v_prerequisite_course_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM employee_courses
    WHERE employee_id = p_employee_id
    AND course_id = v_prerequisite_course_id
    AND status = 'COMPLETED'
  ) INTO v_course_completed;

  RETURN v_course_completed;
END;
$$;

-- Function to update course completion percentage
CREATE OR REPLACE FUNCTION update_course_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_sections int;
  v_completed_sections int;
  v_percentage numeric;
BEGIN
  SELECT COUNT(*) INTO v_total_sections
  FROM course_sections
  WHERE course_id = NEW.course_id;

  SELECT COUNT(*) INTO v_completed_sections
  FROM employee_section_progress
  WHERE employee_id = NEW.employee_id
  AND course_id = NEW.course_id
  AND completed = true;

  IF v_total_sections > 0 THEN
    v_percentage := ROUND((v_completed_sections::numeric / v_total_sections::numeric) * 100, 2);
  ELSE
    v_percentage := 0;
  END IF;

  UPDATE employee_courses
  SET 
    completion_percentage = v_percentage,
    status = CASE 
      WHEN v_percentage >= 100 THEN 'COMPLETED'
      WHEN v_percentage > 0 THEN 'IN_PROGRESS'
      ELSE 'NOT_STARTED'
    END,
    completed_at = CASE 
      WHEN v_percentage >= 100 AND completed_at IS NULL THEN NOW()
      ELSE completed_at
    END,
    last_accessed_at = NOW()
  WHERE employee_id = NEW.employee_id
  AND course_id = NEW.course_id;

  RETURN NEW;
END;
$$;

-- Create trigger for updating course completion
DROP TRIGGER IF EXISTS trigger_update_course_completion ON employee_section_progress;
CREATE TRIGGER trigger_update_course_completion
  AFTER INSERT OR UPDATE ON employee_section_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_course_completion();

-- Create indexes for better performance on new columns
CREATE INDEX IF NOT EXISTS idx_courses_visibility ON courses(is_visible_to_companies) WHERE is_visible_to_companies = true;
CREATE INDEX IF NOT EXISTS idx_employee_courses_completion ON employee_courses(completion_percentage) WHERE completion_percentage >= 100;
CREATE INDEX IF NOT EXISTS idx_subscriptions_reminder ON subscriptions(reminder_sent) WHERE reminder_sent = false;
CREATE INDEX IF NOT EXISTS idx_exams_prerequisite ON exams(prerequisite_course_id) WHERE prerequisite_course_id IS NOT NULL;
