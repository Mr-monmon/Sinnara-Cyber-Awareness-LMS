/*
  Fix: Enable RLS on course_section_progress and add missing policies
  for 6 tables that have RLS enabled but no policies (blocks all access).

  Tables fixed:
  1. course_section_progress  — RLS was disabled (policies existed but inactive)
  2. articles                 — public content, anon read + platform admin write
  3. company_course_departments — company admin manages dept restrictions per course
  4. employee_departments     — links employees to departments
  5. homepage_partners        — public-facing partner logos on landing page
  6. login_activity           — per-user login tracking
  7. quizzes                  — course quiz questions, same access as courses
*/

-- ─────────────────────────────────────────────────────────────
-- 1. course_section_progress — enable RLS (policies already exist)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.course_section_progress ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 2. articles — public resource, no company_id
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "rls_articles_anon_read"
  ON public.articles FOR SELECT
  TO anon, authenticated
  USING (published = true);

CREATE POLICY "rls_articles_pa"
  ON public.articles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'PLATFORM_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'PLATFORM_ADMIN'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. company_course_departments — course-to-department mapping per company
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "rls_ccd_pa"
  ON public.company_course_departments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'PLATFORM_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'PLATFORM_ADMIN'
    )
  );

CREATE POLICY "rls_ccd_ca"
  ON public.company_course_departments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'COMPANY_ADMIN'
        AND u.company_id = company_course_departments.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'COMPANY_ADMIN'
        AND u.company_id = company_course_departments.company_id
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4. employee_departments — links employees to departments
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "rls_emp_dept_pa"
  ON public.employee_departments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'PLATFORM_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'PLATFORM_ADMIN'
    )
  );

CREATE POLICY "rls_emp_dept_ca"
  ON public.employee_departments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.departments d ON d.id = employee_departments.department_id
      WHERE u.id = auth.uid()
        AND u.role = 'COMPANY_ADMIN'
        AND u.company_id = d.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.departments d ON d.id = employee_departments.department_id
      WHERE u.id = auth.uid()
        AND u.role = 'COMPANY_ADMIN'
        AND u.company_id = d.company_id
    )
  );

CREATE POLICY "rls_emp_dept_self"
  ON public.employee_departments FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 5. homepage_partners — public landing page, no auth required
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "rls_hp_anon"
  ON public.homepage_partners FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "rls_hp_pa"
  ON public.homepage_partners FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'PLATFORM_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'PLATFORM_ADMIN'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 6. login_activity — per-user login tracking
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "rls_login_act_pa"
  ON public.login_activity FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'PLATFORM_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'PLATFORM_ADMIN'
    )
  );

CREATE POLICY "rls_login_act_ca"
  ON public.login_activity FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'COMPANY_ADMIN'
        AND u.company_id = login_activity.company_id
    )
  );

CREATE POLICY "rls_login_act_self_sel"
  ON public.login_activity FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "rls_login_act_self_ins"
  ON public.login_activity FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 7. quizzes — course quiz questions, follows same pattern as courses
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "rls_quizzes_pa"
  ON public.quizzes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'PLATFORM_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'PLATFORM_ADMIN'
    )
  );

CREATE POLICY "rls_quizzes_read"
  ON public.quizzes FOR SELECT
  TO authenticated
  USING (true);
