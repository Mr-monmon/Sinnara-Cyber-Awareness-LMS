/*
  # Fix Exam Assignment Tracking and Prevent Duplicates V4

  1. Changes
    - Add assignment_id to exam_results for proper attempt tracking
    - Clean existing duplicates FIRST (mark as expired)
    - Add unique constraints to prevent future duplicates
    - Create helper functions for exam access checking
    - Create views for employees and admins
    - Fix certificate generation trigger

  2. New Features
    - Link all exam attempts to their assignment
    - Auto-filter passed exams from employee view
    - Track multiple attempts per assignment properly
    - Show improvement metrics across attempts
    - Prevent duplicate exam assignments

  3. Security
    - Proper indexes for performance
*/

-- ==========================================
-- Step 1: Add Assignment Tracking Column
-- ==========================================

-- Add assignment_id to exam_results if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exam_results' AND column_name = 'assignment_id'
  ) THEN
    ALTER TABLE exam_results ADD COLUMN assignment_id uuid REFERENCES assigned_exams(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_exam_results_assignment ON exam_results(assignment_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_employee_exam ON exam_results(employee_id, exam_id);

-- ==========================================
-- Step 2: Clean Existing Duplicates FIRST
-- ==========================================

-- Mark duplicate employee assignments as expired (keep most recent)
WITH ranked_assignments AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY exam_id, assigned_to_employee, company_id 
    ORDER BY assigned_at DESC
  ) as rn
  FROM assigned_exams 
  WHERE status = 'active' AND assigned_to_employee IS NOT NULL
)
UPDATE assigned_exams SET status = 'expired'
WHERE id IN (SELECT id FROM ranked_assignments WHERE rn > 1);

-- Mark duplicate department assignments as expired (keep most recent)
WITH ranked_dept_assignments AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY exam_id, assigned_to_department, company_id 
    ORDER BY assigned_at DESC
  ) as rn
  FROM assigned_exams 
  WHERE status = 'active' AND assigned_to_department IS NOT NULL
)
UPDATE assigned_exams SET status = 'expired'
WHERE id IN (SELECT id FROM ranked_dept_assignments WHERE rn > 1);

-- ==========================================
-- Step 3: NOW Add Unique Constraints
-- ==========================================

-- Drop existing indexes if they exist (to recreate them)
DROP INDEX IF EXISTS idx_unique_employee_exam_assignment;
DROP INDEX IF EXISTS idx_unique_department_exam_assignment;

-- Unique constraint: one active assignment per exam+employee
CREATE UNIQUE INDEX idx_unique_employee_exam_assignment 
ON assigned_exams(exam_id, assigned_to_employee, company_id) 
WHERE assigned_to_employee IS NOT NULL AND status = 'active';

-- Unique constraint: one active assignment per exam+department
CREATE UNIQUE INDEX idx_unique_department_exam_assignment 
ON assigned_exams(exam_id, assigned_to_department, company_id) 
WHERE assigned_to_department IS NOT NULL AND status = 'active';

-- ==========================================
-- Step 4: Helper Function - Check Exam Access
-- ==========================================

