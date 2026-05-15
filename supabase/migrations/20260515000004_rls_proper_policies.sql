/*
  PROPER RLS POLICIES — TENANT ISOLATION (defensive casts)
  =========================================================
  All UUID comparisons use ::text on both sides to avoid type
  mismatches in production where some columns may be text.

  ROLLBACK: run 20260515000003_rls_backup_restore.sql
*/

-- ──────────────────────────────────────────────────────────────
-- Helper functions (return text for consistency)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id::text = auth.uid()::text;
$$;

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id::text FROM public.users WHERE id::text = auth.uid()::text;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id::text = auth.uid()::text AND role = 'PLATFORM_ADMIN'
  );
$$;

-- ──────────────────────────────────────────────────────────────
-- Drop all existing policies
-- ──────────────────────────────────────────────────────────────
DO $$ DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ──────────────────────────────────────────────────────────────
-- COMPANIES
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_companies_platform_admin ON public.companies
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_companies_company_admin_select ON public.companies
  FOR SELECT TO authenticated
  USING (id::text = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- USERS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_users_platform_admin ON public.users
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_users_company_admin ON public.users
  FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND company_id::text = public.get_my_company_id()
  )
  WITH CHECK (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND company_id::text = public.get_my_company_id()
  );

CREATE POLICY rls_users_self ON public.users
  FOR SELECT TO authenticated
  USING (id::text = auth.uid()::text);

CREATE POLICY rls_users_self_update ON public.users
  FOR UPDATE TO authenticated
  USING (id::text = auth.uid()::text)
  WITH CHECK (id::text = auth.uid()::text);

-- ──────────────────────────────────────────────────────────────
-- DEPARTMENTS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_departments_platform_admin ON public.departments
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_departments_company ON public.departments
  FOR ALL TO authenticated
  USING (company_id::text = public.get_my_company_id())
  WITH CHECK (company_id::text = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- COURSES
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_courses_platform_admin ON public.courses
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_courses_read ON public.courses
  FOR SELECT TO authenticated USING (true);

-- ──────────────────────────────────────────────────────────────
-- COMPANY_COURSES
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_company_courses_platform_admin ON public.company_courses
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_company_courses_read ON public.company_courses
  FOR SELECT TO authenticated
  USING (company_id::text = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- EMPLOYEE_COURSES
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_employee_courses_platform_admin ON public.employee_courses
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_employee_courses_company_admin ON public.employee_courses
  FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id::text = employee_courses.employee_id::text
      AND u.company_id::text = public.get_my_company_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id::text = employee_courses.employee_id::text
      AND u.company_id::text = public.get_my_company_id()
    )
  );

CREATE POLICY rls_employee_courses_self ON public.employee_courses
  FOR SELECT TO authenticated
  USING (employee_id::text = auth.uid()::text);

-- ──────────────────────────────────────────────────────────────
-- COURSE_SECTIONS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_course_sections_platform_admin ON public.course_sections
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_course_sections_read ON public.course_sections
  FOR SELECT TO authenticated USING (true);

-- ──────────────────────────────────────────────────────────────
-- COURSE_SECTION_PROGRESS (uses employee_id)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_csp_platform_admin ON public.course_section_progress
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_csp_company_admin ON public.course_section_progress
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id::text = course_section_progress.employee_id::text
      AND u.company_id::text = public.get_my_company_id()
    )
  );

CREATE POLICY rls_csp_self ON public.course_section_progress
  FOR ALL TO authenticated
  USING (employee_id::text = auth.uid()::text)
  WITH CHECK (employee_id::text = auth.uid()::text);

-- ──────────────────────────────────────────────────────────────
-- EMPLOYEE_SECTION_PROGRESS (uses user_id)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_esp_platform_admin ON public.employee_section_progress
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_esp_company_admin ON public.employee_section_progress
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id::text = employee_section_progress.user_id::text
      AND u.company_id::text = public.get_my_company_id()
    )
  );

CREATE POLICY rls_esp_self ON public.employee_section_progress
  FOR ALL TO authenticated
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);

