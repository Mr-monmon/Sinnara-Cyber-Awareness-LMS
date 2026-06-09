import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitizeRedirectUrl } from "../_shared/urlSafety.ts";

/*
  serve-landing-page (P-3)

  Public, unauthenticated endpoint that serves a phishing campaign's landing page
  HTML to a recipient who clicked the email link.

    GET /functions/v1/serve-landing-page?lp={landing_page_id}&c={campaign_id}&r={recipient_id}

  Security model (tenant-scoped — NOT an open HTML host):
    • The campaign must exist and be the owner of this landing page:
        phishing_campaigns.id == c  AND  phishing_campaigns.landing_page_id == lp
    • The landing page and campaign must belong to the SAME company.
    • The recipient (r) must be a real target of campaign c.
    Any mismatch returns a generic error page — arbitrary html_content cannot be
    served under a campaign that did not configure it.

  Form capture:
    A small interceptor script is injected before </body>. On any form submit it
    POSTs the entered fields to phishing-track?t=submit&c=&r= (which logs
    FORM_SUBMITTED + creates a CRITICAL alert), then redirects the victim onward.

  This function MUST be deployed with verify_jwt = false (see supabase/config.toml).
*/

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const supabase = createClient(
  SUPABASE_URL,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function errorHtml(code: string, title: string, detail: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Error</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#0e1012;color:#e2e8f0;
       display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .card{background:#1a1e26;border:1px solid rgba(255,255,255,0.09);border-radius:16px;
        padding:36px;max-width:440px;width:100%;text-align:center}
  .icon{width:52px;height:52px;border-radius:50%;background:rgba(248,113,113,0.12);
        border:1px solid rgba(248,113,113,0.28);display:flex;align-items:center;
        justify-content:center;margin:0 auto 20px;font-size:22px}
  h1{font-size:20px;font-weight:700;color:#fff;margin-bottom:10px}
  p{font-size:14px;color:#94a3b8;line-height:1.6;margin-bottom:20px}
  .code{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);
        border-radius:8px;padding:10px 16px;font-family:monospace;font-size:12px;
        color:#64748b;word-break:break-all}
  .label{font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px}
</style>
</head>
<body>
<div class="card">
  <div class="icon">⚠</div>
  <h1>${title}</h1>
  <p>${detail}</p>
  <div class="label">Reference Code</div>
  <div class="code">${code}</div>
</div>
</body>
</html>`;
  return new Response(html, {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

/* JSON-escape a string for safe embedding inside an inline <script> string literal. */
function jsString(value: string): string {
  return JSON.stringify(value ?? "");
}

/* Build the form-capture + redirect interceptor injected into the served page. */
function buildInterceptor(campaignId: string, recipientId: string, redirectUrl: string): string {
  const trackBase = `${SUPABASE_URL}/functions/v1/phishing-track`;
  return `<script>
(function(){
  var TRACK=${jsString(trackBase)},C=${jsString(campaignId)},R=${jsString(recipientId)},REDIRECT=${jsString(redirectUrl)};
  function send(form){
    var data={};
    try{ new FormData(form).forEach(function(v,k){ data[k]=v; }); }catch(_){}
    try{
      fetch(TRACK+"?t=submit&c="+encodeURIComponent(C)+"&r="+encodeURIComponent(R),{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(data),keepalive:true
      }).catch(function(){});
    }catch(_){}
  }
  document.addEventListener("submit",function(e){
    var form=e.target;
    if(!form||String(form.tagName).toUpperCase()!=="FORM") return;
    e.preventDefault();
    send(form);
    setTimeout(function(){ window.location.href=REDIRECT||"https://www.google.com"; },350);
  },true);
})();
</script>`;
}

// Safe default redirect destination when the configured URL is missing/unsafe.
const SAFE_REDIRECT_FALLBACK = "https://www.google.com";

/**
 * Validate a server-side redirect URL.
 * Blocks private IPs, loopback, metadata endpoints, embedded credentials,
 * and any scheme other than http(s). Falls back to google.com on failure.
 */
const SAFE_REDIRECT_FALLBACK = "https://www.google.com";
function sanitizeRedirect(value: string): string {
  return sanitizeRedirectUrl(value ?? "", SAFE_REDIRECT_FALLBACK, { allowHttp: true });
}

function injectInterceptor(html: string, interceptor: string): string {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, interceptor + "</body>");
  }
  return html + interceptor;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const url          = new URL(req.url);
  const landingId    = url.searchParams.get("lp") ?? "";
  const campaignId   = url.searchParams.get("c") ?? "";
  const recipientId  = url.searchParams.get("r") ?? "";
  // NOTE: redirect destination is resolved server-side from the campaign/landing-page
  // record — never from a user-supplied query parameter — to prevent open redirect.

  if (!landingId || !campaignId || !recipientId) {
    const errId = `LP-${Date.now().toString(36).toUpperCase()}-NOREF`;
    return errorHtml(errId, "Invalid Link", "This link is missing required parameters. It may have been copied incorrectly.");
  }

  try {
    // 1. Campaign must exist and must reference THIS landing page.
    const { data: campaign } = await supabase
      .from("phishing_campaigns")
      .select("id, company_id, landing_page_id")
      .eq("id", campaignId)
      .single();

    if (!campaign || campaign.landing_page_id !== landingId) {
      const errId = `LP-${Date.now().toString(36).toUpperCase()}-NOCAMP`;
      return errorHtml(errId, "Page Unavailable", "This page is no longer available. Please contact the sender.");
    }

    // 2. Landing page must exist and be usable by the campaign's company:
    //    - a company-owned page belonging to the SAME company, OR
    //    - a platform page that is GLOBAL, OR
    //    - a platform page SHARED with the campaign's company.
    const { data: landing } = await supabase
      .from("phishing_company_landing_pages")
      .select("id, company_id, html_content, redirect_url, is_platform_page, visibility")
      .eq("id", landingId)
      .single();

    let landingAllowed = false;
    if (landing) {
      if (landing.company_id === campaign.company_id) {
        landingAllowed = true;
      } else if (landing.is_platform_page) {
        if (landing.visibility === "GLOBAL") {
          landingAllowed = true;
        } else {
          const { data: access } = await supabase
            .from("landing_page_company_access")
            .select("id")
            .eq("landing_page_id", landingId)
            .eq("company_id", campaign.company_id)
            .maybeSingle();
          landingAllowed = !!access;
        }
      }
    }

    if (!landing || !landingAllowed) {
      const errId = `LP-${Date.now().toString(36).toUpperCase()}-NOLP`;
      return errorHtml(errId, "Page Unavailable", "This page is no longer available. Please contact the sender.");
    }

    // 3. Recipient must be a real target of this campaign.
    const { data: target } = await supabase
      .from("phishing_campaign_targets")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("recipient_id", recipientId)
      .single();

    if (!target) {
      const errId = `LP-${Date.now().toString(36).toUpperCase()}-NOTGT`;
      return errorHtml(errId, "Invalid Link", "This link could not be verified. Please contact the sender.");
    }

    // Resolve redirect destination from trusted server-side data only.
    // landing_page.redirect_url is set by the platform admin; fall back to a
    // benign search page. A user-supplied ?redirect= parameter is NEVER used.
    const trustedRedirect = sanitizeRedirect(landing.redirect_url ?? "");
    const baseHtml    = landing.html_content || "<!DOCTYPE html><html><body></body></html>";
    const interceptor = buildInterceptor(campaignId, recipientId, trustedRedirect);
    const finalHtml   = injectInterceptor(baseHtml, interceptor);

    return new Response(finalHtml, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch {
    const errId = `LP-${Date.now().toString(36).toUpperCase()}-ERR`;
    return errorHtml(errId, "Unexpected Error", "Something went wrong loading this page. Please try again later.");
  }
});
