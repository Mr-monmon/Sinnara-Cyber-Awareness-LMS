/*
  Phase 6b — RLS sweep: PHISHING_OPERATOR role alignment (section M)

  Two classes of problems addressed:

  CLASS A — EMPLOYEE-accessible phishing tables
    phishing_campaigns and phishing_campaign_requests used get_my_company_id()
    as the only USING guard. Any authenticated company user (including
    EMPLOYEE role) could read/write all phishing data for their company.
    Adding a get_my_role() IN (...) guard confines access to
    phishing-capable roles only.

  CLASS B — PHISHING_OPERATOR invisible to phishing tables
    All company-facing phishing policies were written for COMPANY_ADMIN only.
    PHISHING_OPERATOR existed in the schema (20260518000004) but had no
    READ/WRITE grants on any phishing table, so the phishing UI would
    silently return empty data or permission errors for that role.
    Adding COMPANY_SUPER_ADMIN and PHISHING_OPERATOR to each policy gives
    them full company-scoped access consistent with the role's purpose.

  Tables updated (DROP + recreate, idempotent):
    phishing_campaigns               (rls_pc_company)
    phishing_campaign_requests       (rls_pcr_company)
    phishing_campaign_quotas         (rls_pcq_company_read)
    phishing_campaign_targets        (rls_pct_company_admin)
    phishing_groups                  (company_admin_groups_own)
    phishing_group_members           (company_admin_group_members_own)
    phishing_company_landing_pages   (company_admin_landing_pages_own)
    phishing_company_email_templates (company_admin_co_templates_own)
    phishing_events                  (ca_events_own)
    phishing_alerts                  (ca_alerts_own)
    phishing_scenarios               (ca_scenarios_read)
    phishing_custom_variables        (ca_customvars_own)
    smtp_profiles                    (company_admin_smtp_select, company_admin_smtp_delete)

  Already correct (left unchanged):
    campaign_email_queue    — updated in Phase 4 to include PHISHING_OPERATOR
    company_phishing_limits — updated in 20260602000001 to include PHISHING_OPERATOR
*/

-- ── phishing_campaigns ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS rls_pc_company ON public.phishing_campaigns;
CREATE POLICY rls_pc_company ON public.phishing_campaigns
  FOR ALL TO authenticated
  USING (
    company_id::text = public.get_my_company_id()
    AND public.get_my_role() IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
  )
  WITH CHECK (
    company_id::text = public.get_my_company_id()
    AND public.get_my_role() IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
  );

-- ── phishing_campaign_requests ────────────────────────────────────────────────
DROP POLICY IF EXISTS rls_pcr_company ON public.phishing_campaign_requests;
CREATE POLICY rls_pcr_company ON public.phishing_campaign_requests
  FOR ALL TO authenticated
  USING (
    company_id::text = public.get_my_company_id()
    AND public.get_my_role() IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
  )
  WITH CHECK (
    company_id::text = public.get_my_company_id()
    AND public.get_my_role() IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
  );

-- ── phishing_campaign_quotas ──────────────────────────────────────────────────
DROP POLICY IF EXISTS rls_pcq_company_read ON public.phishing_campaign_quotas;
CREATE POLICY rls_pcq_company_read ON public.phishing_campaign_quotas
  FOR SELECT TO authenticated
  USING (
    company_id::text = public.get_my_company_id()
    AND public.get_my_role() IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
  );

-- ── phishing_campaign_targets ─────────────────────────────────────────────────
DROP POLICY IF EXISTS rls_pct_company_admin ON public.phishing_campaign_targets;
CREATE POLICY rls_pct_company_admin ON public.phishing_campaign_targets
  FOR ALL TO authenticated
  USING (
    public.get_my_role() IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
    AND EXISTS (
      SELECT 1 FROM public.phishing_campaigns pc
      WHERE pc.id::text = phishing_campaign_targets.campaign_id::text
        AND pc.company_id::text = public.get_my_company_id()
    )
  )
  WITH CHECK (
    public.get_my_role() IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
    AND EXISTS (
      SELECT 1 FROM public.phishing_campaigns pc
      WHERE pc.id::text = phishing_campaign_targets.campaign_id::text
        AND pc.company_id::text = public.get_my_company_id()
    )
  );

-- ── phishing_groups ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_admin_groups_own" ON public.phishing_groups;
CREATE POLICY "company_admin_groups_own" ON public.phishing_groups
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid()
        AND role IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
    )
  );

-- ── phishing_group_members ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_admin_group_members_own" ON public.phishing_group_members;
CREATE POLICY "company_admin_group_members_own" ON public.phishing_group_members
  FOR ALL
  USING (
    group_id IN (
      SELECT id FROM public.phishing_groups
      WHERE company_id IN (
        SELECT company_id FROM public.users
        WHERE id = auth.uid()
          AND role IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
      )
    )
  );

-- ── phishing_company_landing_pages ────────────────────────────────────────────
DROP POLICY IF EXISTS "company_admin_landing_pages_own" ON public.phishing_company_landing_pages;
CREATE POLICY "company_admin_landing_pages_own" ON public.phishing_company_landing_pages
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid()
        AND role IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
    )
  );

-- ── phishing_company_email_templates ─────────────────────────────────────────
DROP POLICY IF EXISTS "company_admin_co_templates_own" ON public.phishing_company_email_templates;
CREATE POLICY "company_admin_co_templates_own" ON public.phishing_company_email_templates
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid()
        AND role IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
    )
  );

-- ── phishing_events ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ca_events_own" ON public.phishing_events;
CREATE POLICY "ca_events_own" ON public.phishing_events
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid()
        AND role IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
    )
  );

-- ── phishing_alerts ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ca_alerts_own" ON public.phishing_alerts;
CREATE POLICY "ca_alerts_own" ON public.phishing_alerts
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid()
        AND role IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
    )
  );

-- ── phishing_scenarios ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ca_scenarios_read" ON public.phishing_scenarios;
CREATE POLICY "ca_scenarios_read" ON public.phishing_scenarios
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
    )
  );

-- ── phishing_custom_variables ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "ca_customvars_own" ON public.phishing_custom_variables;
CREATE POLICY "ca_customvars_own" ON public.phishing_custom_variables
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid()
        AND role IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
    )
  );

-- ── smtp_profiles ─────────────────────────────────────────────────────────────
-- Broaden the COMPANY_ADMIN-only SELECT / DELETE policies to include
-- COMPANY_SUPER_ADMIN and PHISHING_OPERATOR so they can select and manage
-- SMTP profiles from the phishing campaign wizard.
DROP POLICY IF EXISTS "company_admin_smtp_select" ON public.smtp_profiles;
CREATE POLICY "company_admin_smtp_select" ON public.smtp_profiles
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid()
        AND role IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
    )
  );

DROP POLICY IF EXISTS "company_admin_smtp_delete" ON public.smtp_profiles;
CREATE POLICY "company_admin_smtp_delete" ON public.smtp_profiles
  FOR DELETE
  USING (
    is_platform_profile = false
    AND company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid()
        AND role IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
    )
  );
