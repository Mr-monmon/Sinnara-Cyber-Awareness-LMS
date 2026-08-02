-- Correct the billing RLS restriction, which did not actually take effect.
--
-- 20260620000002 intended to stop non-admins reading subscriptions and invoices.
-- It targeted the policy names in this repo's migration history
-- (`rls_subscriptions_company_read`, `rls_invoices_company_read`), but the live
-- database carries different names — `rls_subs_read` and `rls_inv_read` — which
-- appear in no migration file here. The database has drifted from the tracked
-- schema at some point.
--
-- The consequence was worse than a no-op. `DROP POLICY IF EXISTS` on a name that
-- does not exist succeeds silently, and the CREATE then added a second, properly
-- role-checked policy ALONGSIDE the permissive one. Multiple permissive policies
-- for the same command are OR-ed, so the old policy alone kept granting every
-- authenticated user in the company access to the company's commercial terms.
-- The migration would have reported success while the data stayed exposed.
--
-- This migration drops both naming conventions, recreates the correct policies,
-- and then FAILS LOUDLY if any unexpected SELECT policy survives on either
-- table. A security fix that silently does nothing is the failure mode being
-- corrected here, so it must not be possible to repeat it.

-- ============================================================================
-- 1) Remove every known permissive read policy, under either naming convention
-- ============================================================================
DROP POLICY IF EXISTS rls_subscriptions_company_read ON public.subscriptions;
DROP POLICY IF EXISTS rls_subs_read                  ON public.subscriptions;

DROP POLICY IF EXISTS rls_invoices_company_read      ON public.invoices;
DROP POLICY IF EXISTS rls_inv_read                   ON public.invoices;

-- ============================================================================
-- 2) Recreate them with the role check
-- ============================================================================
-- Billing is an administrator concern. PLATFORM_ADMIN keeps full access through
-- its own separate FOR ALL policy (`rls_subs_pa` / `rls_inv_pa`), which is left
-- untouched.
CREATE POLICY rls_subscriptions_company_read ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    company_id::text = public.get_my_company_id()
    AND public.get_my_role() IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN')
  );

CREATE POLICY rls_invoices_company_read ON public.invoices
  FOR SELECT TO authenticated
  USING (
    company_id::text = public.get_my_company_id()
    AND public.get_my_role() IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN')
  );

-- ============================================================================
-- 3) Refuse to succeed unless the restriction is genuinely the only one
-- ============================================================================
-- Any other permissive SELECT policy on these tables would be OR-ed with the one
-- above and could re-open the hole. Rather than trust that the two names dropped
-- above are exhaustive on every environment, verify it.
DO $$
DECLARE
  v_extra text;
BEGIN
  SELECT string_agg(format('%s.%s', tablename, policyname), ', ')
    INTO v_extra
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('subscriptions', 'invoices')
    AND cmd = 'SELECT'
    AND policyname NOT IN ('rls_subscriptions_company_read', 'rls_invoices_company_read');

  IF v_extra IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected permissive SELECT policy still present on billing tables: %. Permissive policies are OR-ed, so this keeps the data readable by non-admins. Drop or fold it in before applying this migration.', v_extra;
  END IF;
END $$;
