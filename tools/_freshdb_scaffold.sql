-- Minimal Supabase bootstrap scaffold so the full migration chain can be
-- applied against a vanilla PostgreSQL 16 cluster (no Supabase CLI available).
-- Recreates only what migrations depend on: roles, auth/storage/vault/cron/net
-- schemas, and stub functions. This is a TEST harness — not shipped.

-- ── Roles ──
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN;   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticator NOLOGIN;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Extensions (available in postgresql-contrib) ──
-- Installed into public so unqualified calls (gen_random_bytes, etc.) resolve,
-- matching how these functions are reachable on Supabase's search_path.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ── auth schema + stubs ──
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  created_at timestamptz DEFAULT now()
);
-- Mirror Supabase's real implementations: resolve identity from the
-- `request.jwt.claims` GUC so RLS tests can impersonate a user by setting it
-- (SELECT set_config('request.jwt.claims', '{"sub":"...","role":"..."}', true)).
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(auth.jwt() ->> 'sub', '')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT auth.jwt() ->> 'role'
$$;
-- Supabase grants anon/authenticated access to the auth helper schema so RLS
-- policies (which call auth.uid()/auth.jwt()) work under those roles.
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt(), auth.role() TO anon, authenticated, service_role;

-- ── storage schema + stubs ──
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY, name text, public boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text, owner uuid, created_at timestamptz DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ── vault schema + stubs (supabase_vault) ──
CREATE SCHEMA IF NOT EXISTS vault;
CREATE TABLE IF NOT EXISTS vault.secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, secret text, description text,
  created_at timestamptz DEFAULT now()
);
CREATE OR REPLACE VIEW vault.decrypted_secrets AS
  SELECT id, name, secret AS decrypted_secret, description FROM vault.secrets;
CREATE OR REPLACE FUNCTION vault.create_secret(
  new_secret text, new_name text DEFAULT NULL, new_description text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO vault.secrets(name, secret, description)
  VALUES (new_name, new_secret, new_description) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ── pg_net stub (net.http_post) ──
CREATE SCHEMA IF NOT EXISTS net;
CREATE OR REPLACE FUNCTION net.http_post(
  url text, body jsonb DEFAULT '{}'::jsonb, params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{}'::jsonb, timeout_milliseconds int DEFAULT 5000
) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;

-- ── pg_cron stub (cron.schedule / cron.unschedule) ──
CREATE SCHEMA IF NOT EXISTS cron;
CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text)
  RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
CREATE OR REPLACE FUNCTION cron.unschedule(job_name text)
  RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
