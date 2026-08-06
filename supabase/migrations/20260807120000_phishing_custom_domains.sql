/*
  Custom phishing domains — shared and per-company, and the serving base URL
  ==========================================================================

  Today every tracking link and landing-page URL in a phishing email is built
  from SUPABASE_URL, so a recipient sees `<ref>.supabase.co`. For a realistic
  simulation the link has to sit on a domain the operator controls — four shared
  domains available to every company, plus one or two private domains per
  company.

  This migration teaches `phishing_domains` two things it did not know:

    1. Who may use a domain. It was strictly company-owned (company_id NOT NULL).
       It now mirrors the exact model already used for SMTP profiles and landing
       pages — a platform-owned row (company_id NULL, is_platform_domain) with a
       visibility of GLOBAL (every company) or SHARED (only granted companies),
       alongside the unchanged company-owned COMPANY rows.

    2. Where it serves from. `tracking_base_url` is the origin a Cloudflare
       Worker route forwards to the Supabase functions — e.g.
       https://secure-verify.example. The campaign's links are built from it
       instead of SUPABASE_URL. A domain with no base, or a campaign with no
       domain, falls back to SUPABASE_URL, so nothing that exists today changes
       behaviour until a domain is deliberately chosen.

  Everything here is additive and nullable. No existing campaign, domain, or
  send path is altered by running it.

  Reversal:
      ALTER TABLE public.phishing_campaigns DROP COLUMN IF EXISTS phishing_domain_id;
      DROP TABLE IF EXISTS public.phishing_domain_company_access;
      ALTER TABLE public.phishing_domains
        DROP COLUMN IF EXISTS tracking_base_url,
        DROP COLUMN IF EXISTS is_platform_domain,
        DROP COLUMN IF EXISTS visibility,
        DROP COLUMN IF EXISTS is_active;
      -- company_id is left nullable; re-adding NOT NULL would fail if any
      -- platform domain exists, and nullable is harmless.
*/

-- ── phishing_domains: ownership + serving base ──────────────────────────────

-- Platform domains have no owning company.
ALTER TABLE public.phishing_domains
  ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE public.phishing_domains
  ADD COLUMN IF NOT EXISTS is_platform_domain boolean NOT NULL DEFAULT false;

ALTER TABLE public.phishing_domains
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'COMPANY';

ALTER TABLE public.phishing_domains
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

/*
  The base URL the click/pixel/landing links are served from — the origin of the
  Cloudflare Worker route that proxies to Supabase functions. No trailing slash,
  scheme required. NULL means "not routed yet": links fall back to SUPABASE_URL.
*/
ALTER TABLE public.phishing_domains
  ADD COLUMN IF NOT EXISTS tracking_base_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'phishing_domains_visibility_chk'
  ) THEN
    ALTER TABLE public.phishing_domains
      ADD CONSTRAINT phishing_domains_visibility_chk
      CHECK (visibility IN ('COMPANY', 'GLOBAL', 'SHARED'));
  END IF;
END $$;

/*
  A platform domain must not be attributed to a company, and a company domain
  must have one. Enforced so the "who may use this" logic can trust the row
  shape rather than re-deriving it.
*/
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'phishing_domains_ownership_chk'
  ) THEN
    ALTER TABLE public.phishing_domains
      ADD CONSTRAINT phishing_domains_ownership_chk
      CHECK (
        (is_platform_domain = true  AND company_id IS NULL)
        OR
        (is_platform_domain = false AND company_id IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.phishing_domains.tracking_base_url IS
  'Origin that a Cloudflare Worker route forwards to the Supabase functions (e.g. https://secure-verify.example). Campaign links are built from this; NULL falls back to SUPABASE_URL.';

-- ── SHARED platform domain → companies grant table ──────────────────────────
CREATE TABLE IF NOT EXISTS public.phishing_domain_company_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phishing_domain_id uuid NOT NULL REFERENCES public.phishing_domains(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pushed_at timestamptz DEFAULT now(),
  UNIQUE (phishing_domain_id, company_id)
);

ALTER TABLE public.phishing_domain_company_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admin_pd_access_all" ON public.phishing_domain_company_access;
CREATE POLICY "platform_admin_pd_access_all" ON public.phishing_domain_company_access
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
  );

DROP POLICY IF EXISTS "company_admin_pd_access_view" ON public.phishing_domain_company_access;
CREATE POLICY "company_admin_pd_access_view" ON public.phishing_domain_company_access
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

/*
  Companies may READ platform domains that are GLOBAL, or SHARED to them. This is
  what lets a company admin's campaign form list the four shared domains without
  being able to see another company's private one. Write access to platform
  domains stays with the platform admin (existing policies); a company keeps full
  control of its own COMPANY-scoped rows (existing policies).
*/
DROP POLICY IF EXISTS "company_phishing_domains_platform_read" ON public.phishing_domains;
CREATE POLICY "company_phishing_domains_platform_read" ON public.phishing_domains
  FOR SELECT USING (
    is_platform_domain = true AND (
      visibility = 'GLOBAL'
      OR id IN (
        SELECT phishing_domain_id FROM public.phishing_domain_company_access
        WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
      )
    )
  );

-- ── Campaign → domain link ──────────────────────────────────────────────────
ALTER TABLE public.phishing_campaigns
  ADD COLUMN IF NOT EXISTS phishing_domain_id uuid REFERENCES public.phishing_domains(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.phishing_campaigns.phishing_domain_id IS
  'Domain whose tracking_base_url serves this campaign''s links. NULL falls back to SUPABASE_URL.';

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_phishing_domain_access_company
  ON public.phishing_domain_company_access (company_id);
CREATE INDEX IF NOT EXISTS idx_phishing_domain_access_domain
  ON public.phishing_domain_company_access (phishing_domain_id);
CREATE INDEX IF NOT EXISTS idx_phishing_domains_platform
  ON public.phishing_domains (is_platform_domain) WHERE is_platform_domain = true;
CREATE INDEX IF NOT EXISTS idx_phishing_campaigns_domain
  ON public.phishing_campaigns (phishing_domain_id);
