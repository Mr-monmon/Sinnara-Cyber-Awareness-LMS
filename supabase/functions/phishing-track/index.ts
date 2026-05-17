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
    try { redirectUrl = atob(encodedUrl); } catch { /* use default */ }
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
    logEvent({ campaign_id, recipient_id, event_type: "FORM_SUBMITTED", ip, ua, metadata: { submitted_data: body } }).catch(() => {});
    const redirectUrl = url.searchParams.get("redirect") ?? "https://www.google.com";
    return Response.redirect(redirectUrl, 302);
  }

  return new Response("Not found", { status: 404 });
});
