import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as buildCors } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rateLimit.ts";

// Abuse guard for this PUBLIC, unauthenticated endpoint. A caller who harvests
// campaign/recipient tokens could otherwise spam tracking events or POST submit
// bodies without limit. 120 hits / 60s / IP is far above any legitimate
// recipient's traffic (a real victim produces a handful of hits) but throttles
// a single-host flood. Best-effort per-isolate L1 control — see rateLimit.ts and
// docs/SECURITY_HARDENING.md for the L2 (gateway/WAF) recommendation.
const TRACK_RATE_LIMIT = 120;
const TRACK_RATE_WINDOW_MS = 60_000;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TRANSPARENT_GIF = new Uint8Array([
  0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00,0x80,0x00,0x00,
  0xff,0xff,0xff,0x00,0x00,0x00,0x21,0xf9,0x04,0x00,0x00,0x00,0x00,0x00,
  0x2c,0x00,0x00,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0x02,0x02,0x44,0x01,0x00,0x3b
]);

// Privacy guard — mirrors src/lib/redaction.ts (kept in sync; unit-tested there).
// Submitted form payloads are reduced to field NAMES only; secret values
// (passwords, OTPs, tokens, …) are never persisted.
const SENSITIVE_PATTERNS = [
  "password", "pass", "pwd", "token", "secret", "otp", "mfa", "code", "pin", "credential",
];
function redactSubmittedFields(body: Record<string, unknown> | null | undefined) {
  const field_names = body ? Object.keys(body) : [];
  const redacted_fields = field_names.filter((n) =>
    SENSITIVE_PATTERNS.some((p) => n.toLowerCase().includes(p))
  );
  return { submitted: true, field_names, redacted_fields };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SAFE_DEFAULT_REDIRECT = "https://www.google.com";

// ── Open-redirect guard (mirrors src/lib/urlSafety.ts; unit-tested there) ──
function parseHttpUrl(value: string): URL | null {
  let u: URL;
  try { u = new URL(value); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  return u;
}
function isPrivateOrReservedIp(ip: string): boolean {
  const addr = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateOrReservedIp(mapped[1]);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(addr)) {
    const p = addr.split(".").map((x) => parseInt(x, 10));
    if (p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = p;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 192 && b === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;
    return false;
  }
  if (addr.includes(":")) {
    if (addr === "::" || addr === "::1") return true;
    if (/^fe[89ab]/.test(addr)) return true;
    if (addr.startsWith("fc") || addr.startsWith("fd")) return true;
    if (addr.startsWith("ff")) return true;
    if (addr.startsWith("::ffff:")) return true;
    return false;
  }
  return false;
}
function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host === "metadata" || host === "metadata.google.internal") return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return isPrivateOrReservedIp(host);
  return false;
}
function isAllowedRedirect(target: string, allowedOrigins: string[]): boolean {
  const u = parseHttpUrl(target);
  if (!u) return false;
  if (isBlockedHostname(u.hostname)) return false;
  const allow = new Set(allowedOrigins.filter(Boolean).map((o) => o.replace(/\/$/, "")));
  return allow.has(u.origin);
}

/**
 * Resolve the redirect destination SERVER-SIDE from the campaign record rather
 * than trusting the query parameter. A query-provided URL is only honoured when
 * it matches the server-derived allowlist (our own functions origin, or the
 * campaign's stored redirect origin). Otherwise we fall back to the campaign's
 * landing page, its stored redirect_url, or a safe default — never to an
 * attacker-controlled value.
 */
