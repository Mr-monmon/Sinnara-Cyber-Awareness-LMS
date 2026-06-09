/*
  Tighten grants on tenant_companies → SELECT-only for anon/authenticated
  =======================================================================
  C4 revealed anon and authenticated hold ALL privileges (INSERT, UPDATE,
  DELETE, TRUNCATE, REFERENCES, TRIGGER, SELECT) on tenant_companies — not
  just SELECT. These come from legacy blanket grants in the schema. Because
  tenant_companies is a simple single-table view, it may be auto-updatable,
  so write privileges here are a real risk (an anon user could attempt to
  write to companies through the view).

  This reduces both roles to SELECT only. Login keeps working — SELECT is
  preserved; only the write privileges are removed.

  Destructiveness: NON-DESTRUCTIVE to data (REVOKE of privileges only)
  Run in: Supabase SQL Editor
*/

-- ── PRE-CHECK: current grants (should show the full set incl. INSERT/UPDATE/…)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'tenant_companies'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- ── MAIN FIX
BEGIN;

REVOKE ALL ON public.tenant_companies FROM anon;
REVOKE ALL ON public.tenant_companies FROM authenticated;

GRANT SELECT ON public.tenant_companies TO anon;
GRANT SELECT ON public.tenant_companies TO authenticated;

-- service_role keeps full access for backend operations
GRANT SELECT ON public.tenant_companies TO service_role;

COMMIT;

-- ── POST-CHECK: each role should now show SELECT only (exactly one row each)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'tenant_companies'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- ── Re-confirm login query still works (must still return the grcico row)
SELECT id, name, subdomain, is_primary, is_active, package_type, license_limit
FROM public.tenant_companies
WHERE subdomain = 'grcico'
LIMIT 1;

-- ── ROLLBACK (only if needed — restores broad grants; NOT recommended)
/*
  GRANT ALL ON public.tenant_companies TO anon, authenticated;
*/
