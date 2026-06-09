/*
  Fix: Create the missing tenant_companies view → restores tenant login
  =====================================================================
  Diagnosis (from D1–D5):
    - In production, the subdomain lives directly on the companies table
      (companies.subdomain), NOT on a company_subdomains mapping table.
    - company_subdomains is a thin VIEW (id, subdomain) — not a table.
    - The tenant_companies view that the frontend queries does NOT exist.

  The frontend (resolveTenantBySubdomain → fetchTenantCompanyBySubdomain)
  selects these columns from public.tenant_companies:
      id, name, subdomain, is_primary, is_active, package_type, license_limit
  Because the view is missing, the query errors, company resolves to null,
  and LoginRoute redirects every tenant subdomain to the apex home.

  This file creates tenant_companies to match production's real schema and
  grants anon SELECT so unauthenticated visitors can resolve a tenant before
  logging in. It exposes ONLY public identity columns (no users, billing,
  or campaign data), so it is safe to run WITHOUT security_invoker.

  Destructiveness: NON-DESTRUCTIVE (creates a view + grant; data untouched)
  Run in: Supabase SQL Editor
*/

-- ════════════════════════════════════════════════════════════════════════
-- A. PRE-CHECK
-- ════════════════════════════════════════════════════════════════════════

-- A1. Confirm tenant_companies does NOT exist yet (expected: 0 rows)
SELECT schemaname, viewname
FROM pg_views
WHERE schemaname = 'public' AND viewname = 'tenant_companies';

-- A2. Confirm the grcico company row exists and is active
SELECT id, name, subdomain, is_active, status, package_type, license_limit
FROM public.companies
WHERE subdomain = 'grcico';

-- A3. Preview every company that will appear in the new view
SELECT id, name, subdomain, is_active, package_type, license_limit
FROM public.companies
WHERE subdomain IS NOT NULL
ORDER BY subdomain;


-- ════════════════════════════════════════════════════════════════════════
-- B. MAIN FIX — create the view + grant anon read
-- ════════════════════════════════════════════════════════════════════════
BEGIN;

DROP VIEW IF EXISTS public.tenant_companies;

CREATE VIEW public.tenant_companies AS
SELECT
  c.id,
  c.name,
  c.subdomain,
  true                          AS is_primary,   -- one subdomain per company here
  COALESCE(c.is_active, true)   AS is_active,
  c.package_type,
  c.license_limit
FROM public.companies c
WHERE c.subdomain IS NOT NULL;

-- Anonymous visitors must read this BEFORE authenticating to resolve a tenant.
GRANT SELECT ON public.tenant_companies TO anon, authenticated;

COMMIT;


-- ════════════════════════════════════════════════════════════════════════
-- C. POST-CHECK
-- ════════════════════════════════════════════════════════════════════════

-- C1. View now exists?
SELECT schemaname, viewname
FROM pg_views
WHERE schemaname = 'public' AND viewname = 'tenant_companies';

-- C2. EXACT query the frontend runs for grcico (must return 1 active row)
SELECT id, name, subdomain, is_primary, is_active, package_type, license_limit
FROM public.tenant_companies
WHERE subdomain = 'grcico'
LIMIT 1;

-- C3. Full tenant inventory
SELECT subdomain, name, is_active, package_type, license_limit
FROM public.tenant_companies
ORDER BY subdomain;

-- C4. Confirm anon has SELECT (expected: a row granting SELECT to anon)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'tenant_companies'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

/*
  After C2 returns a row with is_active = true:
  open https://grcico.awareone.net/login — the login form should now render.

  If is_active = false for grcico, the frontend will treat the tenant as
  "inactive" and still redirect. Fix the company first:
      UPDATE public.companies SET is_active = true WHERE subdomain = 'grcico';
*/


-- ════════════════════════════════════════════════════════════════════════
-- D. ROLLBACK
-- ════════════════════════════════════════════════════════════════════════
/*
  DROP VIEW IF EXISTS public.tenant_companies;
*/
