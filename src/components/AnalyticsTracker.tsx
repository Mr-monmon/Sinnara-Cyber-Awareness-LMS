import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "../lib/analytics";

export function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    const page = `${location.pathname}${location.search}${location.hash}`;
    trackPageView(page);
  }, [location.hash, location.pathname, location.search]);

  return null;
}
