/**
 * verify-phishing-domain — prove ownership of a sending domain, and report
 * whether mail from it will actually be delivered.
 *
 * The platform-admin UI generates a verification token, stores it on the domain
 * row, and instructs the operator to publish it as a DNS TXT record. Until this
 * function existed, the "Verify" button simply wrote `is_verified = true` — no
 * lookup, no comparison, no proof. A domain with no DNS records at all could be
 * marked verified, and `RequestPreview` only offers verified domains as senders,
 * so campaigns went out from unauthenticated domains and landed in spam.
 *
 * Ownership is the gate: `is_verified` is set only when the published TXT record
 * matches the stored token. SPF and DMARC are checked too but are ADVISORY —
 * they are reported to the operator rather than blocking verification, because
 * ownership and deliverability are different questions and a domain can be
 * legitimately owned while its mail policy is still being configured. For a
 * phishing-simulation vendor deliverability is the product, so these advisories
 * are the most useful thing this endpoint returns.
 *
 * DNS is resolved server-side because browsers cannot query TXT records at all.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as buildCors } from "../_shared/cors.ts";
import { logAndRef } from "../_shared/httpError.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const TOKEN_PREFIX = "sinnara-verify=";

/* ══════════════════════════════════════════════════════════════════════════
   DNS RESOLUTION — two transports on purpose
   ══════════════════════════════════════════════════════════════════════════
   `Deno.resolveDns` is the direct path: no third party sees the query. It is
   not available under every Deno Deploy configuration, and a runtime that
   restricts it throws rather than returning empty — which, if treated as "no
   record found", would tell the operator to fix DNS that is already correct.
   So the native path reports "could not resolve" distinctly, and a DNS-over-
   HTTPS lookup over plain fetch is used as the fallback. Whichever the
   deployed runtime allows, the check behaves the same.
   ══════════════════════════════════════════════════════════════════════════ */

interface Lookup {
  /** True when a resolver answered authoritatively — including "no such records". */
  resolved: boolean;
  records: string[];
}

const DOH_ENDPOINTS = [
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve",
];

/**
 * DoH returns a TXT record as a quoted string, and a record longer than 255
 * characters as several quoted chunks separated by spaces. Both forms have to
 * collapse to the single logical string, or long SPF and DKIM values never match.
 */
function unquoteTxt(data: string): string {
  return data.replace(/"\s+"/g, "").replace(/^"|"$/g, "");
}

async function lookupNative(name: string, type: "TXT" | "A" | "MX"): Promise<Lookup | null> {
  try {
    // Referenced dynamically: absent on runtimes that do not expose it.
    const resolveDns = (Deno as unknown as {
      resolveDns?: (n: string, t: string) => Promise<unknown>;
    }).resolveDns;
    if (typeof resolveDns !== "function") return null;

    const records = await resolveDns(name, type);
    if (type === "TXT") {
      // Deno returns string[][] — chunks of one record must be joined.
      return { resolved: true, records: (records as string[][]).map((c) => c.join("")) };
    }
    return { resolved: true, records: (records as unknown[]).map(String) };
  } catch (err) {
    // NXDOMAIN / NODATA is a real answer: the lookup worked, there is nothing there.
    if (err instanceof Deno.errors.NotFound) return { resolved: true, records: [] };
    // Anything else (permission denied, unsupported API) is not an answer.
    return null;
  }
}

