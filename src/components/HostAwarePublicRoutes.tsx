import { Navigate } from "react-router-dom";

import LoadingScreen from "./LoadingScreen";
import { ExternalRedirect } from "./ExternalRedirect";
import { useAuth } from "../contexts/AuthContext";
import { useTenantAccess } from "../hooks/useTenantAccess";
import { buildApexRedirectUrl } from "../lib/browserTenant";
import { LandingPage } from "../pages/LandingPage";
import { LoginPage } from "../pages/LoginPage";

export const HomeRoute = () => {
  const { hostMode } = useTenantAccess();

  if (hostMode === "admin") {
    return <Navigate to="/login" replace />;
  }

  return <LandingPage />;
};

export const LoginRoute = () => {
  const { user, loading } = useAuth();
  const { company, hostMode, loading: tenantLoading } = useTenantAccess();

  const currentUrl = window.location.href;
  const apexHomeUrl = buildApexRedirectUrl(currentUrl, "/");

  if (loading || tenantLoading) {
    return <LoadingScreen />;
  }

  if (hostMode === "invalid" || hostMode === "apex") {
    return <ExternalRedirect to={apexHomeUrl} />;
  }

  if (hostMode === "tenant" && !company) {
    return <ExternalRedirect to={apexHomeUrl} />;
  }

  if (user?.role === "PLATFORM_ADMIN") {
    if (hostMode === "admin") {
      return <Navigate to="/dashboard" replace />;
    }
  }

  if (hostMode === "tenant" && company && user?.company_id === company.id) {
    return <Navigate to="/dashboard" replace />;
  }

  if (
    hostMode === "tenant" &&
    company &&
    user &&
    user.company_id !== company.id
  ) {
    return <ExternalRedirect to={apexHomeUrl} />;
  }

  return (
    <LoginPage
      backTo={hostMode === "admin" ? apexHomeUrl : "/"}
      backLabel={hostMode === "admin" ? "Back to Website" : "Back to Home"}
    />
  );
};
