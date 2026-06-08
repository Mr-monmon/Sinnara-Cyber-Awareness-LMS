# Production Readiness — Validation Report

Branch: `claude/review-sinnara-lms-GVfiB`

This report records the production-hardening sprint and the automated gates that
verify it. Every gate below is reproducible from a clean checkout.

## Gate results

| Gate | Command | Result |
|------|---------|--------|
| Type check | `npm run typecheck` | PASS (0 errors) |
| Unit tests | `npm run test` | PASS (84 tests, 7 files) |
| Schema alignment | `npm run verify:schema-alignment` | PASS (every `.from()/.rpc()` is created by a migration) |
| Fresh-DB migration | `npm run verify:freshdb` | PASS (all 88 migrations apply from zero) |
| RLS role matrix | `npm run verify:rls-matrix` | PASS (14 assertions) |
| Production build | `npm run build` | PASS (main chunk 465 kB, was 2,807 kB) |

> The fresh-DB and RLS gates bootstrap an ephemeral PostgreSQL 16 cluster, apply
> the Supabase scaffold (`tools/_freshdb_scaffold.sql`) and **every** migration in
> order — no Supabase CLI or Docker required.

## What changed, by phase

### Phase 1 — missing schema objects (DB reset no longer fails)
- New migration `20251030080000_create_missing_core_tables.sql`: `support_ticket`,
  `articles`, `company_course_departments` (ordered after the departments migration).
- New migration `20260606000001_production_readiness_phase1_2.sql`:
  `company_subdomains`, `tenant_companies` view, `certificates` compatibility view,
  `increment_article_view_count()` RPC, emails storage bucket.
- Fixed a pre-existing SQL bug in `20260602000003`: an `UPDATE … FROM … JOIN … ON`
  referenced the update target table inside the `JOIN ON` clause (invalid in
  PostgreSQL); the join predicate now lives in `WHERE`.
- `tools/verify-schema-alignment.mjs` scans the frontend vs migrations and fails CI
  on any missing relation/RPC (storage buckets like `emails` are excluded).

### Phase 2 — RLS role matrix (verified)
- Canonical policies for `support_ticket`, `articles`, `company_course_departments`,
  `company_subdomains`.
- `tools/_rls_matrix_test.sql` proves, per role:
  - **EMPLOYEE** sees only its own ticket / published articles / own tenant; article
    INSERT is denied.
  - **COMPANY_ADMIN** sees its own tenant's rows only (cross-tenant access blocked).
  - **PLATFORM_ADMIN** sees everything incl. drafts and may insert articles.
  - **ANON** sees only published articles and can resolve tenants via the view.

### Phase 3 — tenant / subdomain routing
- `resolveTenantBySubdomain()` queries the curated `tenant_companies` view (never the
  raw mapping table) and returns `{ status: ok | inactive | unknown }`.
- `company_subdomains` has a CHECK enforcing lowercase, the slug pattern
  `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`, and rejection of 9 reserved names.
- `isValidTenantSubdomain()` is strict (no silent case-normalization); 12 unit tests.

### Phase 4 — phishing backend hardening
- **Fail-closed quota**: `checkLimitsFailClosed()` returns 403 (`QUOTA_EXCEEDED`) or
  500 (`QUOTA_CHECK_FAILED`) and creates nothing on RPC error.
- **Draft-safe quota**: drafts are persisted as `status = DRAFT` and return *before*
  the quota check; the `quota_consumed_at` trigger only fires on `SCHEDULED`/`RUNNING`.
- **Ownership validation**: groups, SMTP profile, landing page, and scenario are all
  checked against the caller's company before launch.
- **Target dedup**: `normalizeTargets()` lowercases/trims and dedupes by email.
- **URL safety**: redirect URLs sanitized (private IPs, credentials, localhost,
  metadata hosts blocked).
- **Phase 4I**: business-hours rescheduling now computes the next start instant in the
  campaign's IANA timezone instead of the server's local zone.

### Phase 5 — frontend alignment (verified)
- `PhishingCampaignsPage` launch flow branches draft / scheduled / immediate, skips
  target/subject validation for drafts, and surfaces fail-closed errors through
  `getEdgeFunctionError`. No change required — already consistent with the backend.

### Phase 6 — shared Edge Function helpers
- `_shared/urlSafety.ts`, `_shared/auth.ts`, `_shared/zepto.ts`,
  `_shared/phishingAccess.ts`. `buildZeptoAuthHeader()` never double-prefixes
  `Zoho-enczapikey`.

### Phase 7 — bundle splitting
- Dashboard pages converted to `React.lazy()` + `<Suspense>`; main chunk reduced
  **2,807 kB → 465 kB (-83%)**.

### Phase 8 — production validation suite
- `verify:freshdb` and `verify:rls-matrix` gates (above), plus the existing
  `verify:schema-alignment`.

## Out of scope (per standing instructions)
- HIGH-03 (welcome-email plaintext password) — intentionally NOT implemented.
- `REVOKE` on `correct_answer` — deferred until admin authoring pages are admin-only.
- No external GoPhish; all execution runs on the internal platform engine.