async function lookupDoh(name: string, type: "TXT" | "A" | "MX"): Promise<Lookup | null> {
  for (const base of DOH_ENDPOINTS) {
    try {
      const res = await fetch(`${base}?name=${encodeURIComponent(name)}&type=${type}`, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const body = await res.json() as { Status?: number; Answer?: { type: number; data: string }[] };

      // 0 = NOERROR, 3 = NXDOMAIN. Both are authoritative answers; anything else
      // (SERVFAIL, REFUSED) means try the next resolver rather than report "empty".
      if (body.Status !== 0 && body.Status !== 3) continue;

      const wanted = type === "TXT" ? 16 : type === "A" ? 1 : 15;
      const answers = (body.Answer ?? []).filter((a) => a.type === wanted);
      return {
        resolved: true,
        records: answers.map((a) => (type === "TXT" ? unquoteTxt(String(a.data)) : String(a.data))),
      };
    } catch {
      continue;
    }
  }
  return null;
}

async function lookup(name: string, type: "TXT" | "A" | "MX"): Promise<Lookup> {
  const native = await lookupNative(name, type);
  if (native) return native;
  const doh = await lookupDoh(name, type);
  if (doh) return doh;
  return { resolved: false, records: [] };
}

/* ══════════════════════════════════════════════════════════════════════════
   INSPECTION
   ══════════════════════════════════════════════════════════════════════════ */

interface DnsFindings {
  ownership_ok: boolean;
  txt_found: number;
  spf: { present: boolean; record: string | null; note: string | null };
  dmarc: { present: boolean; record: string | null; note: string | null };
  /** Set when nothing could be resolved, or the domain itself does not exist. */
  dns_error: string | null;
}

async function inspectDomain(domain: string, token: string): Promise<DnsFindings> {
  const findings: DnsFindings = {
    ownership_ok: false,
    txt_found: 0,
    spf: { present: false, record: null, note: null },
    dmarc: { present: false, record: null, note: null },
    dns_error: null,
  };

  const apex = await lookup(domain, "TXT");

  if (!apex.resolved) {
    findings.dns_error =
      `DNS lookup for ${domain} could not be completed. This is a resolver problem, not a missing record — ` +
      `do not change your DNS on the strength of this result. Try again shortly.`;
    return findings;
  }

  findings.txt_found = apex.records.length;
  findings.ownership_ok = apex.records.some((r) => r.includes(`${TOKEN_PREFIX}${token}`));

  // A domain that resolves nothing at all is almost always a typo, and saying so
  // beats sending the operator to edit DNS on a domain they do not own.
  if (apex.records.length === 0) {
    const a = await lookup(domain, "A");
    const mx = a.records.length === 0 ? await lookup(domain, "MX") : { resolved: true, records: ["skip"] };
    if (a.resolved && a.records.length === 0 && mx.resolved && mx.records.length === 0) {
      findings.dns_error =
        `${domain} has no A, MX or TXT records. Check the domain is spelt correctly and is registered.`;
    }
  }

  // ── SPF (advisory) ──
  const spfRecords = apex.records.filter((r) => r.toLowerCase().startsWith("v=spf1"));
  if (spfRecords.length === 0) {
    findings.spf.note =
      "No SPF record. Receivers cannot confirm this platform is allowed to send as this domain, so simulations are likely to be filtered.";
  } else if (spfRecords.length > 1) {
    findings.spf.present = true;
    findings.spf.record = spfRecords[0];
    findings.spf.note =
      `${spfRecords.length} SPF records published. RFC 7208 allows exactly one — receivers treat this as permerror and may reject the mail.`;
  } else {
    findings.spf.present = true;
    findings.spf.record = spfRecords[0];
    if (!/[?~+-]all/.test(spfRecords[0])) {
      findings.spf.note =
        "SPF record has no 'all' mechanism, so its policy for unlisted senders is undefined.";
    }
  }

  // ── DMARC (advisory) ──
  const dmarcLookup = await lookup(`_dmarc.${domain}`, "TXT");
  const dmarcRecord = dmarcLookup.records.find((r) => r.toLowerCase().startsWith("v=dmarc1"));
  if (!dmarcRecord) {
    findings.dmarc.note =
      `No DMARC record at _dmarc.${domain}. Not required for delivery, but many enterprise receivers treat its absence as a negative signal.`;
  } else {
    findings.dmarc.present = true;
    findings.dmarc.record = dmarcRecord;
    if (/p\s*=\s*reject/i.test(dmarcRecord)) {
      findings.dmarc.note =
        "DMARC policy is p=reject. Unless SPF or DKIM aligns for the sending path, simulations from this domain will be rejected outright.";
    } else if (/p\s*=\s*quarantine/i.test(dmarcRecord)) {
      findings.dmarc.note =
        "DMARC policy is p=quarantine. Unaligned mail from this domain will be delivered to spam.";
    }
  }

  return findings;
}

/* ══════════════════════════════════════════════════════════════════════════
   HANDLER
   ══════════════════════════════════════════════════════════════════════════ */

Deno.serve(async (req: Request) => {
  const cors = { ...buildCors(req), "Content-Type": "application/json" };

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), { status: 405, headers: cors });
  }

  try {
    // ── Caller must be a platform admin (mirrors the page that calls it) ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: cors });
    }
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: cors });
    }
    const { data: profile } = await supabaseAdmin
      .from("users").select("role").eq("id", user.id).single();
    if (profile?.role !== "PLATFORM_ADMIN") {
      return new Response(JSON.stringify({ success: false, error: "Forbidden: PLATFORM_ADMIN required" }), { status: 403, headers: cors });
    }

    const body = await req.json().catch(() => ({}));
    const domainId = String(body.domain_id ?? "").trim();
    if (!domainId) {
      return new Response(JSON.stringify({ success: false, error: "domain_id is required" }), { status: 400, headers: cors });
    }

    const { data: domain, error: readErr } = await supabaseAdmin
      .from("phishing_domains")
      .select("id, domain_name, verification_token")
      .eq("id", domainId)
      .maybeSingle();
    if (readErr) {
      return new Response(JSON.stringify({ success: false, ...logAndRef("verify-phishing-domain:read", readErr) }), { status: 500, headers: cors });
    }
    if (!domain) {
      return new Response(JSON.stringify({ success: false, error: "Domain not found" }), { status: 404, headers: cors });
    }
    if (!domain.verification_token) {
      return new Response(JSON.stringify({
        success: false,
        error: "This domain has no verification token. Delete and re-add it to generate one.",
      }), { status: 409, headers: cors });
    }

    const findings = await inspectDomain(domain.domain_name, domain.verification_token);

    // Ownership alone decides verification. SPF/DMARC ride along as advice.
    if (!findings.ownership_ok) {
      return new Response(JSON.stringify({
        success: false,
        verified: false,
        error: findings.dns_error
          ?? `No TXT record containing "${TOKEN_PREFIX}${domain.verification_token}" was found on ${domain.domain_name}. `
             + `${findings.txt_found} TXT record(s) are published there. DNS changes can take up to an hour to propagate.`,
        findings,
      }), { status: 200, headers: cors });
    }

    const verifiedAt = new Date().toISOString();
    const { error: updErr } = await supabaseAdmin
      .from("phishing_domains")
      .update({ is_verified: true, verified_at: verifiedAt, updated_at: verifiedAt })
      .eq("id", domain.id);
    if (updErr) {
      return new Response(JSON.stringify({ success: false, ...logAndRef("verify-phishing-domain:update", updErr) }), { status: 500, headers: cors });
    }

    return new Response(JSON.stringify({
      success: true,
      verified: true,
      verified_at: verifiedAt,
      findings,
    }), { status: 200, headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, ...logAndRef("verify-phishing-domain", err) }), { status: 500, headers: cors });
  }
});
