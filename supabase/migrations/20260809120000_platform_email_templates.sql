/*
  Platform email templates + cross-company sharing
  ================================================

  Email templates were company-owned only (phishing_company_email_templates,
  company_id NOT NULL), so a platform admin had no way to author a template or
  push one to companies — and in the ticket flow, where the platform team runs
  campaigns on a company's behalf, there was no shared library to draw from.

  This mirrors the exact model already used for SMTP profiles, landing pages and
  phishing domains, so nothing new is invented:

    - company_id becomes nullable (a platform template has no owning company)
    - is_platform_template flags platform vs company templates
    - visibility (COMPANY | GLOBAL | SHARED) — GLOBAL is open to all companies,
      SHARED only to the companies granted access, COMPANY is the owner's own
    - email_template_company_access records which companies a SHARED template
      is pushed to

  RLS: a company may READ platform templates that are GLOBAL or SHARED to it
  (read-only — it can use or duplicate them, not edit the platform's copy); the
  platform admin keeps full control of platform templates; company admins keep
  full control of their own.

  Additive and safe: every existing template is company-owned with the default
  COMPANY visibility, so behaviour is unchanged until a platform template is
  authored.

  Reversal:
      DROP TABLE IF EXISTS public.email_template_company_access;
      DROP POLICY IF EXISTS company_email_templates_platform_read ON public.phishing_company_email_templates;
      ALTER TABLE public.phishing_company_email_templates
        DROP COLUMN IF EXISTS is_platform_template,
        DROP COLUMN IF EXISTS visibility;
      -- company_id left nullable (harmless; re-adding NOT NULL would fail if a
      -- platform template exists).
*/

ALTER TABLE public.phishing_company_email_templates
  ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE public.phishing_company_email_templates
  ADD COLUMN IF NOT EXISTS is_platform_template boolean NOT NULL DEFAULT false;

ALTER TABLE public.phishing_company_email_templates
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'COMPANY';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'phishing_email_templates_visibility_chk'
  ) THEN
    ALTER TABLE public.phishing_company_email_templates
      ADD CONSTRAINT phishing_email_templates_visibility_chk
      CHECK (visibility IN ('COMPANY', 'GLOBAL', 'SHARED'));
  END IF;
END $$;

/*
  A platform template must not be attributed to a company, and a company one
  must have an owner. Lets every read trust the row shape.
*/
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'phishing_email_templates_ownership_chk'
  ) THEN
    ALTER TABLE public.phishing_company_email_templates
      ADD CONSTRAINT phishing_email_templates_ownership_chk
      CHECK (
        (is_platform_template = true  AND company_id IS NULL)
        OR
        (is_platform_template = false AND company_id IS NOT NULL)
      );
  END IF;
END $$;

-- ── SHARED platform template → companies grant table ──
CREATE TABLE IF NOT EXISTS public.email_template_company_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.phishing_company_email_templates(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pushed_at timestamptz DEFAULT now(),
  UNIQUE (template_id, company_id)
);

ALTER TABLE public.email_template_company_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admin_et_access_all" ON public.email_template_company_access;
CREATE POLICY "platform_admin_et_access_all" ON public.email_template_company_access
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
  );

DROP POLICY IF EXISTS "company_admin_et_access_view" ON public.email_template_company_access;
CREATE POLICY "company_admin_et_access_view" ON public.email_template_company_access
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

/*
  Companies may READ platform templates that are GLOBAL, or SHARED to them. This
  is what lets a company admin's campaign form and templates page list the shared
  library without being able to see another company's private template or edit
  the platform's copy (the existing company_admin_co_templates_own policy governs
  writes and only matches their own rows).
*/
DROP POLICY IF EXISTS "company_email_templates_platform_read" ON public.phishing_company_email_templates;
CREATE POLICY "company_email_templates_platform_read" ON public.phishing_company_email_templates
  FOR SELECT USING (
    is_platform_template = true AND (
      visibility = 'GLOBAL'
      OR id IN (
        SELECT template_id FROM public.email_template_company_access
        WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_email_template_access_company
  ON public.email_template_company_access (company_id);
CREATE INDEX IF NOT EXISTS idx_email_template_access_template
  ON public.email_template_company_access (template_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_platform
  ON public.phishing_company_email_templates (is_platform_template) WHERE is_platform_template = true;
