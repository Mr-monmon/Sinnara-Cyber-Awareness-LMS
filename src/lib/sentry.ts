import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE ?? "production",
    release:     import.meta.env.VITE_APP_VERSION as string | undefined,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.1,
    // Don't report noise from browser extensions or network blips
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      "Network request failed",
      "Failed to fetch",
      "Load failed",
    ],
    beforeSend(event) {
      // Strip auth tokens from request headers if accidentally captured
      if (event.request?.headers) {
        delete (event.request.headers as Record<string, string>)["Authorization"];
      }
      return event;
    },
  });
}

/** Report an error to Sentry. No-op if DSN is not configured. */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Set the active user in Sentry for all subsequent events. Pass null on logout. */
export function setSentryUser(
  user: { id: string; email?: string; role?: string } | null,
): void {
  if (!dsn) return;
  Sentry.setUser(user);
}

/** Add a navigation breadcrumb. */
export function addBreadcrumb(
  message: string,
  category = "app",
  data?: Record<string, unknown>,
): void {
  if (!dsn) return;
  Sentry.addBreadcrumb({ message, category, data, level: "info" });
}

export { Sentry };
