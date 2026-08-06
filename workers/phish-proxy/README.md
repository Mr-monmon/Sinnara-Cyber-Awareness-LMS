# phish-proxy

A reverse-proxy Cloudflare Worker that makes phishing campaign links appear on a
domain you control instead of `*.supabase.co`.

## Why it exists

Campaign emails contain a click link, a tracking pixel, and (optionally) a
landing-page link. The platform builds those from each campaign's chosen
**phishing domain** (`phishing_domains.tracking_base_url`). This Worker is what
answers on that domain: it forwards the two recipient-facing endpoints
(`/functions/v1/phishing-track` and `/functions/v1/serve-landing-page`) to the
Supabase Edge Functions, and returns their response unchanged. The recipient
only ever sees your domain.

One Worker serves **every** domain — the four shared ones and each company's
private ones. Adding a domain is a Cloudflare operation, not a code change.

## Deploy the Worker (once)

```
cd workers/phish-proxy
npx wrangler deploy
```

Then, in the Cloudflare dashboard → Workers & Pages → **phish-proxy** →
Settings → Variables, add:

| Name | Value |
|---|---|
| `SUPABASE_FUNCTIONS_ORIGIN` | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | the project's anon / publishable key (public — safe here) |

## Add a phishing domain (per domain)

1. Buy the domain.
2. Add it to Cloudflare as a zone; point its nameservers at Cloudflare.
3. Wait for the zone to go **Active** (Cloudflare issues the edge TLS cert
   automatically — no manual certificate step).
4. Add a route so the domain hits this Worker:
   - Workers & Pages → phish-proxy → Settings → **Domains & Routes** → Add route
   - Route: `yourdomain.example/*`  ·  Zone: `yourdomain.example`
5. In AwareOne → **Phishing Domains**, add the domain with
   `tracking_base_url = https://yourdomain.example`, mark it shared or
   company-scoped, and **verify** it (the platform refuses to launch on an
   unverified domain).

A quick check that the route works, before sending to anyone:

```
curl -i "https://yourdomain.example/functions/v1/phishing-track?t=open&c=00000000-0000-0000-0000-000000000000&r=x"
```

Expect a `200` with `Content-Type: image/gif` (the tracking pixel). A `404`
means the route is not attached; a `502` means the Worker's
`SUPABASE_FUNCTIONS_ORIGIN` is unset or wrong.

## Sender vs link domain

This Worker only governs the **link** domain (what the recipient clicks). The
**sending** domain (the `From:` address, its SPF/DKIM) is configured separately
in Platform SMTP Profiles. For the most convincing simulation, use the same
domain for both.
