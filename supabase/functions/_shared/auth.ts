/**
 * auth — shared authentication helpers for the phishing Edge Functions.
 *
 * Centralises the service-role client factory, the authenticated-caller parser,
 * and the cron/service-role request detection that the campaign functions all
 * need. Mirrors the inline logic that previously lived in
 * process-campaign/index.ts and launch-phishing-campaign/index.ts.
 */

import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

/**
 * A service-role Supabase client (RLS-bypassing). Reads SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY from the function's environment.
 */
export function createServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** A caller's profile row from the `users` table. */
export interface CallerProfile {
  id: string;
  role: string;
  company_id: string | null;
}

/** The authenticated user plus their profile. */
export interface Caller {
  user: { id: string; email?: string };
  profile: CallerProfile;
}

/**
 * Resolve the authenticated caller from the request's Authorization header.
 * Validates the JWT against the anon-key client, then loads the caller's
 * profile (id, role, company_id) using the service-role client. Returns null
 * when the token is missing/invalid or the profile row does not exist.
 */
export async function getCaller(
  req: Request,
  anonKey: string,
  serviceClient: SupabaseClient,
): Promise<Caller | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return null;

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return null;

  const { data: profile, error: profileErr } = await serviceClient
    .from("users")
    .select("id, role, company_id")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) return null;

  return {
    user: { id: user.id, email: user.email },
    profile: {
      id: profile.id as string,
      role: profile.role as string,
      company_id: (profile.company_id as string | null) ?? null,
    },
  };
}

/**
 * Read the `role` claim from a JWT WITHOUT verifying the signature.
 *
 * Safe ONLY because the Supabase gateway runs these functions with verify_jwt
 * enabled, so it has already cryptographically validated the token's signature
 * before invocation (a forged/unsigned token is rejected at the gateway and
 * never reaches here). We therefore only need to read the already-trusted claim.
 */
export function jwtRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

/**
 * Recognise a service-role (cron / server-to-server) request. Accepts two forms:
 *   1. The bearer token matches SUPABASE_SERVICE_ROLE_KEY exactly (legacy setups
 *      where the env key and the bearer are the same string).
 *   2. The bearer is a JWT whose `role` claim === "service_role" (the new
 *      sb_secret_… key system injects a different env value than the gateway
 *      JWT, so the exact-match in (1) can never hold for a JWT bearer).
 */
export function isServiceRoleRequest(req: Request, serviceRoleKey: string): boolean {
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (bearer.length === 0) return false;
  return bearer === serviceRoleKey || jwtRole(bearer) === "service_role";
}
