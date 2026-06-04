/**
 * create-campaign-from-request — platform-admin "Create Campaign from Request"
 *
 * Converts an approved/submitted phishing_campaign_requests ticket into a live
 * campaign using the same secure launch logic as launch-phishing-campaign:
 * creates the phishing_campaigns row, resolves targets (from phishing groups OR
 * target departments), builds campaign_email_queue rows with per-recipient
 * variable resolution, links the request to the new campaign, and marks the
 * request CONVERTED_TO_CAMPAIGN.
 *
 * Only PLATFORM_ADMIN may call this. All writes use the service role.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface TargetInfo {
  email: string;
  first_name?: string;
  last_name?: string;
  department?: string;
  position?: string;
  recipient_id?: string;
}

/* ── Variable resolution (mirrors launch-phishing-campaign) ── */
function resolveVariables(
  html: string,
  target: TargetInfo,
  meta: { campaign_id: string; company_name: string; redirect_url: string; tracking_base: string },
  customVars: Record<string, string> = {},
): string {
  const toB64url = (s: string): string => {
    const bytes = new TextEncoder().encode(s);
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  };
  const domain   = target.email.split("@")[1] || "";
  const rid      = target.recipient_id ?? "";
  const clickUrl = `${meta.tracking_base}?t=click&c=${meta.campaign_id}&r=${encodeURIComponent(rid)}&url=${encodeURIComponent(toB64url(meta.redirect_url || "https://www.google.com"))}`;
  const pixelUrl = `${meta.tracking_base}?t=open&c=${meta.campaign_id}&r=${encodeURIComponent(rid)}`;
  const trackPixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;

  const builtIn: Record<string, string> = {
    "{{.FirstName}}":    target.first_name || target.email.split("@")[0] || "",
    "{{.LastName}}":     target.last_name  || "",
    "{{.Email}}":        target.email,
    "{{.Position}}":     target.position   || "",
    "{{.Department}}":   target.department || "",
    "{{.Company}}":      meta.company_name,
    "{{.CompanyDomain}}": domain,
    "{{.ManagerName}}":  "",
    "{{.LoginURL}}":     clickUrl,
    "{{.URL}}":          clickUrl,
    "{{.TrackingURL}}":  clickUrl,
    "{{.TrackingPixel}}": trackPixel,
    "{{.RId}}":          rid,
    "{{.RandomInt}}":    String(Math.floor(Math.random() * 9999) + 1),
    "{{.Date}}":         new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  };
  for (const [k, v] of Object.entries(customVars)) builtIn[`{{.${k}}}`] = v;

  let result = html;
  for (const [token, value] of Object.entries(builtIn)) result = result.split(token).join(value);
  return result;
}

