import React, { createContext, useContext, useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import type { User } from "../lib/types";
import { supabase } from "../lib/supabase";
import { fetchTenantCompanyBySubdomain } from "../lib/tenantAccess";
import { extractTenantSubdomain, getHostAccessMode } from "../lib/tenant";

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

  useEffect(() => {
    const syncUserFromSession = async (session: Session | null) => {
      if (!session?.user) {
        setUser(null);
        return;
      }

      const profile = await fetchProfile(session.user.id);
      setUser(profile);
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
    if (aalData && aalData.nextLevel === "aal2" && aalData.currentLevel === "aal1") {
      // Get the factor ID
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totp = factorsData?.totp?.[0] ?? null;
      setMfaFactorId(totp?.id ?? null);
      setMfaRequired(true);
      return "mfa_required";
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

    if (profile?.requires_password_change) {
      setForcePasswordChange(true);
      setUser(profile);
      return "force_password_change";
    }

    // If MFA is enforced but user has no enrolled TOTP factor yet, require setup
    if (profile?.mfa_enforced) {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const hasTotp = (factorsData?.totp?.length ?? 0) > 0;
      if (!hasTotp) {
        setUser(profile);
        return "mfa_setup_required";
      }
    }

    setUser(profile);
    return "success";
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setForcePasswordChange(false);
    setMfaRequired(false);
    setMfaFactorId(null);
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
