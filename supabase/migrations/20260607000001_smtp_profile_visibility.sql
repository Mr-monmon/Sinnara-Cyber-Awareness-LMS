/*
  SMTP profile visibility (GLOBAL / SHARED / PLATFORM_ONLY)

  Closes a cross-tenant gap: previously EVERY platform SMTP profile
  (is_platform_profile = true) was treated as globally usable by any company.
  This mirrors the platform landing-page model (visibility + a per-company
  access join table, smtp_profile_company_access, which already exists).

  Visibility semantics (only meaningful for platform profiles):
    - GLOBAL        : usable by every company
    - SHARED        : usable only by companies granted access via
                      smtp_profile_company_access
    - PLATFORM_ONLY : usable only by platform admins (default — fail closed)

  Company-owned profiles (is_platform_profile = false) ignore visibility and
  remain accessible only to their owning company.

  SECURE BACKFILL: existing platform profiles that already have ≥1 access grant
  become SHARED; all others become PLATFORM_ONLY. We deliberately do NOT mark
  any existing profile GLOBAL — a platform admin must opt into global exposure.
*/

-- ── Column + constraint ──
ALTER TABLE smtp_profiles
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'PLATFORM_ONLY';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'smtp_profiles_visibility_chk'
  ) THEN
    ALTER TABLE smtp_profiles
      ADD CONSTRAINT smtp_profiles_visibility_chk
      CHECK (visibility IN ('GLOBAL', 'SHARED', 'PLATFORM_ONLY'));
  END IF;
END $$;

-- ── Secure backfill ──
-- Platform profiles already pushed to ≥1 company → SHARED (preserve current use).
UPDATE smtp_profiles s
SET visibility = 'SHARED'
WHERE s.is_platform_profile = true
  AND s.visibility = 'PLATFORM_ONLY'
  AND EXISTS (
    SELECT 1 FROM smtp_profile_company_access a
    WHERE a.smtp_profile_id = s.id
  );

-- ── RLS: companies may READ platform profiles that are GLOBAL ──
-- (SHARED platform profiles are already readable via the existing
--  smtp_profiles_platform_pushed_read policy from 20260518000005.)
DROP POLICY IF EXISTS "smtp_profiles_platform_global_read" ON public.smtp_profiles;
CREATE POLICY "smtp_profiles_platform_global_read" ON public.smtp_profiles
  FOR SELECT
  USING (
    is_platform_profile = true
    AND visibility = 'GLOBAL'
  );

CREATE INDEX IF NOT EXISTS idx_smtp_profiles_platform_visibility
  ON smtp_profiles (visibility) WHERE is_platform_profile = true;
