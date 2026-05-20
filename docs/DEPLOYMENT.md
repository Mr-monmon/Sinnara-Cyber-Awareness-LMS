# AwareOne LMS — Deployment Guide

## Architecture Overview

```
Browser / Mobile
      │
      ▼
Cloudflare Workers  ──── serves static React frontend (Vite build)
      │
      ▼
Supabase (PostgreSQL + Auth + Edge Functions)
      │
      ├── Edge Functions (Deno)  ──── business logic, email, phishing
      ├── PostgreSQL              ──── data, RLS policies
      └── pg_cron                ──── email queue processor (every minute)
                                       │
                                       ▼
                               ZeptoMail API  ──── transactional email delivery
```

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | ≥ 18 | Frontend build |
| npm | ≥ 9 | Package manager |
| Supabase CLI | latest | Migrations & edge function deploy |
| Wrangler | latest | Cloudflare Workers deploy |
| Git | any | Source control |

```bash
npm install -g supabase wrangler
```

---

## Environment Variables

### Frontend (Cloudflare Workers)

Set in **Cloudflare Dashboard → Workers & Pages → awareone → Settings → Variables and Secrets**:

| Variable | Required | Example |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | `https://xyz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | ✅ | `eyJhbGci...` |
| `VITE_SENTRY_DSN` | ⬜ | `https://key@o123.ingest.sentry.io/456` |
| `VITE_APP_VERSION` | ⬜ | `1.0.0` |

### Supabase Edge Functions

Set in **Supabase Dashboard → Edge Functions → Manage Secrets**:

| Variable | Required | Description |
|---|---|---|
| `ZEPTOMAIL_TOKEN` | ✅ | ZeptoMail `Zoho-enczapikey ...` token |
| `SMTP_ENCRYPTION_KEY` | ✅ | 64-char hex key — generate with `openssl rand -hex 32` |
| `SENTRY_DSN` | ⬜ | Sentry project DSN |
| `BROWSERLESS_URL` | ⬜ | For landing page cloning with JS rendering |
| `BROWSERLESS_TOKEN` | ⬜ | Browserless.io token |
| `SCRAPINGBEE_KEY` | ⬜ | ScrapingBee API key |

> `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase — do not set them manually.

---

## First-Time Setup

### 1. Clone the repository

```bash
git clone https://github.com/Mr-monmon/Sinnara-Cyber-Awareness-LMS.git
cd Sinnara-Cyber-Awareness-LMS
npm install
```

### 2. Link Supabase project

```bash
supabase login
supabase link --project-ref yqhflprrxcnvhwyvrltm
```

### 3. Apply all database migrations

```bash
supabase db push
```

This runs all SQL files in `supabase/migrations/` in chronological order.

### 4. Deploy edge functions

```bash
supabase functions deploy
```

This deploys all functions under `supabase/functions/`.

### 5. Configure email queue cron job

After `db push`, run this once in **Supabase Dashboard → SQL Editor**:

```sql
INSERT INTO email_queue_config (key, value) VALUES
  ('supabase_url',     'https://yqhflprrxcnvhwyvrltm.supabase.co'),
  ('service_role_key', 'YOUR_SERVICE_ROLE_KEY')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

Get your service role key from: **Supabase → Settings → API → Legacy service_role key**

### 6. Build and deploy frontend

```bash
npm run build
npx wrangler deploy
```

---

## CI/CD (GitHub Actions)

All deployments are automated on every push to `main`.

### Workflow files

| File | Trigger | What it does |
|---|---|---|
| `.github/workflows/deploy.yml` | push to `main` | Builds frontend + deploys to Cloudflare Workers |
| `.github/workflows/supabase.yml` | push to `main` | Runs `db push` + deploys edge functions |

### Required GitHub Secrets

Set in **GitHub → Repository → Settings → Secrets and variables → Actions**:

| Secret | Where to get it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access tokens |
| `SUPABASE_DB_PASSWORD` | Supabase → Settings → Database → Database password |
| `SUPABASE_PROJECT_ID` | `yqhflprrxcnvhwyvrltm` |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | `14a813480072859daeb589c34212c98f` |

---

## Database Migrations

Migrations live in `supabase/migrations/` and are named `YYYYMMDDNNNNNN_description.sql`.

### Apply in production

```bash
supabase db push
```

### Create a new migration

```bash
supabase migration new my_change_description
# Edit the generated file in supabase/migrations/
```

### Check migration status

```bash
supabase migration list
```

### Reset local database (development only)

```bash
supabase db reset
```

---

## Rollback

### Edge function rollback

Supabase does not support automatic rollback. To revert an edge function:

```bash
git checkout <previous-commit> -- supabase/functions/<function-name>/
supabase functions deploy <function-name>
```

### Database rollback

Migrations are forward-only. To undo a migration, create a new migration that reverses the changes:

```bash
supabase migration new revert_my_change
# Write the reverse SQL (DROP TABLE, ALTER TABLE, etc.)
supabase db push
```

### Frontend rollback

In Cloudflare Dashboard → Workers & Pages → awareone → Deployments → select a previous deployment → **Rollback**.

---

## Monitoring

| System | URL |
|---|---|
| Sentry errors | sentry.io → Projects → awareone-lms |
| Supabase logs | Supabase Dashboard → Edge Functions → Logs |
| Email queue | Platform Admin → Email Queue (built-in dashboard) |
| Cloudflare analytics | Cloudflare Dashboard → Workers & Pages → awareone |

---

## Security Checklist

Before going live:

- [ ] `SMTP_ENCRYPTION_KEY` is set and is a 64-char hex string
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is **never** exposed to the browser
- [ ] All edge functions are listed in `supabase/functions/` and deployed
- [ ] RLS is enabled on all tables (verify in Supabase → Table Editor → RLS)
- [ ] `VITE_SENTRY_DSN` is set to catch production errors
- [ ] GitHub Secrets are all set and not expired
- [ ] `email_queue_config` table has the correct URL and service role key
- [ ] The `anon` role cannot access sensitive tables (test with Supabase RLS checker)

---

## Troubleshooting

### Edge function returns 401

The JWT in the `Authorization` header is missing, expired, or invalid. Ensure the
frontend is calling `supabase.auth.getSession()` and passing the session token.

### Migration fails: "relation already exists"

The migration is not idempotent. Use `IF NOT EXISTS` / `IF EXISTS` or `OR REPLACE`.

### Email not delivered

1. Check **Platform Admin → Email Queue** — is the email in `failed` status?
2. Check `last_error` for the SMTP error message
3. Verify `ZEPTOMAIL_TOKEN` is set correctly in Supabase Secrets
4. Check ZeptoMail dashboard for delivery logs

### SMTP test email fails: "Authentication failed"

The SMTP profile password was encrypted with an incorrect key. Fix:
1. Open **Company Admin → SMTP Profiles**
2. Click Edit on the failing profile
3. Re-enter the password (same password is fine)
4. Save — this re-encrypts with the correct key

### pg_cron not processing the email queue

The `email_queue_config` table may not have the correct URL/key. Run:

```sql
SELECT * FROM email_queue_config;
```

If empty, run the setup SQL from the "First-Time Setup" section above.
