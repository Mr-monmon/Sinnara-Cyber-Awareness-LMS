import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface reqPayload {
  company_id: string;
  employee_id: string;
}

export const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Verify caller identity
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const { company_id, employee_id }: reqPayload = await req.json();

  // Forward caller's auth header so get_top_performance can validate it too
  const topPerfRes = await fetch(`${SUPABASE_URL}/functions/v1/get_top_performance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ company_id }),
  });

  if (!topPerfRes.ok) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: topPerfRes.status, headers: corsHeaders });
  }

  const userRanksData = await topPerfRes.json();
  const { rankedEmployees } = userRanksData;
  const userRank = rankedEmployees?.find((e: { id: string }) => e.id === employee_id);

  return new Response(JSON.stringify({ userRank }), { headers: corsHeaders });
});
