/*
  PRODUCTION READINESS — Phase 1 (schema alignment) + Phase 2 (RLS helpers)
  + Phase 4B (quota consumption timing).
  ==========================================================================
  Runs LAST, so it is the canonical source of truth for the objects below.
  It DROP/CREATEs the final policy set for the tables created early in
  20251027140000, and adds the remaining missing objects:
    - helper role functions
    - company_subdomains table + tenant_companies view
    - certificates compatibility view (over issued_certificates)
    - increment_article_view_count RPC
    - emails storage bucket (guarded)
    - draft-safe phishing quota consumption
*/

-- ════════════════════════════════════════════════════════════════════════
-- 1. ROLE HELPER FUNCTIONS  (is_platform_admin already exists from 000004)
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin_role()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('COMPANY_SUPER_ADMIN','COMPANY_ADMIN')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_readonly_role()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'REVIEWER'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_company()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin() OR public.is_company_admin_role();
$$;

CREATE OR REPLACE FUNCTION public.can_manage_phishing()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('PLATFORM_ADMIN','COMPANY_SUPER_ADMIN','COMPANY_ADMIN','PHISHING_OPERATOR')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_review_company()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin() OR public.is_company_admin_role() OR public.is_company_readonly_role();
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 2. support_ticket — company auto-fill trigger + canonical RLS
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.support_ticket_set_company()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.users WHERE id = NEW.user_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_support_ticket_set_company ON public.support_ticket;
CREATE TRIGGER trg_support_ticket_set_company
  BEFORE INSERT OR UPDATE ON public.support_ticket
  FOR EACH ROW EXECUTE FUNCTION public.support_ticket_set_company();

-- Drop interim policies (from 20260515000004) then create the canonical set.
DROP POLICY IF EXISTS rls_support_ticket_platform_admin   ON public.support_ticket;
DROP POLICY IF EXISTS rls_support_ticket_owner            ON public.support_ticket;
DROP POLICY IF EXISTS rls_support_ticket_company_admin_read ON public.support_ticket;

CREATE POLICY rls_support_ticket_platform_admin ON public.support_ticket
  FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY rls_support_ticket_owner_select ON public.support_ticket
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY rls_support_ticket_owner_insert ON public.support_ticket
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY rls_support_ticket_owner_delete ON public.support_ticket
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY rls_support_ticket_company_admin_read ON public.support_ticket
  FOR SELECT TO authenticated
  USING (public.is_company_admin_role() AND company_id = public.current_company_id());
CREATE POLICY rls_support_ticket_company_admin_update ON public.support_ticket
  FOR UPDATE TO authenticated
  USING (public.is_company_admin_role() AND company_id = public.current_company_id())
  WITH CHECK (public.is_company_admin_role() AND company_id = public.current_company_id());

-- ════════════════════════════════════════════════════════════════════════
-- 3. articles — canonical RLS (public read published; platform admin manage)
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "rls_articles_anon_read" ON public.articles;
DROP POLICY IF EXISTS "rls_articles_pa"        ON public.articles;

CREATE POLICY rls_articles_public_read ON public.articles
  FOR SELECT TO anon, authenticated USING (published = true);
CREATE POLICY rls_articles_platform_admin ON public.articles
  FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- ════════════════════════════════════════════════════════════════════════
-- 4. company_course_departments — canonical RLS
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "rls_ccd_pa" ON public.company_course_departments;
DROP POLICY IF EXISTS "rls_ccd_ca" ON public.company_course_departments;

CREATE POLICY rls_ccd_platform_admin ON public.company_course_departments
  FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY rls_ccd_company_admin ON public.company_course_departments
  FOR ALL TO authenticated
  USING (public.is_company_admin_role() AND company_id = public.current_company_id())
  WITH CHECK (public.is_company_admin_role() AND company_id = public.current_company_id());
CREATE POLICY rls_ccd_company_read ON public.company_course_departments
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

-- ════════════════════════════════════════════════════════════════════════
-- 5. company_subdomains (tenant mapping) + tenant_companies view
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.company_subdomains (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subdomain  text NOT NULL UNIQUE,
  is_primary boolean NOT NULL DEFAULT false,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_subdomains_format_chk CHECK (
    subdomain = lower(subdomain)
    AND subdomain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
    AND subdomain NOT IN
      ('app','admin','api','www','mail','support','platform','dashboard','login')
  )
);
CREATE INDEX IF NOT EXISTS idx_company_subdomains_company ON public.company_subdomains(company_id);
ALTER TABLE public.company_subdomains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_company_subdomains_platform_admin ON public.company_subdomains;
DROP POLICY IF EXISTS rls_company_subdomains_company_read   ON public.company_subdomains;
CREATE POLICY rls_company_subdomains_platform_admin ON public.company_subdomains
  FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY rls_company_subdomains_company_read ON public.company_subdomains
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());

