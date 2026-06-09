# Phishing Campaign — End-to-End Test Plan

A repeatable, environment-by-environment plan to validate the full phishing
lifecycle: profile setup → campaign creation → launch/schedule → send → recipient
interaction tracking → metrics/reporting → compliance evidence.

## Test taxonomy

- **A. Automated gates** — runnable from a clean checkout, no deployment needed.
- **B. Live integration** — require a deployed Supabase project with secrets,
  cron, and a real (or sandbox) SMTP/ZeptoMail sender. These send mail and hit
  the public tracking endpoints; they cannot run inside CI without a live target.

Each case lists: **Pre-conditions → Steps → Expected result**.

---

## A. Automated gates (CI-runnable)

| # | Gate | Command | Pass criteria |
|---|------|---------|---------------|
| A1 | Install | `npm ci` | clean install |
| A2 | Types | `npm run typecheck` | 0 errors |
| A3 | Build | `npm run build` | build succeeds |
| A4 | Unit tests | `npm run test` | all pass (incl. `phishingMetrics`, `complianceFrameworks`, `redaction`, `urlSafety`) |
| A5 | Lint | `npm run lint` | 0 errors |
| A6 | Schema alignment | `npm run verify:schema-alignment` | every referenced table/view/RPC exists in a migration |
| A7 | Fresh-DB migration | `npm run verify:freshdb` | all migrations apply from zero |
| A8 | RLS role matrix | `npm run verify:rls-matrix` | all assertions pass, incl. SMTP visibility |

A4 specifically locks the reporting/compliance math:
- delivery rates use `sent` as denominator,
- susceptibility uses `targeted` users,
- aggregates are weighted (not averaged),
- compliance `NOT_ASSESSED` excluded from score,
- submitted secrets are redacted to field-names only.

---

## B. Live integration tests

### Pre-conditions (one-time per environment)
- Migrations applied (`supabase db push`); all functions deployed.
- Secrets set: `SMTP_ENCRYPTION_KEY`, `ZEPTOMAIL_TOKEN` (if platform sender),
  `ALLOWED_ORIGINS`. `ALLOW_PLAINTEXT_SMTP` **unset**.
- Vault secrets `project_url`, `service_role_key` created.
- Cron jobs present and active (see `EDGE_FUNCTIONS_DEPLOYMENT.md` verify queries).
- Two test companies (Acme, Globex), a platform admin, a company admin per
  company, and 2–3 seed recipient mailboxes you control.

### B1 — SMTP profile creation & encryption (fail-closed)
**Steps:** As company admin, create an SMTP profile with a password.
**Expected:**
- Profile saved; `password_encrypted = true`; the password is **never** returned
  by any read.
- Temporarily unset `SMTP_ENCRYPTION_KEY` and retry → **HTTP 500**, password not
  saved, generic error + reference code (verify full cause is in function logs).

### B2 — SMTP test-send authorization
**Steps:** Trigger "Send test" for a profile.
**Expected:**
- Company admin can test only **own / GLOBAL / SHARED** profiles; a
  `platform_default` profile requires PLATFORM_ADMIN.
- A REVIEWER role is rejected.
- `from_address` cannot be overridden for company profiles (only the
  platform-default sender may override). Confirm the received mail's From matches
  the stored sender.

### B3 — SMTP profile visibility (cross-tenant)
**Steps:** As platform admin, set a platform profile to PLATFORM_ONLY, then
SHARED (grant to Acme), then GLOBAL.
**Expected (matches RLS matrix A8):**
- PLATFORM_ONLY: invisible to all companies.
- SHARED: visible to Acme only, not Globex.
- GLOBAL: visible to both. Revoking the last SHARED grant falls back to
  PLATFORM_ONLY.

### B4 — Campaign creation (draft)
**Steps:** Create a campaign and save as DRAFT.
**Expected:** Persisted as `DRAFT`, **no quota consumed**, target/subject
validation skipped for drafts.

### B5 — Quota enforcement (fail-closed)
**Steps:** Launch a campaign whose target count exceeds the company quota.
**Expected:** HTTP 403 `Campaign blocked: …`; nothing is queued. Force a quota
RPC failure → HTTP 500, still nothing queued.

### B6 — Ownership validation at launch
**Steps:** Attempt to launch referencing another company's group / landing page /
SMTP profile.
**Expected:** Rejected before any send (fail-closed accessibility checks).

