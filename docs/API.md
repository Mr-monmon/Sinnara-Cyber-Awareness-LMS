# AwareOne Edge Functions — API Reference

Base URL: `https://<PROJECT_REF>.supabase.co/functions/v1`

All endpoints require an `Authorization: Bearer <jwt>` header unless noted otherwise.
CORS is open (`*`) — all endpoints accept `OPTIONS` preflight.

---

## Authentication

Every request must include the Supabase session JWT:

```http
Authorization: Bearer <supabase_session_token>
```

Obtain the token via `supabase.auth.getSession()` on the frontend, or by calling
`supabase.auth.signInWithPassword()`.

### Roles

| Role | Description |
|---|---|
| `PLATFORM_ADMIN` | Full access to all endpoints and all companies |
| `COMPANY_ADMIN` | Access to their own company's data |
| `COMPANY_SUPER_ADMIN` | Same as COMPANY_ADMIN with elevated permissions |
| `PHISHING_OPERATOR` | Can manage phishing campaigns for their company |
| `EMPLOYEE` | Read-only access to their own learning data |

---

## Endpoints

### 1. `POST /send-email`

Queues a transactional email for delivery via ZeptoMail.
Returns immediately — actual delivery happens within ~1 minute via the email queue processor.

**Auth:** Any authenticated user

**Request**
```json
{
  "to": "user@example.com",
  "subject": "Your account credentials",
  "html": "<p>Welcome to AwareOne...</p>"
}
```

**Response `200`**
```json
{
  "queued": true,
  "id": "uuid-of-queue-entry"
}
```

**Errors**

| Status | Meaning |
|---|---|
| `400` | Missing `to`, `subject`, or `html` |
| `401` | Missing or invalid JWT |
| `500` | Database insert failed |

---

### 2. `POST /save-smtp-profile`

Creates or updates an SMTP profile. Encrypts the password server-side using AES-256-GCM
before writing to the database — the plaintext password never reaches the DB.

**Auth:** `COMPANY_ADMIN`, `COMPANY_SUPER_ADMIN`, or `PLATFORM_ADMIN`

**Request — Create**
```json
{
  "name": "Corporate Mail",
  "host": "smtp.office365.com",
  "port": 587,
  "username": "noreply@company.com",
  "password": "plaintext-password",
  "from_address": "noreply@company.com",
  "from_name": "IT Security",
  "use_tls": false,
  "use_starttls": true,
  "ignore_cert_errors": false,
  "custom_headers": [{ "key": "X-Mailer", "value": "AwareOne" }],
  "is_active": true,
  "is_platform_profile": false
}
```

**Request — Update** (add `profile_id`, omit `password` to keep existing)
```json
{
  "profile_id": "uuid",
  "name": "Corporate Mail (updated)",
  "host": "smtp.office365.com",
  "port": 587,
  "username": "noreply@company.com",
  "from_address": "noreply@company.com",
  "from_name": "IT Security",
  "use_tls": false,
  "use_starttls": true,
  "ignore_cert_errors": false,
  "custom_headers": [],
  "is_active": true
}
```

**Response `200`**
```json
{
  "profile": {
    "id": "uuid",
    "company_id": "uuid-or-null",
    "name": "Corporate Mail",
    "host": "smtp.office365.com",
    "port": 587,
    "username": "noreply@company.com",
    "from_address": "noreply@company.com",
    "from_name": "IT Security",
    "use_tls": false,
    "use_starttls": true,
    "ignore_cert_errors": false,
    "custom_headers": [],
    "is_platform_profile": false,
    "is_active": true,
    "password_encrypted": true,
    "created_at": "2026-05-20T10:00:00Z",
    "updated_at": "2026-05-20T10:00:00Z"
  }
}
```

**Errors**

| Status | Meaning |
|---|---|
| `400` | Missing required fields or no password on create |
| `401` | Missing or invalid JWT |
| `403` | Insufficient role or attempting to modify another company's profile |
| `404` | `profile_id` not found on update |

---

### 3. `POST /process-campaign`

Processes a phishing campaign's email queue in batches, or sends a single test email.

**Auth:** Any authenticated non-`EMPLOYEE` role

#### Mode A — Process campaign queue

```json
{
  "campaign_id": "uuid",
  "batch_size": 50
}
```

- `campaign_id` — optional; if omitted, processes all pending jobs across all campaigns
- `batch_size` — optional, default `50`, max `200`

**Response `200`**
```json
{
  "processed": 48,
  "sent": 45,
  "failed": 2,
  "skipped": 1
}
```

#### Mode B — Send test email

```json
{
  "test_smtp_profile_id": "uuid",
  "test_to": "admin@company.com",
  "test_subject": "Test phishing email",
  "test_html": "<p>This is a test.</p>",
  "test_from_address": "phishing@company.com",
  "test_from_name": "IT Security"
}
```

- `test_smtp_profile_id` — use `"platform_default"` to send via ZeptoMail instead of custom SMTP
- `test_subject`, `test_html`, `test_from_address`, `test_from_name` — all optional

**Response `200` — Success**
```json
{
  "success": true,
  "sent": true,
  "type": "smtp_test"
}
```

**Response `200` — SMTP failure** (note: still HTTP 200)
```json
{
  "success": false,
  "error": "535 Authentication failed"
}
```

