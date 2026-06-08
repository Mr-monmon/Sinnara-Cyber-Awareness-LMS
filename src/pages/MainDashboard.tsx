import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { PolicyConsentModal } from "../components/PolicyConsentModal";
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

  useEffect(() => {
    setShowConsent(Boolean(user && !user.policy_accepted));
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
