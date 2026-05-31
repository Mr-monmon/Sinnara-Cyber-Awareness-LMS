-- Phase 4 (CRIT-02 / CRIT-03): server-side scoring foundations
--
-- These RPCs let the employee-facing UI fetch exam questions and course
-- sections WITHOUT ever receiving the correct_answer. Scoring is performed
-- server-side by the submit-exam / submit-quiz edge functions using the
-- service role, so the answer key never reaches the browser.
--
-- NOTE: a column-level REVOKE on correct_answer is intentionally NOT applied
-- here. Admin authoring pages (CourseContentForm, ExamsPage) and the public
-- self-assessment (PublicAssessment) still read correct_answer directly under
-- the same `authenticated` / `anon` roles. REVOKE must wait until those
-- consumers are migrated to an admin-only access path (see remediation plan).

-- ── Helper: strip correct_answer from a section's content_data JSONB ──
CREATE OR REPLACE FUNCTION strip_correct_answers(cd jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN cd ? 'questions' AND jsonb_typeof(cd -> 'questions') = 'array'
    THEN jsonb_set(
      cd,
      '{questions}',
      (
        SELECT COALESCE(jsonb_agg(q - 'correct_answer'), '[]'::jsonb)
        FROM jsonb_array_elements(cd -> 'questions') AS q
      )
    )
    ELSE cd
  END;
$$;

-- ── RPC: exam questions WITHOUT correct_answer ──
-- Caller must have an active assignment for the exam (employee or department)
-- OR be a privileged role. Returns nothing if access is denied.
CREATE OR REPLACE FUNCTION get_exam_questions(p_exam_id uuid)
RETURNS TABLE (
  id          uuid,
  exam_id     uuid,
  question    text,
  options     jsonb,
  order_index integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_role      text;
  v_dept      uuid;
  v_has_access boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT u.role, u.department_id INTO v_role, v_dept
  FROM users u WHERE u.id = v_uid;

  -- Privileged roles may always read the question text (still no answers here)
  IF v_role IN ('PLATFORM_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'REVIEWER') THEN
    v_has_access := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM assigned_exams ae
      WHERE ae.exam_id = p_exam_id
        AND ae.status = 'active'
        AND (ae.assigned_to_employee = v_uid OR ae.assigned_to_department = v_dept)
    ) INTO v_has_access;
  END IF;

  IF NOT v_has_access THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT eq.id, eq.exam_id, eq.question, eq.options, eq.order_index
  FROM exam_questions eq
  WHERE eq.exam_id = p_exam_id
  ORDER BY eq.order_index;
END;
$$;

-- ── RPC: course sections with correct_answer stripped from quiz JSONB ──
CREATE OR REPLACE FUNCTION get_course_sections(p_course_id uuid)
RETURNS TABLE (
  id               uuid,
  course_id        uuid,
  title            text,
  title_ar         text,
  section_type     text,
  content          text,
  content_ar       text,
  content_data     jsonb,
  content_data_ar  jsonb,
  duration_minutes integer,
  order_index      integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    cs.id,
    cs.course_id,
    cs.title,
    cs.title_ar,
    cs.section_type,
    cs.content,
    cs.content_ar,
    strip_correct_answers(COALESCE(cs.content_data, '{}'::jsonb)),
    CASE
      WHEN cs.content_data_ar IS NULL THEN NULL
      ELSE strip_correct_answers(cs.content_data_ar)
    END,
    cs.duration_minutes,
    cs.order_index
  FROM course_sections cs
  WHERE cs.course_id = p_course_id
  ORDER BY cs.order_index;
END;
$$;

GRANT EXECUTE ON FUNCTION get_exam_questions(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION get_course_sections(uuid) TO authenticated;
