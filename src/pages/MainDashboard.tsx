import { lazy, Suspense, useEffect, useState } from "react";
import { isMfaMandatory, useAuth } from "../contexts/AuthContext";
import { PolicyConsentModal } from "../components/PolicyConsentModal";
import { TwoFactorSetupModal } from "../components/auth/TwoFactorSetupModal";
import LoadingScreen from "../components/LoadingScreen";
import { supabase } from "../lib/supabase";

const PlatformDashboard = lazy(() =>
  import("./platform-admin/PlatformDashboard").then((m) => ({
    default: m.PlatformDashboard,
  }))
);
const CompanyDashboard = lazy(() =>
  import("./company-admin/CompanyDashboard").then((m) => ({
    default: m.CompanyDashboard,
  }))
);
const EmployeeDashboard = lazy(() =>
  import("./employee/EmployeeDashboard").then((m) => ({
    default: m.EmployeeDashboard,
  }))
);
const LandingPage = lazy(() =>
  import("./LandingPage").then((m) => ({ default: m.LandingPage }))
);

const MainDashboard = () => {
  const { user } = useAuth();
  const [showConsent, setShowConsent] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);

  useEffect(() => {
    setShowConsent(Boolean(user && !user.policy_accepted));
  }, [user]);

  /*
   * Second line of enforcement for mandatory 2FA.
   *
   * The login flow already routes a user with no TOTP factor into setup, but a
   * restored session never passes through it — an account created before 2FA
   * became mandatory, or one that simply stayed signed in, would otherwise keep
   * using the platform unenrolled forever. Re-checking here means the mandate
   * holds on every entry to the dashboard, not just on a fresh sign-in.
   */
  useEffect(() => {
    let cancelled = false;

    const checkEnrolment = async () => {
      if (!isMfaMandatory(user)) {
        if (!cancelled) setShowMfaSetup(false);
        return;
      }
      const { data } = await supabase.auth.mfa.listFactors();
      // Only a verified factor counts: an abandoned half-finished enrolment
      // leaves an unverified factor behind and must not satisfy the mandate.
      const enrolled = (data?.totp ?? []).some((f) => f.status === "verified");
      if (!cancelled) setShowMfaSetup(!enrolled);
    };

    void checkEnrolment();
    return () => { cancelled = true; };
  }, [user]);

  if (!user) {
    return null;
  }

  let dashboard;

  switch (user.role) {
    case "PLATFORM_ADMIN":
      dashboard = <PlatformDashboard />;
      break;
    case "COMPANY_SUPER_ADMIN":
    case "COMPANY_ADMIN":
    case "PHISHING_OPERATOR":
    case "REVIEWER":
      dashboard = <CompanyDashboard />;
      break;
    case "EMPLOYEE":
      dashboard = <EmployeeDashboard />;
      break;
    default:
      dashboard = <LandingPage />;
  }

  // 2FA is resolved before the policy prompt so the account is secured first.
  if (showMfaSetup) {
    return <TwoFactorSetupModal onComplete={() => setShowMfaSetup(false)} />;
  }

  return (
    <>
      {showConsent && (
        <PolicyConsentModal
          onAccept={async () => {
            await supabase
              .from("users")
              .update({
                policy_accepted: true,
                policy_accepted_at: new Date().toISOString(),
              })
              .eq("id", user.id);
            setShowConsent(false);
          }}
        />
      )}
      <Suspense fallback={<LoadingScreen />}>{dashboard}</Suspense>
    </>
  );
};

export default MainDashboard;
