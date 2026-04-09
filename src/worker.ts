import { buildApexUrl, extractTenantSubdomain, getHostAccessMode, isProtectedPath } from "./lib/tenant";

interface AssetFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface Env {
  ASSETS: AssetFetcher;
}

const redirectTo = (targetUrl: string) => Response.redirect(targetUrl, 302);

const ensureTenantQuery = (requestUrl: URL, tenantSubdomain: string) => {
  const redirectUrl = new URL(requestUrl.toString());
  redirectUrl.searchParams.set("tenant", tenantSubdomain);
  return redirectUrl.toString();
};

const removeTenantQuery = (requestUrl: URL) => {
  const redirectUrl = new URL(requestUrl.toString());
  redirectUrl.searchParams.delete("tenant");
  return redirectUrl.toString();
};

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

      const queryTenant = requestUrl.searchParams.get("tenant")?.trim().toLowerCase();

      if (queryTenant !== tenantSubdomain) {
        return redirectTo(ensureTenantQuery(requestUrl, tenantSubdomain));
      }
    } else if (requestUrl.searchParams.has("tenant")) {
      return redirectTo(removeTenantQuery(requestUrl));
    }

    return env.ASSETS.fetch(request);
  },
};
