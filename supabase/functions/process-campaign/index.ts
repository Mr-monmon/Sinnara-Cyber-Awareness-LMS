import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Inlined Sentry reporter (kept in-file so the function deploys as a single module). */
async function captureException(
  error: unknown,
  context: { function: string; [key: string]: unknown } = { function: "unknown" },
): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;
  const m = dsn.match(/^https?:\/\/([^@]+)@([^/]+)\/(.+)$/);
  if (!m) return;
  const [, key, host, projectId] = m;
  const err = error instanceof Error ? error : new Error(String(error));
  try {
    await fetch(`https://${host}/api/${projectId}/store/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${key}`,
      },
      body: JSON.stringify({
        event_id: crypto.randomUUID().replace(/-/g, ""),
        timestamp: new Date().toISOString(),
        platform: "node",
        level: "error",
        server_name: "supabase-edge",
        tags: { function: context.function },
        extra: context,
        exception: { values: [{ type: err.name, value: err.message }] },
      }),
    });
  } catch {
    // Never let Sentry reporting break the function
  }
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY  = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ZEPTO_TOKEN        = Deno.env.get("ZEPTOMAIL_TOKEN") ?? "";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ── Timezone helpers ── */
function getHourInTimezone(tz: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "numeric", hour12: false,
    });
    return parseInt(formatter.format(new Date()));
  } catch { return new Date().getUTCHours(); }
}

function isBusinessHour(hour: number, start: number, end: number): boolean {
  return hour >= start && hour < end;
}

function nextBusinessHourStart(start: number, end: number, tz: string): Date {
  const currentHour = getHourInTimezone(tz);
  const next = new Date();
  // If before business hours, set to start today
  if (currentHour < start) {
    next.setHours(start, 0, 0, 0);
  } else {
    // After business hours, set to start tomorrow
    next.setDate(next.getDate() + 1);
    next.setHours(start, 0, 0, 0);
  }
  return next;
}

/* ── SMTP Profile type ── */
interface SmtpProfile {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  from_address: string;
  from_name: string;
  use_tls: boolean;
  use_starttls: boolean;
  ignore_cert_errors: boolean;
  custom_headers: { key: string; value: string }[];
  password_encrypted: boolean;
}

