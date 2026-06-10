-- ============================================================================
-- 20260610 — Fix: course progress not reflected anywhere (all zeros)
-- ============================================================================
-- Symptom: Risk Scores "Courses" column, Analytics "Course Completion",
--          Dashboard "Training Overview" and Employee Detail all show 0,
--          even though employees opened courses and completed sections.
--
-- Root cause candidates (this script diagnoses then fixes both):
--   1. The trg_sync_employee_course_progress trigger (migration
--      20260516000002) was never applied in production, so section progress
--      written to course_section_progress never rolls up into
--      employee_courses (status stays 'ASSIGNED', progress 0).
--   2. employee_courses is missing the summary columns the trigger writes.
--
-- Safe to run multiple times (idempotent).
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- A) DIAGNOSTICS — run this block first and check the output
-- ──────────────────────────────────────────────────────────────────────────

-- A1: does the trigger exist?
SELECT tgname, tgrelid::regclass AS on_table
FROM pg_trigger
WHERE tgname = 'trg_sync_employee_course_progress';
-- Expected: 1 row. If 0 rows → the trigger is missing (run section B).

-- A2: is there raw section progress that never rolled up?
SELECT
  (SELECT COUNT(*) FROM course_section_progress)                          AS section_progress_rows,
  (SELECT COUNT(*) FROM course_section_progress WHERE completed)          AS sections_completed,
  (SELECT COUNT(*) FROM employee_courses)                                 AS employee_course_rows,
  (SELECT COUNT(*) FROM employee_courses WHERE status = 'IN_PROGRESS')    AS in_progress,
  (SELECT COUNT(*) FROM employee_courses WHERE status = 'COMPLETED')      AS completed;
-- If sections_completed > 0 but in_progress = 0 and completed = 0
-- → progress exists but was never synced (run section B).

-- A3: do the summary columns exist on employee_courses?
SELECT column_name FROM information_schema.columns
WHERE table_name = 'employee_courses'
  AND column_name IN ('progress_percentage','completed_sections','total_sections','last_accessed_at');
-- Expected: 4 rows. Fewer → columns missing (section B adds them).

-- ──────────────────────────────────────────────────────────────────────────
-- B) FIX — columns, trigger, and backfill
-- ──────────────────────────────────────────────────────────────────────────

-- B1: ensure the summary columns exist
ALTER TABLE employee_courses ADD COLUMN IF NOT EXISTS progress_percentage numeric(5,2) DEFAULT 0;
ALTER TABLE employee_courses ADD COLUMN IF NOT EXISTS completed_sections  integer       DEFAULT 0;
ALTER TABLE employee_courses ADD COLUMN IF NOT EXISTS total_sections      integer       DEFAULT 0;
ALTER TABLE employee_courses ADD COLUMN IF NOT EXISTS last_accessed_at    timestamptz;

-- B2: (re)create the sync function — identical to migration 20260516000002
CREATE OR REPLACE FUNCTION public.sync_employee_course_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id uuid;
  v_course_id   uuid;
  v_completed   integer;
  v_total       integer;
  v_pct         integer;
  v_status      text;
  v_now         timestamptz := now();
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_employee_id := OLD.employee_id;
    v_course_id   := OLD.course_id;
  ELSE
    v_employee_id := NEW.employee_id;
    v_course_id   := NEW.course_id;
  END IF;

  SELECT COUNT(*) INTO v_completed
  FROM course_section_progress
  WHERE employee_id = v_employee_id
    AND course_id   = v_course_id
    AND completed   = true;

  SELECT COUNT(*) INTO v_total
  FROM course_sections
  WHERE course_id = v_course_id;

  v_pct := CASE WHEN v_total > 0 THEN ROUND((v_completed::numeric / v_total) * 100)::integer ELSE 0 END;
  v_status := CASE
    WHEN v_pct >= 100 THEN 'COMPLETED'
    WHEN v_pct > 0    THEN 'IN_PROGRESS'
    ELSE 'ASSIGNED'
  END;

  INSERT INTO employee_courses (
    employee_id, course_id, status,
    completed_sections, total_sections, progress_percentage,
    started_at, completed_at, last_accessed_at, assigned_at
  ) VALUES (
    v_employee_id, v_course_id, v_status,
    v_completed, v_total, v_pct,
    CASE WHEN v_pct > 0   THEN v_now ELSE NULL END,
    CASE WHEN v_pct >= 100 THEN v_now ELSE NULL END,
    v_now, v_now
  )
  ON CONFLICT (employee_id, course_id) DO UPDATE SET
    completed_sections   = EXCLUDED.completed_sections,
    total_sections       = EXCLUDED.total_sections,
    progress_percentage  = EXCLUDED.progress_percentage,
    status               = EXCLUDED.status,
    last_accessed_at     = v_now,
    started_at  = COALESCE(employee_courses.started_at,
                           CASE WHEN EXCLUDED.progress_percentage > 0 THEN v_now ELSE NULL END),
    completed_at = CASE
      WHEN EXCLUDED.progress_percentage >= 100 THEN COALESCE(employee_courses.completed_at, v_now)
      ELSE NULL
    END;

  RETURN NULL;
