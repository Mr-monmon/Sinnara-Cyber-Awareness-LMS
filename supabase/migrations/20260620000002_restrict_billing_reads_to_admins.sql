-- Restrict subscription and invoice reads to company administrators.
--
-- `rls_subscriptions_company_read` and `rls_invoices_company_read` scoped reads
-- to the caller's company but checked no role, so EVERY authenticated user in a
-- company — employees included — could read the company's commercial terms:
-- subscription type and status, licence limit, start and end dates, and the full
-- invoice history.
--
-- This was visible in the product, not just theoretically reachable: the
-- employee Account Settings screen reuses the company-admin one, and its
-- Overview tab rendered live subscription details to employees. The companion
-- UI change hides that tab, but the tab was only the messenger — without this
-- migration the rows stay readable to anyone who calls the API directly, so the
-- fix has to be here.
--
-- The neighbouring phishing tables (`company_phishing_limits`,
-- `phishing_campaign_quotas`) already carry role checks and are left alone.
-- Their policies are why the same screen showed employees "No phishing limits
-- are configured" — the read was denied and the UI reported the empty result as
-- an absence of configuration.
--
-- Billing is an administrator concern, so REVIEWER and PHISHING_OPERATOR are
-- deliberately excluded along with EMPLOYEE. PLATFORM_ADMIN keeps full access
-- through its own separate policy.

-- ============================================================================
-- Subscriptions
-- ============================================================================
DROP POLICY IF EXISTS rls_subscriptions_company_read ON public.subscriptions;
CREATE POLICY rls_subscriptions_company_read ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    company_id::text = public.get_my_company_id()
    AND public.get_my_role() IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN')
  );

-- ============================================================================
-- Invoices
-- ============================================================================
DROP POLICY IF EXISTS rls_invoices_company_read ON public.invoices;
CREATE POLICY rls_invoices_company_read ON public.invoices
  FOR SELECT TO authenticated
  USING (
    company_id::text = public.get_my_company_id()
    AND public.get_my_role() IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN')
  );
