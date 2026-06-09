/*
  DIAGNOSTIC ONLY — discover the ACTUAL production schema
  =======================================================
  Your production company_subdomains table does NOT match the migration file:
    - It has 4 rows (not empty)
    - It has NO company_id column
    - The tenant_companies view does not exist

  Run ALL of these and paste the results back. Nothing here changes data.
  Destructiveness: NON-DESTRUCTIVE (read-only)
*/

-- D1. Actual columns of company_subdomains (the real production schema)
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'company_subdomains'
ORDER BY ordinal_position;

-- D2. The actual 4 rows (SELECT * so we see whatever columns exist)
SELECT * FROM public.company_subdomains ORDER BY subdomain;

-- D3. Is "grcico" among the 4 rows?
SELECT * FROM public.company_subdomains WHERE subdomain = 'grcico';

-- D4. Does companies table itself have a subdomain column?
--     (Some setups store the subdomain directly on companies.)
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'companies'
ORDER BY ordinal_position;

-- D5. Any view at all that mentions subdomain (maybe under a different name)?
SELECT
  schemaname,
  viewname
FROM pg_views
WHERE schemaname = 'public'
  AND definition ILIKE '%subdomain%'
ORDER BY viewname;
