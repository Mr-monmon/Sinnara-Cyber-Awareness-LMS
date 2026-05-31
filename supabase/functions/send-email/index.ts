import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL             = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY        = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  // HIGH-01: only privileged roles may trigger transactional emails.
  // EMPLOYEE / REVIEWER (and any unknown role) must be rejected so the
  // email-sending capability cannot be abused for spam or spoofed notifications.
  const ALLOWED_EMAIL_ROLES = [
    "PLATFORM_ADMIN",
    "COMPANY_ADMIN",
    "COMPANY_SUPER_ADMIN",
    "PHISHING_OPERATOR",
  ];

  const { data: profile, error: profileErr } = await serviceClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile || !ALLOWED_EMAIL_ROLES.includes(profile.role)) {
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: corsHeaders },
    );
  }

  try {
    const { to, subject, html }: { to: string; subject: string; html: string } = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "to, subject, and html are required" }),
        { status: 400, headers: corsHeaders },
      );
    }

    const { data, error: insertErr } = await serviceClient
      .from("email_queue")
      .insert({ to_email: to, subject, html, created_by: user.id })
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({ queued: true, id: data!.id }),
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to queue email" }),
      { status: 500, headers: corsHeaders },
    );
  }
});
