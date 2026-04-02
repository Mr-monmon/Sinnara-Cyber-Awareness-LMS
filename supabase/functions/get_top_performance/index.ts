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

  const { company_id }: reqPayload = await req.json();

  const { data: employees } = await supabase
    .from("users")
    .select("id, full_name, email")
    .eq("company_id", company_id)
    .eq("role", "EMPLOYEE");

  const employeeIds = employees?.map((e) => e.id) || [];

  if (employeeIds.length === 0) {
    return new Response(
      JSON.stringify({
        avgScore: 0,
        rankedEmployees: [],
      }),
      {
        headers: corsHeaders,
      }
    );
  }

  const { data: resultsRes } = await supabase
    .from("exam_results")
    .select("employee_id, percentage, passed")
    .in("employee_id", employeeIds);

  const avgScore =
    resultsRes && resultsRes.length > 0
      ? Math.round(
          resultsRes.reduce((sum, r) => sum + r.percentage, 0) /
            resultsRes.length
        )
      : 0;

  let rankedEmployees: {
    id: string;
    name: string;
    email: string;
    averageScore: number;
    examsTaken: number;
  }[] = [];

  if (resultsRes && employees) {
    const employeeDirectory = new Map(
      employees.map((employee) => [
        employee.id,
        {
          name: employee.full_name || "Employee",
          email: employee.email || "",
        },
      ])
    );

    const scoreMap = new Map<string, { total: number; count: number }>();
    resultsRes.forEach((result) => {
      const current = scoreMap.get(result.employee_id) || {
        total: 0,
        count: 0,
      };
      scoreMap.set(result.employee_id, {
        total: current.total + result.percentage,
        count: current.count + 1,
      });
    });

    rankedEmployees = employees
      .map((employee) => {
        const score = scoreMap.get(employee.id);
        const averageScore =
          score && score.count > 0 ? Math.round(score.total / score.count) : 0;
        return {
          id: employee.id,
          name: employee.full_name || "Employee",
          email: employee.email || "",
          averageScore,
          examsTaken: score?.count || 0,
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore);
  }

  return new Response(
    JSON.stringify({
      avgScore,
      rankedEmployees,
    }),
    {
      headers: corsHeaders,
    }
  );
});