---

### 4. `POST /process-email-queue`

Processes the general email queue — picks up to 20 pending/retrying emails and sends them.
Called automatically every minute by pg_cron; can also be triggered manually.

**Auth:** Service-role key bearer token (pg_cron) OR `PLATFORM_ADMIN` JWT

**Request**
```json
{}
```

**Response `200`**
```json
{
  "processed": 12,
  "sent": 11,
  "failed": 0,
  "retrying": 1
}
```

**Retry schedule**

| Attempt | Delay before retry |
|---|---|
| 1st failure | 1 minute |
| 2nd failure | 5 minutes |
| 3rd failure | Marked `failed` (no more retries) |

---

### 5. `GET /phishing-track`

Public tracking endpoint — no authentication required.
Records phishing simulation events (email open, link click, report).

**Auth:** None (public)

**Query Parameters**

| Param | Values | Description |
|---|---|---|
| `t` | `open`, `click`, `report` | Event type |
| `c` | UUID | Campaign ID |
| `r` | string | Recipient tracking token |

#### `t=open` — Email open tracking

Returns a transparent 1×1 GIF pixel. Embedded in the email HTML automatically by `process-campaign`.

```
GET /phishing-track?t=open&c=<campaign_id>&r=<recipient_id>
```

**Response:** `200 image/gif` (1×1 transparent GIF)

#### `t=click` — Link click tracking

Records the click and redirects the user to the campaign's landing page.

```
GET /phishing-track?t=click&c=<campaign_id>&r=<recipient_id>
```

**Response:** `302` redirect to landing page URL

#### `t=report` — Phishing report (unsubscribe)

Records that the user reported the email as phishing — marks them as aware.

```
GET /phishing-track?t=report&c=<campaign_id>&r=<recipient_id>
```

**Response:** `200` with confirmation HTML page

---

### 6. `POST /clone-landing-page`

Clones an external webpage for use as a phishing landing page.
Strips analytics, ads, and tracking scripts. Optionally renders JavaScript-heavy pages
via Browserless.io or ScrapingBee.

**Auth:** Any authenticated non-`EMPLOYEE` role

**Request**
```json
{
  "url": "https://example.com/login"
}
```

**Response `200`**
```json
{
  "html": "<!DOCTYPE html>..."
}
```

**Optional environment variables (Supabase Secrets)**

| Variable | Description |
|---|---|
| `BROWSERLESS_URL` | Browserless.io endpoint for JS rendering |
| `BROWSERLESS_TOKEN` | Browserless.io API token |
| `SCRAPINGBEE_KEY` | ScrapingBee API key |
| `RENDER_SERVICE_URL` | Generic headless render service |

---

### 7. `POST /get_top_performance`

Returns the top-performing employees leaderboard for a company.

**Auth:** Any authenticated user (all roles)

**Request**
```json
{
  "company_id": "uuid"
}
```

**Response `200`**
```json
[
  {
    "user_id": "uuid",
    "full_name": "Ahmed Al-Hassan",
    "score": 980,
    "rank": 1,
    "courses_completed": 7,
    "avg_quiz_score": 94
  }
]
```

---

### 8. `POST /get_user_rank`

Returns a specific employee's rank within their company.

**Auth:** Any authenticated user

**Request**
```json
{
  "user_id": "uuid",
  "company_id": "uuid"
}
```

**Response `200`**
```json
{
  "rank": 3,
  "total_users": 45,
  "score": 850,
  "percentile": 93
}
```

---

### 9. `POST /user-admin`

Administrative user management — create, update, delete, or bulk-import users.

**Auth:** `PLATFORM_ADMIN`, `COMPANY_ADMIN`, or `COMPANY_SUPER_ADMIN`

**Request — Create user**
```json
{
  "action": "create",
  "email": "employee@company.com",
  "password": "TempPass123!",
  "full_name": "Sara Al-Dosari",
  "role": "EMPLOYEE",
  "company_id": "uuid",
  "job_title": "Software Engineer",
  "department_id": "uuid"
}
```

**Request — Delete user**
```json
{
  "action": "delete",
  "user_id": "uuid"
}
```

**Request — Update user**
```json
{
  "action": "update",
  "user_id": "uuid",
  "full_name": "Sara Al-Dosari",
  "job_title": "Senior Engineer"
}
```

**Response `200`**
```json
{
  "success": true,
  "user_id": "uuid"
}
```

---

## Environment Variables

Set in **Supabase Dashboard → Edge Functions → Secrets**:

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Auto-set by Supabase |
| `SUPABASE_ANON_KEY` | ✅ | Auto-set by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Auto-set by Supabase |
| `ZEPTOMAIL_TOKEN` | ✅ | ZeptoMail API key for email delivery |
| `SMTP_ENCRYPTION_KEY` | ✅ | 64-char hex key for AES-256-GCM password encryption |
| `SENTRY_DSN` | ⬜ | Sentry DSN for error monitoring |
| `BROWSERLESS_URL` | ⬜ | Browserless.io URL for JS rendering |
| `BROWSERLESS_TOKEN` | ⬜ | Browserless.io token |
| `SCRAPINGBEE_KEY` | ⬜ | ScrapingBee API key |

Generate `SMTP_ENCRYPTION_KEY`:
```bash
openssl rand -hex 32
```
