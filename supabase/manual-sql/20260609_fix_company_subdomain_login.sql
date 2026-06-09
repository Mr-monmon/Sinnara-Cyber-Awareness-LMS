/*
  Fix: Company subdomain not registered → login page redirects to home
  =====================================================================
  Root cause:
    Migration 20260606000001 created the company_subdomains table and the
    tenant_companies view. The view is used by the frontend before login to
    resolve a subdomain like "grcico" to a company record. If no row exists
    in company_subdomains for that subdomain, the view returns nothing,
    company = null in the frontend, and LoginRoute redirects to the apex home.

  This file:
    A. Pre-check  — diagnose the current state
    B. Main fix   — insert the missing subdomain row(s)
    C. Post-check — confirm the view now resolves correctly
    D. Rollback   — remove the row if something is wrong

  Destructiveness: NON-DESTRUCTIVE (INSERT only, no DROP/ALTER/DELETE)

  Run in: Supabase SQL Editor (postgres / service role)
*/

-- ════════════════════════════════════════════════════════════════════════
-- A. PRE-CHECK — run these first; read the results before running Section B
-- ════════════════════════════════════════════════════════════════════════

-- A1. How many rows are currently in company_subdomains?
--     Expected BEFORE fix: 0 (empty table)
SELECT COUNT(*) AS subdomain_row_count FROM public.company_subdomains;

-- A2. List all existing subdomain registrations (may be empty)
SELECT
  cs.id,
  cs.subdomain,
  cs.is_primary,
  cs.is_active,
  c.name  AS company_name,
  c.id    AS company_id
FROM public.company_subdomains cs
JOIN public.companies c ON c.id = cs.company_id
ORDER BY cs.subdomain;

-- A3. List ALL companies so you can find the correct company_id for grcico.
--     Look for the company whose name matches the grcico tenant.
SELECT
  id,
  name,
  is_active,
  status,
  package_type,
  created_at
FROM public.companies
ORDER BY name;

-- A4. Does the tenant_companies view currently return anything for "grcico"?
--     Expected BEFORE fix: 0 rows
SELECT *
FROM public.tenant_companies
WHERE subdomain = 'grcico';


-- ════════════════════════════════════════════════════════════════════════
-- B. MAIN FIX — insert the missing subdomain row
--    IMPORTANT: Before running, confirm the correct company_id from A3.
--    Replace <COMPANY_ID_FROM_A3> with the actual UUID of the grcico company.
-- ════════════════════════════════════════════════════════════════════════

/*
  Option B1: If you know the exact company name (safest — no UUID copy/paste)
  Replace 'GRC ICO' with the exact company name shown in A3.
*/
INSERT INTO public.company_subdomains (company_id, subdomain, is_primary, is_active)
SELECT
  id,
  'grcico',
  true,   -- is_primary: this is the main subdomain for this company
  true    -- is_active:  enabled
FROM public.companies
WHERE name = 'GRC ICO'   -- ← CHANGE THIS to match the name from A3
ON CONFLICT (subdomain) DO NOTHING;

/*
  Option B2: If you prefer to use the company UUID directly.
  Uncomment and fill in the UUID from A3, then run instead of B1.

INSERT INTO public.company_subdomains (company_id, subdomain, is_primary, is_active)
VALUES (
  '<COMPANY_ID_FROM_A3>',  -- ← paste UUID here
  'grcico',
  true,
  true
)
ON CONFLICT (subdomain) DO NOTHING;
*/

-- Verify the INSERT succeeded (should show 1 row)
SELECT
  cs.id,
  cs.subdomain,
  cs.is_primary,
  cs.is_active,
  c.name AS company_name,
  c.id   AS company_id
FROM public.company_subdomains cs
JOIN public.companies c ON c.id = cs.company_id
WHERE cs.subdomain = 'grcico';


-- ════════════════════════════════════════════════════════════════════════
-- C. POST-CHECK — run after Section B
-- ════════════════════════════════════════════════════════════════════════

-- C1. Does tenant_companies now return the correct company for "grcico"?
--     Expected: 1 row with is_active = true
SELECT
  id,
  name,
  subdomain,
  is_primary,
  is_active,
  package_type,
  license_limit
FROM public.tenant_companies
WHERE subdomain = 'grcico';

-- C2. Full subdomain inventory after fix
SELECT
  cs.subdomain,
  cs.is_primary,
  cs.is_active  AS subdomain_active,
  c.name        AS company_name,
  c.is_active   AS company_active,
  c.status      AS company_status,
  (COALESCE(c.is_active, true) AND cs.is_active) AS effective_is_active
FROM public.company_subdomains cs
JOIN public.companies c ON c.id = cs.company_id
ORDER BY cs.subdomain;

-- C3. Smoke-test: simulate what the frontend anon query does.
--     This is the EXACT query that fetchTenantCompanyBySubdomain() executes.
--     Must return 1 row with is_active = true for login to work.
SELECT id, name, subdomain, is_primary, is_active, package_type, license_limit
FROM public.tenant_companies
WHERE subdomain = 'grcico'
LIMIT 1;

/*
  After C3 returns a row, go to https://grcico.awareone.net/login.
  The login page should now load instead of redirecting home.

  If the company or subdomain is_active = false in C3, the frontend will
  resolve the tenant as "inactive" and still redirect. In that case, check
  the companies table and update is_active = true for this company.
*/


-- ════════════════════════════════════════════════════════════════════════
-- D. ROLLBACK — run ONLY if you need to undo Section B
-- ════════════════════════════════════════════════════════════════════════

/*
  DELETE FROM public.company_subdomains
  WHERE subdomain = 'grcico';
*/