async function rollback(db: ReturnType<typeof createClient>, campaignId: string, reason: string): Promise<Response> {
  await db.from("phishing_campaigns").delete().eq("id", campaignId);
  return new Response(JSON.stringify({ success: false, error: reason }), { status: 500, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const { data: caller } = await db.from("users").select("role").eq("id", user.id).single();
  // Conversion is a platform-team action (it runs a campaign on behalf of a company).
  if (!caller || caller.role !== "PLATFORM_ADMIN") {
    return new Response(JSON.stringify({ success: false, error: "Only platform administrators can create a campaign from a request." }), { status: 403, headers: corsHeaders });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), { status: 400, headers: corsHeaders }); }

  const requestId = body.request_id as string | undefined;
  if (!requestId) {
    return new Response(JSON.stringify({ success: false, error: "request_id is required" }), { status: 400, headers: corsHeaders });
  }

  // ── Load the request ──
  const { data: rq, error: rqErr } = await db
    .from("phishing_campaign_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (rqErr || !rq) {
    return new Response(JSON.stringify({ success: false, error: "Request not found" }), { status: 404, headers: corsHeaders });
  }

  if (rq.campaign_id) {
    return new Response(JSON.stringify({ success: false, error: "This request has already been converted to a campaign.", code: "ALREADY_CONVERTED" }), { status: 409, headers: corsHeaders });
  }

  // ── Validate completeness ──
  const missing: string[] = [];
  if (!rq.campaign_name)   missing.push("campaign name");
  if (!rq.email_subject)   missing.push("email subject");
  if (!rq.email_html_body) missing.push("email HTML body");
  const groupIds: string[] = Array.isArray(rq.group_ids) ? rq.group_ids : [];
  const deptIds:  string[] = Array.isArray(rq.target_departments) ? rq.target_departments : [];
  if (groupIds.length === 0 && deptIds.length === 0) missing.push("at least one target group or department");
  if (missing.length > 0) {
    return new Response(JSON.stringify({ success: false, error: `Request is incomplete — missing: ${missing.join(", ")}.`, code: "INCOMPLETE_REQUEST" }), { status: 400, headers: corsHeaders });
  }

  const companyId = rq.company_id as string;

  // ── Resolve targets: phishing groups take precedence, else departments ──
  let targets: TargetInfo[] = [];
  if (groupIds.length > 0) {
    const { data: members, error: mErr } = await db
      .from("phishing_group_members")
      .select("email, first_name, last_name, position, department")
      .in("group_id", groupIds);
    if (mErr) {
      return new Response(JSON.stringify({ success: false, error: "Failed to load group members: " + mErr.message }), { status: 500, headers: corsHeaders });
    }
    targets = (members ?? []).map(m => ({
      email: m.email, first_name: m.first_name, last_name: m.last_name,
      position: m.position, department: m.department,
    }));
  } else {
    const { data: emps, error: eErr } = await db
      .from("users")
      .select("email, full_name, job_title, departments(name)")
      .eq("company_id", companyId)
      .eq("role", "EMPLOYEE")
      .in("department_id", deptIds);
    if (eErr) {
      return new Response(JSON.stringify({ success: false, error: "Failed to load department employees: " + eErr.message }), { status: 500, headers: corsHeaders });
    }
    targets = (emps ?? []).map(e => {
      const parts = (e.full_name || "").trim().split(/\s+/);
      return {
        email: e.email,
        first_name: parts[0] || "",
        last_name: parts.slice(1).join(" ") || "",
        position: e.job_title || "",
        department: (e.departments as { name?: string } | null)?.name || "",
      };
    });
  }

  // De-duplicate by email
  const seen = new Set<string>();
  targets = targets.filter(t => {
    const key = (t.email || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (targets.length === 0) {
    return new Response(JSON.stringify({ success: false, error: "The selected groups/departments have no members to target." }), { status: 400, headers: corsHeaders });
  }

  // ── Quota check ──
  const { data: limitCheck } = await db.rpc("check_phishing_limits", {
    p_company_id: companyId, p_target_count: targets.length,
  });
  if (limitCheck && !(limitCheck as Record<string, unknown>).allowed) {
    const reason = (limitCheck as Record<string, unknown>).reason as string ?? "Quota exceeded";
    return new Response(JSON.stringify({ success: false, error: `Campaign blocked: ${reason}`, code: "QUOTA_EXCEEDED" }), { status: 403, headers: corsHeaders });
  }

  // ── Company name + custom vars ──
  const [companyRes, customVarRes] = await Promise.all([
    db.from("companies").select("name").eq("id", companyId).single(),
    db.from("phishing_custom_variables").select("variable_name, variable_value").eq("company_id", companyId),
  ]);
  const companyName = companyRes.data?.name ?? "";
  const customVars: Record<string, string> = {};
  for (const row of (customVarRes.data ?? [])) customVars[row.variable_name] = row.variable_value;

  // ── Scheduling ──
  const launchType   = (body.launch_type as string) || rq.launch_type || "IMMEDIATE";
  const scheduledRaw = (rq.scheduled_launch_at as string | null) || (rq.scheduled_date as string | null);
  const isScheduled  = launchType === "SCHEDULED" && !!scheduledRaw;
  const campaignScheduledAt = isScheduled ? new Date(scheduledRaw!).toISOString() : null;
  const status = campaignScheduledAt ? "SCHEDULED" : "RUNNING";

  // ── Create campaign ──
  const { data: camp, error: campErr } = await db
    .from("phishing_campaigns")
    .insert({
      company_id:           companyId,
      request_id:           rq.id,
      name:                 rq.campaign_name,
      status,
      smtp_profile_id:      rq.smtp_profile_id ?? null,
      landing_page_id:      rq.landing_page_id ?? null,
      group_ids:            groupIds,
      emails_per_minute:    Number(rq.emails_per_minute ?? 10),
      business_hours_only:  Boolean(rq.business_hours_only ?? false),
      business_hours_start: Number(rq.business_hours_start ?? 9),
      business_hours_end:   Number(rq.business_hours_end ?? 17),
      timezone:             String(rq.timezone ?? "Asia/Riyadh"),
      scheduled_at:         campaignScheduledAt,
      launched_at:          status === "RUNNING" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (campErr || !camp) {
    return new Response(JSON.stringify({ success: false, error: campErr?.message ?? "Campaign creation failed" }), { status: 500, headers: corsHeaders });
  }

  // ── Insert targets ──
  const targetsInsert = targets.map(t => ({
    campaign_id: camp.id,
    email:       t.email,
    first_name:  t.first_name || "",
    last_name:   t.last_name  || "",
    position:    t.position   || "",
    department:  t.department || "",
    status:      "PENDING",
  }));
  for (let i = 0; i < targetsInsert.length; i += 500) {
    const { error: tErr } = await db.from("phishing_campaign_targets").insert(targetsInsert.slice(i, i + 500));
    if (tErr) return rollback(db, camp.id, "Failed to insert targets: " + tErr.message);
  }

  // ── Re-fetch for recipient_ids ──
  const { data: insertedTargets, error: fetchErr } = await db
    .from("phishing_campaign_targets")
    .select("id, email, first_name, last_name, position, department, recipient_id")
    .eq("campaign_id", camp.id);
  if (fetchErr || !insertedTargets) return rollback(db, camp.id, "Failed to retrieve inserted targets");

  // ── Build queue ──
  const trackBase        = `${SUPABASE_URL}/functions/v1/phishing-track`;
  const rateMs           = 60000 / Math.max(Number(rq.emails_per_minute ?? 10), 1);
  const baseTime         = campaignScheduledAt ? new Date(campaignScheduledAt).getTime() : Date.now();
  const finalRedirectUrl = String(rq.redirect_url || "https://www.google.com");
  const smtpId           = rq.smtp_profile_id ? String(rq.smtp_profile_id) : null;
  const fromAddr         = String(rq.from_address || "noreply@awareone.io");
  const fromNm           = String(rq.from_name    || "AwareOne Security");
  const emailSubjectStr  = String(rq.email_subject);
  const emailHtmlStr      = String(rq.email_html_body);

  const queueEntries = insertedTargets.map((t, i) => {
    const sendAt = new Date(baseTime + i * rateMs);
    const targetRedirectUrl = rq.landing_page_id
      ? `${SUPABASE_URL}/functions/v1/serve-landing-page?lp=${rq.landing_page_id}&c=${camp.id}&r=${encodeURIComponent(t.recipient_id)}`
      : finalRedirectUrl;
    const meta = { campaign_id: camp.id, company_name: companyName, redirect_url: targetRedirectUrl, tracking_base: trackBase };
    const info: TargetInfo = {
      email: t.email, first_name: t.first_name, last_name: t.last_name,
      position: t.position, department: t.department, recipient_id: t.recipient_id,
    };
    const resolvedHtml    = resolveVariables(emailHtmlStr, info, meta, customVars);
    const resolvedSubject = resolveVariables(emailSubjectStr, info, meta, customVars);
    const pixelUrl   = `${trackBase}?t=open&c=${camp.id}&r=${encodeURIComponent(t.recipient_id)}`;
    const trackPixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
    const finalHtml  = resolvedHtml.includes("phishing-track?t=open")
      ? resolvedHtml
      : resolvedHtml.includes("</body>")
        ? resolvedHtml.replace("</body>", trackPixel + "</body>")
        : resolvedHtml + trackPixel;
    return {
      campaign_id: camp.id, target_id: t.id, company_id: companyId,
      smtp_profile_id: smtpId, recipient_email: t.email, recipient_id: t.recipient_id,
      email_subject: resolvedSubject, email_html: finalHtml,
      from_address: fromAddr, from_name: fromNm, scheduled_at: sendAt.toISOString(),
    };
  });

  for (let i = 0; i < queueEntries.length; i += 100) {
    const { error: qErr } = await db.from("campaign_email_queue").insert(queueEntries.slice(i, i + 100));
    if (qErr) return rollback(db, camp.id, "Failed to enqueue emails: " + qErr.message);
  }

  await db.from("phishing_campaigns").update({ total_queue_size: queueEntries.length }).eq("id", camp.id);
  await db.rpc("update_company_email_usage", { p_company_id: companyId, p_count: queueEntries.length });

  // ── Link request → campaign and mark converted ──
  await db.from("phishing_campaign_requests")
    .update({
      campaign_id:  camp.id,
      status:       "CONVERTED_TO_CAMPAIGN",
      converted_at: new Date().toISOString(),
      approved_by:  user.id,
      approved_at:  rq.approved_at ?? new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    })
    .eq("id", rq.id);

  await db.from("phishing_alerts").insert({
    campaign_id: camp.id,
    company_id:  companyId,
    alert_type:  status === "RUNNING" ? "CAMPAIGN_STARTED" : "CAMPAIGN_SCHEDULED",
    priority:    "LOW",
    title:       `Campaign Created from Request ${rq.ticket_number}`,
    message:     `Campaign "${rq.campaign_name}" was created from request ${rq.ticket_number} with ${targets.length} targets.`,
  });

  if (status === "RUNNING") {
    await fetch(`${SUPABASE_URL}/functions/v1/process-campaign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ campaign_id: camp.id, batch_size: 50 }),
    }).catch(e => console.error("[create-campaign-from-request] process-campaign invoke error:", e));
  }

  return new Response(JSON.stringify({
    success: true, campaign_id: camp.id, status,
    target_count: targets.length, queue_size: queueEntries.length,
  }), { headers: corsHeaders });
});
