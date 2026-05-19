import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface reqPayload {
  company_id: string;
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

  const { company_id }: reqPayload = await req.json();

  // Verify caller belongs to this company (or is platform admin) — all roles allowed
  const { data: caller } = await supabase
    .from("users").select("role, company_id").eq("id", user.id).single();
  if (!caller) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }
  if (caller.role !== "PLATFORM_ADMIN" && caller.company_id !== company_id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }
  // Note: all authenticated roles (including EMPLOYEE) can view their company's leaderboard

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
