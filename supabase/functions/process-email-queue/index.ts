import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL             = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY        = Deno.env.get("SUPABASE_ANON_KEY")!;
const ZEPTO_TOKEN              = Deno.env.get("ZEPTOMAIL_TOKEN") ?? "";

const BATCH_SIZE = 20;

// Retry delay in milliseconds per attempt number (1-indexed: attempt 1, 2, 3)
const RETRY_DELAYS_MS: Record<number, number> = {
  1: 1  * 60 * 1000,   // 1 minute
  2: 5  * 60 * 1000,   // 5 minutes
  3: 30 * 60 * 1000,   // 30 minutes
};

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Service client — bypasses RLS, used for all queue operations
const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface EmailQueueRow {
  id:           string;
  to_email:     string;
  subject:      string;
  html:         string;
  status:       string;
  attempts:     number;
  max_attempts: number;
  scheduled_at: string;
}

/* ── ZeptoMail send ── */
async function sendViaZepto(
  to: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.zeptomail.com/v1.1/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Zoho-enczapikey ${ZEPTO_TOKEN}`,
      },
      body: JSON.stringify({
        from: { address: "support@awareone.net", name: "Awareone" },
        to: [{ email_address: { address: to, name: to } }],
        subject,
        htmlbody: html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `ZeptoMail ${res.status}: ${body}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "ZeptoMail fetch error" };
  }
}

/* ── Auth helper ── */
async function authorize(authHeader: string): Promise<{ allowed: boolean; reason?: string }> {
  // Cron path: service role key passed directly as bearer token
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    return { allowed: true };
  }

  // Dashboard / manual trigger path: validate JWT then check PLATFORM_ADMIN role
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) {
    return { allowed: false, reason: "Invalid or expired token" };
  }

  const { data: caller, error: roleErr } = await serviceClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (roleErr || !caller) {
    return { allowed: false, reason: "User record not found" };
  }
  if (caller.role !== "PLATFORM_ADMIN") {
    return { allowed: false, reason: "Forbidden: PLATFORM_ADMIN role required" };
  }

  return { allowed: true };
}

/* ── Main handler ── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  const auth = await authorize(authHeader);
  if (!auth.allowed) {
    return new Response(
      JSON.stringify({ error: auth.reason ?? "Unauthorized" }),
      { status: 401, headers: corsHeaders },
    );
  }

  try {
    // Fetch batch of processable emails
    const { data: rows, error: fetchErr } = await serviceClient
      .from("email_queue")
      .select("id, to_email, subject, html, status, attempts, max_attempts, scheduled_at")
      .in("status", ["pending", "retrying"])
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) throw fetchErr;

    const emails = (rows ?? []) as EmailQueueRow[];

    let processed = 0;
    let sent      = 0;
    let failed    = 0;
    let retrying  = 0;

    for (const email of emails) {
      // Atomically claim: only proceed if the row is still pending/retrying
      const { count: claimed, error: claimErr } = await serviceClient
        .from("email_queue")
        .update({ status: "sending", updated_at: new Date().toISOString() }, { count: "exact" })
        .eq("id", email.id)
        .in("status", ["pending", "retrying"]);

      if (claimErr || claimed === 0) {
        // Another worker claimed it first — skip
        continue;
      }

      processed++;
      const newAttempts = email.attempts + 1;

      const result = await sendViaZepto(email.to_email, email.subject, email.html);

      if (result.success) {
        await serviceClient
          .from("email_queue")
          .update({
            status:     "sent",
            sent_at:    new Date().toISOString(),
            attempts:   newAttempts,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", email.id);
        sent++;
      } else {
        const errorMsg = result.error ?? "Unknown send error";

        if (newAttempts >= email.max_attempts) {
          // Exhausted retries — mark as permanently failed
          await serviceClient
            .from("email_queue")
            .update({
              status:     "failed",
              attempts:   newAttempts,
              last_error: errorMsg,
              updated_at: new Date().toISOString(),
            })
            .eq("id", email.id);
          failed++;
        } else {
          // Schedule a retry with progressive delay
          const delayMs     = RETRY_DELAYS_MS[newAttempts] ?? 30 * 60 * 1000;
          const nextAttempt = new Date(Date.now() + delayMs).toISOString();

          await serviceClient
            .from("email_queue")
            .update({
              status:       "retrying",
              attempts:     newAttempts,
              scheduled_at: nextAttempt,
              last_error:   errorMsg,
              updated_at:   new Date().toISOString(),
            })
            .eq("id", email.id);
          retrying++;
        }
      }
    }

    return new Response(
      JSON.stringify({ processed, sent, failed, retrying }),
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Worker error";
    console.error("[process-email-queue]", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: corsHeaders },
    );
  }
});
