/*
  RLS BACKUP — RESTORE TO PERMISSIVE STATE
  ==========================================
  Run this script to UNDO the proper RLS policies and go back to
  "any authenticated user can do anything" (the current state before
  migration 20260515000004).

  USE CASE: Something broke after enabling proper RLS → run this to
  instantly restore access while you investigate.

  HOW TO USE:
    1. Go to Supabase → SQL Editor
    2. Paste this entire file and run it
    3. Everything goes back to working (but insecure) state
*/

-- ──────────────────────────────────────────────────────────────
-- Drop all proper RLS policies (added in 20260515000004)
-- ──────────────────────────────────────────────────────────────
DO $$ DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE 'rls_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.is_platform_admin();
DROP FUNCTION IF EXISTS public.get_my_company_id();
DROP FUNCTION IF EXISTS public.get_my_role();

-- ──────────────────────────────────────────────────────────────
-- Restore permissive policies (original state)
-- ──────────────────────────────────────────────────────────────
DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    AND tablename IN (
      'companies','users','departments','courses','company_courses',
      'employee_courses','course_sections','course_section_progress',
      'employee_section_progress','exams','company_exams','exam_questions',
      'assigned_exams','exam_attempts','exam_results','certificate_templates',
      'issued_certificates','subscriptions','invoices','phishing_templates',
      'phishing_domains','phishing_campaign_quotas','phishing_campaign_requests',
      'phishing_campaigns','phishing_campaign_targets','audit_logs',
      'department_vulnerability_stats','fraud_alerts','fraud_alert_acknowledgments',
      'support_ticket','demo_requests','public_assessments','partners',
      'homepage_hero','homepage_features','homepage_steps','homepage_settings'
    )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Allow authenticated all %s" ON public.%I',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "Allow authenticated all %s" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $$;

-- Public tables (anon read)
-- Note: CREATE POLICY IF NOT EXISTS is only valid on PG17+. Use DROP + CREATE for PG15/16 compat.
DROP POLICY IF EXISTS "Allow anon read demo_requests" ON public.demo_requests;
CREATE POLICY "Allow anon read demo_requests" ON public.demo_requests FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon insert public_assessments" ON public.public_assessments;
CREATE POLICY "Allow anon insert public_assessments" ON public.public_assessments FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon select public_assessments" ON public.public_assessments;
CREATE POLICY "Allow anon select public_assessments" ON public.public_assessments FOR SELECT TO anon USING (true);