-- ──────────────────────────────────────────────────────────────
-- EXAMS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_exams_platform_admin ON public.exams
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_exams_read ON public.exams
  FOR SELECT TO authenticated USING (true);

-- ──────────────────────────────────────────────────────────────
-- COMPANY_EXAMS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_company_exams_platform_admin ON public.company_exams
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_company_exams_read ON public.company_exams
  FOR SELECT TO authenticated
  USING (company_id::text = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- EXAM_QUESTIONS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_exam_questions_platform_admin ON public.exam_questions
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_exam_questions_read ON public.exam_questions
  FOR SELECT TO authenticated USING (true);

-- ──────────────────────────────────────────────────────────────
-- ASSIGNED_EXAMS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_assigned_exams_platform_admin ON public.assigned_exams
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_assigned_exams_company_admin ON public.assigned_exams
  FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND company_id::text = public.get_my_company_id()
  )
  WITH CHECK (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND company_id::text = public.get_my_company_id()
  );

CREATE POLICY rls_assigned_exams_self ON public.assigned_exams
  FOR SELECT TO authenticated
  USING (employee_id::text = auth.uid()::text);

-- ──────────────────────────────────────────────────────────────
-- EXAM_ATTEMPTS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_exam_attempts_platform_admin ON public.exam_attempts
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_exam_attempts_company_admin ON public.exam_attempts
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id::text = exam_attempts.employee_id::text
      AND u.company_id::text = public.get_my_company_id()
    )
  );

CREATE POLICY rls_exam_attempts_self ON public.exam_attempts
  FOR ALL TO authenticated
  USING (employee_id::text = auth.uid()::text)
  WITH CHECK (employee_id::text = auth.uid()::text);

-- ──────────────────────────────────────────────────────────────
-- EXAM_RESULTS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_exam_results_platform_admin ON public.exam_results
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_exam_results_company_admin ON public.exam_results
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id::text = exam_results.employee_id::text
      AND u.company_id::text = public.get_my_company_id()
    )
  );

CREATE POLICY rls_exam_results_self ON public.exam_results
  FOR SELECT TO authenticated
  USING (employee_id::text = auth.uid()::text);

-- ──────────────────────────────────────────────────────────────
-- CERTIFICATE_TEMPLATES
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_certificate_templates_platform_admin ON public.certificate_templates
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_certificate_templates_read ON public.certificate_templates
  FOR SELECT TO authenticated USING (true);

-- ──────────────────────────────────────────────────────────────
-- ISSUED_CERTIFICATES
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_issued_certificates_platform_admin ON public.issued_certificates
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_issued_certificates_company_admin ON public.issued_certificates
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id::text = issued_certificates.employee_id::text
      AND u.company_id::text = public.get_my_company_id()
    )
  );

CREATE POLICY rls_issued_certificates_self ON public.issued_certificates
  FOR SELECT TO authenticated
  USING (employee_id::text = auth.uid()::text);

