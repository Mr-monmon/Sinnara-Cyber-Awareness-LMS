import type { Company } from "./types";
import { supabase } from "./supabase";

/**
 * Result of resolving a tenant subdomain.
 *  - status "ok"       → an active tenant company was found.
 *  - status "inactive" → the tenant exists but the company/subdomain is disabled
 *                        (caller should render a "blocked" state).
 *  - status "unknown"  → no tenant maps to this subdomain (clean 404-style error).
 */
export type TenantResolution =
  | { status: "ok"; company: Company }
  | { status: "inactive"; company: Company }
  | { status: "unknown"; company: null };

interface TenantRow {
  id: string;
  name: string;
  subdomain: string;
  is_primary: boolean;
  is_active: boolean;
  package_type: string | null;
  license_limit: number | null;
}

/**
 * Resolve a tenant by subdomain via the curated `tenant_companies` view, which
 * joins company_subdomains → companies and exposes ONLY public identity fields.
 * We never select the raw mapping table and treat it as a Company.
 */
export const resolveTenantBySubdomain = async (
  tenantSubdomain: string
): Promise<TenantResolution> => {
  const { data, error } = await supabase
    .from("tenant_companies")
    .select("id, name, subdomain, is_primary, is_active, package_type, license_limit")
    .eq("subdomain", tenantSubdomain.toLowerCase())
    .maybeSingle<TenantRow>();

  if (error || !data) return { status: "unknown", company: null };

  const company: Company = {
    id: data.id,
    name: data.name,
    subdomain: data.subdomain,
    is_active: data.is_active,
    package_type: data.package_type ?? undefined,
    license_limit: data.license_limit ?? undefined,
  };

  return data.is_active
    ? { status: "ok", company }
    : { status: "inactive", company };
};

/**
 * Backward-compatible helper: returns the company only when the tenant is
 * active, otherwise null. Prefer `resolveTenantBySubdomain` for blocked-state UI.
 */
export const fetchTenantCompanyBySubdomain = async (
  tenantSubdomain: string
): Promise<Company | null> => {
  const res = await resolveTenantBySubdomain(tenantSubdomain);
  return res.status === "ok" ? res.company : null;
};