async function resolveRedirect(
  campaignId: string,
  recipientId: string,
  queryUrl: string,
): Promise<string> {
  let landingPageId: string | null = null;
  let storedRedirect: string | null = null;
  if (campaignId) {
    const { data } = await supabase
      .from("phishing_campaigns")
      .select("landing_page_id, redirect_url")
      .eq("id", campaignId)
      .maybeSingle();
    landingPageId = (data?.landing_page_id as string) ?? null;
    storedRedirect = (data?.redirect_url as string) ?? null;
  }

  const ourOrigin = (() => { try { return new URL(SUPABASE_URL).origin; } catch { return ""; } })();
  const allow = [ourOrigin];
  if (storedRedirect) {
    const su = parseHttpUrl(storedRedirect);
    if (su) allow.push(su.origin);
  }

  // 1. Honour the query URL ONLY if it is on the allowlist (e.g. our own
  //    serve-landing-page link, or the campaign's configured redirect origin).
  if (queryUrl && isAllowedRedirect(queryUrl, allow)) return queryUrl;

  // 2. Otherwise resolve from the record: landing page → serve-landing-page.
  if (landingPageId) {
    return `${SUPABASE_URL}/functions/v1/serve-landing-page?lp=${landingPageId}&c=${encodeURIComponent(campaignId)}&r=${encodeURIComponent(recipientId)}`;
  }

  // 3. Stored campaign redirect, if it is a safe public http(s) URL.
  if (storedRedirect) {
    const su = parseHttpUrl(storedRedirect);
    if (su && !isBlockedHostname(su.hostname)) return storedRedirect;
  }

  // 4. Safe default.
  return SAFE_DEFAULT_REDIRECT;
}

// Heuristic: is this request an <img> load rather than a real navigation?
// Legacy templates put {{.TrackingURL}} (the click URL) inside an <img src>,
// so an open would otherwise be miscounted as a click. Browsers send
// Sec-Fetch-Dest: image and an image/* Accept for pixel loads.
function looksLikeImageRequest(req: Request): boolean {
  const dest = (req.headers.get("sec-fetch-dest") ?? "").toLowerCase();
  if (dest === "image") return true;
  const accept = (req.headers.get("accept") ?? "").toLowerCase();
  return accept.startsWith("image/");
}

function parseUserAgent(ua: string) {
  let browser = "Unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edg")) browser = "Edge";

  let os = "Unknown";
  if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Linux") && !ua.includes("Android")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  let device_type = "Desktop";
  if (ua.includes("Mobile") || ua.includes("iPhone") || ua.includes("Android")) device_type = "Mobile";
  else if (ua.includes("iPad") || ua.includes("Tablet")) device_type = "Tablet";

  return { browser, os, device_type };
}

async function logEvent(params: {
  campaign_id: string;
  recipient_id: string;
  event_type: string;
  ip: string;
  ua: string;
  metadata?: Record<string, unknown>;
}) {
  const { campaign_id, recipient_id, event_type, ip, ua, metadata = {} } = params;
  const uaParsed = parseUserAgent(ua);

  // Pull the current funnel state so we can dedupe and avoid status regression.
  const { data: target } = await supabase
    .from("phishing_campaign_targets")
    .select("id, email, campaign_id, status, opened_at, clicked_at, submitted_at, reported_at")
    .eq("recipient_id", recipient_id)
    .eq("campaign_id", campaign_id)
    .single();

  if (!target) return null;

  const { data: campaign } = await supabase
    .from("phishing_campaigns")
    .select("company_id")
    .eq("id", campaign_id)
    .single();

  if (!campaign) return null;

  // Map each event to its funnel timestamp, target status, rank, and aggregate counter.
  // Rank lets us advance status forward only (an EMAIL_OPENED must never overwrite CLICKED).
  const tsField: Record<string, string> = {
    EMAIL_OPENED: "opened_at",
    LINK_CLICKED: "clicked_at",
    FORM_SUBMITTED: "submitted_at",
    EMAIL_REPORTED: "reported_at",
  };
  const statusMap: Record<string, string> = {
    EMAIL_OPENED: "OPENED",
    LINK_CLICKED: "CLICKED",
    FORM_SUBMITTED: "SUBMITTED",
  };
  const statField: Record<string, string> = {
    EMAIL_OPENED: "emails_opened",
    LINK_CLICKED: "links_clicked",
    FORM_SUBMITTED: "data_submitted",
    EMAIL_REPORTED: "emails_reported",
  };
  const statusRank: Record<string, number> = {
    PENDING: 0, SENT: 1, OPENED: 2, CLICKED: 3, SUBMITTED: 4,
  };

  // Has this target already reached this stage? If so, this is a repeat hit —
  // record the event below but do NOT increment the campaign counter again.
  const existingTs = (target as Record<string, unknown>)[tsField[event_type] ?? ""] as string | null;
  const isFirstForStage = !existingTs;

  // EMAIL_OPENED is fired by the tracking pixel, which mail clients and their
  // image proxies (Gmail/Outlook/Apple) routinely re-fetch — pre-caching on
  // delivery, then again on actual view, plus on every re-open. Recording each
  // hit floods the event timeline with duplicate "Email Opened" rows for a
  // single real open. We therefore collapse opens to ONE event per recipient:
  // only the first open is persisted. Clicks/submits keep full history.
  if (event_type === "EMAIL_OPENED" && !isFirstForStage) {
    return null;
  }

  const { data: event } = await supabase.from("phishing_events").insert({
    campaign_id,
    target_id: target.id,
    company_id: campaign.company_id,
    event_type,
    recipient_id,
    email: target.email,
    ip_address: ip,
    user_agent: ua,
    browser: uaParsed.browser,
    os: uaParsed.os,
    device_type: uaParsed.device_type,
    metadata,
  }).select().single();

  if (tsField[event_type] && isFirstForStage) {
    const update: Record<string, unknown> = { [tsField[event_type]]: new Date().toISOString() };
    // Reporting is independent of the open→click→submit funnel and must not move status.
    const newStatus = statusMap[event_type];
    if (newStatus) {
      const currentRank = statusRank[target.status as string] ?? 0;
      const newRank = statusRank[newStatus] ?? 0;
      if (newRank > currentRank) update.status = newStatus;
    }
    await supabase.from("phishing_campaign_targets").update(update).eq("id", target.id);

    if (statField[event_type]) {
      await supabase.rpc("increment_campaign_stat", {
        p_campaign_id: campaign_id,
        p_field: statField[event_type],
      }).then(() => {});
    }
  }

  if (isFirstForStage && (event_type === "LINK_CLICKED" || event_type === "FORM_SUBMITTED")) {
    const priority = event_type === "FORM_SUBMITTED" ? "CRITICAL" : "HIGH";
    const alertTitle = event_type === "FORM_SUBMITTED"
      ? `Credentials Submitted — ${target.email}`
      : `Link Clicked — ${target.email}`;
    await supabase.from("phishing_alerts").insert({
      campaign_id,
      company_id: campaign.company_id,
      target_id: target.id,
      event_id: event?.id,
      alert_type: event_type === "FORM_SUBMITTED" ? "CREDENTIALS_SUBMITTED" : "LINK_CLICKED",
      priority,
      title: alertTitle,
      message: `${target.email} ${event_type === "FORM_SUBMITTED" ? "submitted their credentials" : "clicked the phishing link"} at ${new Date().toISOString()}`,
    });
  }

  return event;
}

