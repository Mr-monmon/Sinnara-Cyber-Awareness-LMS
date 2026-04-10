import { buildApexUrl, extractTenantSubdomain, getHostAccessMode, isProtectedPath } from "./lib/tenant";

interface AssetFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface Env {
  ASSETS: AssetFetcher;
}

const redirectTo = (targetUrl: string) => Response.redirect(targetUrl, 302);

export default {
  async fetch(request: Request, env: Env) {
    const requestUrl = new URL(request.url);

    if (!isProtectedPath(requestUrl.pathname)) {
      return env.ASSETS.fetch(request);
    }

    const hostMode = getHostAccessMode(requestUrl.hostname);

    if (hostMode === "invalid") {
      return redirectTo(buildApexUrl(requestUrl, "/"));
    }

    if (hostMode === "tenant") {
      const tenantSubdomain = extractTenantSubdomain(requestUrl.hostname);

      if (!tenantSubdomain) {
        return redirectTo(buildApexUrl(requestUrl, "/"));
      }
    }

    return env.ASSETS.fetch(request);
  },
};