CREATE OR REPLACE FUNCTION employee_has_exam_access(p_employee_id uuid, p_exam_id uuid)
RETURNS TABLE(
  assignment_id uuid,
  max_attempts integer,
  attempts_used integer,
  can_take_exam boolean,
  has_passed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH employee_assignments AS (
    SELECT ae.id as assignment_id, ae.exam_id, ae.max_attempts, ae.status
    FROM assigned_exams ae
    LEFT JOIN users u ON u.id = p_employee_id
    WHERE ae.exam_id = p_exam_id AND ae.status = 'active'
      AND (ae.assigned_to_employee = p_employee_id OR ae.assigned_to_department = u.department_id)
    LIMIT 1
  ),
  attempt_stats AS (
    SELECT ea.assignment_id, ea.max_attempts,
      COUNT(er.id) as attempts_used,
      BOOL_OR(er.passed) as has_passed
    FROM employee_assignments ea
    LEFT JOIN exam_results er ON er.assignment_id = ea.assignment_id AND er.employee_id = p_employee_id
    GROUP BY ea.assignment_id, ea.max_attempts
  )
  SELECT 
    ast.assignment_id, 
    ast.max_attempts,
    COALESCE(ast.attempts_used, 0)::integer,
    (COALESCE(ast.attempts_used, 0) < ast.max_attempts AND NOT COALESCE(ast.has_passed, false)),
    COALESCE(ast.has_passed, false)
  FROM attempt_stats ast;
END;
$$;

-- ==========================================
-- Step 5: View for Available Exams
-- ==========================================

DROP VIEW IF EXISTS employee_available_exams;
CREATE VIEW employee_available_exams AS
SELECT DISTINCT
  u.id as employee_id, 
  e.id as exam_id, 
  e.title, 
  e.description,
  e.time_limit_minutes, 
  e.passing_score,
  e.exam_type,
  e.prerequisite_course_id,
  ae.id as assignment_id, 
  ae.due_date, 
  ae.max_attempts, 
  ae.is_mandatory,
  COUNT(er.id) as attempts_used, 
  BOOL_OR(er.passed) as has_passed
FROM users u
CROSS JOIN exams e
INNER JOIN assigned_exams ae ON (
  ae.exam_id = e.id AND ae.status = 'active'
  AND (ae.assigned_to_employee = u.id OR ae.assigned_to_department = u.department_id)
)
LEFT JOIN exam_results er ON (er.assignment_id = ae.id AND er.employee_id = u.id)
GROUP BY 
  u.id, e.id, e.title, e.description, e.time_limit_minutes, 
  e.passing_score, e.exam_type, e.prerequisite_course_id,
  ae.id, ae.due_date, ae.max_attempts, ae.is_mandatory
HAVING NOT COALESCE(BOOL_OR(er.passed), false);

-- ==========================================
-- Step 6: View for Admin Analytics
-- ==========================================

DROP VIEW IF EXISTS exam_attempts_detail;
CREATE VIEW exam_attempts_detail AS
SELECT 
  er.id as result_id, 
  er.employee_id, 
  u.full_name as employee_name,
  u.email as employee_email, 
  d.name as department_name,
  er.exam_id, 
  e.title as exam_title, 
  er.assignment_id,
  er.score, 
  er.total_questions, 
  er.percentage, 
  er.passed,
  er.started_at, 
  er.completed_at,
  ROW_NUMBER() OVER (PARTITION BY er.assignment_id, er.employee_id ORDER BY er.completed_at) as attempt_number,
  ae.max_attempts, 
  ae.due_date,
  ae.company_id
FROM exam_results er
JOIN users u ON u.id = er.employee_id
LEFT JOIN departments d ON d.id = u.department_id
JOIN exams e ON e.id = er.exam_id
LEFT JOIN assigned_exams ae ON ae.id = er.assignment_id
ORDER BY er.completed_at DESC;

-- ==========================================
-- Step 7: Fix Certificate Generation
-- ==========================================

CREATE OR REPLACE FUNCTION issue_certificate_on_course_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_id uuid;
  v_cert_number text;
  v_employee_name text;
  v_course_name text;
BEGIN
  IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN
    -- Get employee name
    SELECT full_name INTO v_employee_name
    FROM users
    WHERE id = NEW.employee_id;
    
    -- Get course name
    SELECT title INTO v_course_name
    FROM courses
    WHERE id = NEW.course_id;
    
    -- Try to get template if exists
    SELECT id INTO v_template_id
    FROM certificate_templates
    WHERE course_id = NEW.course_id
    AND is_active = true
    LIMIT 1;

    -- Generate certificate number
    v_cert_number := 'CERT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 999999)::text, 6, '0');

    -- Insert certificate
    INSERT INTO issued_certificates (
      employee_id,
      course_id,
      template_id,
      certificate_number,
      employee_name,
      course_name,
      completion_date,
      issued_by
    ) VALUES (
      NEW.employee_id,
      NEW.course_id,
      v_template_id,
      v_cert_number,
      v_employee_name,
      v_course_name,
      CURRENT_DATE,
      NEW.employee_id
    )
    ON CONFLICT (employee_id, course_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger is properly set up
DROP TRIGGER IF EXISTS trigger_issue_certificate ON employee_courses;
CREATE TRIGGER trigger_issue_certificate
  AFTER UPDATE ON employee_courses
  FOR EACH ROW
  EXECUTE FUNCTION issue_certificate_on_course_completion();

-- Create unique constraint on certificates
DROP INDEX IF EXISTS idx_unique_certificate;
CREATE UNIQUE INDEX idx_unique_certificate 
ON issued_certificates(employee_id, course_id);