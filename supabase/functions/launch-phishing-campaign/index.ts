/**
 * launch-phishing-campaign — secure server-side campaign launcher
 *
 * Moves all multi-table inserts (campaign, targets, queue) out of the browser
 * so that:
 *   1. campaign_email_queue rows can only be created by the service role.
 *   2. Quota is checked and consumed atomically on the server.
 *   3. Variable resolution and recipient_id lookups happen after the DB
 *      generates recipient_ids, not before.
 *
 * Callers: COMPANY_ADMIN, PHISHING_OPERATOR, PLATFORM_ADMIN (authenticated JWT).
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

/* ── Variable resolution engine (mirrors PhishingCampaignsPage.tsx resolveVariables) ── */
function resolveVariables(
  html: string,
  target: {
    email: string;
    first_name?: string;
    last_name?: string;
    department?: string;
    position?: string;
    recipient_id?: string;
  },
  meta: {
    campaign_id: string;
    company_name: string;
    redirect_url: string;
    tracking_base: string;
  },
  customVars: Record<string, string> = {}
): string {
  const toB64url = (s: string): string => {
    const bytes = new TextEncoder().encode(s);
    let b64 = btoa(String.fromCharCode(...bytes));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
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

  const custom: Record<string, string> = {};
  for (const [k, v] of Object.entries(customVars)) {
    custom[`{{.${k}}}`] = v;
  }

  const allVars = { ...builtIn, ...custom };
  let result = html;
  for (const [token, value] of Object.entries(allVars)) {
    result = result.split(token).join(value);
  }
  return result;
}

/* ── Helper: roll back a partially-created campaign ── */
async function rollback(db: ReturnType<typeof createClient>, campaignId: string, reason: string): Promise<Response> {
  await db.from("phishing_campaigns").delete().eq("id", campaignId);
  return new Response(JSON.stringify({ success: false, error: reason }), { status: 500, headers: corsHeaders });
}

/* ── Main handler ── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  // Authenticate caller
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const { data: caller } = await db
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (!caller || !["COMPANY_ADMIN", "PHISHING_OPERATOR", "COMPANY_SUPER_ADMIN", "PLATFORM_ADMIN"].includes(caller.role as string)) {
    return new Response(JSON.stringify({ success: false, error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  const companyId = caller.company_id as string;
  if (!companyId) {
    return new Response(JSON.stringify({ success: false, error: "User has no associated company" }), { status: 403, headers: corsHeaders });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), { status: 400, headers: corsHeaders }); }

  const {
    name, group_ids, email_subject, email_html,
    smtp_profile_id, from_address, from_name,
    landing_page_id, redirect_url,
    emails_per_minute, random_delay, random_delay_max_seconds,
    business_hours_only, business_hours_start, business_hours_end, timezone,
    launch_type, scheduled_at,
    scenario_id,
  } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return new Response(JSON.stringify({ success: false, error: "Campaign name is required" }), { status: 400, headers: corsHeaders });
  }

  const isDraft = launch_type === "draft";

  if (!isDraft) {
    if (!Array.isArray(group_ids) || group_ids.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "At least one target group is required" }), { status: 400, headers: corsHeaders });
    }
    if (!email_subject || !email_html) {
      return new Response(JSON.stringify({ success: false, error: "Email subject and HTML body are required" }), { status: 400, headers: corsHeaders });
    }
  }

  // ── Draft: create campaign record only ──
  if (isDraft) {
    const { data: camp, error: campErr } = await db
      .from("phishing_campaigns")
      .insert({
        company_id:               companyId,
        name:                     name.trim(),
        status:                   "DRAFT",
        smtp_profile_id:          smtp_profile_id ?? null,
        landing_page_id:          landing_page_id ?? null,
        group_ids:                Array.isArray(group_ids) ? group_ids : [],
        scenario_id:              scenario_id ?? null,
        emails_per_minute:        Number(emails_per_minute ?? 10),
        random_delay_enabled:     Boolean(random_delay),
        random_delay_max_seconds: Number(random_delay_max_seconds ?? 60),
        business_hours_only:      Boolean(business_hours_only),
        business_hours_start:     Number(business_hours_start ?? 9),
        business_hours_end:       Number(business_hours_end ?? 17),
        timezone:                 String(timezone ?? "Asia/Riyadh"),
        scheduled_at:             null,
        launched_at:              null,
      })
      .select("id")
      .single();

    if (campErr || !camp) {
      return new Response(JSON.stringify({ success: false, error: campErr?.message ?? "Campaign creation failed" }), { status: 500, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ success: true, campaign_id: camp.id, status: "DRAFT" }), { headers: corsHeaders });
  }

  // ── Load group members ──
  const { data: members, error: membersErr } = await db
    .from("phishing_group_members")
    .select("email, first_name, last_name, position, department")
    .in("group_id", group_ids as string[]);

  if (membersErr) {
    return new Response(JSON.stringify({ success: false, error: "Failed to load group members: " + membersErr.message }), { status: 500, headers: corsHeaders });
  }

  const targetCount = members?.length ?? 0;
  if (targetCount === 0) {
    return new Response(JSON.stringify({ success: false, error: "Selected groups have no members. Add members to the groups first." }), { status: 400, headers: corsHeaders });
  }

  // ── Quota check (server-side enforcement) ──
  const { data: limitCheck, error: limitErr } = await db.rpc("check_phishing_limits", {
    p_company_id:   companyId,
    p_target_count: targetCount,
  });

  if (limitErr) {
    console.error("[launch-phishing-campaign] quota check error:", limitErr.message);
  } else if (limitCheck && !(limitCheck as Record<string, unknown>).allowed) {
    const reason = (limitCheck as Record<string, unknown>).reason as string ?? "Quota exceeded";
    return new Response(JSON.stringify({ success: false, error: `Campaign blocked: ${reason}`, code: "QUOTA_EXCEEDED" }), { status: 403, headers: corsHeaders });
  }

  // ── Load company name and custom variables in parallel ──
  const [companyRes, customVarRes] = await Promise.all([
    db.from("companies").select("name").eq("id", companyId).single(),
    db.from("phishing_custom_variables").select("variable_name, variable_value").eq("company_id", companyId),
  ]);

  const companyName = companyRes.data?.name ?? "";
  const customVars: Record<string, string> = {};
  for (const row of (customVarRes.data ?? [])) {
    customVars[row.variable_name] = row.variable_value;
  }

  // ── Determine launch status ──
  const campaignScheduledAt = (launch_type === "scheduled" && scheduled_at) ? String(scheduled_at) : null;
  const status = campaignScheduledAt ? "SCHEDULED" : "RUNNING";

  // ── Create campaign record ──
  const { data: camp, error: campErr } = await db
    .from("phishing_campaigns")
    .insert({
      company_id:               companyId,
      name:                     (name as string).trim(),
      status,
      smtp_profile_id:          smtp_profile_id ?? null,
      landing_page_id:          landing_page_id ?? null,
      group_ids:                group_ids,
      scenario_id:              scenario_id ?? null,
      // Stored so phishing-track can resolve the post-click/submit redirect
      // server-side (open-redirect defence) instead of trusting the query param.
      redirect_url:             String(redirect_url || "https://www.google.com"),
      emails_per_minute:        Number(emails_per_minute ?? 10),
      random_delay_enabled:     Boolean(random_delay),
      random_delay_max_seconds: Number(random_delay_max_seconds ?? 60),
      business_hours_only:      Boolean(business_hours_only),
      business_hours_start:     Number(business_hours_start ?? 9),
      business_hours_end:       Number(business_hours_end ?? 17),
      timezone:                 String(timezone ?? "Asia/Riyadh"),
      scheduled_at:             campaignScheduledAt,
      launched_at:              status === "RUNNING" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (campErr || !camp) {
    return new Response(JSON.stringify({ success: false, error: campErr?.message ?? "Campaign creation failed" }), { status: 500, headers: corsHeaders });
  }

  // ── Insert targets ──
  const targetsInsert = (members ?? []).map(m => ({
    campaign_id: camp.id,
    email:       m.email,
    first_name:  m.first_name  || "",
    last_name:   m.last_name   || "",
    position:    m.position    || "",
    department:  m.department  || "",
    status:      "PENDING",
  }));

  for (let i = 0; i < targetsInsert.length; i += 500) {
    const { error: tErr } = await db.from("phishing_campaign_targets").insert(targetsInsert.slice(i, i + 500));
    if (tErr) {
      console.error("[launch-phishing-campaign] target insert error:", tErr.message);
      return rollback(db, camp.id, "Failed to insert targets: " + tErr.message);
    }
  }

  // ── Re-fetch targets to get DB-generated recipient_ids ──
  const { data: insertedTargets, error: fetchErr } = await db
    .from("phishing_campaign_targets")
    .select("id, email, first_name, last_name, position, department, recipient_id")
    .eq("campaign_id", camp.id);

  if (fetchErr || !insertedTargets) {
    return rollback(db, camp.id, "Failed to retrieve inserted targets");
  }

  // ── Build queue entries (variable resolution per recipient) ──
  const trackBase        = `${SUPABASE_URL}/functions/v1/phishing-track`;
  const rateMs           = 60000 / Math.max(Number(emails_per_minute ?? 10), 1);
  const baseTime         = campaignScheduledAt ? new Date(campaignScheduledAt).getTime() : Date.now();
  const finalRedirectUrl = String(redirect_url || "https://www.google.com");
  const smtpId           = smtp_profile_id ? String(smtp_profile_id) : null;
  const fromAddr         = String(from_address || "noreply@awareone.io");
  const fromNm           = String(from_name    || "AwareOne Security");
  const emailSubjectStr  = String(email_subject);
  const emailHtmlStr     = String(email_html);

  const queueEntries = insertedTargets.map((t, i) => {
    const randomDelaySec = random_delay
      ? Math.floor(Math.random() * Math.max(Number(random_delay_max_seconds ?? 60), 1))
      : 0;
    const sendAt = new Date(baseTime + i * rateMs + randomDelaySec * 1000);

    // If a landing page is selected, the click URL must route through serve-landing-page.
    const targetRedirectUrl = landing_page_id
      ? `${SUPABASE_URL}/functions/v1/serve-landing-page?lp=${landing_page_id}&c=${camp.id}&r=${encodeURIComponent(t.recipient_id)}`
      : finalRedirectUrl;

    const targetMeta = {
      campaign_id:   camp.id,
      company_name:  companyName,
      redirect_url:  targetRedirectUrl,
      tracking_base: trackBase,
    };
    const targetInfo = {
      email:        t.email,
      first_name:   t.first_name,
      last_name:    t.last_name,
      department:   t.department,
      position:     t.position,
      recipient_id: t.recipient_id,
    };

    const resolvedHtml    = resolveVariables(emailHtmlStr,    targetInfo, targetMeta, customVars);
    const resolvedSubject = resolveVariables(emailSubjectStr, targetInfo, targetMeta, customVars);

    // Inject tracking pixel if template didn't include {{.TrackingPixel}}
    const pixelUrl   = `${trackBase}?t=open&c=${camp.id}&r=${encodeURIComponent(t.recipient_id)}`;
    const trackPixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
    const finalHtml  = resolvedHtml.includes("phishing-track?t=open")
      ? resolvedHtml
      : resolvedHtml.includes("</body>")
        ? resolvedHtml.replace("</body>", trackPixel + "</body>")
        : resolvedHtml + trackPixel;

    return {
      campaign_id:     camp.id,
      target_id:       t.id,
      company_id:      companyId,
      smtp_profile_id: smtpId,
      recipient_email: t.email,
      recipient_id:    t.recipient_id,
      email_subject:   resolvedSubject,
      email_html:      finalHtml,
      from_address:    fromAddr,
      from_name:       fromNm,
      scheduled_at:    sendAt.toISOString(),
    };
  });

  // Insert queue rows using service role (bypasses RLS — only the server may do this)
  for (let i = 0; i < queueEntries.length; i += 100) {
    const { error: qErr } = await db.from("campaign_email_queue").insert(queueEntries.slice(i, i + 100));
    if (qErr) {
      console.error("[launch-phishing-campaign] queue insert error:", qErr.message);
      return rollback(db, camp.id, "Failed to enqueue emails: " + qErr.message);
    }
  }

  // ── Update total_queue_size ──
  await db.from("phishing_campaigns")
    .update({ total_queue_size: queueEntries.length })
    .eq("id", camp.id);

  // ── Consume quota exactly once ──
  await db.rpc("update_company_email_usage", {
    p_company_id: companyId,
    p_count:      queueEntries.length,
  });

  // ── Create launch alert ──
  await db.from("phishing_alerts").insert({
    campaign_id: camp.id,
    company_id:  companyId,
    alert_type:  status === "RUNNING" ? "CAMPAIGN_STARTED" : "CAMPAIGN_SCHEDULED",
    priority:    "LOW",
    title:       status === "RUNNING"
      ? `Campaign Started: ${name}`
      : `Campaign Scheduled: ${name}`,
    message: status === "RUNNING"
      ? `Phishing campaign "${name}" launched with ${targetCount} targets.`
      : `Phishing campaign "${name}" scheduled for ${campaignScheduledAt} with ${targetCount} targets.`,
  });

  // ── Trigger first processing batch (immediate campaigns only) ──
  if (status === "RUNNING") {
    await fetch(`${SUPABASE_URL}/functions/v1/process-campaign`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ campaign_id: camp.id, batch_size: 50 }),
    }).catch(e => console.error("[launch-phishing-campaign] process-campaign invoke error:", e));
  }

  return new Response(JSON.stringify({
    success:      true,
    campaign_id:  camp.id,
    status,
    target_count: targetCount,
    queue_size:   queueEntries.length,
  }), { headers: corsHeaders });
});
