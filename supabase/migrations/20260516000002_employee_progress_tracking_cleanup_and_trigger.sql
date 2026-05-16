-- ============================================================================
-- Employee Progress Tracking — cleanup + automated summary
-- ============================================================================
-- Step 1: drop the obsolete `employee_section_progress` table (never used in
--         production code; was superseded by `course_section_progress`).
-- Step 2: add a trigger on `course_section_progress` that keeps the
--         `employee_courses` summary columns (completed_sections, total_sections,
--         progress_percentage, status, started_at, completed_at, last_accessed_at)
--         in sync automatically. The application no longer needs to compute
--         these — the DB is the source of truth.
-- ============================================================================

-- ---------- Step 1: drop dead table ----------
DROP TABLE IF EXISTS employee_section_progress CASCADE;

-- ---------- Step 2: trigger function ----------
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
  -- Pick the right record depending on operation
  IF TG_OP = 'DELETE' THEN
    v_employee_id := OLD.employee_id;
    v_course_id   := OLD.course_id;
  ELSE
    v_employee_id := NEW.employee_id;
    v_course_id   := NEW.course_id;
  END IF;

  -- Count completed sections for this employee+course
  SELECT COUNT(*) INTO v_completed
  FROM course_section_progress
  WHERE employee_id = v_employee_id
    AND course_id   = v_course_id
    AND completed   = true;

  -- Total sections in the course
  SELECT COUNT(*) INTO v_total
  FROM course_sections
  WHERE course_id = v_course_id;

  v_pct := CASE WHEN v_total > 0 THEN ROUND((v_completed::numeric / v_total) * 100)::integer ELSE 0 END;
  v_status := CASE
    WHEN v_pct >= 100 THEN 'COMPLETED'
    WHEN v_pct > 0    THEN 'IN_PROGRESS'
    ELSE 'ASSIGNED'
  END;

  -- Upsert summary. If the employee_courses row already exists, update it;
  -- otherwise create one (covers the case where the employee opened a course
  -- without an explicit assignment).
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
    -- only set started_at the first time progress becomes > 0
    started_at  = COALESCE(employee_courses.started_at,
                           CASE WHEN EXCLUDED.progress_percentage > 0 THEN v_now ELSE NULL END),
    -- set completed_at when reaching 100%, clear if it drops below
    completed_at = CASE
      WHEN EXCLUDED.progress_percentage >= 100 THEN COALESCE(employee_courses.completed_at, v_now)
      ELSE NULL
    END;

  RETURN NULL; -- AFTER trigger
END;
$$;

-- ---------- Step 3: attach the trigger ----------
DROP TRIGGER IF EXISTS trg_sync_employee_course_progress ON course_section_progress;
CREATE TRIGGER trg_sync_employee_course_progress
AFTER INSERT OR UPDATE OR DELETE ON course_section_progress
FOR EACH ROW EXECUTE FUNCTION public.sync_employee_course_progress();

-- ---------- Step 4: backfill existing data ----------
-- Recompute summary for every existing employee+course pair that has any
-- section progress so old rows align with the new source-of-truth.
-- The trigger is idempotent so firing it multiple times per pair is fine.
UPDATE course_section_progress SET completed = completed;
