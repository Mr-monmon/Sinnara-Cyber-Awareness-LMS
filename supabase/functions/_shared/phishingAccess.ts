/**
 * phishingAccess — cross-tenant ownership / accessibility checks and quota
 * enforcement for the phishing-campaign Edge Functions.
 *
 * Every helper takes a service-role Supabase client (`db`) so it can read across
 * companies, and answers a single question: "may THIS company use THIS resource?"
 * Ownership validation fails CLOSED — any query error is treated as "not
 * accessible" so a transient DB failure can never grant cross-tenant access.
 */

import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Normalise a list of targets: lowercase + trim each email and de-duplicate by
 * email (first occurrence wins). Rows with an empty email are dropped.
 */
export function normalizeTargets<T extends { email: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const email = (row.email ?? "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ ...row, email });
  }
  return out;
}

/**
 * True only when EVERY group id belongs to the given company. An empty list is
 * vacuously true. Fails closed on query error.
 */
export async function assertGroupsOwnedByCompany(
  db: SupabaseClient,
  groupIds: string[],
  companyId: string,
): Promise<boolean> {
  if (!groupIds || groupIds.length === 0) return true;
  const { data, error } = await db
    .from("phishing_groups")
    .select("id")
    .in("id", groupIds)
    .eq("company_id", companyId);
  if (error || !data) return false;
  return data.length === groupIds.length;
}

/**
 * True when the SMTP profile is accessible to the company: null id → no profile
 * selected (allowed); otherwise the profile must be company-owned OR a platform
 * profile (is_platform_profile = true). Fails closed on query error.
 */
export async function assertSmtpProfileAccessible(
  db: SupabaseClient,
  smtpProfileId: string | null,
  companyId: string,
): Promise<boolean> {
  if (!smtpProfileId) return true;
  const { data, error } = await db
    .from("smtp_profiles")
    .select("id, company_id, is_platform_profile")
    .eq("id", smtpProfileId)
    .single();
  if (error || !data) return false;
  if (data.is_platform_profile === true) return true;
  return data.company_id === companyId;
}

/**
 * True when the landing page is accessible to the company: null id → no page
 * selected (allowed); otherwise the page must be company-owned OR a platform
 * page that is either GLOBAL or explicitly shared with the company via
 * landing_page_company_access. Fails closed on query error.
 */
export async function assertLandingPageAccessible(
  db: SupabaseClient,
  landingPageId: string | null,
  companyId: string,
): Promise<boolean> {
  if (!landingPageId) return true;
  const { data, error } = await db
    .from("phishing_company_landing_pages")
    .select("id, company_id, is_platform_page, visibility")
    .eq("id", landingPageId)
    .single();
  if (error || !data) return false;

  // Company-owned page.
  if (data.company_id === companyId) return true;

  // Platform page: GLOBAL is open to all; SHARED requires an access grant.
  if (data.is_platform_page === true) {
    if (data.visibility === "GLOBAL") return true;
    if (data.visibility === "SHARED") {
      const { data: grant, error: grantErr } = await db
        .from("landing_page_company_access")
        .select("id")
        .eq("landing_page_id", landingPageId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (grantErr) return false;
      return !!grant;
    }
  }

  return false;
}

/**
 * True when the scenario is accessible to the company: null id → no scenario
 * selected (allowed); otherwise it must exist. Scenarios are platform-global —
 * the table carries no owning company_id, so any existing scenario is treated
 * as a global/platform scenario. Should a company_id column ever be added, a
 * non-null value must match the company. Fails closed on query error.
 */
export async function assertScenarioAccessible(
  db: SupabaseClient,
  scenarioId: string | null,
  companyId: string,
): Promise<boolean> {
  if (!scenarioId) return true;
  const { data, error } = await db
    .from("phishing_scenarios")
    .select("*")
    .eq("id", scenarioId)
    .single();
  if (error || !data) return false;

  const row = data as Record<string, unknown>;
  // If the schema ever gains an owning company_id, honour it: a non-null value
  // must match; null means global. Absent column → global (current schema).
  if ("company_id" in row && row.company_id != null) {
    return row.company_id === companyId;
  }
  return true;
}

/** Result of a fail-closed quota check. */
export type LimitCheckResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Fail-CLOSED phishing quota check. Calls the check_phishing_limits RPC and:
 *   - returns { ok:false, status:500 } if the RPC errors OR returns no row
 *     (a quota check that cannot run must never let a campaign through);
 *   - returns { ok:false, status:403, error: reason } when allowed === false;
 *   - returns { ok:true } only when the RPC explicitly allows the campaign.
 */
export async function checkLimitsFailClosed(
  db: SupabaseClient,
  companyId: string,
  targetCount: number,
): Promise<LimitCheckResult> {
  const { data, error } = await db.rpc("check_phishing_limits", {
    p_company_id: companyId,
    p_target_count: targetCount,
  });

  if (error || data == null) {
    return { ok: false, status: 500, error: "Quota validation failed" };
  }

  const result = data as Record<string, unknown>;
  if (result.allowed !== true) {
    const reason = (result.reason as string) || "Quota exceeded";
    return { ok: false, status: 403, error: `Campaign blocked: ${reason}` };
  }

  return { ok: true };
}