/* ── Decode encryption key — supports both hex (64 chars) and base64url (43 chars) ── */
function decodeKey(keyStr: string): Uint8Array {
  const trimmed = keyStr.trim();
  // Hex: 64 chars, only 0-9a-fA-F
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  // Base64url
  const b64 = trimmed.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

/* ── Decrypt an encrypted SMTP password ──
 * Fails CLOSED: only called for profiles whose password_encrypted = true, so a
 * missing/invalid key or a decryption failure must throw rather than fall back
 * to using the ciphertext as the password (which would leak it to the SMTP
 * server and always fail auth). */
async function decryptPassword(encrypted: string): Promise<string> {
  const keyStr = Deno.env.get("SMTP_ENCRYPTION_KEY");
  if (!keyStr) {
    throw new Error("SMTP_ENCRYPTION_KEY is not set in the Supabase Edge Function secrets. Set it to a 64-char hex string (openssl rand -hex 32) or a 44-char base64 string (openssl rand -base64 32), then re-save the SMTP profile to re-encrypt the password.");
  }
  const keyBytes = decodeKey(keyStr);
  if (keyBytes.length !== 32) {
    throw new Error(
      `SMTP_ENCRYPTION_KEY decoded to ${keyBytes.length} bytes but AES-256 requires exactly 32. ` +
      `Generate a valid key with: openssl rand -hex 32  (produces 64 hex chars)  ` +
      `or: openssl rand -base64 32  (produces 44 base64 chars). ` +
      `Set it in Supabase → Edge Functions → Secrets, then re-save the SMTP profile so the password is re-encrypted.`
    );
  }
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);

  // Encrypted format: base64url(iv[12] + ciphertext)
  try {
    const combined = Uint8Array.from(atob(encrypted.replace(/-/g,"+").replace(/_/g,"/")), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error("Failed to decrypt the stored SMTP password (key mismatch or corrupted value).");
  }
}

/* ── Turn raw nodemailer/SMTP errors into actionable, secret-free messages ── */
function normalizeSmtpError(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; message?: string; response?: string };
  const code = (err?.code ?? "").toUpperCase();
  const resp = err?.responseCode ?? 0;
  const msg  = err?.message ?? "";
  const m = msg.toLowerCase();
  // The server's raw response (e.g. Mailgun's "535 5.7.0 incorrect username/password"
  // or a region hint) is far more diagnostic than a generic message. It contains no
  // secrets — only the server's own reply text — so surface it to the operator.
  const serverResp = (err?.response ?? "").trim();

  if (code === "EAUTH" || resp === 535 || resp === 534 || /invalid login|authentication failed|auth/i.test(m)) {
    return serverResp
      ? `SMTP authentication failed — the server replied: "${serverResp}". Verify the SMTP username/password (for Mailgun, use the SMTP credentials from Domain settings, not your account login, and confirm you are using the correct region host — smtp.mailgun.org for US, smtp.eu.mailgun.org for EU).`
      : "SMTP authentication failed — check the username and password.";
  }
  if (code === "ETIMEDOUT" || code === "ETIMEOUT" || /timed? ?out|greeting never received/i.test(m)) {
    return "Connection to the SMTP server timed out — check the host and port.";
  }
  if (code === "ECONNECTION" || code === "ECONNREFUSED" || code === "ESOCKET" || /connection refused|econnreset/i.test(m)) {
    return "Could not connect to the SMTP server — check the host and port.";
  }
  if (code === "ENOTFOUND" || code === "EDNS" || /getaddrinfo|dns/i.test(m)) {
    return "The SMTP server hostname could not be resolved — check the host.";
  }
  if (/self.signed|certificate|tls|ssl|wrong version number/i.test(m)) {
    return "TLS/SSL negotiation with the SMTP server failed — check the TLS/STARTTLS settings.";
  }
  if (resp === 530) return "The SMTP server requires authentication (530).";
  if (resp === 550 || /recipient|mailbox unavailable|user unknown/i.test(m)) {
    return "The recipient address was rejected by the SMTP server (550).";
  }
  if (resp === 553 || resp === 554 || /relay|sender|not permitted/i.test(m)) {
    return "The sender address was rejected or relaying is not allowed by the SMTP server.";
  }
  return msg ? `SMTP error: ${msg}` : "SMTP send failed for an unknown reason.";
}

/* ── Send via custom SMTP using nodemailer ── */
async function sendViaSmtp(params: {
  to: string; subject: string; html: string;
  from_address: string; from_name: string;
  profile: SmtpProfile;
}): Promise<{ success: boolean; error?: string; from_used?: string }> {
  const fromUsed = `"${params.from_name}" <${params.from_address}>`;
  // Decrypt outside the send try/catch so a key/decryption problem produces a
  // clear, non-SMTP error and we NEVER authenticate with ciphertext.
  let password: string;
  try {
    password = params.profile.password_encrypted
      ? await decryptPassword(params.profile.password)
      : params.profile.password;
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not decrypt SMTP password.", from_used: fromUsed };
  }
  try {
    // deno-lint-ignore no-explicit-any
    const nodemailer = await import("npm:nodemailer@6") as any;

    // Port 465 = implicit TLS (TLS from the first byte, nodemailer `secure: true`).
    // Port 587 / 2525 / 25 with TLS enabled = STARTTLS upgrade after connect
    // (`requireTLS: true`). The original code only set requireTLS from the
    // `use_starttls` flag, so `use_tls: true` + port 587 produced NO TLS at all,
    // causing every SMTP server that requires TLS for AUTH to reject with 535.
    const smtpPort    = params.profile.port;
    const useTls      = params.profile.use_tls;
    const useStartTls = params.profile.use_starttls;
    const implicitTls = useTls && smtpPort === 465;
    const requireTLS  = useStartTls || (useTls && !implicitTls);

    const transport = nodemailer.createTransport({
      host: params.profile.host,
      port: smtpPort,
      secure: implicitTls,
      requireTLS,
      tls: { rejectUnauthorized: !params.profile.ignore_cert_errors },
      auth: { user: params.profile.username, pass: password },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
    });

    const extraHeaders: Record<string, string> = {};
    for (const h of (params.profile.custom_headers || [])) {
      if (h.key) extraHeaders[h.key] = h.value;
    }

    await transport.sendMail({
      from: fromUsed,
      to: params.to,
      subject: params.subject,
      html: params.html,
      headers: extraHeaders,
    });

    return { success: true, from_used: fromUsed };
  } catch (e) {
    return { success: false, error: normalizeSmtpError(e), from_used: fromUsed };
  }
}

