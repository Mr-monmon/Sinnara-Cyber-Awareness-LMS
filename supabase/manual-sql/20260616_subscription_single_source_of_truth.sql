-- ═══════════════════════════════════════════════════════════════════════
-- AwareOne — subscription single source of truth
-- Run in: Supabase Dashboard → SQL Editor
--
-- CONTEXT
--   Subscription state lives in two tables:
--     • companies      (subscription_type / subscription_start /
--                       subscription_end / license_limit / is_active)
--       ← the ONLY table the platform-admin UI writes when a subscription
--         is created, edited or extended.
--     • subscriptions  (start_date / end_date / license_count / status)
--       ← written once at company creation and never updated afterwards.
--
--   The company-admin banner used to read `subscriptions` alone, so
--   extending a subscription moved companies.subscription_end forward while
--   the stale subscriptions row kept the workspace showing
--   "Your subscription has expired" forever.
--
-- IS THIS SCRIPT REQUIRED?
--   NO — the application fix alone clears the banner. The app now resolves
--   MAX(companies.subscription_end, subscriptions.end_date) and the admin UI
--   writes both tables on save.
--
--   This script is RECOMMENDED HOUSEKEEPING: it reconciles rows that already
--   drifted and keeps the two tables in step even for edits made directly in
--   Supabase Studio (which bypass the application entirely).
--
-- SAFETY
--   • Idempotent — safe to run more than once.
--   • Additive only — no DROP TABLE, no column changes, no data deleted.
--   • Contains NO RLS changes. The four policies the app relies on
--     (rls_companies_company_admin_select, rls_subscriptions_company_read,
--      ca_limits_view, rls_pcq_company_read) already exist and are correctly
--     company-scoped; re-creating them would risk regressing the
--     PHISHING_OPERATOR grants added in 20260604000004.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────
-- 1. Keep `subscriptions` mirrored from `companies` going forward.
--    `companies` is authoritative: it is what every admin gesture writes.
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_company_subscription_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id uuid;
  v_status text;
BEGIN
  -- subscriptions.end_date is NOT NULL; nothing to mirror without an end date.
  IF NEW.subscription_end IS NULL THEN
    RETURN NEW;
  END IF;

  v_status := CASE
    WHEN NEW.is_active IS FALSE                    THEN 'PENDING'
    WHEN NEW.subscription_end::date < CURRENT_DATE THEN 'EXPIRED'
    ELSE 'ACTIVE'
  END;

  SELECT s.id INTO v_sub_id
  FROM public.subscriptions s
  WHERE s.company_id = NEW.id
  ORDER BY s.end_date DESC NULLS LAST, s.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_sub_id IS NULL THEN
    INSERT INTO public.subscriptions (
      company_id, subscription_type, start_date, end_date, license_count, status
    ) VALUES (
      NEW.id,
      COALESCE(NULLIF(NEW.subscription_type, ''), 'CUSTOM'),
      COALESCE(NEW.subscription_start, now()),
      NEW.subscription_end,
      COALESCE(NEW.license_limit, 10),
      v_status
    );
  ELSE
    UPDATE public.subscriptions s
    SET subscription_type = COALESCE(NULLIF(NEW.subscription_type, ''), s.subscription_type),
        start_date        = COALESCE(NEW.subscription_start, s.start_date),
        end_date          = NEW.subscription_end,
        license_count     = COALESCE(NEW.license_limit, s.license_count),
        status            = v_status,
        updated_at        = now()
    WHERE s.id = v_sub_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_company_subscription_row() IS
  'Mirrors companies.subscription_* / license_limit / is_active onto the latest subscriptions row. companies is authoritative; this stops the legacy subscriptions table going stale and fabricating a false "subscription expired" banner.';

DROP TRIGGER IF EXISTS trg_sync_company_subscription ON public.companies;
CREATE TRIGGER trg_sync_company_subscription
  AFTER INSERT OR UPDATE OF
    subscription_type, subscription_start, subscription_end, license_limit, is_active
  ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_company_subscription_row();


-- ───────────────────────────────────────────────────────────────────────
-- 2. One-time reconciliation of rows that already drifted.
-- ───────────────────────────────────────────────────────────────────────

-- 2a. Bring each company's newest subscriptions row in line with companies.
WITH latest AS (
  SELECT DISTINCT ON (s.company_id) s.id, s.company_id
  FROM public.subscriptions s
  ORDER BY s.company_id, s.end_date DESC NULLS LAST, s.created_at DESC NULLS LAST
)
UPDATE public.subscriptions s
SET subscription_type = COALESCE(NULLIF(c.subscription_type, ''), s.subscription_type),
    start_date        = COALESCE(c.subscription_start, s.start_date),
    end_date          = c.subscription_end,
    license_count     = COALESCE(c.license_limit, s.license_count),
    status            = CASE
                          WHEN c.is_active IS FALSE                    THEN 'PENDING'
                          WHEN c.subscription_end::date < CURRENT_DATE THEN 'EXPIRED'
                          ELSE 'ACTIVE'
                        END,
    updated_at        = now()
FROM latest l
JOIN public.companies c ON c.id = l.company_id
WHERE s.id = l.id
  AND c.subscription_end IS NOT NULL;

-- 2b. Create a subscriptions row for companies that never got one.
INSERT INTO public.subscriptions (
  company_id, subscription_type, start_date, end_date, license_count, status
)
SELECT c.id,
       COALESCE(NULLIF(c.subscription_type, ''), 'CUSTOM'),
       COALESCE(c.subscription_start, now()),
       c.subscription_end,
       COALESCE(c.license_limit, 10),
       CASE
         WHEN c.is_active IS FALSE                    THEN 'PENDING'
         WHEN c.subscription_end::date < CURRENT_DATE THEN 'EXPIRED'
         ELSE 'ACTIVE'
       END
FROM public.companies c
WHERE c.subscription_end IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.company_id = c.id);

-- 2c. Ensure every company has a phishing-limits row (the Overview panel
--     reads it; companies created before the auto-create trigger may lack one).
INSERT INTO public.company_phishing_limits (company_id)
SELECT c.id
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_phishing_limits l WHERE l.company_id = c.id
);

COMMIT;


-- ═══════════════════════════════════════════════════════════════════════
-- 3. VERIFY — read-only, run separately. Should return ZERO rows.
-- ═══════════════════════════════════════════════════════════════════════
-- SELECT c.name,
--        c.subscription_end AS companies_end,
--        s.end_date         AS subscriptions_end,
--        c.license_limit    AS companies_licenses,
--        s.license_count    AS subscriptions_licenses,
--        c.is_active, s.status
-- FROM public.companies c
-- LEFT JOIN LATERAL (
--   SELECT * FROM public.subscriptions x
--   WHERE x.company_id = c.id
--   ORDER BY x.end_date DESC NULLS LAST LIMIT 1
-- ) s ON true
-- WHERE c.subscription_end IS DISTINCT FROM s.end_date
--    OR c.license_limit    IS DISTINCT FROM s.license_count;
