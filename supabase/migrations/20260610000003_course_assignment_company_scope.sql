-- Fix: course assignment ignored company scoping.
--
-- The legacy triggers assigned courses to employees based on the platform-level
-- courses.department_ids array, ignoring company_courses entirely. Any course
-- with department_ids = NULL was assigned to EVERY employee in EVERY company,
-- so companies saw courses they were never given (and empty courses showed up
-- on employees / reports).
--
-- Correct model (matches CourseAssignmentPage):
--   An employee (role EMPLOYEE, company C, dept D) is assigned course X iff
--     1. X is in company_courses for company C, AND
--     2. (no company_course_departments rows for (C, X)  => all departments)
--        OR a company_course_departments row exists for (C, X, D).
--
-- Cleanup is conservative: only ASSIGNED rows with zero progress are removed.
-- IN_PROGRESS / COMPLETED rows (and their certificates) are preserved even if
-- the course is no longer in scope, so no learning history is destroyed.

-- ============================================================================
-- 1) Core: re-sync one employee's course assignments
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_employee_courses(p_employee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_dept    uuid;
  v_role    text;
BEGIN
  SELECT company_id, department_id, role
    INTO v_company, v_dept, v_role
  FROM users WHERE id = p_employee_id;

  IF v_role IS DISTINCT FROM 'EMPLOYEE' OR v_company IS NULL THEN
    RETURN;
  END IF;

  -- Add newly-eligible company courses as ASSIGNED
  INSERT INTO employee_courses (employee_id, course_id, assigned_at, status)
  SELECT p_employee_id, cc.course_id, now(), 'ASSIGNED'
  FROM company_courses cc
  WHERE cc.company_id = v_company
    AND (
      NOT EXISTS (
        SELECT 1 FROM company_course_departments ccd
        WHERE ccd.company_id = v_company AND ccd.course_id = cc.course_id
      )
      OR EXISTS (
        SELECT 1 FROM company_course_departments ccd
        WHERE ccd.company_id = v_company AND ccd.course_id = cc.course_id
          AND ccd.department_id = v_dept
      )
    )
  ON CONFLICT (employee_id, course_id) DO NOTHING;

  -- Remove no-longer-eligible courses, but ONLY untouched ASSIGNED rows
  DELETE FROM employee_courses ec
  WHERE ec.employee_id = p_employee_id
    AND ec.status = 'ASSIGNED'
    AND COALESCE(ec.progress_percentage, 0) = 0
    AND COALESCE(ec.completed_sections, 0) = 0
    AND NOT EXISTS (
      SELECT 1 FROM company_courses cc
      WHERE cc.company_id = v_company AND cc.course_id = ec.course_id
        AND (
          NOT EXISTS (
            SELECT 1 FROM company_course_departments ccd
            WHERE ccd.company_id = v_company AND ccd.course_id = cc.course_id
          )
          OR EXISTS (
            SELECT 1 FROM company_course_departments ccd
            WHERE ccd.company_id = v_company AND ccd.course_id = cc.course_id
              AND ccd.department_id = v_dept
          )
        )
    );
END;
$$;

-- ============================================================================
-- 2) Core: re-sync one (company, course) pair across all its employees
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_company_course(p_company_id uuid, p_course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add for eligible employees
  INSERT INTO employee_courses (employee_id, course_id, assigned_at, status)
  SELECT u.id, p_course_id, now(), 'ASSIGNED'
  FROM users u
  WHERE u.company_id = p_company_id
    AND u.role = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM company_courses cc
      WHERE cc.company_id = p_company_id AND cc.course_id = p_course_id
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM company_course_departments ccd
        WHERE ccd.company_id = p_company_id AND ccd.course_id = p_course_id
      )
      OR EXISTS (
        SELECT 1 FROM company_course_departments ccd
        WHERE ccd.company_id = p_company_id AND ccd.course_id = p_course_id
          AND ccd.department_id = u.department_id
      )
    )
  ON CONFLICT (employee_id, course_id) DO NOTHING;

  -- Remove for no-longer-eligible employees (untouched ASSIGNED only)
  DELETE FROM employee_courses ec
  USING users u
  WHERE ec.employee_id = u.id
    AND ec.course_id = p_course_id
    AND u.company_id = p_company_id
    AND u.role = 'EMPLOYEE'
    AND ec.status = 'ASSIGNED'
    AND COALESCE(ec.progress_percentage, 0) = 0
    AND COALESCE(ec.completed_sections, 0) = 0
    AND NOT (
      EXISTS (
        SELECT 1 FROM company_courses cc
        WHERE cc.company_id = p_company_id AND cc.course_id = p_course_id
      )
      AND (
        NOT EXISTS (
          SELECT 1 FROM company_course_departments ccd
          WHERE ccd.company_id = p_company_id AND ccd.course_id = p_course_id
        )
        OR EXISTS (
          SELECT 1 FROM company_course_departments ccd
          WHERE ccd.company_id = p_company_id AND ccd.course_id = p_course_id
            AND ccd.department_id = u.department_id
        )
      )
    );
END;
$$;

-- ============================================================================
-- 3) Trigger wrappers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_sync_courses_on_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'EMPLOYEE' THEN
    PERFORM public.sync_employee_courses(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_courses_on_company_course()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_company_course(OLD.company_id, OLD.course_id);
    RETURN OLD;
  END IF;
  PERFORM public.sync_company_course(NEW.company_id, NEW.course_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_courses_on_ccd()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_company_course(OLD.company_id, OLD.course_id);
    RETURN OLD;
  END IF;
  PERFORM public.sync_company_course(NEW.company_id, NEW.course_id);
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4) Replace legacy triggers/functions
-- ============================================================================
-- Old course-driven and global user triggers (ignored company scope)
DROP TRIGGER IF EXISTS trigger_assign_courses_to_departments      ON public.courses;
DROP TRIGGER IF EXISTS trigger_assign_courses_to_new_employee     ON public.users;
DROP TRIGGER IF EXISTS trigger_assign_courses_on_department_change ON public.users;
DROP FUNCTION IF EXISTS public.assign_courses_to_department_employees();
DROP FUNCTION IF EXISTS public.assign_courses_to_new_employee();

-- New, company-scoped triggers
DROP TRIGGER IF EXISTS trg_sync_courses_on_user ON public.users;
CREATE TRIGGER trg_sync_courses_on_user
AFTER INSERT OR UPDATE OF department_id, company_id, role ON public.users
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_courses_on_user();

DROP TRIGGER IF EXISTS trg_sync_courses_on_company_course ON public.company_courses;
CREATE TRIGGER trg_sync_courses_on_company_course
AFTER INSERT OR DELETE ON public.company_courses
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_courses_on_company_course();

DROP TRIGGER IF EXISTS trg_sync_courses_on_ccd ON public.company_course_departments;
CREATE TRIGGER trg_sync_courses_on_ccd
AFTER INSERT OR DELETE ON public.company_course_departments
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_courses_on_ccd();

-- ============================================================================
-- 5) One-time conservative backfill for every existing employee
-- ============================================================================
-- Adds missing eligible courses and removes only untouched ASSIGNED rows that
-- are out of company scope. IN_PROGRESS / COMPLETED rows are left intact.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM users WHERE role = 'EMPLOYEE' LOOP
    PERFORM public.sync_employee_courses(r.id);
  END LOOP;
END $$;
