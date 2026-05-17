import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ZEPTO_TOKEN  = Deno.env.get("ZEPTOMAIL_TOKEN") ?? "";

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

/* ── Decrypt password if stored encrypted ── */
async function decryptPassword(encrypted: string): Promise<string> {
  const keyStr = Deno.env.get("SMTP_ENCRYPTION_KEY");
  if (!keyStr) return encrypted; // no key = stored plaintext

  try {
    // Key is base64url-encoded 32 bytes
    const keyBytes = Uint8Array.from(atob(keyStr.replace(/-/g,"+").replace(/_/g,"/")), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);

    // Encrypted format: base64url(iv[12] + ciphertext)
    const combined = Uint8Array.from(atob(encrypted.replace(/-/g,"+").replace(/_/g,"/")), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);
    return new TextDecoder().decode(decrypted);
  } catch {
    return encrypted; // decryption failed, return as-is
  }
}

/* ── Send via custom SMTP using nodemailer ── */
async function sendViaSmtp(params: {
  to: string; subject: string; html: string;
  from_address: string; from_name: string;
  profile: SmtpProfile;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // deno-lint-ignore no-explicit-any
    const nodemailer = await import("npm:nodemailer@6") as any;
    const password = params.profile.password_encrypted
      ? await decryptPassword(params.profile.password)
      : params.profile.password;

    const transport = nodemailer.createTransport({
      host: params.profile.host,
      port: params.profile.port,
      secure: params.profile.use_tls && params.profile.port === 465,
      requireTLS: params.profile.use_starttls,
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
      from: `"${params.from_name}" <${params.from_address}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      headers: extraHeaders,
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "SMTP error" };
  }
}

/* ── Send via ZeptoMail ── */
async function sendViaZepto(params: {
  to: string; subject: string; html: string;
  from_address: string; from_name: string;
}): Promise<{ success: boolean; error?: string }> {
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
      return { success: false, error: err };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "ZeptoMail error" };
  }
}

/* ── Master send function ── */
async function sendEmail(params: {
  to: string; subject: string; html: string;
  from_address: string; from_name: string;
  smtp_profile_id?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  // Fetch SMTP profile if specified
  if (params.smtp_profile_id) {
    const { data: profile } = await supabase
      .from("smtp_profiles")
      .select("*")
      .eq("id", params.smtp_profile_id)
      .eq("is_active", true)
      .single();

    if (profile) {
      return sendViaSmtp({
        to: params.to,
        subject: params.subject,
        html: params.html,
        from_address: params.from_address || profile.from_address,
        from_name: params.from_name || profile.from_name,
        profile: profile as SmtpProfile,
      });
    }
  }

  // Fall back to ZeptoMail
  return sendViaZepto(params);
}

/* ── Main handler ── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
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

      // Skip if campaign is not running
      if (campaign?.status !== "RUNNING") {
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

      // Inject open-tracking pixel (idempotent: only if not already present)
      const trackBase   = `${SUPABASE_URL}/functions/v1/phishing-track`;
      const pixelUrl    = `${trackBase}?t=open&c=${job.campaign_id}&r=${job.recipient_id}`;
      const trackPixel  = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
      const finalHtml   = job.email_html.includes("phishing-track?t=open")
        ? job.email_html // already has pixel
        : job.email_html.includes("</body>")
          ? job.email_html.replace("</body>", trackPixel + "</body>")
          : job.email_html + trackPixel;

      // Send
      const result = await sendEmail({
        to:               job.recipient_email,
        subject:          job.email_subject,
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

        await supabase.from("phishing_campaigns")
          .update({ status: "COMPLETED", completion_date: new Date().toISOString() })
          .eq("id", campId);

        await supabase.from("phishing_alerts").insert({
          campaign_id: campId,
          company_id:  companyId,
          alert_type:  "CAMPAIGN_COMPLETE",
          priority:    "LOW",
          title:       "Campaign Completed",
          message:     `Campaign has finished sending. Check results in the dashboard.`,
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
    const msg = err instanceof Error ? err.message : "Worker error";
    console.error("[process-campaign]", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