-- Public tenant-resolution view: minimal, non-sensitive identity fields only.
-- Runs with the view owner's privileges (no security_invoker) so anonymous
-- visitors can resolve a tenant before authenticating. Exposes ONLY public
-- branding/identity columns — never user, billing, or campaign data.
DROP VIEW IF EXISTS public.tenant_companies;
CREATE VIEW public.tenant_companies AS
SELECT
  c.id,
  c.name,
  cs.subdomain,
  cs.is_primary,
  (COALESCE(c.is_active, true) AND cs.is_active) AS is_active,
  c.package_type,
  c.license_limit
FROM public.company_subdomains cs
JOIN public.companies c ON c.id = cs.company_id;
GRANT SELECT ON public.tenant_companies TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 6. certificates — compatibility view over issued_certificates
-- ════════════════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.certificates;
CREATE VIEW public.certificates
  WITH (security_invoker = on) AS
SELECT
  id,
  employee_id AS user_id,
  course_id,
  certificate_number,
  employee_name,
  course_name,
  completion_date,
  score,
  pdf_url,
  issued_at,
  issued_by
FROM public.issued_certificates;
GRANT SELECT ON public.certificates TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 7. increment_article_view_count RPC  (param name matches frontend)
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.increment_article_view_count(article_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.articles
  SET view_count = view_count + 1
  WHERE id = article_id AND published = true;
$$;
GRANT EXECUTE ON FUNCTION public.increment_article_view_count(uuid) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 8. emails storage bucket (guarded — storage schema may be absent in CI)
-- ════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('emails', 'emails', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('storage.objects') IS NOT NULL THEN
    BEGIN
      EXECUTE $p$CREATE POLICY "emails_public_read" ON storage.objects
        FOR SELECT TO anon, authenticated USING (bucket_id = 'emails')$p$;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      EXECUTE $p$CREATE POLICY "emails_admin_write" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'emails' AND public.is_platform_admin())$p$;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════
-- 9. Phase 4B — draft-safe phishing quota consumption
--    DRAFT campaigns must NOT consume annual quota. Quota is consumed once,
--    when a campaign first becomes SCHEDULED/RUNNING (or is created active),
--    tracked idempotently via quota_consumed_at.
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.phishing_campaigns
  ADD COLUMN IF NOT EXISTS quota_consumed_at timestamptz;

CREATE OR REPLACE FUNCTION public.consume_phishing_quota(p_company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.phishing_campaign_quotas (company_id, quota_year, annual_quota, used_campaigns)
  VALUES (p_company_id, EXTRACT(YEAR FROM CURRENT_DATE)::int, 4, 1)
  ON CONFLICT (company_id, quota_year) DO UPDATE
    SET used_campaigns = phishing_campaign_quotas.used_campaigns + 1,
        updated_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.deduct_quota_on_campaign_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('SCHEDULED','RUNNING') AND NEW.quota_consumed_at IS NULL THEN
    PERFORM public.consume_phishing_quota(NEW.company_id);
    NEW.quota_consumed_at := now();
  END IF;
  RETURN NEW;
END; $$;

-- BEFORE so we can set quota_consumed_at on the row; fires on insert and on
-- any status change (draft → scheduled/running).
DROP TRIGGER IF EXISTS trg_deduct_quota_on_campaign_insert ON public.phishing_campaigns;
DROP TRIGGER IF EXISTS trg_deduct_quota_on_campaign        ON public.phishing_campaigns;
CREATE TRIGGER trg_deduct_quota_on_campaign
  BEFORE INSERT OR UPDATE OF status ON public.phishing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.deduct_quota_on_campaign_insert();

-- Refund only campaigns that actually consumed quota (never refund a draft).
CREATE OR REPLACE FUNCTION public.refund_quota_on_campaign_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.quota_consumed_at IS NOT NULL THEN
    UPDATE public.phishing_campaign_quotas
    SET used_campaigns = GREATEST(0, used_campaigns - 1),
        updated_at     = now()
    WHERE company_id = OLD.company_id
      AND quota_year  = EXTRACT(YEAR FROM OLD.created_at)::int;
  END IF;
  RETURN OLD;
END; $$;