function errorHtml(code: string, title: string, detail: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Error — Awareone</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#0e1012;color:#e2e8f0;
       display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .card{background:#1a1e26;border:1px solid rgba(255,255,255,0.09);border-radius:16px;
        padding:36px;max-width:440px;width:100%;text-align:center}
  .icon{width:52px;height:52px;border-radius:50%;background:rgba(248,113,113,0.12);
        border:1px solid rgba(248,113,113,0.28);display:flex;align-items:center;
        justify-content:center;margin:0 auto 20px;font-size:22px}
  h1{font-size:20px;font-weight:700;color:#fff;margin-bottom:10px}
  p{font-size:14px;color:#94a3b8;line-height:1.6;margin-bottom:20px}
  .code{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);
        border-radius:8px;padding:10px 16px;font-family:monospace;font-size:12px;
        color:#64748b;word-break:break-all}
  .label{font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:0.8px;
         margin-bottom:4px}
</style>
</head>
<body>
<div class="card">
  <div class="icon">⚠</div>
  <h1>${title}</h1>
  <p>${detail}</p>
  <div class="label">Error Reference Code</div>
  <div class="code">${code}</div>
</div>
</body>
</html>`;
  return new Response(html, {
    status: 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const t = url.searchParams.get("t");
  const campaign_id = url.searchParams.get("c") ?? "";
  const recipient_id = url.searchParams.get("r") ?? "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  const ua = req.headers.get("user-agent") ?? "";

  // Public endpoint: wildcard CORS is required (recipients arrive from any
  // origin / mail client) and safe (no cookies, no tenant data returned).
  const corsHeaders = buildCors(req, { methods: "GET, POST, OPTIONS", headers: "content-type", publicWildcard: true });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  // Best-effort per-IP flood guard. When exceeded we still serve a benign
  // response (pixel / redirect) but SKIP all database side effects, so a flood
  // cannot amplify into unbounded inserts. Legitimate recipients never approach
  // this ceiling.
  const within = rateLimit(`pt:${ip}`, TRACK_RATE_LIMIT, TRACK_RATE_WINDOW_MS).allowed;

  if (!t) {
    const errId = `PT-${Date.now().toString(36).toUpperCase()}-NOTYPE`;
    return errorHtml(errId, "Invalid Request", "This tracking link is missing required parameters. Please contact your administrator.");
  }

  if (!campaign_id || !recipient_id) {
    const errId = `PT-${Date.now().toString(36).toUpperCase()}-NOREF`;
    return errorHtml(errId, "Invalid Link", "This link is missing campaign or recipient information. It may have been copied incorrectly.");
  }

  if (t === "open") {
    if (within) logEvent({ campaign_id, recipient_id, event_type: "EMAIL_OPENED", ip, ua }).catch(() => {});
    return new Response(TRANSPARENT_GIF, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store, must-revalidate" },
    });
  }

  if (t === "click") {
    // Backward compatibility: legacy templates embed the click URL in an
    // <img src="{{.TrackingURL}}">. Such an image load must be recorded as an
    // OPEN, not a click, otherwise every open inflates the click count.
    if (looksLikeImageRequest(req)) {
      if (within) logEvent({ campaign_id, recipient_id, event_type: "EMAIL_OPENED", ip, ua }).catch(() => {});
      return new Response(TRANSPARENT_GIF, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store, must-revalidate" },
      });
    }
    // SECURITY (open redirect): do not trust the query-provided URL. Decode it
    // for the allowlist check, then resolve the final destination server-side
    // from the campaign record.
    const encodedUrl = url.searchParams.get("url") ?? "";
    let decodedUrl = "";
    if (encodedUrl) {
      try {
        // The URL is base64url-encoded (+ → -, / → _, padding stripped).
        // atob requires standard base64, so convert back before decoding.
        const b64 = encodedUrl.replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "==".slice(0, (4 - b64.length % 4) % 4);
        decodedUrl = atob(padded);
      } catch { decodedUrl = ""; }
    }
    // Over the flood ceiling: skip the DB read + write entirely and send the
    // recipient to a safe default rather than amplifying load.
    if (!within) return Response.redirect(SAFE_DEFAULT_REDIRECT, 302);
    const redirectUrl = await resolveRedirect(campaign_id, recipient_id, decodedUrl);
    logEvent({ campaign_id, recipient_id, event_type: "LINK_CLICKED", ip, ua }).catch(() => {});
    return Response.redirect(redirectUrl, 302);
  }

  if (t === "submit" && req.method === "POST") {
    // Over the flood ceiling: do not read the body or write anything; send the
    // recipient onward to a safe default.
    if (!within) return Response.redirect(SAFE_DEFAULT_REDIRECT, 302);
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      try {
        const fd = await req.formData();
        fd.forEach((v, k) => { body[k] = v; });
      } catch { /* ignore */ }
    }
    try {
      // SECURITY: never persist raw submitted values (passwords/OTPs/tokens).
      // Store only the field names and which of them were sensitive.
      await logEvent({ campaign_id, recipient_id, event_type: "FORM_SUBMITTED", ip, ua, metadata: redactSubmittedFields(body) });
    } catch {
      // Non-fatal: log failure silently, still redirect
    }
    // SECURITY (open redirect): resolve the post-submit destination server-side
    // from the campaign record; only honour ?redirect= if it is allowlisted.
    const submitRedirect = url.searchParams.get("redirect") ?? "";
    const redirectUrl = await resolveRedirect(campaign_id, recipient_id, submitRedirect);
    return Response.redirect(redirectUrl, 302);
  }

  if (t === "report") {
    // Recipient reported the email as phishing (e.g. "Report" button / mailbox plugin).
    // Independent of the funnel — feeds reporting_rate, never alters open/click/submit status.
    if (within) logEvent({ campaign_id, recipient_id, event_type: "EMAIL_REPORTED", ip, ua }).catch(() => {});
    if (req.method === "GET") {
      return new Response(TRANSPARENT_GIF, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store, must-revalidate" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const errId = `PT-${Date.now().toString(36).toUpperCase()}-UNKNOWN`;
  return errorHtml(errId, "Unknown Request", "This request type is not recognized. If you believe this is an error, please contact your administrator.");
});
