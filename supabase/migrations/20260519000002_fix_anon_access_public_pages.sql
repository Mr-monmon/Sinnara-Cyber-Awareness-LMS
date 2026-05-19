/*
  Fix: Public-facing pages blocked for unauthenticated (anon) users.

  Root cause: these policies were set TO authenticated, but the pages
  that consume them are accessible without login (landing page, public
  fraud alerts, public awareness test).

  Strategy: add narrow anon-read policies alongside existing ones.
  We do NOT modify existing policies — only add new ones scoped to anon.
*/

-- ─────────────────────────────────────────────────────────────
-- 1. partners — landing page carousel (anon visitors)
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "rls_partners_anon"
  ON public.partners FOR SELECT
  TO anon
  USING (is_active = true);

-- ─────────────────────────────────────────────────────────────
-- 2. fraud_alerts — public fraud alerts page (anon visitors)
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "rls_fa_anon"
  ON public.fraud_alerts FOR SELECT
  TO anon
  USING (is_published = true);

-- ─────────────────────────────────────────────────────────────
-- 3. exams — public awareness test reads GENERAL exam only
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "rls_exams_anon"
  ON public.exams FOR SELECT
  TO anon
  USING (exam_type = 'GENERAL');

-- ─────────────────────────────────────────────────────────────
-- 4. exam_questions — scoped to GENERAL exams only
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "rls_exam_questions_anon"
  ON public.exam_questions FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_questions.exam_id
        AND e.exam_type = 'GENERAL'
    )
  );
