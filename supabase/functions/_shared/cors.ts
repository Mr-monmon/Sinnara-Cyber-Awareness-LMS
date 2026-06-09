/**
 * cors — shared CORS policy for the Edge Functions.
 *
 * Two postures:
 *
 *   1. PUBLIC endpoints (phishing recipients arrive from any browser / mail
 *      client / image proxy): these MUST use a wildcard origin. They never read
 *      ambient browser credentials (no cookies — Supabase auth is bearer-token
 *      only) and never return tenant data to the caller's origin, so a wildcard
 *      is safe and is the only thing that works for arbitrary recipients. Call
 *      with { publicWildcard: true }.
 *
 *   2. AUTHENTICATED endpoints invoked by the SPA: these honour an operator-
 *      configured origin allowlist via the ALLOWED_ORIGINS env var (comma-
 *      separated, e.g. "https://app.awareone.io,https://admin.awareone.io").
 *      When the allowlist is set, only a matching Origin is reflected back; a
 *      non-matching browser origin is denied by the browser. When ALLOWED_ORIGINS
 *      is unset (local dev / preview), the policy falls back to "*" so nothing
 *      breaks before an operator hardens it.
 *
 * Note: bearer-token auth means CORS is defence-in-depth here, not the primary
 * control — a server-to-server caller ignores CORS entirely. The allowlist's
 * value is blocking a logged-in user's browser from being driven by a hostile
 * third-party site (drive-by calls with the user's token are still gated by the
 * JWT the attacker cannot read cross-origin).
 */

const DEFAULT_ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";

function configuredOrigins(): string[] {
  return (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export interface CorsOptions {
  /** Allowed HTTP methods, e.g. "POST, OPTIONS" (default) or "GET, OPTIONS". */
  methods?: string;
  /** Allowed request headers. Defaults to the Supabase SPA set. */
  headers?: string;
  /** Force a wildcard origin — for public, unauthenticated endpoints only. */
  publicWildcard?: boolean;
}

/**
 * Build the CORS response headers for a request. See module docs for the two
 * postures. Always sets `Vary: Origin` so caches don't cross-pollinate origins.
 */
export function corsHeaders(req: Request, opts: CorsOptions = {}): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": opts.methods ?? "POST, OPTIONS",
    "Access-Control-Allow-Headers": opts.headers ?? DEFAULT_ALLOW_HEADERS,
    "Vary": "Origin",
  };

  if (opts.publicWildcard) {
    base["Access-Control-Allow-Origin"] = "*";
    return base;
  }

  const allow = configuredOrigins();
  if (allow.length === 0) {
    // No allowlist configured — stay permissive so dev/preview keep working.
    base["Access-Control-Allow-Origin"] = "*";
    return base;
  }

  const origin = (req.headers.get("Origin") ?? "").replace(/\/$/, "");
  // Reflect the caller's origin only when it is explicitly allowlisted;
  // otherwise return the canonical (first) allowed origin so a mismatched
  // browser origin is blocked by the browser's CORS check.
  base["Access-Control-Allow-Origin"] = origin && allow.includes(origin) ? origin : allow[0];
  return base;
}
