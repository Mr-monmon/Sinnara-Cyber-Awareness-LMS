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

async function getCallerProfile(req: Request): Promise<CallerProfile | null> {
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

  return profile as CallerProfile | null;
}

function isAdmin(role: string) {
  return role === "PLATFORM_ADMIN" || role === "COMPANY_ADMIN" || role === "COMPANY_SUPER_ADMIN";
}

interface CallerProfile {
  id: string;
  role: string;
  company_id: string | null;
}

// Record a blocked cross-tenant attempt for security monitoring. Fire-and-forget
// (uses the service role client so it bypasses RLS); never throws into the caller path.
async function logBlockedAttempt(
  caller: CallerProfile,
  action: string,
  targetUserId: string | null,
  detail: string,
) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: caller.id,
      user_role: caller.role,
      action_type: "SECURITY_BLOCKED",
      entity_type: "USER",
      entity_id: targetUserId,
      company_id: caller.company_id,
      description: `Blocked ${action}: ${detail}`,
    });
  } catch {
    // Audit logging must never break the request flow.
  }
}

// Verify the caller is allowed to operate on a target user.
// PLATFORM_ADMIN may act on anyone. Other admins may only act on users
// within their own company. Returns true when allowed; otherwise records
// a SECURITY_BLOCKED audit entry and returns false.
async function assertSameTenant(
  caller: CallerProfile,
  targetUserId: string,
  action: string,
): Promise<boolean> {
  if (caller.role === "PLATFORM_ADMIN") return true;

  const { data: target } = await supabaseAdmin
    .from("users")
    .select("company_id")
    .eq("id", targetUserId)
    .single();

  if (!target) {
    await logBlockedAttempt(caller, action, targetUserId, "target user not found");
    return false;
  }
  if (target.company_id !== caller.company_id) {
    await logBlockedAttempt(
      caller,
      action,
      targetUserId,
      `cross-tenant: target company ${target.company_id} != caller company ${caller.company_id}`,
    );
    return false;
  }
  return true;
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

  // Force the user to change this temporary password on next login
  const { error: profileError } = await supabaseAdmin.from("users")
    .update({ requires_password_change: true })
    .eq("id", userId);
  if (profileError) return { success: false, error: profileError.message };

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
        // Non-platform admins may only create users inside their own company.
        if (caller.role !== "PLATFORM_ADMIN" && body.company_id !== caller.company_id) {
          await logBlockedAttempt(caller, "createUser", null, `target company ${body.company_id} != caller company ${caller.company_id}`);
          return json({ success: false, error: "Forbidden: cross-tenant operation" }, 403);
        }
        // Role escalation guard: non-platform admins cannot create PLATFORM_ADMIN users;
        // COMPANY_ADMIN cannot create COMPANY_SUPER_ADMIN users.
        if (caller.role !== "PLATFORM_ADMIN" && body.role === "PLATFORM_ADMIN") {
          await logBlockedAttempt(caller, "createUser", null, `role escalation: attempted to create PLATFORM_ADMIN`);
          return json({ success: false, error: "Forbidden: cannot assign PLATFORM_ADMIN role" }, 403);
        }
        if (caller.role === "COMPANY_ADMIN" && body.role === "COMPANY_SUPER_ADMIN") {
          await logBlockedAttempt(caller, "createUser", null, `role escalation: COMPANY_ADMIN attempted to create COMPANY_SUPER_ADMIN`);
          return json({ success: false, error: "Forbidden: cannot assign COMPANY_SUPER_ADMIN role" }, 403);
        }
        const r = await handleCreateUser(body);
        return json(r);
      }

      case "bulkCreate": {
        if (!isAdmin(caller.role)) return json({ success: false, error: "Forbidden" });
        const users: CreateUserPayload[] = body.users ?? [];
        // Non-platform admins may only bulk-create within their own company.
        if (caller.role !== "PLATFORM_ADMIN") {
          const foreign = users.find((u) => u.company_id && u.company_id !== caller.company_id);
          if (foreign) {
            await logBlockedAttempt(caller, "bulkCreate", null, `target company ${foreign.company_id} != caller company ${caller.company_id}`);
            return json({ success: false, error: "Forbidden: cross-tenant operation" }, 403);
          }
          // Force every created user into the caller's company regardless of payload.
          users.forEach((u) => { u.company_id = caller.company_id ?? undefined; });
        }
        return json(await handleBulkCreate(users));
      }

      case "resetPassword": {
        if (!isAdmin(caller.role)) return json({ success: false, error: "Forbidden" });
        if (!(await assertSameTenant(caller, body.userId, "resetPassword"))) {
          return json({ success: false, error: "Forbidden: cross-tenant operation" }, 403);
        }
        const r = await handleResetPassword(body.userId, body.password);
        return json(r);
      }

      case "deleteUser": {
        if (!isAdmin(caller.role)) return json({ success: false, error: "Forbidden" });
        if (!(await assertSameTenant(caller, body.userId, "deleteUser"))) {
          return json({ success: false, error: "Forbidden: cross-tenant operation" }, 403);
        }
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
        if (!(await assertSameTenant(caller, body.userId, "resetMfa"))) {
          return json({ success: false, error: "Forbidden: cross-tenant operation" }, 403);
        }
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

        // Do NOT change mfa_enforced — if it was true, the user will be
        // prompted to re-enroll on next login.
        return json({ success: true, factors_removed: deleted });
      }

      // Set/unset forced MFA for a user
      case "setMfaEnforced": {
        if (!isAdmin(caller.role)) return json({ success: false, error: "Forbidden" });
        if (!(await assertSameTenant(caller, body.userId, "setMfaEnforced"))) {
          return json({ success: false, error: "Forbidden: cross-tenant operation" }, 403);
        }
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
        if (!(await assertSameTenant(caller, body.userId, "forcePasswordChange"))) {
          return json({ success: false, error: "Forbidden: cross-tenant operation" }, 403);
        }
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
        // Role escalation guard: only PLATFORM_ADMIN may grant the PLATFORM_ADMIN role.
        if (caller.role !== "PLATFORM_ADMIN" && newRole === "PLATFORM_ADMIN") {
          await logBlockedAttempt(caller, "updateUserRole", body.userId, `role escalation: attempted to assign PLATFORM_ADMIN`);
          return json({ success: false, error: "Forbidden: only platform admins may grant PLATFORM_ADMIN role" }, 403);
        }
        if (!(await assertSameTenant(caller, body.userId, "updateUserRole"))) {
          return json({ success: false, error: "Forbidden: cross-tenant operation" }, 403);
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
