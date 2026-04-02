// supabase/functions/create-user/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Read from environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface reqPayload {
  company_id: string;
  employee_id: string;
}

export const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const { company_id, employee_id }: reqPayload = await req.json();

  const { data: userRanksData } = await supabase.invoke("get_top_performance", {
    method: "POST",
    body: { company_id, employee_id },
  });

  const { rankedEmployees } = userRanksData;

  const userRank = rankedEmployees.find(
    (employee) => employee.id === employee_id
  );

  return new Response(
    JSON.stringify({
      userRank,
    }),
    {
      headers: corsHeaders,
    }
  );
});
