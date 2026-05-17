import { supabase } from "./supabase";

function makeFingerprint(name: string, message: string, stack?: string): string {
  const firstStackLine = (stack ?? "").split("\n").find(l => l.includes("at ")) ?? "";
  const raw = `${name}|${message}|${firstStackLine.trim()}`;
  // Simple non-cryptographic hash — enough for grouping
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) - h) + raw.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

export async function logErrorToSupabase(error: Error, componentStack?: string) {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();

    let user_email: string | null = null;
    let user_role:  string | null = null;
    let company_id: string | null = null;

    if (authUser) {
      const { data: profile } = await supabase
        .from("users")
        .select("email, role, company_id")
        .eq("id", authUser.id)
        .single();
      user_email = profile?.email    ?? null;
      user_role  = profile?.role     ?? null;
      company_id = profile?.company_id ?? null;
    }

    await supabase.from("error_logs").insert({
      user_id:         authUser?.id ?? null,
      company_id,
      user_email,
      user_role,
      error_name:      error.name || "Error",
      error_message:   error.message || "(no message)",
      error_stack:     error.stack ?? null,
      component_stack: componentStack ?? null,
      url:             typeof window !== "undefined" ? window.location.href      : null,
      user_agent:      typeof navigator !== "undefined" ? navigator.userAgent     : null,
      fingerprint:     makeFingerprint(error.name, error.message, error.stack),
    });
  } catch (e) {
    // Never let the error logger itself crash the boundary fallback
    console.error("Failed to log error to Supabase:", e);
  }
}
