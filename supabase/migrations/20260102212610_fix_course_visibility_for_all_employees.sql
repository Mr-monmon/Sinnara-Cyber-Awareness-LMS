/*
  # Fix Course Visibility for All Employees
  
  1. Problem
    - Courses with department_ids = NULL (assigned to "all departments") weren't showing to employees
    - Employees without department_id couldn't see any courses
    - No backfill was done for existing courses
  
  2. Solution
    - Update trigger to assign courses to ALL employees when department_ids is NULL
    - Add trigger for when courses are INSERT to auto-assign
    - Backfill all existing courses to appropriate employees
  
  3. Logic
    - If course.department_ids IS NULL → assign to ALL employees in that company
    - If course.department_ids has values → assign only to employees in those departments
    - Employees without department_id can still see courses assigned to "all departments"
*/

-- Drop and recreate the trigger function with improved logic
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
      -- Assign to ALL employees in the company
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
      
      -- Remove any department-specific assignments if transitioning to all departments
      -- (This shouldn't happen often but ensures consistency)
      
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
        AND u.company_id = NEW.company_id
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
              AND u.company_id = NEW.company_id
              AND (u.department_id IS NULL OR NOT (u.department_id::text = ANY(NEW.department_ids)))
          );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for both INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_assign_courses_to_departments ON courses;
CREATE TRIGGER trigger_assign_courses_to_departments
  AFTER INSERT OR UPDATE OF department_ids ON courses
  FOR EACH ROW
  EXECUTE FUNCTION assign_courses_to_department_employees();

-- Update the new employee trigger to handle employees without departments
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
    WHERE c.company_id = NEW.company_id
      AND (
        -- Course is assigned to all departments
        (c.department_ids IS NULL)
        OR
        -- Course is assigned to this specific department (if employee has one)
        (NEW.department_id IS NOT NULL AND c.department_ids IS NOT NULL AND NEW.department_id::text = ANY(c.department_ids))
      )
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

-- BACKFILL: Assign all existing courses to appropriate employees
INSERT INTO employee_courses (employee_id, course_id, assigned_at, status)
SELECT DISTINCT
  u.id,
  c.id,
  now(),
  'ASSIGNED'
FROM users u
CROSS JOIN courses c
WHERE u.role = 'EMPLOYEE'
  AND (
    -- Course is assigned to all departments
    c.department_ids IS NULL
    OR
    -- Course is assigned to employee's specific department
    (u.department_id IS NOT NULL AND c.department_ids IS NOT NULL AND u.department_id::text = ANY(c.department_ids))
  )
  AND NOT EXISTS (
    SELECT 1 FROM employee_courses ec 
    WHERE ec.employee_id = u.id AND ec.course_id = c.id
  )
ON CONFLICT (employee_id, course_id) DO NOTHING;