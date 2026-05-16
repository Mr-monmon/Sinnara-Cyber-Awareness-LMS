import { supabase } from "./supabase";

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
}

export async function getActiveSubscription(companyId: string): Promise<SubscriptionInfo | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("id, status, subscription_type, start_date, end_date, license_count")
    .eq("company_id", companyId)
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const end = new Date(data.end_date).getTime();
  const now = Date.now();
  const days_remaining = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

  return {
    ...data,
    status: data.status as SubscriptionInfo["status"],
    days_remaining,
    expires_soon: days_remaining > 0 && days_remaining <= 30,
    expired: days_remaining <= 0,
  };
}

export async function countCompanyEmployees(companyId: string): Promise<number> {
  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("role", "EMPLOYEE");
  return count ?? 0;
}
