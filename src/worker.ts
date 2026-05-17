import { buildApexUrl, extractTenantSubdomain, getHostAccessMode, isProtectedPath } from "./lib/tenant";

interface AssetFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface Env {
  ASSETS: AssetFetcher;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_GOOGLE_ANALYTICS_ID?: string;
  VITE_SITE_URL_LOGIN?: string;
}

const RUNTIME_ENV_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_GOOGLE_ANALYTICS_ID",
  "VITE_SITE_URL_LOGIN",
] as const;

const redirectTo = (targetUrl: string) => Response.redirect(targetUrl, 302);

const escapeForScript = (value: string) =>
  value.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

async function injectRuntimeEnv(response: Response, env: Env): Promise<Response> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) {
    return response;
  }

  const runtimeEnv: Record<string, string> = {};
  for (const key of RUNTIME_ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string" && value.length > 0) {
      runtimeEnv[key] = value;
    }
  }

  const payload = escapeForScript(JSON.stringify(runtimeEnv));
  const scriptTag = `<script>window.__ENV__=${payload};</script>`;

  const html = await response.text();
  const injected = html.includes("</head>")
    ? html.replace("</head>", `${scriptTag}</head>`)
    : `${scriptTag}${html}`;

  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env) {
    const requestUrl = new URL(request.url);

    if (isProtectedPath(requestUrl.pathname)) {
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
    }

    const response = await env.ASSETS.fetch(request);
    return injectRuntimeEnv(response, env);
  },
};
