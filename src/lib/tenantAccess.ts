import type { Company } from "./types";
import { supabase } from "./supabase";

export const fetchTenantCompanyBySubdomain = async (
  tenantSubdomain: string
): Promise<Company | null> => {
  const { data, error } = await supabase
    .from("company_subdomains")
    .select("*")
    .eq("subdomain", tenantSubdomain)
    .maybeSingle();

  return error ? null : data ?? null;
};
