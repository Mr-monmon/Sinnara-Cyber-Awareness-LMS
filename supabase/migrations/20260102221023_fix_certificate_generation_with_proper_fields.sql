/*
  # Fix Certificate Generation with Proper Fields
  
  1. Problem
    - Trigger function uses wrong column names
    - Table has employee_name, course_name, completion_date
    - Function was trying to use issue_date, expiry_date
  
  2. Solution
    - Update trigger to use correct column names
    - Fetch employee and course names
    - Set completion_date properly
*/

-- Update function to auto-issue certificate with correct fields
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

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_issue_certificate ON employee_courses;
CREATE TRIGGER trigger_issue_certificate
  AFTER UPDATE ON employee_courses
  FOR EACH ROW
  EXECUTE FUNCTION issue_certificate_on_course_completion();