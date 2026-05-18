import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const { data: target } = await supabase
    .from("phishing_campaign_targets")
    .select("id, email, campaign_id")
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

  const tsField: Record<string, string> = {
    EMAIL_OPENED: "opened_at",
    LINK_CLICKED: "clicked_at",
    FORM_SUBMITTED: "submitted_at",
  };
  const statusMap: Record<string, string> = {
    EMAIL_OPENED: "OPENED",
    LINK_CLICKED: "CLICKED",
    FORM_SUBMITTED: "SUBMITTED",
  };
  if (tsField[event_type]) {
    await supabase.from("phishing_campaign_targets")
      .update({ [tsField[event_type]]: new Date().toISOString(), status: statusMap[event_type] })
      .eq("id", target.id);
  }

  const statField: Record<string, string> = {
    EMAIL_OPENED: "emails_opened",
    LINK_CLICKED: "links_clicked",
    FORM_SUBMITTED: "data_submitted",
  };
  if (statField[event_type]) {
    await supabase.rpc("increment_campaign_stat", {
      p_campaign_id: campaign_id,
      p_field: statField[event_type],
    }).then(() => {});
  }

  if (event_type === "LINK_CLICKED" || event_type === "FORM_SUBMITTED") {
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

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  if (!t) {
    const errId = `PT-${Date.now().toString(36).toUpperCase()}-NOTYPE`;
    return errorHtml(errId, "Invalid Request", "This tracking link is missing required parameters. Please contact your administrator.");
  }

  if (!campaign_id || !recipient_id) {
    const errId = `PT-${Date.now().toString(36).toUpperCase()}-NOREF`;
    return errorHtml(errId, "Invalid Link", "This link is missing campaign or recipient information. It may have been copied incorrectly.");
  }

  if (t === "open") {
    logEvent({ campaign_id, recipient_id, event_type: "EMAIL_OPENED", ip, ua }).catch(() => {});
    return new Response(TRANSPARENT_GIF, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store, must-revalidate" },
    });
  }

  if (t === "click") {
    const encodedUrl = url.searchParams.get("url") ?? "";
    let redirectUrl = "https://www.google.com";
    try { redirectUrl = atob(encodedUrl); } catch {
      const errId = `PT-${Date.now().toString(36).toUpperCase()}-BADURL`;
      return errorHtml(errId, "Invalid Link", "This link could not be decoded. Please report this to your administrator.");
    }
    logEvent({ campaign_id, recipient_id, event_type: "LINK_CLICKED", ip, ua }).catch(() => {});
    return Response.redirect(redirectUrl, 302);
  }

  if (t === "submit" && req.method === "POST") {
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
      await logEvent({ campaign_id, recipient_id, event_type: "FORM_SUBMITTED", ip, ua, metadata: { submitted_data: body } });
    } catch {
      // Non-fatal: log failure silently, still redirect
    }
    const redirectUrl = url.searchParams.get("redirect") ?? "https://www.google.com";
    return Response.redirect(redirectUrl, 302);
  }

  const errId = `PT-${Date.now().toString(36).toUpperCase()}-UNKNOWN`;
  return errorHtml(errId, "Unknown Request", "This request type is not recognized. If you believe this is an error, please contact your administrator.");
});
