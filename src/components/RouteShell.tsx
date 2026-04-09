import { Outlet } from "react-router-dom";
import { AnalyticsTracker } from "./AnalyticsTracker";

export function RouteShell() {
  return (
    <>
      <AnalyticsTracker />
      <Outlet />
    </>
  );
}
