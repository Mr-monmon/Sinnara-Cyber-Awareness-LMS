-- RLS role-matrix test — runs AFTER the full migration chain on the fresh-DB
-- harness. Seeds two tenants and users in each role, then impersonates each
-- role (via the request.jwt.claims GUC that the scaffold's auth.uid()/jwt()
-- read) and asserts the exact rows RLS exposes. Any mismatch RAISEs and, under
-- ON_ERROR_STOP=1, fails the run.
--
-- Identities use fixed UUIDs so assertions are deterministic.

\set ON_ERROR_STOP on

-- ── Make table privileges match Supabase defaults (RLS still applies) ──
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ── Seed tenants ──
INSERT INTO companies (id, name, package_type, license_limit) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme',   'TYPE_A', 50),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Globex', 'TYPE_B', 50);

-- ── Seed users (one per role; PA has no company) ──
INSERT INTO users (id, email, password, full_name, role, company_id) VALUES
  ('11111111-1111-1111-1111-111111111111','pa@x.io',  'x','PA',   'PLATFORM_ADMIN', NULL),
  ('22222222-2222-2222-2222-222222222222','ca-a@x.io','x','CA-A', 'COMPANY_ADMIN',  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('33333333-3333-3333-3333-333333333333','emp-a@x.io','x','EMP-A','EMPLOYEE',      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('44444444-4444-4444-4444-444444444444','emp2-a@x.io','x','EMP2-A','EMPLOYEE',    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('55555555-5555-5555-5555-555555555555','ca-b@x.io','x','CA-B', 'COMPANY_ADMIN',  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('66666666-6666-6666-6666-666666666666','emp-b@x.io','x','EMP-B','EMPLOYEE',      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- ── Seed support tickets (company_id auto-filled by trigger from user_id) ──
INSERT INTO support_ticket (user_id, subject, description) VALUES
  ('33333333-3333-3333-3333-333333333333','T1 emp-a','d'),
  ('44444444-4444-4444-4444-444444444444','T2 emp2-a','d'),
  ('66666666-6666-6666-6666-666666666666','T3 emp-b','d');

-- ── Seed articles ──
INSERT INTO articles (slug, title, content, published) VALUES
  ('pub','Published','c', true),
  ('draft','Draft','c', false);

-- ── Seed tenant subdomains (format constraint: lowercase, no reserved) ──
INSERT INTO company_subdomains (company_id, subdomain, is_primary) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','acme',   true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','globex', true);

-- ── Assertion helper: run `q` as the current role, compare row count ──
CREATE OR REPLACE FUNCTION pg_temp.expect(q text, want int, label text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE got int;
BEGIN
  EXECUTE 'SELECT count(*) FROM (' || q || ') s' INTO got;
  IF got <> want THEN
    RAISE EXCEPTION 'RLS FAIL [%]: got % rows, expected %', label, got, want;
  END IF;
  RAISE NOTICE 'RLS ok  [%]: % rows', label, got;
END $$;

-- Impersonation helper (top-level): set role + JWT claims for a user id.
-- (kept inline below since SET ROLE cannot run inside a function)

-- ═══════════════════════ EMPLOYEE (Acme) ═══════════════════════
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false);
SELECT pg_temp.expect('SELECT 1 FROM support_ticket',            1, 'EMP sees only own ticket');
SELECT pg_temp.expect('SELECT 1 FROM articles',                  1, 'EMP sees only published article');
SELECT pg_temp.expect('SELECT 1 FROM company_subdomains',        1, 'EMP sees only own tenant subdomain');
RESET ROLE;

-- Employee must NOT be able to insert an article (platform-admin only).
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false);
DO $$
BEGIN
  BEGIN
    INSERT INTO articles (slug,title,content,published) VALUES ('hack','H','c',true);
    RAISE EXCEPTION 'RLS FAIL [EMP article insert]: insert succeeded but should be denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'RLS ok  [EMP article insert denied]';
  END;
END $$;
RESET ROLE;

-- ═══════════════════════ COMPANY_ADMIN (Acme) ═══════════════════════
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
SELECT pg_temp.expect('SELECT 1 FROM support_ticket',     2, 'CA-A sees both Acme tickets');
SELECT pg_temp.expect('SELECT 1 FROM company_subdomains', 1, 'CA-A sees only Acme subdomain');
RESET ROLE;

-- ═══════════════════════ COMPANY_ADMIN (Globex) — cross-tenant isolation ═══════════════════════
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', false);
SELECT pg_temp.expect('SELECT 1 FROM support_ticket',     1, 'CA-B sees only Globex ticket (no Acme leak)');
SELECT pg_temp.expect('SELECT 1 FROM company_subdomains', 1, 'CA-B sees only Globex subdomain');
RESET ROLE;

-- ═══════════════════════ PLATFORM_ADMIN ═══════════════════════
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
SELECT pg_temp.expect('SELECT 1 FROM support_ticket',     3, 'PA sees all tickets');
SELECT pg_temp.expect('SELECT 1 FROM articles',           2, 'PA sees all articles (incl. draft)');
SELECT pg_temp.expect('SELECT 1 FROM company_subdomains', 2, 'PA sees all subdomains');
-- PA can insert an article.
INSERT INTO articles (slug,title,content,published) VALUES ('pa-new','PA','c',false);
SELECT pg_temp.expect('SELECT 1 FROM articles WHERE slug=''pa-new''', 1, 'PA article insert allowed');
RESET ROLE;

-- ═══════════════════════ ANON (unauthenticated tenant resolution) ═══════════════════════
SET ROLE anon;
SELECT set_config('request.jwt.claims','', false);
SELECT pg_temp.expect('SELECT 1 FROM articles',          1, 'ANON sees only the 1 published article');
SELECT pg_temp.expect('SELECT 1 FROM tenant_companies',  2, 'ANON can resolve tenants via view');
RESET ROLE;

SELECT 'RLS MATRIX: ALL ASSERTIONS PASSED' AS result;
