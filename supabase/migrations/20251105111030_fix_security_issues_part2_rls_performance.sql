/*
  # Fix Security Issues - Part 2: RLS Performance & Remove Unused Indexes
  
  1. RLS Performance Optimization
    - Fix auth function calls in RLS policies
    - Replace auth.<function>() with (select auth.<function>())
    - Prevents re-evaluation for each row
  
  2. Remove Unused Indexes
    - Drop 24 unused indexes to reduce maintenance overhead
    - Improves INSERT/UPDATE performance
    - Reduces storage footprint
  
  3. Fix Multiple Permissive Policies
    - Consolidate department_vulnerability_stats policies
    - Use single restrictive policy with OR conditions
*/

-- ============================================================================
-- 1. FIX RLS PERFORMANCE ISSUES
-- ============================================================================

-- Drop and recreate department_vulnerability_stats policies with optimized auth calls
DROP POLICY IF EXISTS "Platform admins can manage department stats" ON public.department_vulnerability_stats;
DROP POLICY IF EXISTS "Company admins can view own department stats" ON public.department_vulnerability_stats;

-- Create single policy with optimized auth function calls
CREATE POLICY "Admins can manage department stats"
  ON public.department_vulnerability_stats
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = (SELECT auth.uid())
      AND (
        users.role = 'platform_admin'
        OR (
          users.role = 'company_admin' 
          AND users.company_id = department_vulnerability_stats.company_id
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = (SELECT auth.uid())
      AND (
        users.role = 'platform_admin'
        OR (
          users.role = 'company_admin' 
          AND users.company_id = department_vulnerability_stats.company_id
        )
      )
    )
  );

-- ============================================================================
-- 2. REMOVE UNUSED INDEXES
-- ============================================================================

-- Remove unused indexes to improve write performance
DROP INDEX IF EXISTS public.idx_courses_visibility;
DROP INDEX IF EXISTS public.idx_employee_courses_completion;
DROP INDEX IF EXISTS public.idx_subscriptions_reminder;
DROP INDEX IF EXISTS public.idx_exams_prerequisite;
DROP INDEX IF EXISTS public.idx_invoices_subscription_id;
DROP INDEX IF EXISTS public.idx_issued_certificates_template_id;
DROP INDEX IF EXISTS public.idx_quizzes_course_id;
DROP INDEX IF EXISTS public.idx_certificate_templates_course_id;
DROP INDEX IF EXISTS public.idx_company_courses_course_id;
DROP INDEX IF EXISTS public.idx_company_exams_exam_id;
DROP INDEX IF EXISTS public.idx_course_sections_course_id;
DROP INDEX IF EXISTS public.idx_users_company_id;
DROP INDEX IF EXISTS public.idx_users_department_id;
DROP INDEX IF EXISTS public.idx_campaign_requests_status;
DROP INDEX IF EXISTS public.idx_campaigns_request;
DROP INDEX IF EXISTS public.idx_campaign_targets_campaign;
DROP INDEX IF EXISTS public.idx_campaign_targets_employee;
DROP INDEX IF EXISTS public.idx_phishing_domains_company;
DROP INDEX IF EXISTS public.idx_login_activity_user;
DROP INDEX IF EXISTS public.idx_login_activity_company;
DROP INDEX IF EXISTS public.idx_login_activity_date;
DROP INDEX IF EXISTS public.idx_partners_active;
DROP INDEX IF EXISTS public.idx_dept_vuln_stats_company;
DROP INDEX IF EXISTS public.idx_dept_vuln_stats_dept;
DROP INDEX IF EXISTS public.idx_dept_vuln_stats_campaign;
