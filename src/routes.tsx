import { Navigate, RouteObject } from "react-router-dom";

import { LandingPage } from "./pages/LandingPage";
import { PublicFraudAlertsPage } from "./pages/PublicFraudAlertsPage";
import { PublicAssessment } from "./pages/PublicAssessment";
import { LoginPage } from "./pages/LoginPage";
import MainDashboard from "./pages/MainDashboard";
import ProtectedRoute from "./ProtectedRoute";
import { PublicResourcesPage } from "./pages/PublicResourcesPage";

const routes: RouteObject[] = [
  { path: "/", element: <LandingPage /> },
  { path: "/assessment", element: <PublicAssessment /> },
  { path: "/fraud", element: <PublicFraudAlertsPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/resources", element: <PublicResourcesPage /> },
  {
    element: <ProtectedRoute />,
    children: [{ path: "/dashboard", element: <MainDashboard /> }],
  },

  { path: "*", element: <Navigate to="/" replace /> },
];

export default routes;
