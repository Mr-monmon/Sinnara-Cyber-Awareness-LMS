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
  return role === "PLATFORM_ADMIN" || role === "COMPANY_ADMIN" || role === "COMPANY_SUPER_ADMIN";
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
  job_title?: string;
  role: string;
  company_id?: string;
  department?: string;
  department_id?: string;
  mfa_enforced?: boolean;
  requires_password_change?: boolean;
}

async function handleCreateUser(payload: CreateUserPayload) {
  const {
    email,
    password,
    full_name,
    phone,
    employee_id,
    job_title,
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
    job_title: job_title ?? null,
    role,
    company_id: company_id ?? null,
    department: department ?? null,
    department_id: department_id ?? null,
    requires_password_change: payload.requires_password_change !== false, // default true for new users
    mfa_enforced: payload.mfa_enforced ?? false,
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
        if (!isAdmin(caller.role)) return json({ success: false, error: "Forbidden" });
        const r = await handleCreateUser(body);
        return json(r);
      }

      case "bulkCreate": {
        if (!isAdmin(caller.role)) return json({ success: false, error: "Forbidden" });
        return json(await handleBulkCreate(body.users));
      }

      case "resetPassword": {
        if (!isAdmin(caller.role)) return json({ success: false, error: "Forbidden" });
        const r = await handleResetPassword(body.userId, body.password);
        return json(r);
      }

      case "deleteUser": {
        if (!isAdmin(caller.role)) return json({ success: false, error: "Forbidden" });
        if (body.userId !== caller.id) {
          const { data: targetProfile } = await supabaseAdmin
            .from("users").select("role").eq("id", body.userId).single();
          if (targetProfile?.role === "COMPANY_SUPER_ADMIN") {
            return json({ success: false, error: "Cannot delete the company super admin" });
          }
        }
        const r = await handleDeleteUser(body.userId);
        return json(r);
      }

      // Reset MFA: unenroll all TOTP factors for the target user
      case "resetMfa": {
        if (!isAdmin(caller.role)) return json({ success: false, error: "Forbidden" });
        const targetId: string = body.userId;

        // Use getUserById to fetch factors — available in all supabase-js v2 versions
        const { data: userData, error: getUserErr } =
          await supabaseAdmin.auth.admin.getUserById(targetId);
        if (getUserErr) return json({ success: false, error: getUserErr.message });

        const factors: { id: string }[] = userData?.user?.factors ?? [];
        let deleted = 0;
        for (const f of factors) {
          const { error: delErr } =
            await supabaseAdmin.auth.admin.mfa.deleteFactor({ userId: targetId, id: f.id });
          if (!delErr) deleted++;
        }

        const { error: updErr } = await supabaseAdmin.from("users")
          .update({ mfa_enforced: false })
          .eq("id", targetId);
        if (updErr) return json({ success: false, error: updErr.message });
        return json({ success: true, factors_removed: deleted });
      }

      // Set/unset forced MFA for a user
      case "setMfaEnforced": {
        if (!isAdmin(caller.role)) return json({ success: false, error: "Forbidden" });
        const { userId: targetId, enforced } = body;
        const { error: updErr } = await supabaseAdmin.from("users")
          .update({ mfa_enforced: !!enforced })
          .eq("id", targetId);
        if (updErr) return json({ success: false, error: updErr.message });
        return json({ success: true });
      }

      // Force a specific user to change password on next login
      case "forcePasswordChange": {
        if (!isAdmin(caller.role)) return json({ success: false, error: "Forbidden" });
        const { error: updErr } = await supabaseAdmin.from("users")
          .update({ requires_password_change: true })
          .eq("id", body.userId);
        if (updErr) return json({ success: false, error: updErr.message });
        return json({ success: true });
      }

      // Change a user's role. Only PLATFORM_ADMIN or COMPANY_SUPER_ADMIN can do this.
      case "updateUserRole": {
        const allowedRoles = [
          "PLATFORM_ADMIN",
          "COMPANY_SUPER_ADMIN",
          "COMPANY_ADMIN",
          "PHISHING_OPERATOR",
          "REVIEWER",
          "EMPLOYEE",
        ];
        if (caller.role !== "PLATFORM_ADMIN" && caller.role !== "COMPANY_SUPER_ADMIN") {
          return json({ success: false, error: "Forbidden" });
        }
        const newRole: string = body.newRole;
        if (!allowedRoles.includes(newRole)) {
          return json({ success: false, error: `Invalid role: ${newRole}` });
        }
        const { data: targetProfile } = await supabaseAdmin
          .from("users").select("role").eq("id", body.userId).single();
        if (targetProfile?.role === "COMPANY_SUPER_ADMIN" && body.userId !== caller.id) {
          return json({ success: false, error: "Cannot change role of a company super admin" });
        }
        const { error: updErr } = await supabaseAdmin.from("users")
          .update({ role: newRole })
          .eq("id", body.userId);
        if (updErr) return json({ success: false, error: updErr.message });
        return json({ success: true });
      }

      default:
        return json({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
    );
  }
});
