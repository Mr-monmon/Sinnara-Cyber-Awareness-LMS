/*
  Platform Landing Pages + cross-company sharing

  Mirrors the platform SMTP-profile model (is_platform_profile + smtp_profile_company_access)
  for landing pages so a Platform Admin can author landing pages once and expose them to:
    - GLOBAL  : every company
    - SHARED  : only the companies granted access (via landing_page_company_access)
    - COMPANY : legacy company-owned page (unchanged default behaviour)

  Changes to phishing_company_landing_pages:
    - company_id becomes nullable (platform pages have no owning company)
    - is_platform_page flag distinguishes platform vs company pages
    - visibility column (COMPANY | GLOBAL | SHARED)

  New table landing_page_company_access: which companies a SHARED platform page is pushed to.

  RLS: companies may SELECT platform pages that are GLOBAL or SHARED to them (read-only);
       platform admin keeps full control; company admins keep full control of their own pages.
*/

-- ── Schema: platform-page support on the landing pages table ──
ALTER TABLE phishing_company_landing_pages
  ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE phishing_company_landing_pages
  ADD COLUMN IF NOT EXISTS is_platform_page boolean NOT NULL DEFAULT false;

ALTER TABLE phishing_company_landing_pages
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'COMPANY';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'phishing_landing_pages_visibility_chk'
  ) THEN
    ALTER TABLE phishing_company_landing_pages
      ADD CONSTRAINT phishing_landing_pages_visibility_chk
      CHECK (visibility IN ('COMPANY', 'GLOBAL', 'SHARED'));
  END IF;
END $$;

-- ── Join table: SHARED platform page → companies ──
CREATE TABLE IF NOT EXISTS landing_page_company_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES phishing_company_landing_pages(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pushed_at timestamptz DEFAULT now(),
  UNIQUE (landing_page_id, company_id)
);

ALTER TABLE landing_page_company_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admin_lp_access_all" ON landing_page_company_access;
CREATE POLICY "platform_admin_lp_access_all" ON landing_page_company_access
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
  );

DROP POLICY IF EXISTS "company_admin_lp_access_view" ON landing_page_company_access;
CREATE POLICY "company_admin_lp_access_view" ON landing_page_company_access
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- ── RLS: companies may READ platform pages that are GLOBAL or SHARED to them ──
DROP POLICY IF EXISTS "company_landing_pages_platform_read" ON phishing_company_landing_pages;
CREATE POLICY "company_landing_pages_platform_read" ON phishing_company_landing_pages
  FOR SELECT USING (
    is_platform_page = true AND (
      visibility = 'GLOBAL'
      OR id IN (
        SELECT landing_page_id FROM landing_page_company_access
        WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
      )
    )
  );

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_landing_page_company_access_company
  ON landing_page_company_access (company_id);
CREATE INDEX IF NOT EXISTS idx_landing_page_company_access_page
  ON landing_page_company_access (landing_page_id);
CREATE INDEX IF NOT EXISTS idx_phishing_landing_pages_platform
  ON phishing_company_landing_pages (is_platform_page) WHERE is_platform_page = true;
