-- Make public.users.password nullable.
-- The original schema (20251027133919) declared it NOT NULL, but the
-- user-admin Edge Function creates auth users via Supabase Auth and then
-- inserts a profile row without a password value. Requiring NOT NULL breaks
-- that creation path and forces callers to duplicate the plaintext password
-- into the profile table — a security anti-pattern.

ALTER TABLE public.users
  ALTER COLUMN password DROP NOT NULL;