### B7 — Immediate launch & send
**Steps:** Launch a small campaign to your seed mailboxes.
**Expected:** Queue rows created (PENDING → SENT); recipients receive the mail
from the configured sender; `sent` count matches deliveries; `failed` increments
only on real send failures.

### B8 — Scheduled launch
**Steps:** Schedule a campaign for `now + 2 min`.
**Expected:** Status `SCHEDULED`; within ~1–2 min `process-scheduled-campaigns`
flips it to `RUNNING` and the first batch drains. Confirm a non-service-role call
to `process-scheduled-campaigns` returns **401**.

### B9 — Open tracking (dedup)
**Steps:** Open the email; let the mail client re-fetch the pixel; open again.
**Expected:** Exactly **one** `EMAIL_OPENED` event persists per recipient;
`openRate` denominator is `sent`.

### B10 — Click tracking & open-redirect safety
**Steps:** Click the link. Then manually craft a tracking URL with a
`url=`/`redirect=` pointing at `http://169.254.169.254/`, `http://localhost`, and
an arbitrary external site.
**Expected:**
- Legitimate click → recorded once, redirected to the campaign's landing page.
- Malicious redirect targets are **never** honored — destination resolves
  server-side from the campaign record; private/loopback/metadata hosts blocked;
  fallback is the safe default.

### B11 — Landing page & form submit (secret redaction)
**Steps:** On the served landing page, submit a form including a `password` field.
**Expected:**
- `FORM_SUBMITTED` event + a **CRITICAL** alert created.
- Stored metadata contains only **field names** and which were sensitive — the
  actual password value is **never** persisted.
- Victim is redirected onward to the safe/configured destination.

### B12 — Report action
**Steps:** Trigger the "report phishing" tracking call.
**Expected:** `EMAIL_REPORTED` recorded; it feeds `reportRate` and does **not**
move the open→click→submit funnel status backward.

### B13 — Rate-limit / abuse guard
**Steps:** From one host, fire >120 tracking requests within 60s.
**Expected:** Beyond the ceiling, the endpoint still returns a pixel/redirect but
**stops writing** new events (verify event count plateaus). Legitimate low-volume
traffic is unaffected.

### B14 — Metrics consistency across surfaces
**Steps:** Compare the campaign's numbers on the company dashboard, the platform
monitoring page, the CSV export, and the per-campaign PDF.
**Expected:** Identical counts and rates everywhere (single canonical module);
denominators labelled; susceptibility = (clicked OR submitted)/targeted;
recipients deduplicated by email.

### B15 — Aggregate weighting
**Steps:** Run a tiny campaign (2 targets) and a larger one (≥20), then view the
org-level aggregate.
**Expected:** Aggregate rate equals Σnumerators/Σdenominators (weighted), not the
average of the two campaign percentages.

### B16 — Compliance evidence
**Steps:** Open the Compliance Readiness Report after running campaigns + training.
**Expected:** Controls map to the verified IDs (ISO A.6.3/9.1/9.2/A.5.1/10.1,
NCA ECC-1-10-1/2, SAMA 3.1.6/3.1.7); untested controls show **Not Assessed** and
are excluded from the readiness score; the standard disclaimer appears in the UI
and the PDF.

### B17 — Employee risk INSUFFICIENT_EVIDENCE
**Steps:** Add an employee with no training/exam/phishing exposure.
**Expected:** Risk level `INSUFFICIENT_EVIDENCE` ("Not Assessed"), risk score
shown as "—", and excluded from company average risk (the view's
`assessed_risk_score` is NULL for them).

### B18 — Error-message redaction
**Steps:** Induce a server error in an admin function (e.g. malformed payload to a
worker path).
**Expected:** Client receives a **generic** message + reference code; the full
cause appears only in function logs (grep the reference code). Provider/validation
diagnostics (SMTP/ZeptoMail) remain human-readable by design.

---

## Sign-off matrix

| Group | Cases | Required for production sign-off |
|-------|-------|----------------------------------|
| A (automated) | A1–A8 | **Yes** — all must pass |
| B (live) | B1–B18 | **Yes** — execute in a staging project before first production campaign |

A production-ready declaration requires **both** groups green. Group A is
reproducible in CI; Group B requires a deployed environment with SMTP and is the
responsibility of the deploying operator before go-live.
