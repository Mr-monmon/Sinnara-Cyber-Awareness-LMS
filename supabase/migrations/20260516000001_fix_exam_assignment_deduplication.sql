-- Fix duplicate exam assignments showing to employees
-- Problem: employee_available_exams grouped by ae.id, so one employee could see
--          the same exam multiple times if they match >1 assigned_exams rows
--          (e.g. assigned via dept AND directly).
-- Fix: DISTINCT ON (employee_id, exam_id) — one row per employee+exam,
--      preferring employee-specific assignment over dept-level,
--      and counting attempts across ALL assignments for that employee+exam.

DROP VIEW IF EXISTS employee_available_exams;

CREATE VIEW employee_available_exams AS
SELECT DISTINCT ON (u.id, e.id)
  u.id                        AS employee_id,
  e.id                        AS exam_id,
  e.title,
  e.description,
  e.time_limit_minutes,
  e.passing_score,
  e.exam_type,
  e.prerequisite_course_id,
  ae.id                       AS assignment_id,
  ae.due_date,
  ae.max_attempts,
  ae.is_mandatory,
  -- count attempts across ALL assignments for this employee+exam
  (
    SELECT COUNT(*)
    FROM exam_results er2
    WHERE er2.employee_id = u.id
      AND er2.exam_id     = e.id
  )::bigint AS attempts_used,
  COALESCE(
    (
      SELECT BOOL_OR(er2.passed)
      FROM exam_results er2
      WHERE er2.employee_id = u.id
        AND er2.exam_id     = e.id
    ),
    false
  ) AS has_passed
FROM users u
CROSS JOIN exams e
INNER JOIN assigned_exams ae ON (
  ae.exam_id   = e.id
  AND ae.status = 'active'
  AND (
    ae.assigned_to_employee   = u.id
    OR ae.assigned_to_department = u.department_id
  )
)
WHERE NOT COALESCE(
  (
    SELECT BOOL_OR(er2.passed)
    FROM exam_results er2
    WHERE er2.employee_id = u.id
      AND er2.exam_id     = e.id
  ),
  false
)
ORDER BY
  u.id,
  e.id,
  -- prefer employee-specific assignment (more targeted, may have different max_attempts)
  (CASE WHEN ae.assigned_to_employee = u.id THEN 0 ELSE 1 END),
  ae.assigned_at DESC;
