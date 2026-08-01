import React, { createContext, useContext, useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import type { User } from "../lib/types";
import { supabase } from "../lib/supabase";
import { fetchTenantCompanyBySubdomain } from "../lib/tenantAccess";
import { extractTenantSubdomain, getHostAccessMode } from "../lib/tenant";
import { captureException, setSentryUser } from "../lib/sentry";
import { isDeviceTrusted, revokeTrustedDevices, trustThisDevice } from "../lib/deviceTrust";

/**
 * Whether this account must have two-factor enabled.
 *
 * Employees are always in scope: they are the population targeted by phishing
 * simulations, so their accounts are the ones a compromised password matters
 * most for. Other roles opt in through the `mfa_enforced` profile flag, which
 * company admins control.
 */
export function isMfaMandatory(profile: { role?: string | null; mfa_enforced?: boolean | null } | null): boolean {
  if (!profile) return false;
  return profile.role === "EMPLOYEE" || profile.mfa_enforced === true;
}

export type LoginResult =
  | "success"
  | "invalid_credentials"
  | "wrong_tenant"
  | "mfa_required"
  | "mfa_setup_required"
  | "force_password_change";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  forcePasswordChange: boolean;
  mfaRequired: boolean;
  mfaFactorId: string | null;
  /**
   * True when the signed-in account must enrol a TOTP factor before it can use
   * the platform. Set during login so the forced-password-change step knows to
   * chain straight into 2FA setup instead of dropping the user on the dashboard.
   */
  mfaSetupRequired: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  verifyMfa: (code: string) => Promise<{ ok: boolean; error?: string }>;
  changePassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  enrollTotp: () => Promise<{ qrCode: string; secret: string; factorId: string } | null>;
  verifyTotpEnrollment: (factorId: string, code: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfile(userId: string): Promise<User | null> {
  try {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaSetupRequired, setMfaSetupRequired] = useState(false);

  useEffect(() => {
    const syncUserFromSession = async (session: Session | null) => {
      if (!session?.user) {
        setUser(null);
        setSentryUser(null);
        return;
      }

      const profile = await fetchProfile(session.user.id);

      if (profile?.is_active === false) {
        await supabase.auth.signOut();
        setUser(null);
        setSentryUser(null);
        return;
      }

      setUser(profile);
      if (profile) setSentryUser({ id: profile.id, email: profile.email, role: profile.role });
    };

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        await syncUserFromSession(session);
      } catch {
        // Session restore failed — continue as logged out
      } finally {
        setLoading(false);
      }
    };

    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncUserFromSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<LoginResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return "invalid_credentials";
    }

    // Check MFA assurance level
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsChallenge =
      aalData && aalData.nextLevel === "aal2" && aalData.currentLevel === "aal1";

    if (needsChallenge) {
      // A browser that passed a challenge within the trust window (15 days) is
      // let through without re-entering a code. The session stays at aal1 — no
      // policy in this schema requires aal2, and the check is server-side and
      // keyed on auth.uid(), so a forged device id cannot buy a skip.
      const trusted = await isDeviceTrusted();
      if (!trusted) {
        // Get the factor ID
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const totp = factorsData?.totp?.[0] ?? null;
        setMfaFactorId(totp?.id ?? null);
        setMfaRequired(true);
        return "mfa_required";
      }
    }

    const profile = data.user ? await fetchProfile(data.user.id) : null;

    const currentUrl = new URL(window.location.href);
    const hostMode = getHostAccessMode(currentUrl.hostname);
    const tenantSubdomain = extractTenantSubdomain(currentUrl.hostname);

    if (hostMode === "tenant" && tenantSubdomain) {
      const company = await fetchTenantCompanyBySubdomain(tenantSubdomain);

      if (!company || profile?.company_id !== company.id) {
        await supabase.auth.signOut();
        setUser(null);
        return "wrong_tenant";
      }
    }

    // Resolve the outstanding 2FA enrolment up front, because the forced
    // password change below has to know whether to chain into 2FA setup once
    // the new password is saved. The mandated order for a first login is:
    // change password → enrol 2FA → (dashboard, where the exam gate takes over).
    let needsMfaEnrolment = false;
    if (isMfaMandatory(profile)) {
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        // "Couldn't check" must not become "not enrolled": that would push an
        // already-enrolled user into a setup flow they cannot dismiss. Let them
        // in and re-check on the next sign-in, but make the failure visible.
        console.error("[auth] listFactors failed during login; skipping 2FA enrolment gate:", factorsError.message, factorsError);
        captureException(factorsError, { scope: "AuthContext.login.listFactors", userId: profile?.id });
      } else {
        // Only a verified factor satisfies the mandate; an abandoned enrolment
        // leaves an unverified one behind.
        needsMfaEnrolment = (factorsData?.totp ?? []).every((f) => f.status !== "verified");
      }
    }
    setMfaSetupRequired(needsMfaEnrolment);

    if (profile?.requires_password_change) {
      setForcePasswordChange(true);
      setUser(profile);
      return "force_password_change";
    }

    if (needsMfaEnrolment) {
      setUser(profile);
      return "mfa_setup_required";
    }

    setUser(profile);
    return "success";
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSentryUser(null);
    setForcePasswordChange(false);
    setMfaRequired(false);
    setMfaFactorId(null);
    setMfaSetupRequired(false);
  };

  const verifyMfa = async (code: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) return { ok: false, error: factorsError.message };

      const totp = factorsData?.totp?.[0] ?? null;
      const factorId = totp?.id ?? mfaFactorId;
      if (!factorId) return { ok: false, error: "No MFA factor found" };

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challengeData) return { ok: false, error: challengeError?.message ?? "Challenge failed" };

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) return { ok: false, error: verifyError.message };

      // The code was correct, so this browser has proven possession of the
      // factor and may skip the challenge until the trust window lapses.
      await trustThisDevice();

      // MFA succeeded — load profile
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const profile = await fetchProfile(authUser.id);
        setUser(profile);
      }
      setMfaRequired(false);
      setMfaFactorId(null);
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return { ok: false, error: msg };
    }
  };

  const changePassword = async (newPassword: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) return { ok: false, error: updateError.message };

      if (user?.id) {
        await supabase.from("users").update({ requires_password_change: false }).eq("id", user.id);
        setUser((prev) => prev ? { ...prev, requires_password_change: false } : prev);
      }

      setForcePasswordChange(false);
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return { ok: false, error: msg };
    }
  };

  const enrollTotp = async (): Promise<{ qrCode: string; secret: string; factorId: string } | null> => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Awareone",
        friendlyName: `Awareone-${Date.now()}`,
      });
      if (error || !data) return null;
      return {
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        factorId: data.id,
      };
    } catch {
      return null;
    }
  };

  const verifyTotpEnrollment = async (factorId: string, code: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challengeData) return { ok: false, error: challengeError?.message ?? "Challenge failed" };

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) return { ok: false, error: verifyError.message };

      // A fresh factor invalidates trust granted against the previous one; the
      // browser doing the enrolment then earns the window it just proved.
      await revokeTrustedDevices();
      await trustThisDevice();
      setMfaSetupRequired(false);
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return { ok: false, error: msg };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        forcePasswordChange,
        mfaRequired,
        mfaFactorId,
        mfaSetupRequired,
        login,
        logout,
        verifyMfa,
        changePassword,
        enrollTotp,
        verifyTotpEnrollment,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
