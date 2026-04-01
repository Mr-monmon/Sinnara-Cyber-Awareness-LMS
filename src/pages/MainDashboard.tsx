import { PlatformDashboard } from "./platform-admin/PlatformDashboard";
import { CompanyDashboard } from "./company-admin/CompanyDashboard";
import { LandingPage } from "./LandingPage";
import { EmployeeDashboard } from "./employee/EmployeeDashboard";
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useState } from "react";
import { PolicyConsentModal } from "../components/PolicyConsentModal";
import { supabase } from "../lib/supabase";

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
    case "COMPANY_ADMIN":
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
      {dashboard}
    </>
  );
};

export default MainDashboard;
