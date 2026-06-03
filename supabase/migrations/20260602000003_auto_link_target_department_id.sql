-- Resolve department_id on phishing_campaign_targets at the database level.
--
-- The department_vulnerability_stats trigger aggregates target rows by department_id,
-- skipping any row where department_id IS NULL. Relying on the frontend to set
-- department_id at upload time is fragile: a stale client build (or any other insert
-- path) leaves it NULL and the department stats never populate.
--
-- auto_link_target_to_employee() already matches each new target to its employee by
-- email + company (SECURITY DEFINER, so RLS does not hide cross-company users), and
-- runs BEFORE INSERT — before the AFTER-INSERT stats trigger fires. Extend it to also
-- copy the matched employee's department_id onto the target row when it is not already
-- provided. This makes department attribution robust regardless of the insert path.

CREATE OR REPLACE FUNCTION auto_link_target_to_employee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT u.id, u.department_id
      INTO NEW.employee_id, NEW.department_id
    FROM phishing_campaigns c
    JOIN users u
      ON lower(u.email) = lower(NEW.email)
     AND u.company_id   = c.company_id
     AND u.role         = 'EMPLOYEE'
    WHERE c.id = NEW.campaign_id
    LIMIT 1;
  ELSIF NEW.department_id IS NULL AND NEW.email IS NOT NULL THEN
    -- employee_id was supplied but department_id was not: still resolve the department.
    SELECT u.department_id
      INTO NEW.department_id
    FROM phishing_campaigns c
    JOIN users u
      ON lower(u.email) = lower(NEW.email)
     AND u.company_id   = c.company_id
     AND u.role         = 'EMPLOYEE'
    WHERE c.id = NEW.campaign_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger definition is unchanged (BEFORE INSERT); recreating the function is enough.

-- Backfill department_id for existing target rows that have a matchable employee.
UPDATE phishing_campaign_targets t
SET department_id = u.department_id
FROM phishing_campaigns c
JOIN users u
  ON lower(u.email) = lower(t.email)
 AND u.company_id   = c.company_id
 AND u.role         = 'EMPLOYEE'
WHERE t.campaign_id = c.id
  AND t.department_id IS NULL
  AND u.department_id IS NOT NULL;
