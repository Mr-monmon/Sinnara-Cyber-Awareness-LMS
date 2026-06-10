-- Fix: Company Admins cannot see their employees' course progress.
--
-- The employee_courses table had only two RLS policies in production:
--   * rls_emp_courses_pa   (platform admin, ALL)
--   * rls_emp_courses_self (employee reads own rows, SELECT)
-- The COMPANY_ADMIN policy was never applied, so every company-admin facing
-- view (CompanyDashboard, AnalyticsPage, EmployeeDetailPage, Risk Scores,
-- Compliance Readiness) read ZERO course rows and reported 0% completion even
-- for employees who had completed courses (their issued_certificates showed up
-- because issued_certificates DOES have a company-admin SELECT policy).
--
-- This adds the missing company-admin policy, mirroring rls_issued_cert_ca:
-- a company admin may access employee_courses rows for employees that belong
-- to their own company. FOR ALL (with WITH CHECK) so the same scope also
-- covers course assignment / withdrawal performed by the company admin.

DROP POLICY IF EXISTS rls_emp_courses_ca ON public.employee_courses;

CREATE POLICY rls_emp_courses_ca ON public.employee_courses
  FOR ALL
  TO authenticated
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
