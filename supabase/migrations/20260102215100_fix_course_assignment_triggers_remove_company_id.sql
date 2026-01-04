/*
  # Fix Course Assignment Triggers - Remove Company ID Reference
  
  1. Problem
    - Triggers reference NEW.company_id but courses table doesn't have company_id
    - This causes department assignment updates to fail
    - Courses are platform-wide content, not company-specific
  
  2. Solution
    - Remove company_id references from trigger functions
    - Use departments to determine which employees to assign to
    - Departments belong to companies, so this properly isolates data
*/

-- Drop and recreate the trigger function without company_id reference
DROP FUNCTION IF EXISTS public.assign_courses_to_department_employees() CASCADE;

CREATE OR REPLACE FUNCTION public.assign_courses_to_department_employees()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- For INSERT or when department_ids changes
  IF (TG_OP = 'INSERT') OR (NEW.department_ids IS DISTINCT FROM OLD.department_ids) THEN
    
    -- If course is assigned to all departments (department_ids is NULL)
    IF NEW.department_ids IS NULL THEN
      -- Assign to ALL employees across all companies
      INSERT INTO employee_courses (employee_id, course_id, assigned_at, status)
      SELECT 
        u.id,
        NEW.id,
        now(),
        'ASSIGNED'
      FROM users u
      WHERE u.role = 'EMPLOYEE'
        AND NOT EXISTS (
          SELECT 1 FROM employee_courses ec 
          WHERE ec.employee_id = u.id AND ec.course_id = NEW.id
        )
      ON CONFLICT (employee_id, course_id) DO NOTHING;
      
    -- If course is assigned to specific departments
    ELSIF NEW.department_ids IS NOT NULL AND array_length(NEW.department_ids, 1) > 0 THEN
      -- Insert employee_courses for all employees in those departments
      INSERT INTO employee_courses (employee_id, course_id, assigned_at, status)
      SELECT 
        u.id,
        NEW.id,
        now(),
        'ASSIGNED'
      FROM users u
      WHERE u.role = 'EMPLOYEE'
        AND u.department_id IS NOT NULL
        AND u.department_id::text = ANY(NEW.department_ids)
        AND NOT EXISTS (
          SELECT 1 FROM employee_courses ec 
          WHERE ec.employee_id = u.id AND ec.course_id = NEW.id
        )
      ON CONFLICT (employee_id, course_id) DO NOTHING;
      
      -- Remove employees who are no longer in assigned departments
      IF TG_OP = 'UPDATE' THEN
        DELETE FROM employee_courses
        WHERE course_id = NEW.id
          AND employee_id IN (
            SELECT u.id FROM users u 
            WHERE u.role = 'EMPLOYEE'
              AND (u.department_id IS NULL OR NOT (u.department_id::text = ANY(NEW.department_ids)))
          );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_assign_courses_to_departments ON courses;
CREATE TRIGGER trigger_assign_courses_to_departments
  AFTER INSERT OR UPDATE OF department_ids ON courses
  FOR EACH ROW
  EXECUTE FUNCTION assign_courses_to_department_employees();

-- Update the new employee trigger to not reference company_id on courses
DROP FUNCTION IF EXISTS public.assign_courses_to_new_employee() CASCADE;

CREATE OR REPLACE FUNCTION public.assign_courses_to_new_employee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Only process for employees
  IF NEW.role = 'EMPLOYEE' THEN
    -- Assign courses based on department
    INSERT INTO employee_courses (employee_id, course_id, assigned_at, status)
    SELECT 
      NEW.id,
      c.id,
      now(),
      'ASSIGNED'
    FROM courses c
    WHERE 
      -- Course is assigned to all departments
      (c.department_ids IS NULL)
      OR
      -- Course is assigned to this specific department (if employee has one)
      (NEW.department_id IS NOT NULL AND c.department_ids IS NOT NULL AND NEW.department_id::text = ANY(c.department_ids))
    ON CONFLICT (employee_id, course_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate triggers for new employee
DROP TRIGGER IF EXISTS trigger_assign_courses_to_new_employee ON users;
CREATE TRIGGER trigger_assign_courses_to_new_employee
  AFTER INSERT ON users
  FOR EACH ROW
  WHEN (NEW.role = 'EMPLOYEE')
  EXECUTE FUNCTION assign_courses_to_new_employee();

-- Trigger for when employee department changes
DROP TRIGGER IF EXISTS trigger_assign_courses_on_department_change ON users;
CREATE TRIGGER trigger_assign_courses_on_department_change
  AFTER UPDATE OF department_id ON users
  FOR EACH ROW
  WHEN (NEW.role = 'EMPLOYEE' AND (OLD.department_id IS DISTINCT FROM NEW.department_id))
  EXECUTE FUNCTION assign_courses_to_new_employee();