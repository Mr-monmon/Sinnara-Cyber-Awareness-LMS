import { Navigate, RouteObject } from "react-router-dom";

import { HomeRoute, LoginRoute } from "./components/HostAwarePublicRoutes";
import { RouteShell } from "./components/RouteShell";
import { PublicFraudAlertsPage } from "./pages/PublicFraudAlertsPage";
import { PublicAssessment } from "./pages/PublicAssessment";
import MainDashboard from "./pages/MainDashboard";
import ProtectedRoute from "./ProtectedRoute";
import { PublicResourcesPage } from "./pages/PublicResourcesPage";
import { LegalPage } from "./pages/LegalPage";

const routes: RouteObject[] = [
  {
    element: <RouteShell />,
    children: [
      { path: "/", element: <HomeRoute /> },
      { path: "/assessment", element: <PublicAssessment /> },
      { path: "/fraud-alerts", element: <PublicFraudAlertsPage /> },
      { path: "/login", element: <LoginRoute /> },
      { path: "/resources", element: <PublicResourcesPage /> },
      { path: "/legal", element: <LegalPage /> },
      {
        element: <ProtectedRoute />,
        children: [{ path: "/dashboard", element: <MainDashboard /> }],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];

export default routes;
