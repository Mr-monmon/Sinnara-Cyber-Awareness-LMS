import { Suspense } from "react";
import { lazyWithReload } from "./lib/lazyWithReload";
import { Navigate, RouteObject } from "react-router-dom";

import { HomeRoute, LoginRoute } from "./components/HostAwarePublicRoutes";
import { RouteShell } from "./components/RouteShell";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
import LoadingScreen from "./components/LoadingScreen";
import ProtectedRoute from "./ProtectedRoute";

const PublicFraudAlertsPage = lazyWithReload(() =>
  import("./pages/PublicFraudAlertsPage").then((m) => ({
    default: m.PublicFraudAlertsPage,
  }))
);
const PublicAssessment = lazyWithReload(() =>
  import("./pages/PublicAssessment").then((m) => ({
    default: m.PublicAssessment,
  }))
);
const MainDashboard = lazyWithReload(() => import("./pages/MainDashboard"));
const PublicResourcesPage = lazyWithReload(() =>
  import("./pages/PublicResourcesPage").then((m) => ({
    default: m.PublicResourcesPage,
  }))
);
const LegalPage = lazyWithReload(() =>
  import("./pages/LegalPage").then((m) => ({ default: m.LegalPage }))
);

const withSuspense = (node: React.ReactNode) => (
  <Suspense fallback={<LoadingScreen />}>{node}</Suspense>
);

const routes: RouteObject[] = [
  {
    element: <RouteShell />,
    errorElement: <RouteErrorBoundary />,
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
