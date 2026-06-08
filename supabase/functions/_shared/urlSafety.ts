/**
 * urlSafety (Edge Function port) — pure, dependency-free SSRF / open-redirect
 * defence helpers.
 *
 * Ported from src/lib/urlSafety.ts (the canonical, unit-tested validator) so the
 * Supabase Edge Functions share the exact same classification rules. Contains
 * only synchronous logic (no DNS, no network) — safe to call inline in a
 * request handler. Pure TypeScript, no Deno or remote imports.
 */

/** Parse a string into a URL only if it is a valid http(s) URL. */
function parseHttpUrl(value: string, allowHttp: boolean): URL | null {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return null;
  }
  if (u.protocol === "https:") return u;
  if (u.protocol === "http:" && allowHttp) return u;
  return null;
}

/**
 * Is the given IP literal in a private, loopback, link-local, or otherwise
 * reserved range that must never be reachable via SSRF? Handles IPv4, IPv6,
 * and IPv4-mapped IPv6 (::ffff:a.b.c.d).
 */
function isPrivateOrReservedIp(ip: string): boolean {
  const addr = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");

  // IPv4-mapped IPv6 → unwrap to the embedded IPv4 and test that.
  const mapped = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateOrReservedIp(mapped[1]);

  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(addr)) {
    const parts = addr.split(".").map((p) => parseInt(p, 10));
    if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true; // malformed → block
    const [a, b] = parts;
    if (a === 0) return true;                          // 0.0.0.0/8 "this network"
    if (a === 10) return true;                         // 10.0.0.0/8
    if (a === 127) return true;                        // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true;           // 169.254.0.0/16 link-local (incl. metadata 169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
    if (a === 192 && b === 168) return true;           // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 192 && b === 0) return true;             // 192.0.0.0/24 + 192.0.2.0/24 (test nets / reserved)
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
    if (a >= 224) return true;                         // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
    return false;
  }

  // IPv6
  if (addr.includes(":")) {
    if (addr === "::" || addr === "::1") return true;          // unspecified / loopback
    if (addr.startsWith("fe80") || addr.startsWith("fe9") ||
        addr.startsWith("fea") || addr.startsWith("feb")) return true; // fe80::/10 link-local
    if (addr.startsWith("fc") || addr.startsWith("fd")) return true;   // fc00::/7 unique-local
    if (addr.startsWith("ff")) return true;                    // ff00::/8 multicast
    if (addr.startsWith("::ffff:")) return true;               // mapped but not dotted-quad → block defensively
    return false;
  }

  // Not a recognisable IP literal.
  return false;
}

/**
 * Hostnames that must be blocked outright, independent of DNS resolution:
 * localhost, loopback synonyms, internal/.local suffixes, raw private IPs,
 * and the well-known cloud metadata hostnames.
 */
function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!host) return true;

  if (host === "localhost") return true;
  if (host.endsWith(".localhost")) return true;
  if (host.endsWith(".local")) return true;
  if (host.endsWith(".internal")) return true;
  if (host === "metadata" || host === "metadata.google.internal") return true;

  // Raw IP literal → classify directly.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    return isPrivateOrReservedIp(host);
  }

  return false;
}

/**
 * Strict redirect-target validator. A value is safe only when it is a valid
 * http(s) URL (https only unless opts.allowHttp), carries no embedded
 * credentials (user:pass@host), does not point at an internal/private/metadata
 * host, and — when opts.allowedHosts is supplied — its hostname is in the
 * allowlist. Anything else is unsafe.
 */
export function isSafeRedirectUrl(
  value: string,
  opts?: { allowHttp?: boolean; allowedHosts?: string[] },
): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  const allowHttp = opts?.allowHttp ?? false;

  const u = parseHttpUrl(value.trim(), allowHttp);
  if (!u) return false;

  // Reject embedded credentials (user:pass@host) — a classic open-redirect /
  // phishing obfuscation vector.
  if (u.username || u.password) return false;

  if (isBlockedHostname(u.hostname)) return false;

  if (opts?.allowedHosts && opts.allowedHosts.length > 0) {
    const allow = new Set(
      opts.allowedHosts
        .filter(Boolean)
        .map((h) => h.trim().toLowerCase().replace(/\.$/, "")),
    );
    const host = u.hostname.trim().toLowerCase().replace(/\.$/, "");
    if (!allow.has(host)) return false;
  }

  return true;
}

/**
 * Returns `value` when it is a safe redirect target, otherwise the `fallback`.
 * Use to harden any stored/forwarded redirect URL against open-redirect abuse.
 */
export function sanitizeRedirectUrl(
  value: string,
  fallback: string,
  opts?: { allowHttp?: boolean; allowedHosts?: string[] },
): string {
  return isSafeRedirectUrl(value, opts) ? value : fallback;
}
