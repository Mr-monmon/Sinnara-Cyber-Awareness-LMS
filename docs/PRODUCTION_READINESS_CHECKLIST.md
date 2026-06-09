# Production Readiness Checklist

Go-live checklist for the AwareOne Cyber Awareness LMS. A box is only checked when
its verification is reproducible. Items requiring a deployed environment are
marked **[operator]** and must be completed in staging before the first
production campaign.

> Companion docs: `PHISHING_REPORTING_METHODOLOGY.md`,
> `COMPLIANCE_READINESS_METHODOLOGY.md`, `EDGE_FUNCTIONS_DEPLOYMENT.md`,
> `SECURITY_HARDENING.md`, `PHISHING_E2E_TEST_PLAN.md`.

## 1. Automated gates (must all pass from a clean checkout)

- [ ] `npm ci`
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — succeeds
- [ ] `npm run test` — all tests pass
- [ ] `npm run lint` — 0 errors (warnings tolerated)
- [ ] `npm run verify:schema-alignment` — PASS
- [ ] `npm run verify:freshdb` — all migrations apply from zero
- [ ] `npm run verify:rls-matrix` — all assertions pass

## 2. Database & migrations

- [ ] All migrations apply cleanly on a fresh DB (gate above).
- [ ] `employee_risk_scores` view recreated with INSUFFICIENT_EVIDENCE support
      (`20260607000002`) — drops before recreate to allow the column reorder.
- [ ] SMTP profile visibility column + RLS (`20260607000001`) present.
- [ ] **[operator]** Vault secrets `project_url` and `service_role_key` created.
- [ ] **[operator]** Cron jobs `process-campaign`, `process-email-queue`,
      `process-scheduled-campaigns` active (verify queries in the deployment doc).

## 3. Edge Functions

- [ ] All functions deployed.
- [ ] `serve-landing-page` and `phishing-track` deployed with `verify_jwt = false`;
      every other function with `verify_jwt = true` (per `config.toml`).
- [ ] **[operator]** Secrets set: `SMTP_ENCRYPTION_KEY`, `ZEPTOMAIL_TOKEN`
      (if platform sender), `ALLOWED_ORIGINS`. `ALLOW_PLAINTEXT_SMTP` **unset**.

## 4. Security (Phase 7 — see SECURITY_HARDENING.md)

- [ ] CORS allowlist helper in place; `ALLOWED_ORIGINS` set in production.
- [ ] Edge Function error messages redacted (generic + reference code); full
      detail only in logs.
- [ ] Public tracking endpoint flood guard active (120/60s/IP, DB side effects
      skipped over the ceiling).
- [ ] **[operator]** L2 gateway/WAF per-IP rate rule configured for
      `phishing-track` and `serve-landing-page`.
- [ ] SMTP passwords encrypted (AES-256-GCM), fail-closed without the key.
- [ ] No secrets committed (verified by scan; only an instructional placeholder
      exists).
- [ ] Submitted phishing form secrets are redacted to field-names only.
- [ ] Open-redirect protection: tracking/landing redirects resolved server-side;
      private/loopback/metadata hosts blocked.

## 5. Reporting & compliance correctness

- [ ] All phishing surfaces use the canonical `phishingMetrics` module
      (dashboard, monitoring, CSV, PDF, compliance signals).
- [ ] Delivery rates use `sent` denominator; susceptibility uses `targeted`;
      aggregates weighted.
- [ ] Compliance controls map only to verified IDs; `NOT_ASSESSED` excluded from
      score; standard disclaimer present in UI + PDF.
- [ ] Employee risk shows `INSUFFICIENT_EVIDENCE` for unassessed employees and
      excludes them from averages.

## 6. Live E2E (staging) — see PHISHING_E2E_TEST_PLAN.md

- [ ] **[operator]** Group B cases B1–B18 executed green in staging with a real
      or sandbox SMTP sender.

## 7. Standing constraints (must remain true)

- [ ] `service_role_key` never committed to code.
- [ ] HIGH-03 (welcome-email plaintext password) **not** implemented.
- [ ] `REVOKE` on `correct_answer` **not** applied until admin authoring pages are
      admin-only.
- [ ] All campaign execution on the internal platform engine — **no** external
      GoPhish.
- [ ] `ALLOW_PLAINTEXT_SMTP` stays `false`/unset in production (fail closed).

## Go / No-go

**GO** only when Sections 1–6 are fully checked (including **[operator]** items in
staging) and Section 7 holds. Section 1 is CI-reproducible; the **[operator]**
and Group-B items require a deployed environment and are the deploying operator's
responsibility before go-live.
