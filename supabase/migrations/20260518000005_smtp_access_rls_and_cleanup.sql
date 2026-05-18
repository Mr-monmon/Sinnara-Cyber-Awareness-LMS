-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: RLS for smtp_profile_company_access + misc cleanup
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enable RLS on smtp_profile_company_access (may already be enabled)
ALTER TABLE IF EXISTS public.smtp_profile_company_access ENABLE ROW LEVEL SECURITY;

-- 2. Allow company users to read their own push-access rows
--    (so the company SMTP page can show platform-pushed profiles)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'smtp_profile_company_access'
      AND policyname = 'smtp_access_company_read'
  ) THEN
    CREATE POLICY smtp_access_company_read ON public.smtp_profile_company_access
      FOR SELECT
      USING (
        company_id IN (
          SELECT company_id FROM public.users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- 3. Allow platform admins (service role) full access — service role bypasses RLS,
--    but add an explicit PLATFORM_ADMIN policy for client-side reads too.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'smtp_profile_company_access'
      AND policyname = 'smtp_access_platform_admin'
  ) THEN
    CREATE POLICY smtp_access_platform_admin ON public.smtp_profile_company_access
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN'
        )
      );
  END IF;
END $$;

-- 4. Allow company users to read platform smtp_profiles that are pushed to them
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'smtp_profiles'
      AND policyname = 'smtp_profiles_platform_pushed_read'
  ) THEN
    CREATE POLICY smtp_profiles_platform_pushed_read ON public.smtp_profiles
      FOR SELECT
      USING (
        is_platform_profile = true
        AND id IN (
          SELECT smtp_profile_id FROM public.smtp_profile_company_access
          WHERE company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
          )
        )
      );
  END IF;
END $$;
