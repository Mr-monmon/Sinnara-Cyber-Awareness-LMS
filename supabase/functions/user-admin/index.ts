import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

async function getCallerProfile(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("id, role, company_id")
    .eq("id", user.id)
    .single();

  return profile;
}

function isAdmin(role: string) {
  return role === "PLATFORM_ADMIN" || role === "COMPANY_ADMIN";
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

interface CreateUserPayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  employee_id?: string;
  role: string;
  company_id?: string;
  department?: string;
  department_id?: string;
}

async function handleCreateUser(payload: CreateUserPayload) {
  const {
    email,
    password,
    full_name,
    phone,
    employee_id,
    role,
    company_id,
    department,
    department_id,
  } = payload;

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError) return { success: false, error: authError.message };

  const userId = authData.user.id;

  const { error: profileError } = await supabaseAdmin.from("users").insert({
    id: userId,
    email,
    full_name,
    phone: phone ?? null,
    employee_id: employee_id ?? null,
    role,
    company_id: company_id ?? null,
    department: department ?? null,
    department_id: department_id ?? null,
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return { success: false, error: profileError.message };
  }

  return { success: true, user_id: userId };
}

async function handleBulkCreate(users: CreateUserPayload[]) {
  const results: {
    email: string;
    success: boolean;
    user_id?: string;
    error?: string;
  }[] = [];

  for (const u of users) {
    const r = await handleCreateUser(u);
    results.push({ email: u.email, ...r });
  }

  return {
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

async function handleResetPassword(userId: string, password: string) {
  const { error: authError } =
    await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (authError) return { success: false, error: authError.message };

  return { success: true };
}

async function handleDeleteUser(userId: string) {
  const { error: authError } =
    await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authError) return { success: false, error: authError.message };

  const { error: profileError } = await supabaseAdmin
    .from("users")
    .delete()
    .eq("id", userId);

  if (profileError) return { success: false, error: profileError.message };

  return { success: true };
}

// ---------------------------------------------------------------------------
// Backfill — migrates every existing public.users row into auth.users
// ---------------------------------------------------------------------------

async function handleBackfill() {
  const { data: users, error: fetchError } = await supabaseAdmin
    .from("users")
    .select("id, email, password");

  if (fetchError) return { success: false, error: fetchError.message };

  const results: {
    id: string;
    email: string;
    success: boolean;
    error?: string;
  }[] = [];

  for (const u of users ?? []) {
    const { error } = await supabaseAdmin.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password: u.password,
      email_confirm: true,
    });

    results.push(
      error
        ? { id: u.id, email: u.email, success: false, error: error.message }
        : { id: u.id, email: u.email, success: true },
    );
  }

  return {
    total: (users ?? []).length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const { action } = body;

    // Backfill supports a shared-secret bypass so it can run before any
    // auth users exist. Set BACKFILL_SECRET in your Edge Function secrets
    // and remove it after the migration is complete.
    if (action === "backfill") {
      const backfillSecret = Deno.env.get("BACKFILL_SECRET");
      if (backfillSecret && body.secret === backfillSecret) {
        return json(await handleBackfill());
      }
      const caller = await getCallerProfile(req);
      if (!caller || caller.role !== "PLATFORM_ADMIN") {
        return json({ error: "Forbidden: PLATFORM_ADMIN or valid secret required" }, 403);
      }
      return json(await handleBackfill());
    }

    const caller = await getCallerProfile(req);
    if (!caller) return json({ error: "Unauthorized" }, 401);

    switch (action) {
      case "createUser": {
        if (!isAdmin(caller.role)) return json({ error: "Forbidden" }, 403);
        const r = await handleCreateUser(body);
        return json(r, r.success ? 200 : 400);
      }

      case "bulkCreate": {
        if (!isAdmin(caller.role)) return json({ error: "Forbidden" }, 403);
        return json(await handleBulkCreate(body.users));
      }

      case "resetPassword": {
        if (!isAdmin(caller.role)) return json({ error: "Forbidden" }, 403);
        const r = await handleResetPassword(body.userId, body.password);
        return json(r, r.success ? 200 : 400);
      }

      case "deleteUser": {
        if (!isAdmin(caller.role)) return json({ error: "Forbidden" }, 403);
        const r = await handleDeleteUser(body.userId);
        return json(r, r.success ? 200 : 400);
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      500,
    );
  }
});
