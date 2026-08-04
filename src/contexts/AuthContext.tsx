import React, { createContext, useContext, useState, useEffect, useRef } from "react";
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

/**
 * Does this account still owe us a TOTP enrolment?
 *
 * Shared by `login()` and by session restore so both answer the question the
 * same way. A failed lookup deliberately reports "no gap": "couldn't check"
 * must not become "not enrolled", which would push an already-enrolled user
 * into a setup flow they cannot dismiss. The failure is logged and re-checked
 * on the next sign-in.
 */
async function resolveMfaEnrolmentGap(
  profile: { role?: string | null; mfa_enforced?: boolean | null; id?: string } | null,
): Promise<boolean> {
  if (!isMfaMandatory(profile)) return false;
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    console.error("[auth] listFactors failed; skipping 2FA enrolment gate:", error.message, error);
    captureException(error, { scope: "AuthContext.resolveMfaEnrolmentGap", userId: profile?.id });
    return false;
  }
  // Only a verified factor satisfies the mandate; an abandoned enrolment leaves
  // an unverified one behind.
  return (data?.totp ?? []).every((f) => f.status !== "verified");
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

  /*
   * True while a password change is being written.
   *
   * `supabase.auth.updateUser({ password })` fires a USER_UPDATED event, which
   * runs the session-restore handler below. At that moment the profile's
   * `requires_password_change` is still true — clearing it is the *next*
   * statement — so the handler reads a stale value and raises the gate again,
   * often after the local flag has already been lowered. The user changed their
   * password, reached the dashboard, and was immediately asked to change it
   * again; refreshing repeated it indefinitely.
   *
   * A ref rather than state: this must be readable by the event handler
   * synchronously, without waiting for a re-render.
   */
  const passwordChangeInFlight = useRef(false);

  useEffect(() => {
    const syncUserFromSession = async (session: Session | null) => {
      if (!session?.user) {
        setUser(null);
        setSentryUser(null);
        setForcePasswordChange(false);
        setMfaSetupRequired(false);
        return;
      }

      const profile = await fetchProfile(session.user.id);

      if (profile?.is_active === false) {
        await supabase.auth.signOut();
        setUser(null);
        setSentryUser(null);
        setForcePasswordChange(false);
        setMfaSetupRequired(false);
        return;
      }

      setUser(profile);
      if (profile) setSentryUser({ id: profile.id, email: profile.email, role: profile.role });

      /*
       * Re-derive the onboarding gates on every session restore.
       *
       * These used to be set only by `login()`, which made them survive exactly
       * as long as the login page did. A first-time employee who pressed refresh
       * on the "change your password" screen — or opened /dashboard in a new tab
       * — came back with a valid session, both flags cleared, and full access to
       * the platform still holding the password that was emailed to them and
       * with no second factor enrolled.
       *
       * Deriving them from the profile means the gate is a property of the
       * account, not of the page the user happens to be on.
       */
      if (!passwordChangeInFlight.current) {
        setForcePasswordChange(profile?.requires_password_change === true);
      }
      setMfaSetupRequired(await resolveMfaEnrolmentGap(profile));
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
    const needsMfaEnrolment = await resolveMfaEnrolmentGap(profile);
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
    passwordChangeInFlight.current = true;
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) return { ok: false, error: updateError.message };

      if (user?.id) {
        /*
         * `.select()` is not decoration. An UPDATE that matches no rows — which
         * is what RLS produces when the policy does not admit the row — returns
         * success with no error. Without asking for the changed row back there
         * is no way to tell "cleared" from "silently did nothing", and the
         * latter puts the user in a permanent loop: the gate re-derives from the
         * profile on every session restore and the flag never goes down.
         */
        const { data: updatedRows, error: profileError } = await supabase
          .from("users")
          .update({ requires_password_change: false })
          .eq("id", user.id)
          .select("id");

        if (!profileError && (updatedRows?.length ?? 0) === 0) {
          const msg =
            "Your password was changed, but the account could not be marked as updated, " +
            "so you may be asked again. Please contact your administrator.";
          console.error("[auth] clearing requires_password_change matched no rows for", user.id);
          captureException(new Error("requires_password_change update matched no rows"), {
            scope: "AuthContext.changePassword.noRows",
            userId: user.id,
          });
          return { ok: false, error: msg };
        }

        if (profileError) {
          // The auth password did change, so this is not a failed change — but
          // leaving the flag set means the user is asked to change it again on
          // the next login, which looks like the save silently failed.
          console.error("[auth] password changed but clearing requires_password_change failed:", profileError.message, profileError);
          captureException(profileError, { scope: "AuthContext.changePassword.clearFlag", userId: user.id });
        }
        setUser((prev) => prev ? { ...prev, requires_password_change: false } : prev);
      }

      /*
       * A new password invalidates every remembered browser.
       *
       * Otherwise an attacker who obtained the old password and had once passed
       * a challenge keeps a 2FA-free path in on that browser for the rest of the
       * trust window. This is done here rather than by a database trigger
       * because the password lives in `auth.users` and this schema has no column
       * whose change a trigger could key off.
       */
      await revokeTrustedDevices();

      // Lower the gate itself, not just the profile field it derives from — the
      // route guard reads this flag on every render.
      setForcePasswordChange(false);
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return { ok: false, error: msg };
    } finally {
      // Released only now: a USER_UPDATED event arriving mid-write must not be
      // able to re-raise the gate from the value we are in the middle of clearing.
      passwordChangeInFlight.current = false;
    }
  };

  const enrollTotp = async (): Promise<{ qrCode: string; secret: string; factorId: string } | null> => {
    try {
      /*
       * Clear out abandoned enrolments before starting a new one.
       *
       * Every call mints a fresh factor with a unique friendly name, and an
       * enrolment the user walks away from leaves an unverified factor behind
       * forever. Since 2FA setup is now mandatory and non-dismissible, those
       * accumulate on exactly the accounts that keep retrying — until the
       * per-user factor cap is hit and `enroll` starts failing outright, which
       * strands the user on an unskippable modal. Unverified factors carry no
       * value, so removing them is safe.
       */
      const { data: existing, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        console.warn("[auth] could not list factors before enrolling:", listError.message);
      } else {
        const stale = (existing?.totp ?? []).filter((f) => f.status !== "verified");
        for (const factor of stale) {
          const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
          if (unenrollError) {
            console.warn("[auth] could not remove an unverified factor:", factor.id, unenrollError.message);
          }
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Awareone",
        friendlyName: `Awareone-${Date.now()}`,
      });
      if (error || !data) {
        // The modal shows a retry, but without this the underlying cause of a
        // repeated failure (factor cap, rate limit, project config) is invisible.
        console.error("[auth] TOTP enrolment failed:", error?.message, error);
        captureException(error ?? new Error("mfa.enroll returned no data"), { scope: "AuthContext.enrollTotp" });
        return null;
      }
      return {
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        factorId: data.id,
      };
    } catch (err) {
      console.error("[auth] TOTP enrolment threw:", err);
      captureException(err, { scope: "AuthContext.enrollTotp" });
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
