/*
  PROPER RLS POLICIES — TENANT ISOLATION
  =======================================
  Replaces permissive "allow all authenticated" policies with
  role-based, tenant-isolated policies.

  ROLES (from users.role):
    PLATFORM_ADMIN  — full access to everything
    COMPANY_ADMIN   — only their own company's data
    EMPLOYEE        — only their own data

  ROLLBACK: run 20260515000003_rls_backup_restore.sql
*/

-- ──────────────────────────────────────────────────────────────
-- Helper functions (SECURITY DEFINER so RLS can't block them)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN'
  );
$$;

-- ──────────────────────────────────────────────────────────────
-- Drop all existing permissive policies
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
  USING (id = public.get_my_company_id());

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
    AND company_id = public.get_my_company_id()
  )
  WITH CHECK (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND company_id = public.get_my_company_id()
  );

CREATE POLICY rls_users_self ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY rls_users_self_update ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- DEPARTMENTS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_departments_platform_admin ON public.departments
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_departments_company ON public.departments
  FOR ALL TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- COURSES (platform-managed content — all can read)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_courses_platform_admin ON public.courses
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_courses_read ON public.courses
  FOR SELECT TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────────────────
-- COMPANY_COURSES (which courses a company has access to)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_company_courses_platform_admin ON public.company_courses
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_company_courses_read ON public.company_courses
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- EMPLOYEE_COURSES (course assignments per employee)
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
      WHERE u.id = employee_id AND u.company_id = public.get_my_company_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = employee_id AND u.company_id = public.get_my_company_id()
    )
  );

CREATE POLICY rls_employee_courses_self ON public.employee_courses
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- COURSE_SECTIONS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_course_sections_platform_admin ON public.course_sections
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_course_sections_read ON public.course_sections
  FOR SELECT TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────────────────
-- COURSE_SECTION_PROGRESS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_course_section_progress_platform_admin ON public.course_section_progress
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_course_section_progress_company_admin ON public.course_section_progress
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = user_id AND u.company_id = public.get_my_company_id()
    )
  );

CREATE POLICY rls_course_section_progress_self ON public.course_section_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- EMPLOYEE_SECTION_PROGRESS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_employee_section_progress_platform_admin ON public.employee_section_progress
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_employee_section_progress_company_admin ON public.employee_section_progress
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = employee_id AND u.company_id = public.get_my_company_id()
    )
  );

CREATE POLICY rls_employee_section_progress_self ON public.employee_section_progress
  FOR ALL TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- EXAMS (platform content)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_exams_platform_admin ON public.exams
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_exams_read ON public.exams
  FOR SELECT TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────────────────
-- COMPANY_EXAMS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_company_exams_platform_admin ON public.company_exams
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_company_exams_read ON public.company_exams
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- EXAM_QUESTIONS (platform content)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_exam_questions_platform_admin ON public.exam_questions
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_exam_questions_read ON public.exam_questions
  FOR SELECT TO authenticated
  USING (true);

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
    AND company_id = public.get_my_company_id()
  )
  WITH CHECK (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND company_id = public.get_my_company_id()
  );

CREATE POLICY rls_assigned_exams_self ON public.assigned_exams
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

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
      WHERE u.id = employee_id AND u.company_id = public.get_my_company_id()
    )
  );

CREATE POLICY rls_exam_attempts_self ON public.exam_attempts
  FOR ALL TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

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
      WHERE u.id = employee_id AND u.company_id = public.get_my_company_id()
    )
  );

CREATE POLICY rls_exam_results_self ON public.exam_results
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- CERTIFICATE_TEMPLATES (platform content)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_certificate_templates_platform_admin ON public.certificate_templates
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_certificate_templates_read ON public.certificate_templates
  FOR SELECT TO authenticated
  USING (true);

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
      WHERE u.id = employee_id AND u.company_id = public.get_my_company_id()
    )
  );

CREATE POLICY rls_issued_certificates_self ON public.issued_certificates
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_subscriptions_platform_admin ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_subscriptions_company_read ON public.subscriptions
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- INVOICES
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_invoices_platform_admin ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_invoices_company_read ON public.invoices
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- PHISHING_TEMPLATES (platform content)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_phishing_templates_platform_admin ON public.phishing_templates
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_phishing_templates_read ON public.phishing_templates
  FOR SELECT TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────────────────
-- PHISHING_DOMAINS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_phishing_domains_platform_admin ON public.phishing_domains
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Company admins can only see verified platform domains
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
CREATE POLICY rls_phishing_campaign_quotas_platform_admin ON public.phishing_campaign_quotas
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_phishing_campaign_quotas_company_read ON public.phishing_campaign_quotas
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- PHISHING_CAMPAIGN_REQUESTS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_phishing_campaign_requests_platform_admin ON public.phishing_campaign_requests
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_phishing_campaign_requests_company ON public.phishing_campaign_requests
  FOR ALL TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- PHISHING_CAMPAIGNS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_phishing_campaigns_platform_admin ON public.phishing_campaigns
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_phishing_campaigns_company ON public.phishing_campaigns
  FOR ALL TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- PHISHING_CAMPAIGN_TARGETS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_phishing_campaign_targets_platform_admin ON public.phishing_campaign_targets
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_phishing_campaign_targets_company_admin ON public.phishing_campaign_targets
  FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.phishing_campaigns pc
      WHERE pc.id = campaign_id AND pc.company_id = public.get_my_company_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.phishing_campaigns pc
      WHERE pc.id = campaign_id AND pc.company_id = public.get_my_company_id()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- AUDIT_LOGS (no company_id column — only platform admin)
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
CREATE POLICY rls_dept_vuln_stats_platform_admin ON public.department_vulnerability_stats
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_dept_vuln_stats_company ON public.department_vulnerability_stats
  FOR ALL TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- FRAUD_ALERTS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_fraud_alerts_platform_admin ON public.fraud_alerts
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_fraud_alerts_company ON public.fraud_alerts
  FOR ALL TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- ──────────────────────────────────────────────────────────────
-- FRAUD_ALERT_ACKNOWLEDGMENTS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_fraud_ack_platform_admin ON public.fraud_alert_acknowledgments
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_fraud_ack_company_admin ON public.fraud_alert_acknowledgments
  FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.fraud_alerts fa
      WHERE fa.id = alert_id AND fa.company_id = public.get_my_company_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.fraud_alerts fa
      WHERE fa.id = alert_id AND fa.company_id = public.get_my_company_id()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- SUPPORT_TICKET (uses user_id, cast to text to handle either type)
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
      AND u.company_id = public.get_my_company_id()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- DEMO_REQUESTS (anon insert + platform admin full access)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_demo_requests_platform_admin ON public.demo_requests
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_demo_requests_anon_insert ON public.demo_requests
  FOR INSERT TO anon
  WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────
-- PUBLIC_ASSESSMENTS (anon accessible)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_public_assessments_platform_admin ON public.public_assessments
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_public_assessments_anon_select ON public.public_assessments
  FOR SELECT TO anon
  USING (true);

CREATE POLICY rls_public_assessments_anon_insert ON public.public_assessments
  FOR INSERT TO anon
  WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────
-- PARTNERS
-- ──────────────────────────────────────────────────────────────
CREATE POLICY rls_partners_platform_admin ON public.partners
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_partners_read ON public.partners
  FOR SELECT TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────────────────
-- HOMEPAGE TABLES (public read, platform admin write)
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
