# Security Hardening Review (Phase 7)

This document records the production security review of the Edge Functions and the
hardening applied. It covers CORS, error-message disclosure, public-endpoint abuse
controls, cron/secret handling, SMTP credential storage, and `verify_jwt` posture.

## 1. CORS

### Finding
Every function hardcoded `Access-Control-Allow-Origin: *`, including authenticated
ones.

### Assessment
For these endpoints `*` is **not** a credential-theft or CSRF vector: authentication
is via an `Authorization: Bearer <jwt>` header, **not cookies**. A hostile
cross-origin site cannot read the victim's token (it lives in the app origin's
storage, inaccessible cross-origin) and therefore cannot forge an authenticated
request. CORS here is defence-in-depth policy, not a primary control.

### Hardening applied
- New shared helper `_shared/cors.ts` with an **`ALLOWED_ORIGINS` allowlist**.
  When the env var is set, only matching SPA origins are reflected; when unset it
  falls back to `*` so dev/preview are unaffected.
- Applied to the highest-value authenticated endpoints: `save-smtp-profile`
  (SMTP credentials), `process-campaign` (campaign send), `clone-landing-page`.
- The two **public** recipient endpoints (`serve-landing-page`, `phishing-track`)
  intentionally keep wildcard CORS — recipients arrive from arbitrary
  origins/mail clients and no tenant data or ambient credentials are involved.
  `phishing-track` now declares this via `corsHeaders(req, { publicWildcard: true })`.

### Operator action
Set `ALLOWED_ORIGINS=https://<your-app-origin>` in production. Remaining
authenticated functions still use `*`; because bearer-auth makes this
non-exploitable, migrating them to the shared helper is a low-priority, mechanical
follow-up (tracked in "Known limitations").

## 2. Error-message disclosure

### Finding
Several top-level `catch` blocks returned raw `err.message` / DB error text to the
client, which can disclose schema, query shape, or driver internals.

### Hardening applied
- New `_shared/httpError.ts`:
  - `safeErrorResponse(tag, err, opts)` — logs full detail (message + stack)
    server-side, returns only a generic message + short **reference code** the
    operator can grep for in logs.
  - `logAndRef(tag, err, message?)` — same logging, returns `{ error, ref }` to
    spread into a function's existing `{ success:false, ... }` body shape.
- Applied to the unhandled-exception paths of: `save-smtp-profile`,
  `process-scheduled-campaigns`, `process-campaign`, `launch-phishing-campaign`,
  `create-campaign-from-request`, `process-email-queue`, `clone-landing-page`,
  `user-admin`.

### Deliberately preserved
Admin-facing **operational diagnostics** are intentionally kept verbatim because
they are actionable for the authenticated admin and do not leak DB internals:
SMTP/ZeptoMail provider errors (e.g. "invalid API key"), validation messages, and
Supabase **Auth** errors in `user-admin` (e.g. "User already registered"). These
surface in admin UIs by design.

## 3. Public tracking endpoint abuse

### Finding
`phishing-track` is public and unauthenticated. A caller who harvests
campaign/recipient tokens could spam tracking events or POST submit bodies,
amplifying into unbounded DB inserts (events, alerts).

### Hardening applied
- New `_shared/rateLimit.ts` — per-isolate sliding-window limiter.
- `phishing-track` enforces **120 requests / 60s / IP**. Over the ceiling the
  endpoint **still serves a benign response** (tracking pixel or safe redirect)
  but **skips all database side effects** — so a flood cannot amplify into writes,
  and a legitimate (throttled) recipient is still sent somewhere safe.
- Existing protections retained: first-open-only dedup, image-vs-click
  heuristic, submitted-secret redaction (only field *names* are stored, never
  passwords/OTPs/tokens), and server-side open-redirect resolution.

### Honesty about scope (L1 vs L2)
The limiter is **best-effort and per-isolate**. Supabase runs Edge Functions
across many short-lived isolates, so the counter is not global; a distributed
flood spread across isolates is only partially mitigated. It reliably stops the
common single-host burst. For a hard global guarantee, pair it with an **L2
control at the gateway / WAF / CDN** (per-IP rate rules). This is a deployment
recommendation, not a code change.

## 4. Cron jobs & secret handling

### Verified (no change needed)
- The service-role key used by cron lives in **Supabase Vault** (encrypted at
  rest), read via `vault.decrypted_secrets`. The previous plaintext
  `email_queue_config` row is migrated into the vault and deleted.
- Invoker functions are `SECURITY DEFINER` with `EXECUTE` **revoked** from
  `PUBLIC`, `anon`, `authenticated`.
- Three jobs scheduled every minute (see `EDGE_FUNCTIONS_DEPLOYMENT.md`).
- `process-scheduled-campaigns` rejects any non-service-role caller via
  `isServiceRoleRequest()` (exact key match **or** a `service_role` JWT claim).

### Secret scan
No `service_role` key, JWT literal, or SMTP secret is committed. The only match
(`EmailQueuePage.tsx`) is an **instructional placeholder** (`YOUR_SERVICE_ROLE_KEY`)
shown to the operator as setup SQL — not a live secret.

## 5. SMTP credential storage

### Verified (no change needed)
- Passwords are encrypted with **AES-256-GCM** using `SMTP_ENCRYPTION_KEY`
  (server-only) in `save-smtp-profile`; the plaintext never reaches the DB and
  the key never reaches the browser.
- **Fail-closed**: if the key is missing/invalid the function **refuses to save**
  the password (HTTP 500) unless `ALLOW_PLAINTEXT_SMTP=true` is explicitly set —
  which must remain unset in production.
- Password columns are **never** returned to the client (the SPA selects an
  explicit safe column list excluding `password`).

## 6. `verify_jwt` posture

### Verified (no change needed)
Only `serve-landing-page` and `phishing-track` disable `verify_jwt` (they are
public recipient endpoints, tenant-scoped internally). All admin/worker functions
keep `verify_jwt = true` (Supabase default), including the cron workers which
authenticate with the service-role JWT. Full table in
`EDGE_FUNCTIONS_DEPLOYMENT.md`.

## 7. SMTP profile visibility (from Phase 1)

`assertSmtpProfileAccessible()` fails closed and enforces the
GLOBAL / SHARED / PLATFORM_ONLY model; the RLS role-matrix test
(`tools/_rls_matrix_test.sql`) proves a company admin sees only own + GLOBAL +
SHARED profiles and never PLATFORM_ONLY or another tenant's profile.

## Known limitations / residual risk

- **CORS allowlist** is applied to 3 of the authenticated functions plus the
  public ones; the remaining authenticated functions keep `*`. This is
  non-exploitable under bearer-token auth but should be completed for uniform
  policy. Mechanical follow-up.
- **Rate limiting** is L1 (per-isolate). Production deployments should add an L2
  gateway/WAF rule for a global guarantee.
- The limiter and redaction logic in Edge Functions are **not** covered by the
  repo's `vitest`/`tsc` gates (those target the React app, `src/`). They are
  reviewed by reading and exercised by the manual E2E plan
  (`PHISHING_E2E_TEST_PLAN.md`). The redaction logic is additionally unit-tested
  on the app side in `src/lib/redaction.test.ts` (the function keeps an in-sync
  copy).
