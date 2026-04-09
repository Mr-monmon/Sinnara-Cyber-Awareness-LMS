import ReactGA from "react-ga4";

const analyticsId = import.meta.env.VITE_GOOGLE_ANALYTICS_ID?.trim();

let isInitialized = false;
let lastTrackedPath: string | null = null;

function initializeAnalytics() {
  if (!analyticsId || isInitialized || typeof window === "undefined") {
    return false;
  }

  ReactGA.initialize(analyticsId);
  isInitialized = true;

  return true;
}

export function trackPageView(path: string, title = document.title) {
  if (!analyticsId || typeof window === "undefined") {
    return;
  }

  if (!isInitialized && !initializeAnalytics()) {
    return;
  }

  if (lastTrackedPath === path) {
    return;
  }

  ReactGA.send({ hitType: "pageview", page: path, title });
  lastTrackedPath = path;
}