END;
$$;

-- B3: attach the trigger
DROP TRIGGER IF EXISTS trg_sync_employee_course_progress ON course_section_progress;
CREATE TRIGGER trg_sync_employee_course_progress
AFTER INSERT OR UPDATE OR DELETE ON course_section_progress
FOR EACH ROW EXECUTE FUNCTION public.sync_employee_course_progress();

-- B4: BACKFILL — roll up all existing section progress directly
-- (does not depend on the trigger, so it repairs history in one pass)
WITH agg AS (
  SELECT
    csp.employee_id,
    csp.course_id,
    COUNT(*) FILTER (WHERE csp.completed)                                       AS done_sections,
    (SELECT COUNT(*) FROM course_sections cs WHERE cs.course_id = csp.course_id) AS total_sections,
    MIN(csp.completed_at) FILTER (WHERE csp.completed)                          AS first_done,
    MAX(csp.completed_at) FILTER (WHERE csp.completed)                          AS last_done
  FROM course_section_progress csp
  GROUP BY csp.employee_id, csp.course_id
)
INSERT INTO employee_courses (
  employee_id, course_id, status,
  completed_sections, total_sections, progress_percentage,
  started_at, completed_at, last_accessed_at, assigned_at
)
SELECT
  a.employee_id,
  a.course_id,
  CASE
    WHEN a.total_sections > 0 AND a.done_sections >= a.total_sections THEN 'COMPLETED'
    WHEN a.done_sections > 0 THEN 'IN_PROGRESS'
    ELSE 'ASSIGNED'
  END,
  a.done_sections,
  a.total_sections,
  CASE WHEN a.total_sections > 0
       THEN ROUND((a.done_sections::numeric / a.total_sections) * 100)
       ELSE 0 END,
  a.first_done,
  CASE WHEN a.total_sections > 0 AND a.done_sections >= a.total_sections
       THEN COALESCE(a.last_done, now()) END,
  COALESCE(a.last_done, now()),
  now()
FROM agg a
ON CONFLICT (employee_id, course_id) DO UPDATE SET
  completed_sections  = EXCLUDED.completed_sections,
  total_sections      = EXCLUDED.total_sections,
  progress_percentage = EXCLUDED.progress_percentage,
  status              = EXCLUDED.status,
  started_at          = COALESCE(employee_courses.started_at, EXCLUDED.started_at),
  completed_at        = CASE
    WHEN EXCLUDED.status = 'COMPLETED' THEN COALESCE(employee_courses.completed_at, EXCLUDED.completed_at)
    ELSE NULL
  END,
  last_accessed_at    = GREATEST(
    COALESCE(employee_courses.last_accessed_at, EXCLUDED.last_accessed_at),
    EXCLUDED.last_accessed_at
  );

-- ──────────────────────────────────────────────────────────────────────────
-- C) VERIFY — run after B; numbers should no longer be all zero
-- ──────────────────────────────────────────────────────────────────────────
SELECT status, COUNT(*) AS rows, ROUND(AVG(progress_percentage), 1) AS avg_progress
FROM employee_courses
GROUP BY status
ORDER BY status;

-- Per-employee view as the Risk Scores page sees it:
SELECT u.full_name,
       ec.status,
       ec.completed_sections || '/' || ec.total_sections AS sections,
       ec.progress_percentage
FROM employee_courses ec
JOIN users u ON u.id = ec.employee_id
ORDER BY u.full_name;
