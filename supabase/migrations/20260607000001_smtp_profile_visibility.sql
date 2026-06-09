/*
  Migration: SMTP profile visibility model

  Mirrors the landing-page visibility model (GLOBAL / SHARED / COMPANY) for
  smtp_profiles so a Platform Admin can control which companies may use a
  platform-managed SMTP profile:

    PLATFORM_ONLY  — default; only Platform Admins can use it (not exposed to companies)
    SHARED         — only companies explicitly granted access (smtp_profile_company_access)
    GLOBAL         — every company may use it

  Secure backfill strategy:
    - Existing platform profiles that already have ≥1 access grant → SHARED
    - All other platform profiles → PLATFORM_ONLY (never auto-promoted to GLOBAL)
*/

-- 1. Add visibility column with safe default
ALTER TABLE public.smtp_profiles
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'PLATFORM_ONLY';

-- 2. Enforce valid values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'smtp_profiles_visibility_chk'
  ) THEN
    ALTER TABLE public.smtp_profiles
      ADD CONSTRAINT smtp_profiles_visibility_chk
      CHECK (visibility IN ('GLOBAL', 'SHARED', 'PLATFORM_ONLY'));
  END IF;
END $$;

-- 3. Secure backfill: platform profiles with existing access grants → SHARED
UPDATE public.smtp_profiles
SET visibility = 'SHARED'
WHERE is_platform_profile = true
  AND id IN (
    SELECT DISTINCT smtp_profile_id FROM public.smtp_profile_company_access
  );

-- 4. All other platform profiles remain PLATFORM_ONLY (the DEFAULT above).

-- 5. RLS: allow companies to SELECT platform profiles that are GLOBAL
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'smtp_profiles'
      AND policyname = 'smtp_profiles_platform_global_read'
  ) THEN
    CREATE POLICY smtp_profiles_platform_global_read ON public.smtp_profiles
      FOR SELECT
      USING (
        is_platform_profile = true AND visibility = 'GLOBAL'
      );
  END IF;
END $$;

-- 6. Index for platform-profile reads by visibility
CREATE INDEX IF NOT EXISTS idx_smtp_profiles_platform_visibility
  ON public.smtp_profiles (visibility) WHERE is_platform_profile = true;
