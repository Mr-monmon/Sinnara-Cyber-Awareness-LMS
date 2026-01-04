/*
  # Fix Trigger Functions for Content Assignment
  
  1. Problem
    - Trigger functions were incorrectly recreated as regular functions with parameters
    - Triggers expect TRIGGER return type functions, not void return functions
    - This broke automatic course and exam assignment to employees
  
  2. Solution
    - Drop the incorrectly created parameterized functions
    - Recreate trigger functions with correct TRIGGER return type
    - Ensure triggers are properly attached
  
  3. Functions Fixed
    - assign_courses_to_department_employees() - Now returns TRIGGER
    - assign_exams_to_department_employees() - Now returns TRIGGER  
    - assign_courses_to_new_employee() - Now returns TRIGGER
  
  4. Behavior
    - When a course's department_ids change, automatically assign to employees in those departments
    - When an exam is assigned to a department, create individual assignments for employees
    - When a new employee is created with a department, assign relevant courses automatically
*/

-- Drop the incorrectly created parameterized versions
DROP FUNCTION IF EXISTS public.assign_courses_to_department_employees(uuid, uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.assign_exams_to_department_employees(uuid, uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.assign_courses_to_new_employee() CASCADE;

-- Recreate assign_courses_to_department_employees as proper trigger function
CREATE OR REPLACE FUNCTION public.assign_courses_to_department_employees()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- When department_ids changes on a course, sync employee_courses
  IF (NEW.department_ids IS DISTINCT FROM OLD.department_ids) OR (OLD.department_ids IS NULL AND NEW.department_ids IS NOT NULL) THEN
    
    -- If course is now assigned to specific departments
    IF NEW.department_ids IS NOT NULL AND array_length(NEW.department_ids, 1) > 0 THEN
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
      DELETE FROM employee_courses
      WHERE course_id = NEW.id
        AND employee_id IN (
          SELECT u.id FROM users u 
          WHERE u.role = 'EMPLOYEE'
            AND (u.department_id IS NULL OR NOT (u.department_id::text = ANY(NEW.department_ids)))
        );
        
    -- If course is now assigned to all departments (department_ids is NULL)
    ELSIF NEW.department_ids IS NULL THEN
      -- Assign to all employees
      INSERT INTO employee_courses (employee_id, course_id, assigned_at, status)
      SELECT 
        u.id,
        NEW.id,
        now(),
        'ASSIGNED'
      FROM users u
      WHERE u.role = 'EMPLOYEE'
        AND u.company_id = NEW.company_id
        AND NOT EXISTS (
          SELECT 1 FROM employee_courses ec 
          WHERE ec.employee_id = u.id AND ec.course_id = NEW.id
        )
      ON CONFLICT (employee_id, course_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate assign_exams_to_department_employees as proper trigger function
CREATE OR REPLACE FUNCTION public.assign_exams_to_department_employees()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  emp_record RECORD;
BEGIN
  -- If an exam is assigned to a department, create individual assignments for each employee
  IF NEW.assigned_to_department IS NOT NULL THEN
    FOR emp_record IN 
      SELECT id FROM users 
      WHERE role = 'EMPLOYEE' 
        AND department_id = NEW.assigned_to_department
        AND company_id = NEW.company_id
    LOOP
      -- Insert individual employee assignment only if it doesn't exist
      INSERT INTO assigned_exams (
        exam_id,
        company_id,
        assigned_by,
        assigned_to_employee,
        due_date,
        max_attempts,
        is_mandatory,
        status,
        assigned_at
      )
      VALUES (
        NEW.exam_id,
        NEW.company_id,
        NEW.assigned_by,
        emp_record.id,
        NEW.due_date,
        NEW.max_attempts,
        NEW.is_mandatory,
        'active',
        now()
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate assign_courses_to_new_employee as proper trigger function
CREATE OR REPLACE FUNCTION public.assign_courses_to_new_employee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Only process for employees with a department
  IF NEW.role = 'EMPLOYEE' AND NEW.department_id IS NOT NULL THEN
    -- Assign courses that are available to this employee's department
    INSERT INTO employee_courses (employee_id, course_id, assigned_at, status)
    SELECT 
      NEW.id,
      c.id,
      now(),
      'ASSIGNED'
    FROM courses c
    WHERE 
      c.company_id = NEW.company_id
      AND (
        -- Course is assigned to all departments
        (c.department_ids IS NULL)
        OR
        -- Course is assigned to this specific department
        (c.department_ids IS NOT NULL AND NEW.department_id::text = ANY(c.department_ids))
      )
    ON CONFLICT (employee_id, course_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Ensure triggers are properly created
DROP TRIGGER IF EXISTS trigger_assign_courses_to_departments ON courses;
CREATE TRIGGER trigger_assign_courses_to_departments
  AFTER UPDATE OF department_ids ON courses
  FOR EACH ROW
  EXECUTE FUNCTION assign_courses_to_department_employees();

DROP TRIGGER IF EXISTS trigger_assign_exams_to_department_employees ON assigned_exams;
CREATE TRIGGER trigger_assign_exams_to_department_employees
  AFTER INSERT ON assigned_exams
  FOR EACH ROW
  WHEN (NEW.assigned_to_department IS NOT NULL)
  EXECUTE FUNCTION assign_exams_to_department_employees();

DROP TRIGGER IF EXISTS trigger_assign_courses_to_new_employee ON users;
CREATE TRIGGER trigger_assign_courses_to_new_employee
  AFTER INSERT ON users
  FOR EACH ROW
  WHEN (NEW.role = 'EMPLOYEE')
  EXECUTE FUNCTION assign_courses_to_new_employee();

-- Also add trigger for when employee department changes
DROP TRIGGER IF EXISTS trigger_assign_courses_on_department_change ON users;
CREATE TRIGGER trigger_assign_courses_on_department_change
  AFTER UPDATE OF department_id ON users
  FOR EACH ROW
  WHEN (NEW.role = 'EMPLOYEE' AND NEW.department_id IS NOT NULL AND (OLD.department_id IS NULL OR OLD.department_id != NEW.department_id))
  EXECUTE FUNCTION assign_courses_to_new_employee();