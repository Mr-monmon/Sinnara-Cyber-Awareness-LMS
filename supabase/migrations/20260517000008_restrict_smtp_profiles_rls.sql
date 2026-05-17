-- Security fix: smtp_profiles company_admin RLS was FOR ALL, which allowed
-- a company admin to INSERT or UPDATE directly from the browser,
-- bypassing the save-smtp-profile Edge Function and storing passwords
-- in plaintext.
--
-- Fix: restrict company_admin to SELECT and DELETE only.
-- INSERT and UPDATE must go through the save-smtp-profile Edge Function
-- (which uses the service role key and encrypts passwords server-side).

-- Drop the overly permissive FOR ALL policy
DROP POLICY IF EXISTS "company_admin_smtp_own" ON smtp_profiles;

-- Read: company admin can list their own profiles (excluding password column
-- is enforced at the application layer via SAFE_COLS)
CREATE POLICY "company_admin_smtp_select" ON smtp_profiles
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid() AND role = 'COMPANY_ADMIN'
    )
  );

-- Delete: company admin can delete their own non-platform profiles
CREATE POLICY "company_admin_smtp_delete" ON smtp_profiles
  FOR DELETE USING (
    is_platform_profile = false
    AND company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid() AND role = 'COMPANY_ADMIN'
    )
  );

-- INSERT and UPDATE are intentionally NOT granted to company_admin role.
-- All writes go through the save-smtp-profile Edge Function (service role),
-- which enforces ownership and encrypts the password before storage.
