-- Exams in Arabic as well as English, following the pattern courses already use.
--
-- Courses carry `title_ar` / `content_ar` alongside the English columns and the
-- viewer picks `arabic ? x_ar || x : x`, so a missing translation falls back
-- rather than showing an empty screen. Exams never got the same treatment and
-- have been English-only.
--
-- THE HARD PART IS SCORING, NOT TRANSLATION. `submit-exam` compares the answer
-- the employee submitted against `correct_answer` by TEXT:
--
--     const isCorrect = selected === q.correct_answer;
--
-- and the viewer submits the text of the option that was clicked. So simply
-- translating the options would mean an Arabic-speaking employee submits Arabic
-- text, which never equals the English answer key — every answer scored wrong,
-- silently, for the population the translation was meant to serve. That is a
-- far worse outcome than having no Arabic at all.
--
-- The fix keeps English as the single answer key. `options_ar` is a parallel
-- array in the SAME ORDER as `options`, so whatever language was displayed, the
-- submitted text can be mapped back to its English counterpart by position
-- before comparison. The ordering requirement is enforced by a CHECK on length
-- rather than left as a convention someone will eventually break.

-- ============================================================================
-- 1) Exam-level translations
-- ============================================================================
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS title_ar       text;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS description_ar text;

COMMENT ON COLUMN public.exams.title_ar IS
  'Arabic title. NULL falls back to the English title in the viewer.';

-- ============================================================================
-- 2) Question-level translations
-- ============================================================================
ALTER TABLE public.exam_questions ADD COLUMN IF NOT EXISTS question_ar    text;
ALTER TABLE public.exam_questions ADD COLUMN IF NOT EXISTS options_ar     jsonb;
ALTER TABLE public.exam_questions ADD COLUMN IF NOT EXISTS explanation_ar text;

COMMENT ON COLUMN public.exam_questions.options_ar IS
  'Arabic options, in the SAME ORDER as options. Position is what maps a submitted Arabic answer back to the English answer key — reordering it silently breaks scoring.';

-- A translated option list that is a different length cannot be positionally
-- matched, so the mapping would fail open and mark correct answers wrong. Refuse
-- to store it. NULL means "not translated yet", which is fine and falls back.
ALTER TABLE public.exam_questions DROP CONSTRAINT IF EXISTS exam_questions_options_ar_len_chk;
ALTER TABLE public.exam_questions
  ADD CONSTRAINT exam_questions_options_ar_len_chk
  CHECK (
    options_ar IS NULL
    OR (
      jsonb_typeof(options_ar) = 'array'
      AND jsonb_array_length(options_ar) = jsonb_array_length(options)
    )
  );

-- ============================================================================
-- 3) Map a submitted answer back to the English answer key
-- ============================================================================
-- Used by the scoring path. Kept in the database rather than only in the edge
-- function so that any future scorer — a report, a backfill, a second client —
-- resolves an answer the same way. Divergent scoring rules are how a platform
-- ends up unable to explain its own results.
CREATE OR REPLACE FUNCTION public.canonical_exam_answer(
  p_selected    text,
  p_options     jsonb,
  p_options_ar  jsonb
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_selected IS NULL THEN NULL
    -- Already the English text: the common case, and cheapest.
    WHEN p_options ? p_selected THEN p_selected
    -- Otherwise find it among the Arabic options and take the English option
    -- sitting at the same position.
    ELSE COALESCE(
      (
        SELECT p_options ->> idx
        FROM generate_series(0, COALESCE(jsonb_array_length(p_options_ar), 0) - 1) AS idx
        WHERE p_options_ar ->> idx = p_selected
        LIMIT 1
      ),
      p_selected
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.canonical_exam_answer(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canonical_exam_answer(text, jsonb, jsonb) TO authenticated, service_role;

-- ============================================================================
-- 4) Serve the translations to the viewer
-- ============================================================================
-- Same access rules as before — this only widens the columns returned, and
-- still never returns `correct_answer`.
DROP FUNCTION IF EXISTS public.get_exam_questions(uuid);
CREATE OR REPLACE FUNCTION public.get_exam_questions(p_exam_id uuid)
RETURNS TABLE (
  id             uuid,
  exam_id        uuid,
  question       text,
  question_ar    text,
  options        jsonb,
  options_ar     jsonb,
  order_index    integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_role       text;
  v_dept       uuid;
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
  SELECT eq.id, eq.exam_id, eq.question, eq.question_ar, eq.options, eq.options_ar, eq.order_index
  FROM exam_questions eq
  WHERE eq.exam_id = p_exam_id
  ORDER BY eq.order_index;
END;
$$;

REVOKE ALL ON FUNCTION public.get_exam_questions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_exam_questions(uuid) TO authenticated;
