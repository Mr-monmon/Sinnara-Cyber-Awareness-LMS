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
  to: string;
  subject: string;
  html: string;
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

  try {
    const { to, subject, html }: reqPayload = await req.json();

    const res = await fetch("https://api.zeptomail.com/v1.1/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Zoho-enczapikey ${Deno.env.get("ZEPTOMAIL_TOKEN")}`,
      },
      body: JSON.stringify({
        from: {
          address: "support@awareone.net",
          name: "Awareone",
        },
        to: [
          {
            email_address: {
              address: to,
              name: "User",
            },
          },
        ],
        subject,
        htmlbody: html,
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: res.ok ? 200 : res.status,
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to send email",
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});
