import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isBusinessHour(hour: number, start: number, end: number): boolean {
  return hour >= start && hour < end;
}

function getHourInTimezone(tz: string): number {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false });
    return parseInt(formatter.format(now));
  } catch {
    return new Date().getUTCHours();
  }
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from_address: string;
  from_name: string;
  smtp_profile_id?: string;
}): Promise<{ success: boolean; error?: string }> {
  const zeptoToken = Deno.env.get("ZEPTOMAIL_TOKEN");

  try {
    const res = await fetch("https://api.zeptomail.com/v1.1/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Zoho-enczapikey ${zeptoToken}`,
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
    return { success: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const campaign_id = body.campaign_id as string | undefined;

    let query = supabase
      .from("campaign_email_queue")
      .select("*, phishing_campaigns(emails_per_minute, business_hours_only, business_hours_start, business_hours_end, timezone, status)")
      .eq("status", "PENDING")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (campaign_id) query = query.eq("campaign_id", campaign_id);

    const { data: jobs, error } = await query;
    if (error) throw error;
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No pending jobs" }), { headers: corsHeaders });
    }

    let sent = 0, failed = 0, skipped = 0;

    for (const job of jobs) {
      const campaign = job.phishing_campaigns as Record<string, unknown>;

      if (campaign?.status !== "RUNNING") {
        await supabase.from("campaign_email_queue")
          .update({ status: "SKIPPED" })
          .eq("id", job.id);
        skipped++;
        continue;
      }

      if (campaign.business_hours_only) {
        const tz = (campaign.timezone as string) || "UTC";
        const currentHour = getHourInTimezone(tz);
        const start = (campaign.business_hours_start as number) || 9;
        const end = (campaign.business_hours_end as number) || 17;
        if (!isBusinessHour(currentHour, start, end)) {
          const tomorrow = new Date();
          tomorrow.setHours(start, 0, 0, 0);
          if (currentHour >= end) tomorrow.setDate(tomorrow.getDate() + 1);
          await supabase.from("campaign_email_queue")
            .update({ scheduled_at: tomorrow.toISOString() })
            .eq("id", job.id);
          skipped++;
          continue;
        }
      }

      await supabase.from("campaign_email_queue")
        .update({ status: "SENDING" })
        .eq("id", job.id);

      const trackBase = `${SUPABASE_URL}/functions/v1/phishing-track`;
      const pixelUrl = `${trackBase}?t=open&c=${job.campaign_id}&r=${job.recipient_id}`;
      const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
      const htmlWithTracking = job.email_html.includes("</body>")
        ? job.email_html.replace("</body>", `${trackingPixel}</body>`)
        : job.email_html + trackingPixel;

      const result = await sendEmail({
        to: job.recipient_email,
        subject: job.email_subject,
        html: htmlWithTracking,
        from_address: job.from_address,
        from_name: job.from_name,
        smtp_profile_id: job.smtp_profile_id,
      });

      if (result.success) {
        await supabase.from("campaign_email_queue")
          .update({ status: "SENT", sent_at: new Date().toISOString() })
          .eq("id", job.id);

        await supabase.from("phishing_events").insert({
          campaign_id: job.campaign_id,
          target_id: job.target_id,
          company_id: job.company_id,
          event_type: "EMAIL_SENT",
          recipient_id: job.recipient_id,
          email: job.recipient_email,
        });

        await supabase.from("phishing_campaign_targets")
          .update({ status: "SENT", sent_at: new Date().toISOString() })
          .eq("id", job.target_id);

        sent++;
      } else {
        const retryCount = (job.retry_count || 0) + 1;
        await supabase.from("campaign_email_queue")
          .update({
            status: retryCount >= 3 ? "FAILED" : "PENDING",
            retry_count: retryCount,
            failed_at: new Date().toISOString(),
            failure_reason: result.error,
            scheduled_at: retryCount < 3 ? new Date(Date.now() + retryCount * 60000).toISOString() : undefined,
          })
          .eq("id", job.id);

        if (retryCount >= 3) {
          await supabase.from("phishing_events").insert({
            campaign_id: job.campaign_id,
            target_id: job.target_id,
            company_id: job.company_id,
            event_type: "EMAIL_FAILED",
            recipient_id: job.recipient_id,
            email: job.recipient_email,
            metadata: { error: result.error },
          });
        }
        failed++;
      }

      const { count: pending } = await supabase
        .from("campaign_email_queue")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", job.campaign_id)
        .in("status", ["PENDING", "SENDING"]);

      if (pending === 0) {
        await supabase.from("phishing_campaigns")
          .update({ status: "COMPLETED", completion_date: new Date().toISOString() })
          .eq("id", job.campaign_id);
        await supabase.from("phishing_alerts").insert({
          campaign_id: job.campaign_id,
          company_id: job.company_id,
          alert_type: "CAMPAIGN_COMPLETE",
          priority: "LOW",
          title: "Campaign Completed",
          message: `All emails have been processed for campaign ${job.campaign_id}`,
        });
      }

      await new Promise(r => setTimeout(r, 100));
    }

    return new Response(JSON.stringify({ processed: jobs.length, sent, failed, skipped }), { headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Worker error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
