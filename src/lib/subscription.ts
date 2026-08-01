import { supabase } from "./supabase";

/**
 * Subscription state — SINGLE SOURCE OF TRUTH resolver.
 *
 * Historically subscription state lived in TWO places that were never
 * reconciled:
 *
 *   • `companies` (subscription_type / subscription_start / subscription_end /
 *     license_limit / is_active) — the ONLY table the platform-admin UI writes
 *     when a subscription is created, edited or extended, and the table the
 *     platform-admin Subscriptions screen reads.
 *
 *   • `subscriptions` (start_date / end_date / license_count / status) — written
 *     exactly once, at company creation, and never updated afterwards.
 *
 * The company-admin banner used to read `subscriptions` alone, so extending a
 * subscription moved `companies.subscription_end` forward while the stale
 * `subscriptions.end_date` kept the workspace showing "Your subscription has
 * expired" forever.
 *
 * This module now resolves both stores through ONE function so every consumer
 * (dashboard banner, employee license cap, account settings) agrees:
 *
 *   effective end     = MAX(companies.subscription_end, subscriptions.end_date)
 *   effective license = companies.license_limit ?? subscriptions.license_count
 *
 * "Most generous wins" is deliberate. Expiry here is presentational — access is
 * gated by `companies.is_active`, not by these dates — so a stale row must never
 * be able to FABRICATE an expiry. Reads that fail resolve to `null` (which
 * renders no banner at all) rather than to an expired state.
 */

export interface SubscriptionInfo {
  id: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "PENDING";
  subscription_type: string;
  start_date: string;
  end_date: string;
  license_count: number;
  days_remaining: number;
  expires_soon: boolean;
  expired: boolean;
  /** Whether the company record itself is active (the real access gate). */
  is_active: boolean;
  /** Which store supplied the effective end date — useful for diagnostics. */
  source: "company" | "subscriptions";
}

/**
 * End of the calendar day, in the viewer's timezone.
 *
 * End dates are authored as date-only values ("YYYY-MM-DD") and stored as
 * timestamptz at midnight UTC. Comparing against midnight made a subscription
 * read as expired for the whole of its final valid day (and, for a UTC+3
 * tenant, from 03:00 local on the day before). A subscription that ends on a
 * given day is valid *through* that day.
 */
