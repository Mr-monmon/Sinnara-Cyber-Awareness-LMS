import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * `React.lazy` that heals a stale code-split chunk instead of crashing.
 *
 * The app is served as a single-page app: any path that is not a real file
 * falls back to index.html. After a redeploy the hashed chunk names change, so
 * a browser still holding the previous index.html requests a chunk
 * (`PhishingEmailTemplatesPage-DQKnr0eM.js`) that no longer exists — and the SPA
 * fallback answers it with index.html. The browser refuses that as a module
 * script:
 *
 *     Failed to load module script: expected a JavaScript module but the server
 *     responded with a MIME type of "text/html"
 *
 * and the lazy page dies with "Cannot read properties of undefined". The user
 * sees a page that simply will not open, and it recurs for every lazy route
 * whose chunk changed in the deploy — until they happen to hard-refresh.
 *
 * The fix is the standard one: on a failed dynamic import, reload the page once
 * so the browser fetches the current index.html and its chunk map. A timestamp
 * in sessionStorage bounds it to one reload per short window, so a genuinely
 * missing module (a real 404, an offline device) surfaces the error boundary
 * rather than reloading forever.
 */
const RELOAD_KEY = "aw-chunk-reload-at";
const RELOAD_WINDOW_MS = 10_000;

// `any` in the component's props here, deliberately: this wraps pages with many
// different (and sometimes implicit-{}) prop types, exactly as React.lazy does.
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((err: unknown) => {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      const now = Date.now();
      if (now - last > RELOAD_WINDOW_MS) {
        sessionStorage.setItem(RELOAD_KEY, String(now));
        window.location.reload();
        // Never resolve: nothing should render in the instant before the reload
        // takes effect, and resolving with a stub would flash wrong content.
        return new Promise<{ default: T }>(() => {});
      }
      // Already reloaded once and still failing — this is a real error, not
      // deploy skew. Let the error boundary handle it.
      throw err;
    }),
  );
}
