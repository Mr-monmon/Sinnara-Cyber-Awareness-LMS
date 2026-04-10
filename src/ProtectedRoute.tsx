import { Navigate, Outlet } from "react-router-dom";

import { ExternalRedirect } from "./components/ExternalRedirect";
import LoadingScreen from "./components/LoadingScreen";
import { useAuth } from "./contexts/AuthContext";
import { useTenantAccess } from "./hooks/useTenantAccess";
import {
  buildApexRedirectUrl
} from "./lib/browserTenant";

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const { company, hostMode, loading: tenantLoading } = useTenantAccess();

  const currentUrl = window.location.href;
  const apexHomeUrl = buildApexRedirectUrl(currentUrl, "/");

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

    if (user.company_id !== company.id) {
      return <ExternalRedirect to={apexHomeUrl} />;
    }

    return <Outlet />;
  }

  if (hostMode === "admin") {
    if (!user) {
      return <Navigate to="/login" replace />;
    }

    if (user.role !== "PLATFORM_ADMIN") {
      return <ExternalRedirect to={apexHomeUrl} />;
    }

    return <Outlet />;
  }

  return <ExternalRedirect to={apexHomeUrl} />;
};

export default ProtectedRoute;
