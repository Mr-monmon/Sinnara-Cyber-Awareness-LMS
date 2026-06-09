/**
 * process-scheduled-campaigns — activates due SCHEDULED campaigns
 *
 * Invoked by pg_cron every minute. Finds campaigns whose status = 'SCHEDULED'
 * and scheduled_at <= now(), flips them to RUNNING, then invokes process-campaign
 * so the first batch of PENDING queue rows is processed immediately.
 *
 * Queue rows were already created by launch-phishing-campaign at launch time
 * (with status PENDING and appropriate scheduled_at values). They will begin
 * appearing as due the moment the campaign transitions to RUNNING.
 *
 * Only accepts requests with the service-role key as the bearer token.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isServiceRoleRequest } from "../_shared/auth.ts";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!isServiceRoleRequest(req, serviceRoleKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const { data: dueCampaigns, error: fetchErr } = await db
      .from("phishing_campaigns")
      .select("id, name")
      .eq("status", "SCHEDULED")
      .lte("scheduled_at", new Date().toISOString());

    if (fetchErr) throw fetchErr;
    if (!dueCampaigns || dueCampaigns.length === 0) {
      return new Response(JSON.stringify({ activated: 0 }), { headers: corsHeaders });
    }

    let activated = 0;
    for (const campaign of dueCampaigns) {
      const { error: updateErr } = await db
        .from("phishing_campaigns")
        .update({ status: "RUNNING", launched_at: new Date().toISOString() })
        .eq("id", campaign.id)
        .eq("status", "SCHEDULED"); // optimistic guard against concurrent workers

      if (updateErr) {
        console.error(`[process-scheduled-campaigns] failed to activate ${campaign.id}:`, updateErr.message);
        continue;
      }
      activated++;
    }

    // Trigger process-campaign so the first batch drains immediately.
    // process-campaign will also fire via its own pg_cron on the next minute tick,
    // but this avoids a full-minute delay for the first batch.
    if (activated > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      await fetch(`${supabaseUrl}/functions/v1/process-campaign`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ batch_size: 200 }),
      }).catch(e => console.error("[process-scheduled-campaigns] process-campaign invoke error:", e));
    }

    return new Response(JSON.stringify({ activated }), { headers: corsHeaders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Worker error";
    console.error("[process-scheduled-campaigns]", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
