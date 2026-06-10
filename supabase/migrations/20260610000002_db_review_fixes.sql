-- Database review fixes (2026-06-10)
-- Findings from a full review of RLS policies, functions, triggers and views.
-- Each section is independent and idempotent.

-- ============================================================================
-- 1) TENANT ISOLATION — enable security_invoker on leaking views
-- ============================================================================
-- These views read employee PII / scores across ALL companies. Without
-- security_invoker they execute as the view owner and BYPASS RLS, so any
-- authenticated user could read other companies' data by querying the view
-- directly (the app filters by company_id, but the DB did not enforce it).
-- All underlying tables already have COMPANY_ADMIN / self policies
-- (users.rls_users_ca, exam_results.rls_exam_res_ca, phishing_events.ca_events_own,
-- phishing_campaign_targets.rls_pct_ca, assigned_exams.rls_assigned_exams_*,
-- departments.rls_departments_co), so legitimate filtered queries keep working.
ALTER VIEW public.employee_phishing_summary SET (security_invoker = on);
ALTER VIEW public.exam_attempts_detail      SET (security_invoker = on);
ALTER VIEW public.employee_available_exams  SET (security_invoker = on);

-- ============================================================================
-- 2) PHISHING QUOTA — remove duplicate deduction trigger
-- ============================================================================
-- phishing_campaigns had TWO AFTER INSERT triggers deducting quota:
--   * on_campaign_created -> deduct_campaign_quota()        (unconditional +1, no year filter)
--   * trg_deduct_quota_on_campaign_insert -> deduct_quota_on_campaign_insert()
-- The second one is correct (skips TICKET campaigns already charged at request
-- time via consume_campaign_quota, charges CUSTOM campaigns once). The first
-- caused CUSTOM campaigns to be charged twice and TICKET campaigns to be
-- charged an extra wrong time. Drop the legacy trigger + its function.
DROP TRIGGER IF EXISTS on_campaign_created ON public.phishing_campaigns;
DROP FUNCTION IF EXISTS public.deduct_campaign_quota();

-- ============================================================================
-- 3) DEAD CODE — functions referencing the dropped employee_section_progress
-- ============================================================================
-- employee_section_progress was dropped in the progress-tracking cleanup, but
-- these two functions still read from it. They are not attached to any trigger
-- and are not called from app/edge code, so they are dead and would error if
-- ever invoked. sync_employee_course_progress is the live source of truth.
DROP FUNCTION IF EXISTS public.update_course_completion();
DROP FUNCTION IF EXISTS public.calculate_course_progress(uuid, uuid);

-- ============================================================================
-- 4) DEAD COLUMN — employee_courses.completion_percentage
-- ============================================================================
-- Duplicate of progress_percentage. Only the now-dropped update_course_completion()
-- ever wrote it, so it was always 0. The app reads progress_percentage.
ALTER TABLE public.employee_courses DROP COLUMN IF EXISTS completion_percentage;

-- ============================================================================
-- 5) RLS CONSISTENCY — add missing COMPANY_ADMIN policies
-- ============================================================================
-- course_section_progress had only platform-admin + self. Add company-admin so
-- section-level drill-downs work for the admin's own employees (mirrors the
-- employee_courses fix).
DROP POLICY IF EXISTS rls_csp_ca ON public.course_section_progress;
CREATE POLICY rls_csp_ca ON public.course_section_progress
  FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id::text = course_section_progress.employee_id::text
        AND u.company_id::text = public.get_my_company_id()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id::text = course_section_progress.employee_id::text
        AND u.company_id::text = public.get_my_company_id()
    )
  );

-- fraud_alert_acknowledgments had only platform-admin + self. Add company-admin
-- (read-only) so an admin can report on their own employees' acknowledgements.
DROP POLICY IF EXISTS rls_fa_ack_ca ON public.fraud_alert_acknowledgments;
CREATE POLICY rls_fa_ack_ca ON public.fraud_alert_acknowledgments
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'COMPANY_ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id::text = fraud_alert_acknowledgments.user_id::text
        AND u.company_id::text = public.get_my_company_id()
    )
  );

-- ============================================================================
-- 6) CLEANUP — duplicate self-read policy on users
-- ============================================================================
-- users had two identical self-SELECT policies (rls_users_self and
-- users_read_own). Drop the redundant one; rls_users_self is kept.
DROP POLICY IF EXISTS users_read_own ON public.users;
