-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: expand users.role CHECK constraint to allow new platform roles
--
-- The original schema constrained role to ('PLATFORM_ADMIN','COMPANY_ADMIN',
-- 'EMPLOYEE'). Inserting COMPANY_SUPER_ADMIN, PHISHING_OPERATOR, or REVIEWER
-- violates that constraint, which causes the user-admin edge function to
-- return a 400 when an admin tries to create a platform user with a new role.
--
-- This migration finds and drops whatever name that constraint has, then adds
-- a new constraint that allows the full set of six roles.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  cname text;
BEGIN
  SELECT c.conname INTO cname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname = 'users'
    AND n.nspname = 'public'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%role%'
    AND pg_get_constraintdef(c.oid) ILIKE '%PLATFORM_ADMIN%'
    AND pg_get_constraintdef(c.oid) ILIKE '%EMPLOYEE%'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN (
    'PLATFORM_ADMIN',
    'COMPANY_SUPER_ADMIN',
    'COMPANY_ADMIN',
    'PHISHING_OPERATOR',
    'REVIEWER',
    'EMPLOYEE'
  ));
