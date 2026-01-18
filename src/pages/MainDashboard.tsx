import { PlatformDashboard } from "./platform-admin/PlatformDashboard";
import { CompanyDashboard } from "./company-admin/CompanyDashboard";
import { LandingPage } from "./LandingPage";
import { EmployeeDashboard } from "./employee/EmployeeDashboard";
import { useAuth } from "../contexts/AuthContext";

const MainDashboard = () => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  switch (user.role) {
    case "PLATFORM_ADMIN":
      return <PlatformDashboard />;
    case "COMPANY_ADMIN":
      return <CompanyDashboard />;
    case "EMPLOYEE":
      return <EmployeeDashboard />;
    default:
      return <LandingPage />;
  }
};

export default MainDashboard;
