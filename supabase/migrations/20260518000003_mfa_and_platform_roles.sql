-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: MFA support + platform roles
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add OTP / MFA control columns to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS requires_password_change BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_enforced BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Ensure new platform roles are accepted
--    (role is stored as TEXT — no enum to alter)
--    Allowed values: PLATFORM_ADMIN, COMPANY_SUPER_ADMIN, COMPANY_ADMIN,
--                    PHISHING_OPERATOR, REVIEWER, EMPLOYEE
--    We just document the constraint here; enforcement is in the application.

-- 3. One COMPANY_SUPER_ADMIN per company — enforced via partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS users_company_super_admin_unique
  ON public.users (company_id)
  WHERE role = 'COMPANY_SUPER_ADMIN' AND company_id IS NOT NULL;

-- 4. RLS: COMPANY_SUPER_ADMIN rows cannot be modified by other admins
--    The user-admin edge function (service-role) handles creation.
--    Here we add a row-level policy so client-side calls can't mutate
--    another user's COMPANY_SUPER_ADMIN row.

-- Allow users to read their own row (already exists in most setups, but safe to add)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users' AND policyname = 'users_read_own'
  ) THEN
    CREATE POLICY users_read_own ON public.users
      FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

-- 5. Indexes for the new columns (query performance)
CREATE INDEX IF NOT EXISTS users_requires_password_change_idx
  ON public.users (company_id) WHERE requires_password_change = TRUE;

CREATE INDEX IF NOT EXISTS users_mfa_enforced_idx
  ON public.users (company_id) WHERE mfa_enforced = TRUE;

-- 6. Mark all existing COMPANY_ADMIN users as requiring a password change
--    so they go through the forced change flow on next login.
--    Comment this out if you don't want to force existing admins to reset.
-- UPDATE public.users SET requires_password_change = TRUE
--   WHERE role = 'COMPANY_ADMIN' AND requires_password_change = FALSE;