function endOfDayMs(value: string): number | null {
  if (!value) return null;
  const datePart = String(value).slice(0, 10);
  const ms = new Date(`${datePart}T23:59:59.999`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Return whichever ISO date string is later; ignores null/invalid values. */
function laterDate(a: string | null, b: string | null): string | null {
  const ams = a ? endOfDayMs(a) : null;
  const bms = b ? endOfDayMs(b) : null;
  if (ams === null) return bms === null ? null : b;
  if (bms === null) return a;
  return bms > ams ? b : a;
}

export interface CompanySubscriptionRow {
  subscription_type: string | null;
  subscription_start: string | null;
  subscription_end: string | null;
  license_limit: number | null;
  is_active: boolean | null;
}

export interface LegacySubscriptionRow {
  id: string;
  status: string | null;
  subscription_type: string | null;
  start_date: string | null;
  end_date: string | null;
  license_count: number | null;
}

/**
 * Pure resolver — decides the effective subscription state from the two stores.
 * Kept free of IO so the expiry rules can be unit-tested directly.
 *
 * @param now epoch ms to evaluate against (injectable for tests)
 */
export function resolveSubscriptionState(
  companyId: string,
  company: CompanySubscriptionRow | null,
  legacy: LegacySubscriptionRow | null,
  now: number = Date.now(),
): SubscriptionInfo | null {
  if (!company && !legacy) return null;

  const effectiveEnd = laterDate(company?.subscription_end ?? null, legacy?.end_date ?? null);
  if (!effectiveEnd) return null;

  const endMs = endOfDayMs(effectiveEnd);
  if (endMs === null) return null;

  const source: SubscriptionInfo["source"] =
    effectiveEnd === (company?.subscription_end ?? null) ? "company" : "subscriptions";

  const days_remaining = Math.ceil((endMs - now) / (1000 * 60 * 60 * 24));
  const expired = days_remaining <= 0;
  const is_active = company ? company.is_active !== false : true;

  const status: SubscriptionInfo["status"] = expired
    ? "EXPIRED"
    : !is_active
      ? "PENDING"
      : "ACTIVE";

  return {
    id: legacy?.id ?? companyId,
    status,
    subscription_type: company?.subscription_type || legacy?.subscription_type || "CUSTOM",
    start_date: company?.subscription_start || legacy?.start_date || "",
    end_date: effectiveEnd,
    license_count: company?.license_limit ?? legacy?.license_count ?? 0,
    days_remaining,
    expires_soon: days_remaining > 0 && days_remaining <= 30,
    expired,
    is_active,
    source,
  };
}

export async function getActiveSubscription(companyId: string): Promise<SubscriptionInfo | null> {
  if (!companyId) return null;

  const [companyRes, legacyRes] = await Promise.all([
    supabase
      .from("companies")
      .select("id, subscription_type, subscription_start, subscription_end, license_limit, is_active")
      .eq("id", companyId)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("id, status, subscription_type, start_date, end_date, license_count")
      .eq("company_id", companyId)
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const company = (companyRes.data ?? null) as CompanySubscriptionRow | null;
  const legacy = (legacyRes.data ?? null) as LegacySubscriptionRow | null;

  // Fail safe: if we learned nothing, say nothing. Callers render no banner for
  // a null result — an unreadable subscription must never look like an expired one.
  if (!company && !legacy && (companyRes.error || legacyRes.error)) {
    console.warn("[subscription] could not resolve subscription state", companyRes.error || legacyRes.error);
  }

  return resolveSubscriptionState(companyId, company, legacy);
}

export async function countCompanyEmployees(companyId: string): Promise<number> {
  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("role", "EMPLOYEE");
  return count ?? 0;
}

/* ─────────────────────────────────────────────────────────────
   Keeping the legacy `subscriptions` table in step with `companies`
───────────────────────────────────────────────────────────── */

export interface CompanySubscriptionFields {
  subscription_type?: unknown;
  subscription_start?: unknown;
  subscription_end?: unknown;
  license_limit?: unknown;
  is_active?: unknown;
}

/**
 * Mirror a company's subscription fields onto its latest `subscriptions` row.
 *
 * `companies` is authoritative — it is what the platform-admin UI writes and
 * what the Subscriptions screen reads. This keeps the legacy table in step so
 * it can never go stale and contradict it. Safe to call on every company save;
 * failures are logged and swallowed because the company row is already saved
 * and the resolver above tolerates a stale legacy row anyway.
 */
export async function syncSubscriptionRow(
  companyId: string,
  form: CompanySubscriptionFields,
): Promise<void> {
  const end = form.subscription_end ? String(form.subscription_end) : "";
  if (!companyId || !end) return; // subscriptions.end_date is NOT NULL

  const isActive = form.is_active !== false;
  const expired = (endOfDayMs(end) ?? 0) <= Date.now();
  const status = !isActive ? "PENDING" : expired ? "EXPIRED" : "ACTIVE";

  const payload = {
    subscription_type: form.subscription_type ? String(form.subscription_type) : "CUSTOM",
    start_date: form.subscription_start ? String(form.subscription_start) : new Date().toISOString(),
    end_date: end,
    license_count: Number(form.license_limit ?? 10),
    status,
  };

  try {
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("company_id", companyId)
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = existing?.id
      ? await supabase.from("subscriptions").update(payload).eq("id", existing.id)
      : await supabase.from("subscriptions").insert([{ company_id: companyId, ...payload }]);

    if (error) console.warn("[subscription] could not sync legacy subscriptions row", error);
  } catch (err) {
    console.warn("[subscription] syncSubscriptionRow failed", err);
  }
}

/* ─────────────────────────────────────────────────────────────
   Company-facing overview (subscription + phishing limits/usage)
───────────────────────────────────────────────────────────── */

export interface PhishingLimitsInfo {
  phishing_mode: "CUSTOM" | "TICKET";
  max_campaigns_per_year: number | null;
  max_emails_per_month: number | null;
  max_targets_per_campaign: number | null;
  emails_sent_this_month: number | null;
  campaigns_used_this_year: number | null;
  annual_quota: number | null;
}

export interface CompanySubscriptionOverview {
  subscription: SubscriptionInfo | null;
  licensesUsed: number | null;
  phishing: PhishingLimitsInfo | null;
}

/**
 * Everything the company-admin Account Settings "Overview" tab shows.
 *
 * Every read is company-scoped and already permitted by existing RLS
 * (rls_companies_company_admin_select, rls_subscriptions_company_read,
 * ca_limits_view, rls_pcq_company_read). Each section degrades independently:
 * a table the caller cannot read yields null for that section instead of
 * failing the whole page.
 */
export async function getCompanySubscriptionOverview(
  companyId: string,
): Promise<CompanySubscriptionOverview> {
  if (!companyId) return { subscription: null, licensesUsed: null, phishing: null };

  const [subscription, licensesUsed, limitsRes, quotaRes] = await Promise.all([
    getActiveSubscription(companyId),
    countCompanyEmployees(companyId).catch(() => null),
    supabase
      .from("company_phishing_limits")
      .select("phishing_mode, max_campaigns_per_year, max_emails_per_month, max_targets_per_campaign, emails_sent_this_month")
      .eq("company_id", companyId)
      .maybeSingle(),
    supabase
      .from("phishing_campaign_quotas")
      .select("annual_quota, used_campaigns, quota_year")
      .eq("company_id", companyId)
      .order("quota_year", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const limits = limitsRes.data as {
    phishing_mode: string | null;
    max_campaigns_per_year: number | null;
    max_emails_per_month: number | null;
    max_targets_per_campaign: number | null;
    emails_sent_this_month: number | null;
  } | null;

  const quota = quotaRes.data as { annual_quota: number | null; used_campaigns: number | null } | null;

  const phishing: PhishingLimitsInfo | null = limits
    ? {
        phishing_mode: limits.phishing_mode === "TICKET" ? "TICKET" : "CUSTOM",
        max_campaigns_per_year: limits.max_campaigns_per_year,
        max_emails_per_month: limits.max_emails_per_month,
        max_targets_per_campaign: limits.max_targets_per_campaign,
        emails_sent_this_month: limits.emails_sent_this_month,
        campaigns_used_this_year: quota?.used_campaigns ?? null,
        annual_quota: quota?.annual_quota ?? null,
      }
    : null;

  return { subscription, licensesUsed, phishing };
}
