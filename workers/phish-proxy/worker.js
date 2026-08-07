/**
 * phish-proxy — reverse proxy from a custom phishing domain to Supabase functions.
 *
 * One Worker serves every phishing domain, shared and per-company alike. Each
 * domain is a Cloudflare zone with a route (`*domain/*`) pointing here; this
 * Worker forwards the request, unchanged in path and query, to the Supabase
 * Edge Functions origin. The recipient's browser only ever sees the phishing
 * domain; Supabase is invisible.
 *
 * It forwards ONLY the two public tracking endpoints. Everything else gets a
 * bare 404, so the domain cannot be turned into an open proxy to the rest of the
 * Supabase project (auth, other functions, the REST API).
 *
 * Environment (set as Worker vars/secrets — see workers/phish-proxy/README.md):
 *   SUPABASE_FUNCTIONS_ORIGIN  e.g. https://abcdefgh.supabase.co
 *   SUPABASE_ANON_KEY          the project's publishable anon key (public)
 */

const ALLOWED_PATHS = new Set([
  "/functions/v1/phishing-track",
  "/functions/v1/serve-landing-page",
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only the two recipient-facing endpoints are proxied. A campaign link is
    // always one of these; anything else is either a probe or a mistake.
    if (!ALLOWED_PATHS.has(url.pathname)) {
      return new Response("Not found", { status: 404 });
    }

    const origin = (env.SUPABASE_FUNCTIONS_ORIGIN || "").replace(/\/+$/, "");
    if (!origin) {
      // Misconfiguration should fail visibly in logs, not silently mislabel a
      // real recipient's click as an error page they'll report to IT.
      console.error("[phish-proxy] SUPABASE_FUNCTIONS_ORIGIN is not set");
      return new Response("Service unavailable", { status: 502 });
    }

    const target = origin + url.pathname + url.search;

    const headers = new Headers(request.headers);
    /*
     * The Supabase gateway wants an apikey even for verify_jwt=false functions.
     * The anon key is public (it ships in the browser bundle), so injecting it
     * here exposes nothing — it only lets the gateway route the request. Without
     * it every forwarded call is rejected before reaching the function.
     */
    if (env.SUPABASE_ANON_KEY) headers.set("apikey", env.SUPABASE_ANON_KEY);
    // Preserve the domain the recipient actually used, in case a function ever
    // needs to know it. Also drop hop-by-hop headers Cloudflare manages.
    headers.set("x-forwarded-host", url.host);
    headers.delete("host");

    const init = {
      method: request.method,
      headers,
      // GET/HEAD have no body; forwarding request.body for them throws.
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      // The tracking endpoint answers a click with a 302 to the landing page.
      // That redirect must reach the recipient's browser, not be followed here —
      // otherwise the Worker fetches the destination and returns its body under
      // the phishing domain.
      redirect: "manual",
    };

    try {
      const upstream = await fetch(target, init);
      // Pass the response straight through: the pixel GIF, the 302 redirect, the
      // landing-page HTML all travel back to the recipient exactly as Supabase
      // produced them.
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: upstream.headers,
      });
    } catch (err) {
      console.error("[phish-proxy] upstream fetch failed:", err && err.message);
      return new Response("Bad gateway", { status: 502 });
    }
  },
};
