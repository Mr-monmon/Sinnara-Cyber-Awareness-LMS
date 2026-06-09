# Edge Functions — Deployment & Configuration Reference

This is the authoritative list of Supabase Edge Functions, their authentication
posture, required secrets, and the scheduled jobs that drive them. Use it as the
pre-deploy checklist.

## Functions and `verify_jwt` posture

`verify_jwt` defaults to **`true`** in Supabase. Only the two **public,
unauthenticated** recipient-facing endpoints disable it; every other function
relies on the gateway verifying a valid project JWT before the code runs.

| Function | `verify_jwt` | Caller | Notes |
|----------|--------------|--------|-------|
| `serve-landing-page` | **false** (explicit) | Phishing recipients (any browser) | Tenant-scoped inside the function: campaign ↔ landing page ↔ recipient must all match. Never an open HTML host. |
| `phishing-track` | **false** (explicit) | Phishing recipients (pixel/click/submit/report) | Validates campaign/recipient tokens; redacts submitted secrets; per-IP flood guard. |
| `get_top_performance` | true (explicit) | SPA (authenticated) | Leaderboard. |
| `get_user_rank` | true (explicit) | SPA (authenticated) | Leaderboard. |
| `send-email` | true (explicit) | SPA (authenticated) | Queues transactional email. |
| `save-smtp-profile` | true (default) | SPA admins | Encrypts SMTP password (AES-256-GCM); role + ownership checks. |
| `process-campaign` | true (default) | **pg_cron** (service-role) + SPA admins (test-send) | Drains the send queue; admin test-send path is role-gated. |
| `process-scheduled-campaigns` | true (default) | **pg_cron** (service-role) | Activates due SCHEDULED campaigns. Rejects non-service-role callers. |
| `process-email-queue` | true (default) | **pg_cron** (service-role) | Drains transactional email queue. |
| `launch-phishing-campaign` | true (default) | SPA admins | Fail-closed quota + ownership validation. |
| `create-campaign-from-request` | true (default) | SPA platform admins | Converts a request into a campaign. |
| `clone-landing-page` | true (default) | SPA admins | Clones + inlines landing-page HTML. |
| `submit-quiz` | true (default) | SPA (authenticated) | Server-side scoring. |
| `submit-exam` | true (default) | SPA (authenticated) | Server-side scoring. |
| `user-admin` | true (default) | SPA admins | User management (create/update/deactivate). |

> The cron-driven workers (`process-campaign`, `process-scheduled-campaigns`,
> `process-email-queue`) are invoked **server-to-server with the service-role
> key**, which is itself a valid project JWT — so `verify_jwt = true` is correct
> for them. `process-scheduled-campaigns` additionally calls
> `isServiceRoleRequest()` to reject any non-service-role caller.

## Required environment secrets (per project)

Set with `supabase secrets set KEY=value` (or the dashboard). **Never commit
these.**

| Secret | Used by | Required? | Notes |
|--------|---------|-----------|-------|
| `SUPABASE_URL` | all | yes | Auto-provided by the platform. |
| `SUPABASE_ANON_KEY` | functions doing user-JWT auth | yes | Auto-provided. |
| `SUPABASE_SERVICE_ROLE_KEY` | all DB-writing functions | yes | Auto-provided. **Never** place in client code. |
| `SMTP_ENCRYPTION_KEY` | `save-smtp-profile`, `process-campaign` | **yes for SMTP** | 32-byte key as hex (64 chars) or base64url. Generate: `openssl rand -hex 32`. Without it, `save-smtp-profile` **fails closed** and refuses to store the password. |
| `ALLOW_PLAINTEXT_SMTP` | `save-smtp-profile` | no | Keep **unset / `false`** in production (fail closed). `true` only for local dev. |
| `ZEPTOMAIL_TOKEN` | `process-campaign`, `process-email-queue` | for platform sender | ZeptoMail API token. |
| `ALLOWED_ORIGINS` | authenticated functions (via `_shared/cors.ts`) | recommended | Comma-separated SPA origins, e.g. `https://app.example.com`. When unset, CORS falls back to `*`. |
| `SENTRY_DSN` | `process-campaign`, `process-email-queue` | optional | Error reporting. |

## Vault secrets (database-side, for cron)

The cron invokers read these from **Supabase Vault** (encrypted at rest), not from
a plaintext table. Configured by migration `20260531000003_campaign_scheduler_and_vault.sql`;
on a fresh project set them once:

```sql
SELECT vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
```

The migration also auto-migrates any pre-existing plaintext `email_queue_config`
values into the vault and deletes the plaintext service-role key row.

## Scheduled jobs (pg_cron)

All three run **every minute** and invoke their function via `net.http_post` with
the vault-stored service-role key. The invoker functions are
`SECURITY DEFINER` and have `EXECUTE` **revoked** from `PUBLIC`, `anon`, and
`authenticated`.

| Cron job | Invoker function | Migration |
|----------|------------------|-----------|
| `process-campaign` | `invoke_process_campaign()` | `20260531000003_campaign_scheduler_and_vault.sql` |
| `process-email-queue` | `invoke_process_email_queue()` | `20260520000001_email_queue.sql` |
| `process-scheduled-campaigns` | `invoke_process_scheduled_campaigns()` | `20260604000001_phase4_secure_campaign_launch.sql` |

### Verify cron jobs after deploy

```sql
-- All three jobs present and active?
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;

-- Recent run outcomes (look for status = 'succeeded'):
SELECT j.jobname, r.status, r.start_time, r.end_time
FROM cron.job_run_details r
JOIN cron.job j ON j.jobid = r.jobid
ORDER BY r.start_time DESC
LIMIT 20;

-- Vault secrets present?
SELECT name FROM vault.secrets WHERE name IN ('project_url','service_role_key');
```

## Deploy command reference

```bash
# Deploy all functions
supabase functions deploy

# Or one at a time (the two public functions MUST keep verify_jwt = false,
# which is declared in supabase/config.toml — deploy respects that file):
supabase functions deploy serve-landing-page
supabase functions deploy phishing-track

# Apply migrations
supabase db push
```

## Pre-deploy gate (run from a clean checkout)

```bash
npm ci
npm run typecheck
npm run build
npm run test
npm run lint
npm run verify:schema-alignment
npm run verify:freshdb
npm run verify:rls-matrix
```
