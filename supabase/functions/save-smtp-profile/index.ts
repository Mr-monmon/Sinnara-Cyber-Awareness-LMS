/**
 * save-smtp-profile — secure SMTP credential storage
 *
 * Receives an SMTP profile from the frontend, encrypts the password using
 * AES-256-GCM with SMTP_ENCRYPTION_KEY (server-side secret only), and
 * writes the encrypted value to the database.
 *
 * The plaintext password NEVER reaches the database.
 * The encryption key NEVER reaches the browser.
 *
 * Supports: CREATE (no profile_id) and UPDATE (with profile_id).
 *
 * On UPDATE with no new password provided, the existing encrypted
 * password is preserved unchanged.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ── Decode encryption key — supports both hex (64 chars) and base64url (43 chars) ── */
function decodeKey(keyStr: string): Uint8Array {
  const trimmed = keyStr.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  const b64 = trimmed.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

/* ── AES-256-GCM encrypt ── */
async function encryptPassword(plaintext: string): Promise<{ ciphertext: string; encrypted: boolean }> {
  const keyStr = Deno.env.get("SMTP_ENCRYPTION_KEY");
  if (!keyStr || !plaintext) {
    return { ciphertext: plaintext, encrypted: false };
  }

  const keyBytes = decodeKey(keyStr);
  if (keyBytes.length !== 32) {
    console.error(`[encryptPassword] SMTP_ENCRYPTION_KEY decoded to ${keyBytes.length} bytes, expected 32. Generate a valid key with: openssl rand -hex 32`);
    return { ciphertext: plaintext, encrypted: false };
  }
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoded);

  // Combine iv + ciphertext, encode as base64url
  // Use a loop instead of spread to avoid "Maximum call stack size exceeded"
  // on large buffers in some Deno/V8 environments.
  const combined = new Uint8Array(iv.byteLength + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.byteLength);
  let b64str = "";
  for (let i = 0; i < combined.length; i++) b64str += String.fromCharCode(combined[i]);
  const b64 = btoa(b64str)
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  return { ciphertext: b64, encrypted: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
  // Authenticate the caller using their session JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  // Load caller's role + company_id
  const { data: callerRow } = await serviceClient
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (!callerRow) {
    return new Response(JSON.stringify({ error: "User record not found" }), { status: 403, headers: corsHeaders });
  }

  const isPlatformAdmin  = callerRow.role === "PLATFORM_ADMIN";
  const isCompanyPhishing = ["COMPANY_ADMIN", "COMPANY_SUPER_ADMIN", "PHISHING_OPERATOR"].includes(callerRow.role);

  if (!isPlatformAdmin && !isCompanyPhishing) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders }); }

  const {
    profile_id,        // present on UPDATE
    name, host, port, username, password,
    from_address, from_name,
    use_tls, use_starttls, ignore_cert_errors,
    custom_headers,
    is_active,
    is_platform_profile,
  } = body as Record<string, unknown>;

  // Validate required fields
  if (!name || !host || !from_address || !from_name) {
    return new Response(JSON.stringify({ error: "name, host, from_address, and from_name are required" }), { status: 400, headers: corsHeaders });
  }

  // Authorisation scope check
  const targetIsPlatform = Boolean(is_platform_profile);
  if (targetIsPlatform && !isPlatformAdmin) {
    return new Response(JSON.stringify({ error: "Only platform admins may create platform profiles" }), { status: 403, headers: corsHeaders });
  }
  if (!targetIsPlatform && !isCompanyPhishing && !isPlatformAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  // On UPDATE, verify ownership
  if (profile_id) {
    const { data: existing } = await serviceClient
      .from("smtp_profiles")
      .select("id, company_id, is_platform_profile")
      .eq("id", profile_id)
      .single();

    if (!existing) {
      return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers: corsHeaders });
    }

    const ownsProfile =
      isPlatformAdmin
        ? existing.is_platform_profile === true
        : existing.company_id === callerRow.company_id;

    if (!ownsProfile) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }
  }

  // Build payload — encrypt password if provided
  const payload: Record<string, unknown> = {
    name, host,
    port: Number(port ?? 587),
    username:           String(username ?? ""),
    from_address:       String(from_address),
    from_name:          String(from_name),
    use_tls:            Boolean(use_tls ?? true),
    use_starttls:       Boolean(use_starttls ?? false),
    ignore_cert_errors: Boolean(ignore_cert_errors ?? false),
    custom_headers:     Array.isArray(custom_headers) ? custom_headers : [],
    is_active:          Boolean(is_active ?? true),
    updated_at:         new Date().toISOString(),
  };

  if (!profile_id) {
    // CREATE — set ownership
    payload.is_platform_profile = targetIsPlatform;
    payload.company_id          = targetIsPlatform ? null : callerRow.company_id;
  }

  // Encrypt password if a new one is provided. Fail CLOSED: if the server has
  // no valid SMTP_ENCRYPTION_KEY we refuse to store the password rather than
  // silently persisting it in plaintext. Local dev can opt in explicitly.
  const newPassword = typeof password === "string" ? password.trim() : "";
  if (newPassword) {
    const { ciphertext, encrypted } = await encryptPassword(newPassword);
    const allowPlaintext = (Deno.env.get("ALLOW_PLAINTEXT_SMTP") ?? "").toLowerCase() === "true";
    if (!encrypted && !allowPlaintext) {
      console.error("[save-smtp-profile] refusing to store plaintext password: SMTP_ENCRYPTION_KEY missing or invalid");
      return new Response(JSON.stringify({ error: "SMTP encryption is not configured on the server (SMTP_ENCRYPTION_KEY missing or invalid). The SMTP password was not saved. Contact your platform administrator." }), { status: 500, headers: corsHeaders });
    }
    payload.password           = ciphertext;
    payload.password_encrypted = encrypted;
  }
  // If no new password on UPDATE, keep existing (omit from payload entirely)

  let savedId: string;

  if (profile_id) {
    // UPDATE
    const { data, error } = await serviceClient
      .from("smtp_profiles")
      .update(payload)
      .eq("id", String(profile_id))
      .select("id")
      .single();

    if (error) {
      console.error("[save-smtp-profile] update error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
    savedId = data!.id;
  } else {
    // INSERT — password is required on create
    if (!newPassword) {
      return new Response(JSON.stringify({ error: "Password is required when creating a new profile" }), { status: 400, headers: corsHeaders });
    }
    const { data, error } = await serviceClient
      .from("smtp_profiles")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      console.error("[save-smtp-profile] insert error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
    savedId = data!.id;
  }

  // Return the saved profile WITHOUT password fields
  const { data: saved } = await serviceClient
    .from("smtp_profiles")
    .select("id, company_id, name, host, port, username, from_address, from_name, use_tls, use_starttls, ignore_cert_errors, custom_headers, is_platform_profile, is_active, password_encrypted, created_at, updated_at")
    .eq("id", savedId)
    .single();

  return new Response(JSON.stringify({ profile: saved }), { status: 200, headers: corsHeaders });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[save-smtp-profile] unhandled exception:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
