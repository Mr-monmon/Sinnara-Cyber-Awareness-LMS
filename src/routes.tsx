import { lazy, Suspense } from "react";
import { Navigate, RouteObject } from "react-router-dom";

import { HomeRoute, LoginRoute } from "./components/HostAwarePublicRoutes";
import { RouteShell } from "./components/RouteShell";
import LoadingScreen from "./components/LoadingScreen";
import ProtectedRoute from "./ProtectedRoute";

const PublicFraudAlertsPage = lazy(() =>
  import("./pages/PublicFraudAlertsPage").then((m) => ({
    default: m.PublicFraudAlertsPage,
  }))
);
const PublicAssessment = lazy(() =>
  import("./pages/PublicAssessment").then((m) => ({
    default: m.PublicAssessment,
  }))
);
const MainDashboard = lazy(() => import("./pages/MainDashboard"));
const PublicResourcesPage = lazy(() =>
  import("./pages/PublicResourcesPage").then((m) => ({
    default: m.PublicResourcesPage,
  }))
);
const LegalPage = lazy(() =>
  import("./pages/LegalPage").then((m) => ({ default: m.LegalPage }))
);

const withSuspense = (node: React.ReactNode) => (
  <Suspense fallback={<LoadingScreen />}>{node}</Suspense>
);

const routes: RouteObject[] = [
  {
    element: <RouteShell />,
    children: [
      { path: "/", element: <HomeRoute /> },
      { path: "/assessment", element: withSuspense(<PublicAssessment />) },
      { path: "/fraud-alerts", element: withSuspense(<PublicFraudAlertsPage />) },
      { path: "/login", element: <LoginRoute /> },
      { path: "/resources", element: withSuspense(<PublicResourcesPage />) },
      { path: "/legal", element: withSuspense(<LegalPage />) },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "/dashboard", element: withSuspense(<MainDashboard />) },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];

export default routes;
