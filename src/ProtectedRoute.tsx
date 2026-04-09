import { Navigate, Outlet } from "react-router-dom";

import { ExternalRedirect } from "./components/ExternalRedirect";
import { useAuth } from "./contexts/AuthContext";
import { useTenantAccess } from "./hooks/useTenantAccess";
import { buildApexRedirectUrl } from "./lib/browserTenant";
import LoadingScreen from "./components/LoadingScreen";

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const { company, hostMode, loading: tenantLoading } = useTenantAccess();

  const apexHomeUrl = buildApexRedirectUrl(window.location.href, "/");

  if (loading || tenantLoading) {
    return <LoadingScreen />;
  }

  if (hostMode === "invalid") {
    return <ExternalRedirect to={apexHomeUrl} />;
  }

  if (hostMode === "tenant") {
    if (!company) {
      return <ExternalRedirect to={apexHomeUrl} />;
    }

    if (!user) {
      return <Navigate to="/login" replace />;
    }

    if (user.role === "PLATFORM_ADMIN") {
      return <Outlet />;
    }

    if (user.company_id !== company.id) {
      return <ExternalRedirect to={apexHomeUrl} />;
    }

    return <Outlet />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "PLATFORM_ADMIN") {
    return <ExternalRedirect to={apexHomeUrl} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