/* ── Send via ZeptoMail ── */
async function sendViaZepto(params: {
  to: string; subject: string; html: string;
  from_address: string; from_name: string;
}): Promise<{ success: boolean; error?: string; from_used?: string }> {
  const fromUsed = `"${params.from_name}" <${params.from_address}>`;
  if (!ZEPTO_TOKEN) {
    return { success: false, error: "Platform email sender is not configured (ZEPTOMAIL_TOKEN is missing).", from_used: fromUsed };
  }
  if (!params.from_address) {
    return { success: false, error: "No sender address configured for the platform default sender.", from_used: fromUsed };
  }
  try {
    const res = await fetch("https://api.zeptomail.com/v1.1/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Zoho-enczapikey ${ZEPTO_TOKEN}`,
      },
      body: JSON.stringify({
        from: { address: params.from_address, name: params.from_name },
        to: [{ email_address: { address: params.to, name: params.to } }],
        subject: params.subject,
        htmlbody: params.html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Platform sender rejected the message: ${err}`, from_used: fromUsed };
    }
    return { success: true, from_used: fromUsed };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Platform sender (ZeptoMail) error", from_used: fromUsed };
  }
}

/* ── Read the `role` claim from a JWT WITHOUT verifying the signature ──
 * Safe ONLY because the Supabase gateway runs this function with verify_jwt
 * enabled, so it has already cryptographically validated the token's signature
 * before invocation (a forged/unsigned token is rejected at the gateway with
 * UNAUTHORIZED_INVALID_JWT_FORMAT and never reaches here). We therefore only
 * need to read the already-trusted claim. Used by the cron auth check below. */
function jwtRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

/* ── Master send function ── */
async function sendEmail(params: {
  to: string; subject: string; html: string;
  from_address: string; from_name: string;
  smtp_profile_id?: string | null;
}): Promise<{ success: boolean; error?: string; from_used?: string }> {
  // When an SMTP profile is specified it is MANDATORY — never silently fall
  // back to the platform sender, which would send from the wrong domain.
  if (params.smtp_profile_id) {
    const { data: profile, error } = await supabase
      .from("smtp_profiles")
      .select("*")
      .eq("id", params.smtp_profile_id)
      .eq("is_active", true)
      .single();

    if (error || !profile) {
      return { success: false, error: "The selected SMTP profile was not found, is inactive, or is inaccessible. The email was not sent." };
    }

    return sendViaSmtp({
      to: params.to,
      subject: params.subject,
      html: params.html,
      // Prefer the profile's own verified sender; allow an explicit override.
      from_address: params.from_address || profile.from_address,
      from_name: params.from_name || profile.from_name,
      profile: profile as SmtpProfile,
    });
  }

  // No profile selected → platform default sender (ZeptoMail).
  return sendViaZepto(params);
}

/* ── Main handler ── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  // Two callers are allowed:
  //   1. pg_cron (every minute) — authenticates with the service-role key. This is the
  //      recurring driver that drains all due PENDING jobs across every RUNNING campaign.
  //   2. An authenticated company/platform admin — the manual "launch / relaunch" path.
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer     = authHeader.replace(/^Bearer\s+/i, "").trim();
  // The cron invoker authenticates with a service-role credential. Accept two forms:
  //   1. Exact match against the injected SUPABASE_SERVICE_ROLE_KEY (legacy setups
  //      where the env key and the pg_cron bearer are the same string).
  //   2. Any service-role JWT (role claim === "service_role"). Supabase's new API
  //      key system injects SUPABASE_SERVICE_ROLE_KEY in the new `sb_secret_…`
  //      format, while the gateway still requires a JWT (`eyJ…`) in the
  //      Authorization header — so the exact-match in (1) can never hold for a
  //      JWT bearer. The gateway runs with verify_jwt enabled and has already
  //      validated the JWT signature before this point, so reading the role claim
  //      is sufficient to recognise the cron caller.
  const isCron     = bearer.length > 0 &&
    (bearer === SERVICE_ROLE_KEY || jwtRole(bearer) === "service_role");

  if (!isCron) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const { data: caller } = await supabase
      .from("users").select("role, company_id").eq("id", user.id).single();
    if (!caller || caller.role === "EMPLOYEE") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }
  }

  try {
    const body = await req.json().catch(() => ({}));

    // ── Test-send path: send a single test email via a stored SMTP profile ──
    if (body.test_smtp_profile_id && body.test_to) {
      try {
        const isCampaignTest = !!(body.test_subject || body.test_html);
        const isPlatformDefault = body.test_smtp_profile_id === "platform_default";
        // For a real SMTP profile, default to the PROFILE's own sender (empty
        // here → sendEmail uses profile.from_address/from_name). Only the
        // platform-default path falls back to the platform sender.
        const result = await sendEmail({
          to:              String(body.test_to),
          subject:         body.test_subject ? String(body.test_subject) : "Awareone SMTP Test",
          html:            body.test_html
            ? String(body.test_html)
            : "<p>This is a test email from your Awareone SMTP profile. If you received this, the profile is configured correctly.</p>",
          from_address:    body.test_from_address ? String(body.test_from_address) : (isPlatformDefault ? "noreply@awareone.io" : ""),
          from_name:       body.test_from_name ? String(body.test_from_name) : (isPlatformDefault ? "Awareone Security" : ""),
          smtp_profile_id: isPlatformDefault ? null : String(body.test_smtp_profile_id),
        });
        if (!result.success) {
          return new Response(JSON.stringify({ success: false, error: result.error ?? "Send failed", from_used: result.from_used }), { status: 200, headers: corsHeaders });
        }
        return new Response(JSON.stringify({ success: true, sent: true, type: isCampaignTest ? "campaign_test" : "smtp_test", from_used: result.from_used }), { status: 200, headers: corsHeaders });
      } catch (testErr) {
        const msg = testErr instanceof Error ? testErr.message : "Unexpected error during test send";
        console.error("[process-campaign] test-send error:", msg);
        return new Response(JSON.stringify({ success: false, error: msg }), { status: 200, headers: corsHeaders });
      }
    }

    const campaign_id = body.campaign_id as string | undefined;
    const batch_size  = Math.min(body.batch_size ?? 50, 200); // max 200 per invocation

    // Fetch PENDING jobs due now
    let query = supabase
      .from("campaign_email_queue")
      .select(`
        *,
        phishing_campaigns(
          emails_per_minute, business_hours_only, business_hours_start,
          business_hours_end, timezone, status, company_id
        ),
        phishing_campaign_targets(
          employee_id, first_name, last_name, position, department,
          users(full_name, email, job_title, manager_name, office_location, phone, departments(name))
        )
      `)
      .eq("status", "PENDING")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(batch_size);

    if (campaign_id) query = query.eq("campaign_id", campaign_id);

    const { data: jobs, error: qErr } = await query;
    if (qErr) throw qErr;
    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending jobs" }),
        { headers: corsHeaders }
      );
    }

    let sent = 0, failed = 0, skipped = 0;

    for (const job of jobs) {
      const campaign = job.phishing_campaigns as Record<string, unknown> | null;

      // Campaign-state gating:
      //   RUNNING              → process now (fall through).
      //   SCHEDULED / PAUSED   → not yet active OR temporarily halted. Leave the
      //                          row PENDING so it is picked up once the campaign
      //                          becomes RUNNING (the scheduler flips SCHEDULED→
      //                          RUNNING; an admin resumes PAUSED). Marking it
      //                          SKIPPED here would silently drop the email.
      //   anything else        → terminal (COMPLETED/FAILED/PARTIAL_FAILURE/
      //                          DRAFT/REJECTED). Mark SKIPPED; it will never send.
      const campaignStatus = campaign?.status as string | undefined;
      if (campaignStatus !== "RUNNING") {
        if (campaignStatus === "SCHEDULED" || campaignStatus === "PAUSED") {
          // leave PENDING; do not count as skipped (it is merely deferred)
          continue;
        }
        await supabase.from("campaign_email_queue")
          .update({ status: "SKIPPED" })
          .eq("id", job.id);
        skipped++;
        continue;
      }

      // Enforce business hours
      if (campaign.business_hours_only) {
        const tz    = (campaign.timezone as string) || "UTC";
        const start = (campaign.business_hours_start as number) || 9;
        const end   = (campaign.business_hours_end   as number) || 17;
        const hour  = getHourInTimezone(tz);

        if (!isBusinessHour(hour, start, end)) {
          const reschedule = nextBusinessHourStart(start, end, tz);
          await supabase.from("campaign_email_queue")
            .update({ scheduled_at: reschedule.toISOString() })
            .eq("id", job.id);
          skipped++;
          continue;
        }
      }

      // Claim the job (optimistic lock — skip if another worker already claimed it)
      const { error: claimErr, count: claimed } = await supabase
        .from("campaign_email_queue")
        .update({ status: "SENDING" }, { count: "exact" })
        .eq("id", job.id)
        .eq("status", "PENDING");
      if (claimErr || claimed === 0) { skipped++; continue; }

      // ── Resolve per-recipient template variables ─────────────────────────────
      // Data-source priority:
      //   1. Linked employee record (users table) — SOLE source when employee_id exists
      //   2. Target persona columns (fallback only when employee_id is NULL)
      //   3. Email-derived first_name as last resort
      const target = (job.phishing_campaign_targets as Record<string, any> | null);
      const linkedUser = (target?.users as Record<string, any> | null);

      let firstName      = "";
      let lastName       = "";
      let position       = "";
      let department     = "";
      let managerName    = "";
      let officeLocation = "";
      let phone          = "";

      if (linkedUser) {
        // Employee record is authoritative; ignore persona fields entirely
        const nameParts = (linkedUser.full_name || "").trim().split(/\s+/);
        firstName      = nameParts[0] || "";
        lastName       = nameParts.slice(1).join(" ") || "";
        position       = linkedUser.job_title         || "";
        department     = linkedUser.departments?.name || "";
        managerName    = linkedUser.manager_name      || "";
        officeLocation = linkedUser.office_location   || "";
        phone          = linkedUser.phone             || "";
      } else if (target) {
        // Fallback to target persona columns
        firstName  = target.first_name || "";
        lastName   = target.last_name  || "";
        position   = target.position   || "";
        department = target.department || "";
      }

      if (!firstName) firstName = job.recipient_email.split("@")[0];

      const trackingUrl    = `${SUPABASE_URL}/functions/v1/phishing-track?t=click&c=${job.campaign_id}&r=${job.recipient_id}`;
      const unsubscribeUrl = `${SUPABASE_URL}/functions/v1/phishing-track?t=report&c=${job.campaign_id}&r=${job.recipient_id}`;
      const pixelUrlEarly  = `${SUPABASE_URL}/functions/v1/phishing-track?t=open&c=${job.campaign_id}&r=${job.recipient_id}`;
      const fullName       = `${firstName} ${lastName}`.trim();

      // Variables support both snake_case ({{first_name}}) and GoPhish dotted
      // PascalCase ({{.FirstName}}) for backward compatibility.
      const vars: Record<string, string> = {
        // snake_case (native)
        first_name:      firstName,
        last_name:       lastName,
        full_name:       fullName,
        email:           job.recipient_email,
        position,
        job_title:       position,
        department,
        manager_name:    managerName,
        office_location: officeLocation,
        phone,
        tracking_url:    trackingUrl,
        unsubscribe_url: unsubscribeUrl,
        from:            job.from_address,
        from_name:       job.from_name,
        rid:             job.recipient_id,

        // GoPhish dotted aliases
        ".FirstName":    firstName,
        ".LastName":     lastName,
        ".FullName":     fullName,
        ".Email":        job.recipient_email,
        ".Position":     position,
        ".Department":   department,
        ".From":         job.from_address,
        // Click/landing links → click endpoint (records LINK_CLICKED, then redirects).
        ".URL":          trackingUrl,
        ".TrackingURL":  trackingUrl,
        ".LandingURL":   trackingUrl,
        // Open-tracking pixel URL → open endpoint (records EMAIL_OPENED). Use in
        // an <img src="{{.TrackingPixel}}">. `.Tracker` is the full <img> tag.
        ".TrackingPixel": pixelUrlEarly,
        ".Tracker":      `<img src="${pixelUrlEarly}" width="1" height="1" style="display:none" alt="" />`,
        // Report-phishing simulation link.
        ".ReportURL":    unsubscribeUrl,
        ".RId":          job.recipient_id,
      };

      // Resolves both {{first_name}} and {{.FirstName}} (with optional whitespace).
      const resolveVars = (text: string) =>
        text.replace(/\{\{\s*(\.?[A-Za-z_][\w]*)\s*\}\}/g, (_, key) => vars[key] ?? "");

      const resolvedHtml    = resolveVars(job.email_html);
      const resolvedSubject = resolveVars(job.email_subject);

      // Inject open-tracking pixel (idempotent: only if not already present)
      const trackBase   = `${SUPABASE_URL}/functions/v1/phishing-track`;
      const pixelUrl    = `${trackBase}?t=open&c=${job.campaign_id}&r=${job.recipient_id}`;
      const trackPixel  = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
      const finalHtml   = resolvedHtml.includes("phishing-track?t=open")
        ? resolvedHtml
        : resolvedHtml.includes("</body>")
          ? resolvedHtml.replace("</body>", trackPixel + "</body>")
          : resolvedHtml + trackPixel;

      // Send
      const result = await sendEmail({
        to:               job.recipient_email,
        subject:          resolvedSubject,
        html:             finalHtml,
        from_address:     job.from_address,
        from_name:        job.from_name,
        smtp_profile_id:  job.smtp_profile_id,
      });

      if (result.success) {
        await supabase.from("campaign_email_queue")
          .update({ status: "SENT", sent_at: new Date().toISOString() })
          .eq("id", job.id);

        // Log EMAIL_SENT event
        await supabase.from("phishing_events").insert({
          campaign_id:  job.campaign_id,
          target_id:    job.target_id,
          company_id:   job.company_id,
          event_type:   "EMAIL_SENT",
          recipient_id: job.recipient_id,
          email:        job.recipient_email,
        });

        // Update target to SENT
        await supabase.from("phishing_campaign_targets")
          .update({ status: "SENT", sent_at: new Date().toISOString() })
          .eq("id", job.target_id);

        // Increment emails_sent counter on the campaign
        await supabase.rpc("increment_campaign_stat", {
          p_campaign_id: job.campaign_id,
          p_field: "emails_sent",
        });

        sent++;
      } else {
        const retryCount = (job.retry_count || 0) + 1;
        const maxRetries = 3;

        if (retryCount >= maxRetries) {
          // Final failure
          await supabase.from("campaign_email_queue")
            .update({
              status: "FAILED",
              retry_count: retryCount,
              failed_at: new Date().toISOString(),
              failure_reason: result.error,
            })
            .eq("id", job.id);

          await supabase.from("phishing_events").insert({
            campaign_id:  job.campaign_id,
            target_id:    job.target_id,
            company_id:   job.company_id,
            event_type:   "EMAIL_FAILED",
            recipient_id: job.recipient_id,
            email:        job.recipient_email,
            metadata:     { error: result.error, retries: retryCount },
          });
        } else {
          // Exponential backoff retry
          const backoffMs = retryCount * 60 * 1000; // 1min, 2min, 3min
          await supabase.from("campaign_email_queue")
            .update({
              status: "PENDING",
              retry_count: retryCount,
              scheduled_at: new Date(Date.now() + backoffMs).toISOString(),
              failure_reason: result.error,
            })
            .eq("id", job.id);
        }
        failed++;
      }

      // Check if campaign is now fully processed
      const { count: remaining } = await supabase
        .from("campaign_email_queue")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", job.campaign_id)
        .in("status", ["PENDING", "SENDING"]);

      if (remaining === 0) {
        const campId    = job.campaign_id;
        const companyId = (campaign?.company_id as string) || job.company_id;

        // Determine final status based on outcome mix:
        //   COMPLETED      — all emails sent successfully
        //   PARTIAL_FAILURE — some sent, some permanently failed
        //   FAILED         — every email permanently failed (nothing was delivered)
        const [{ count: sentCount }, { count: failedCount }] = await Promise.all([
          supabase.from("campaign_email_queue").select("id", { count: "exact", head: true }).eq("campaign_id", campId).eq("status", "SENT"),
          supabase.from("campaign_email_queue").select("id", { count: "exact", head: true }).eq("campaign_id", campId).eq("status", "FAILED"),
        ]);

        let finalStatus: string;
        if ((failedCount ?? 0) === 0) {
          finalStatus = "COMPLETED";
        } else if ((sentCount ?? 0) === 0) {
          finalStatus = "FAILED";
        } else {
          finalStatus = "PARTIAL_FAILURE";
        }

        await supabase.from("phishing_campaigns")
          .update({ status: finalStatus, completion_date: new Date().toISOString() })
          .eq("id", campId);

        await supabase.from("phishing_alerts").insert({
          campaign_id: campId,
          company_id:  companyId,
          alert_type:  "CAMPAIGN_COMPLETE",
          priority:    finalStatus === "FAILED" ? "HIGH" : (finalStatus === "PARTIAL_FAILURE" ? "MEDIUM" : "LOW"),
          title:       finalStatus === "COMPLETED"
            ? "Campaign Completed"
            : finalStatus === "PARTIAL_FAILURE"
              ? "Campaign Completed with Errors"
              : "Campaign Failed",
          message: finalStatus === "COMPLETED"
            ? `Campaign has finished sending. Check results in the dashboard.`
            : finalStatus === "PARTIAL_FAILURE"
              ? `Campaign finished but ${failedCount} email(s) could not be delivered. Check the event log for details.`
              : `Campaign could not deliver any emails. Check your SMTP configuration.`,
        });
      }

      // Micro-delay to avoid hammering the SMTP server
      await new Promise(r => setTimeout(r, 50));
    }

    return new Response(
      JSON.stringify({ processed: jobs.length, sent, failed, skipped }),
      { headers: corsHeaders }
    );

  } catch (err) {
    // Supabase/PostgREST throws plain objects ({message, details, hint, code}),
    // not Error instances — so `err instanceof Error` is false and a naive
    // fallback hides the real reason behind a generic "Worker error". Dig the
    // most specific text out of whatever was thrown so the 500 body and the logs
    // both carry an actionable message.
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    const msg = err instanceof Error
      ? err.message
      : (e?.message || e?.details || e?.hint || (e?.code ? `Database error ${e.code}` : "Worker error"));
    console.error("[process-campaign]", msg, JSON.stringify(err));
    await captureException(err, { function: "process-campaign" });
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