-- ──────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_subscriptions_platform_admin ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_subscriptions_company_read ON public.subscriptions
  FOR SELECT TO authenticated
  USING (company_id::text = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- INVOICES
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_invoices_platform_admin ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_invoices_company_read ON public.invoices
  FOR SELECT TO authenticated
  USING (company_id::text = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- PHISHING_TEMPLATES
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_phishing_templates_platform_admin ON public.phishing_templates
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_phishing_templates_read ON public.phishing_templates
  FOR SELECT TO authenticated USING (true);

-- ──────────────────────────────────────────────────────────────
-- PHISHING_DOMAINS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_phishing_domains_platform_admin ON public.phishing_domains
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_phishing_domains_company_read ON public.phishing_domains
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND is_platform_domain = true
    AND is_verified = true
  );

-- ──────────────────────────────────────────────────────────────
-- PHISHING_CAMPAIGN_QUOTAS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_pcq_platform_admin ON public.phishing_campaign_quotas
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_pcq_company_read ON public.phishing_campaign_quotas
  FOR SELECT TO authenticated
  USING (company_id::text = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- PHISHING_CAMPAIGN_REQUESTS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_pcr_platform_admin ON public.phishing_campaign_requests
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_pcr_company ON public.phishing_campaign_requests
  FOR ALL TO authenticated
  USING (company_id::text = public.get_my_company_id())
  WITH CHECK (company_id::text = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- PHISHING_CAMPAIGNS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_pc_platform_admin ON public.phishing_campaigns
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_pc_company ON public.phishing_campaigns
  FOR ALL TO authenticated
  USING (company_id::text = public.get_my_company_id())
  WITH CHECK (company_id::text = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- PHISHING_CAMPAIGN_TARGETS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_pct_platform_admin ON public.phishing_campaign_targets
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_pct_company_admin ON public.phishing_campaign_targets
  FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.phishing_campaigns pc
      WHERE pc.id::text = phishing_campaign_targets.campaign_id::text
      AND pc.company_id::text = public.get_my_company_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.phishing_campaigns pc
      WHERE pc.id::text = phishing_campaign_targets.campaign_id::text
      AND pc.company_id::text = public.get_my_company_id()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- AUDIT_LOGS (no company_id column)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_audit_logs_platform_admin ON public.audit_logs
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_audit_logs_self_read ON public.audit_logs
  FOR SELECT TO authenticated
  USING (user_id::text = auth.uid()::text);

-- ──────────────────────────────────────────────────────────────
-- DEPARTMENT_VULNERABILITY_STATS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_dvs_platform_admin ON public.department_vulnerability_stats
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_dvs_company ON public.department_vulnerability_stats
  FOR ALL TO authenticated
  USING (company_id::text = public.get_my_company_id())
  WITH CHECK (company_id::text = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- FRAUD_ALERTS (global content — all authenticated read published)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_fraud_alerts_platform_admin ON public.fraud_alerts
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_fraud_alerts_read ON public.fraud_alerts
  FOR SELECT TO authenticated
  USING (is_published = true);

-- ──────────────────────────────────────────────────────────────
-- FRAUD_ALERT_ACKNOWLEDGMENTS (per-user)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_fa_ack_platform_admin ON public.fraud_alert_acknowledgments
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_fa_ack_self ON public.fraud_alert_acknowledgments
  FOR ALL TO authenticated
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);

-- ──────────────────────────────────────────────────────────────
-- SUPPORT_TICKET (uses user_id)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_support_ticket_platform_admin ON public.support_ticket
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_support_ticket_owner ON public.support_ticket
  FOR ALL TO authenticated
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY rls_support_ticket_company_admin_read ON public.support_ticket
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id::text = support_ticket.user_id::text
      AND u.company_id::text = public.get_my_company_id()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- DEMO_REQUESTS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_demo_requests_platform_admin ON public.demo_requests
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_demo_requests_anon_insert ON public.demo_requests
  FOR INSERT TO anon
  WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────
-- PUBLIC_ASSESSMENTS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_public_assessments_platform_admin ON public.public_assessments
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_public_assessments_anon_select ON public.public_assessments
  FOR SELECT TO anon USING (true);

CREATE POLICY rls_public_assessments_anon_insert ON public.public_assessments
  FOR INSERT TO anon WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────
-- PARTNERS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_partners_platform_admin ON public.partners
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_partners_read ON public.partners
  FOR SELECT TO authenticated USING (true);

-- ──────────────────────────────────────────────────────────────
-- HOMEPAGE TABLES
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_homepage_hero_admin ON public.homepage_hero
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_homepage_hero_read ON public.homepage_hero
  FOR SELECT TO anon USING (true);

CREATE POLICY rls_homepage_features_admin ON public.homepage_features
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_homepage_features_read ON public.homepage_features
  FOR SELECT TO anon USING (true);

CREATE POLICY rls_homepage_steps_admin ON public.homepage_steps
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_homepage_steps_read ON public.homepage_steps
  FOR SELECT TO anon USING (true);

CREATE POLICY rls_homepage_settings_admin ON public.homepage_settings
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_homepage_settings_read ON public.homepage_settings
  FOR SELECT TO anon USING (true);
