import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL        = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY   = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
// Optional headless render services — configure in Supabase edge function env vars
// Browserless.io: set BROWSERLESS_URL (e.g. https://chrome.browserless.io) + BROWSERLESS_TOKEN
// ScrapingBee:    set SCRAPINGBEE_KEY
// Generic:        set RENDER_SERVICE_URL (must accept ?url=<encoded>&wait=<ms> GET requests)
const BROWSERLESS_URL     = Deno.env.get("BROWSERLESS_URL") ?? "";
const BROWSERLESS_TOKEN   = Deno.env.get("BROWSERLESS_TOKEN") ?? "";
const SCRAPINGBEE_KEY     = Deno.env.get("SCRAPINGBEE_KEY") ?? "";
const RENDER_SERVICE_URL  = Deno.env.get("RENDER_SERVICE_URL") ?? "";

// ─── Analytics / tracking / infra to strip ───────────────────────────────────
const STRIP_DOMAINS = [
  "google-analytics.com", "googletagmanager.com", "googlesyndication.com",
  "facebook.net", "facebook.com/tr", "connect.facebook.net",
  "hotjar.com", "clarity.ms", "mouseflow.com", "fullstory.com",
  "mixpanel.com", "segment.com", "amplitude.com",
  "doubleclick.net", "adnxs.com", "adsrvr.org",
  "zendesk.com/embeddable_framework", "intercomcdn.com",
  "crisp.chat", "tawk.to", "freshchat.com",
];

// ─── CDN / framework scripts to always keep (needed for CSR) ─────────────────
const KEEP_PATTERNS = [
  /react[\.\-]/, /vue[\.\-]/, /angular[\.\-]/, /ember[\.\-]/, /svelte[\.\-]/,
  /bootstrap/, /jquery/, /lodash/, /moment/, /axios/, /zustand/, /redux/,
  /unpkg\.com/, /cdnjs\.cloudflare\.com/, /cdn\.jsdelivr\.net/,
  /stackpath\.bootstrapcdn\.com/, /ajax\.googleapis\.com/,
];

function shouldStripScript(src: string): boolean {
  const lower = src.toLowerCase();
  if (KEEP_PATTERNS.some(p => p.test(lower))) return false;
  if (STRIP_DOMAINS.some(d => lower.includes(d))) return true;
  if (lower.includes("service-worker") || lower.includes("sw.js") || lower.includes("workbox")) return true;
  return false;
}

function resolveUrl(href: string, base: string): string {
  if (!href || href.startsWith("data:") || href.startsWith("blob:") ||
      href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("{{")) {
    return href;
  }
  try { return new URL(href, base).toString(); } catch { return href; }
}

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchResource(url: string, timeout = 8000): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    return res;
  } catch { return null; }
}

// ─── Smart page fetch: follows cookie chains, detects bot challenges ──────────
// Many sites (Cloudflare, Rails CSRF, etc.) set cookies on first hit then
// expect them on the second request. This two-pass approach handles that.
async function smartFetchPage(url: string): Promise<{
  html: string;
  finalUrl: string;
  botProtected: boolean;
  statusCode: number;
}> {
  // Derive Accept-Language from URL params (e.g. locale=ar → prefer Arabic)
  let acceptLang = "en-US,en;q=0.9,ar;q=0.8";
  try {
    const params = new URL(url).searchParams;
    const locale = params.get("locale") || params.get("lang") || params.get("language") || "";
    if (locale.startsWith("ar")) acceptLang = "ar,en-US;q=0.8,en;q=0.6";
    else if (locale.startsWith("fr")) acceptLang = "fr,en-US;q=0.8,en;q=0.6";
    else if (locale.startsWith("de")) acceptLang = "de,en-US;q=0.8,en;q=0.6";
    else if (locale.startsWith("es")) acceptLang = "es,en-US;q=0.8,en;q=0.6";
  } catch { /* ignore */ }

  const baseHeaders: Record<string, string> = {
    "User-Agent": BROWSER_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": acceptLang,
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  };

  let cookies = "";

  // Pass 1 — initial GET
  let res: Response | null = null;
  try {
    res = await fetch(url, {
      headers: { ...baseHeaders, ...(cookies ? { "Cookie": cookies } : {}) },
      signal: AbortSignal.timeout(22000),
      redirect: "follow",
    });
  } catch { /* network error */ }

  if (!res) {
    return { html: "", finalUrl: url, botProtected: false, statusCode: 0 };
  }

  // Harvest Set-Cookie from first response
  const setCookie = res.headers.get("set-cookie") || "";
  if (setCookie) {
    cookies = setCookie
      .split(/,(?=[^;]+=[^;]+)/)          // split multiple cookies
      .map(c => c.split(";")[0].trim())   // keep name=value only
      .filter(Boolean)
      .join("; ");
  }

  const html1 = await res.text();
  const status1 = res.status;
  const finalUrl = res.url || url;

  // Detect Cloudflare or other JS challenges
  const isChallenge =
    html1.includes("cf-browser-verification") ||
    html1.includes("__cf_chl_") ||
    html1.includes("jschl_vc") ||
    html1.includes("challenge-platform") ||
    (status1 === 403 && html1.length < 5000) ||
    (html1.includes("Ray ID") && html1.length < 8000);

  // If we got cookies on the first pass and the page looks incomplete,
  // make a second request with those cookies
  const seemsIncomplete = html1.length < 2000 || !/<html/i.test(html1);

  if (cookies && (seemsIncomplete || isChallenge)) {
    try {
      const res2 = await fetch(url, {
        headers: { ...baseHeaders, "Cookie": cookies, "Referer": new URL(url).origin + "/" },
        signal: AbortSignal.timeout(22000),
        redirect: "follow",
      });
      if (res2.ok) {
        const html2 = await res2.text();
        if (html2.length > html1.length) {
          return { html: html2, finalUrl: res2.url || url, botProtected: isChallenge, statusCode: res2.status };
        }
      }
    } catch { /* non-fatal, use first result */ }
  }

  return { html: html1, finalUrl, botProtected: isChallenge, statusCode: status1 };
}

// ─── Headless render via Browserless.io ──────────────────────────────────────
// Requires BROWSERLESS_URL + BROWSERLESS_TOKEN env vars
async function renderBrowserless(url: string): Promise<string | null> {
  if (!BROWSERLESS_URL || !BROWSERLESS_TOKEN) return null;
  try {
    const endpoint = `${BROWSERLESS_URL}/content?token=${BROWSERLESS_TOKEN}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        waitFor: 3500,
        gotoOptions: { waitUntil: "networkidle2", timeout: 30000 },
        userAgent: BROWSER_UA,
        viewport: { width: 1280, height: 800 },
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

// ─── Headless render via ScrapingBee ─────────────────────────────────────────
// Requires SCRAPINGBEE_KEY env var
async function renderScrapingBee(url: string): Promise<string | null> {
  if (!SCRAPINGBEE_KEY) return null;
  try {
    const params = new URLSearchParams({
      api_key: SCRAPINGBEE_KEY,
      url,
      render_js: "true",
      wait: "3500",
      premium_proxy: "false",
    });
    const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`, {
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

// ─── Generic render service ───────────────────────────────────────────────────
// Requires RENDER_SERVICE_URL (GET ?url=<encoded>&wait=3500)
async function renderGeneric(url: string): Promise<string | null> {
  if (!RENDER_SERVICE_URL) return null;
  try {
    const apiUrl = `${RENDER_SERVICE_URL}?url=${encodeURIComponent(url)}&wait=3500`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(45000) });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

// ─── SPA detection heuristics ─────────────────────────────────────────────────
function detectSpa(html: string): { isSpa: boolean; reason: string } {
  const noScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  const checks = {
    rootDiv:    /<div\b[^>]*id=["'](app|root|main|__next|__nuxt|app-root|ng-app)["']/i.test(noScripts),
    emptyBody:  /<body[^>]*>\s*(<noscript[^>]*>[\s\S]*?<\/noscript>\s*)?<\/body>/i.test(noScripts),
    reactMeta:  /data-reactroot|__NEXT_DATA__|__NUXT__|window\.__INITIAL_STATE__/i.test(html),
    viteBundle: /\/_vite\/|\.vite\/|vite\.config/i.test(html),
    webpackBootstrap: /__webpack(?:_require__|_modules__|JsonpChunkLoading)/i.test(html),
    angularZone: /ng-version=|platformBrowserDynamic|bootstrapModule/i.test(html),
    noInputInBody: !/<input\b/i.test(noScripts) && !/<form\b/i.test(noScripts),
  };

  const trueKeys = Object.entries(checks).filter(([, v]) => v).map(([k]) => k);
  const isSpa = trueKeys.length >= 2 || checks.reactMeta || checks.webpackBootstrap;
  return { isSpa, reason: trueKeys.join(", ") || "none" };
}

// ─── JS bundle analysis ───────────────────────────────────────────────────────
interface FieldHint { type: string; name: string; placeholder: string; label: string; }
interface BundleAnalysis { fieldHints: FieldHint[]; apiEndpoints: string[]; formAction: string; }

async function analyzeJsBundles(html: string, baseUrl: string): Promise<BundleAnalysis> {
  // Collect all <script src="..."> pointing to JS files (skip analytics)
  const scriptPat = /<script\b[^>]*\bsrc=["']([^"']+\.js[^"']*)["'][^>]*>/gi;
  const bundleUrls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = scriptPat.exec(html)) !== null) {
    const abs = resolveUrl(m[1], baseUrl);
    if (!shouldStripScript(abs)) {
      bundleUrls.push(abs);
      if (bundleUrls.length >= 4) break;
    }
  }

  const fieldHints: FieldHint[] = [];
  const apiEndpoints: string[] = [];
  let formAction = "";

  for (const bundleUrl of bundleUrls) {
    const res = await fetchResource(bundleUrl, 10000);
    if (!res) continue;
    const js = await res.text();
    if (js.length > 800_000) continue; // skip huge bundles

    // Pattern 1: object-style field definitions (React/Vue form schemas)
    // e.g. { type: "email", name: "username", placeholder: "Enter email" }
    const objPat = /\btype\s*:\s*["'](\w+)["'][^}]*?\bname\s*:\s*["']([^"']{1,40})["'](?:[^}]*?\bplaceholder\s*:\s*["']([^"']{0,80})["'])?/gi;
    while ((m = objPat.exec(js)) !== null) {
      fieldHints.push({ type: m[1], name: m[2], placeholder: m[3] || "", label: "" });
      if (fieldHints.length >= 15) break;
    }

    // Pattern 2: JSX-style <input ... /> props
    // e.g. type="password" name="pass" placeholder="Password"
    const jsxPat = /type=["'](\w+)["'][^>]{0,200}?name=["']([^"']{1,40})["'](?:[^>]{0,200}?placeholder=["']([^"']{0,80})["'])?/gi;
    while ((m = jsxPat.exec(js)) !== null) {
      if (fieldHints.length < 15) {
        fieldHints.push({ type: m[1], name: m[2], placeholder: m[3] || "", label: "" });
      }
    }

    // Pattern 3: label/field pairs (form schemas like Formik, react-hook-form)
    // e.g. { label: "Email", name: "email", type: "email" }
    const labelPat = /\blabel\s*:\s*["']([^"']{1,60})["'][^}]{0,200}?\bname\s*:\s*["']([^"']{1,40})["']/gi;
    while ((m = labelPat.exec(js)) !== null) {
      if (fieldHints.length < 15) {
        fieldHints.push({ type: "text", name: m[2], placeholder: "", label: m[1] });
      }
    }

    // API endpoints: fetch(), axios.get/post(), $http, useQuery
    const apiPat = /(?:fetch|axios\.(?:get|post|put|patch)|useQuery[^(]*)\s*\(\s*["'`]([^"'`\s]{3,100})["'`]/gi;
    while ((m = apiPat.exec(js)) !== null) {
      const ep = m[1];
      if ((ep.startsWith("/") || ep.startsWith("http")) && !ep.includes("{{")) {
        apiEndpoints.push(ep);
      }
    }

    // Form action from JS (SPA route-based submit)
    const actionPat = /(?:action|submitUrl|loginUrl|authUrl)\s*[:=]\s*["']([^"']{3,120})["']/gi;
    while ((m = actionPat.exec(js)) !== null) {
      if (!formAction) formAction = m[1];
    }
  }

  // Dedupe field hints by name
  const seenNames = new Set<string>();
  const deduped = fieldHints.filter(f => {
    if (seenNames.has(f.name)) return false;
    seenNames.add(f.name);
    return true;
  });

  return {
    fieldHints: deduped.slice(0, 12),
    apiEndpoints: [...new Set(apiEndpoints)].slice(0, 10),
    formAction,
  };
}

// ─── Page manifest / branding extraction ─────────────────────────────────────
interface Branding { title: string; faviconUrl: string; logoUrl: string; primaryColor: string; }

async function extractBranding(html: string, baseUrl: string): Promise<Branding> {
  const origin = new URL(baseUrl).origin;

  // Title
  const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  const title = titleMatch?.[1]?.trim().replace(/\s*[-|–]\s*.+$/, "") || new URL(baseUrl).hostname;

  // Favicon (prefer 192+ icon, fallback to any link icon)
  const favPat = /<link\b[^>]*\brel=["'][^"']*icon[^"']*["'][^>]*\bhref=["']([^"']+)["']/gi;
  let faviconUrl = `${origin}/favicon.ico`;
  while ((m = favPat.exec(html)) !== null) {
    faviconUrl = resolveUrl(m[1], baseUrl);
    if (m[0].includes("192") || m[0].includes("180")) break;
  }

  // Logo: <img> with logo/brand in id/class/alt, or Open Graph image
  const ogImg = /<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(html);
  const logoImgPat = /<img\b[^>]*(?:id|class|alt)=["'][^"']*(?:logo|brand|header-img)[^"']*["'][^>]*src=["']([^"']+)["']|<img\b[^>]*src=["']([^"']+)["'][^>]*(?:id|class|alt)=["'][^"']*(?:logo|brand)[^"']*["']/i;
  const logoMatch = logoImgPat.exec(html);
  const logoUrl = logoMatch ? resolveUrl(logoMatch[1] || logoMatch[2], baseUrl) : (ogImg ? resolveUrl(ogImg[1], baseUrl) : "");

  // Primary colour: meta theme-color > CSS custom property > brand-colour heuristic
  const themeMatch = /<meta\b[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i.exec(html);
  let primaryColor = themeMatch?.[1] || "";
  if (!primaryColor) {
    const cssVarMatch = /--(?:primary|brand|accent|main)-color\s*:\s*(#[0-9a-f]{3,8}|(?:rgb|hsl)\([^)]+\))/i.exec(html);
    primaryColor = cssVarMatch?.[1] || "#2563eb";
  }

  // Try to fetch web manifest for richer data
  const manifestMatch = /<link\b[^>]*rel=["']manifest["'][^>]*href=["']([^"']+)["']/i.exec(html);
  if (manifestMatch) {
    try {
      const res = await fetchResource(resolveUrl(manifestMatch[1], baseUrl), 4000);
      if (res) {
        const manifest = await res.json();
        if (manifest.name && !title.includes(manifest.name)) {
          // prefer manifest short_name for conciseness
        }
        if (manifest.theme_color && !primaryColor) primaryColor = manifest.theme_color;
        if (!logoUrl && manifest.icons?.length) {
          const best = manifest.icons.sort((a: Record<string, string>, b: Record<string, string>) =>
            parseInt(b.sizes?.split("x")[0] || "0") - parseInt(a.sizes?.split("x")[0] || "0")
          )[0];
          if (best?.src) return { title, faviconUrl, logoUrl: resolveUrl(best.src, baseUrl), primaryColor };
        }
      }
    } catch { /* non-fatal */ }
  }

  return { title, faviconUrl, logoUrl, primaryColor };
}

// ─── Synthetic login form for SPAs that returned no real form ─────────────────
function buildSyntheticForm(branding: Branding, fieldHints: FieldHint[]): string {
  // Decide on fields to show based on bundle analysis
  const hasEmailHint = fieldHints.some(f =>
    f.type === "email" || f.name?.toLowerCase().includes("email") ||
    f.name?.toLowerCase().includes("mail") || f.name?.toLowerCase().includes("user") ||
    f.name?.toLowerCase().includes("login")
  );
  const hasPasswordHint = fieldHints.some(f =>
    f.type === "password" || f.name?.toLowerCase().includes("pass")
  );

  const emailField = fieldHints.find(f =>
    f.type === "email" || f.name?.toLowerCase().includes("email") || f.name?.toLowerCase().includes("mail")
  );
  const userField = fieldHints.find(f =>
    f.name?.toLowerCase().includes("user") || f.name?.toLowerCase() === "login" || f.name?.toLowerCase() === "username"
  );
  const passField = fieldHints.find(f => f.type === "password" || f.name?.toLowerCase().includes("pass"));

  const mainFieldName  = emailField?.name || userField?.name || "email";
  const mainFieldType  = emailField ? "email" : "text";
  const mainPlaceholder = emailField?.placeholder || userField?.placeholder ||
                          emailField?.label || userField?.label || "Email or username";
  const passFieldName  = passField?.name || "password";
  const passPlaceholder = passField?.placeholder || passField?.label || "Password";

  const c = branding.primaryColor;

  return `
<style>
#__aw_synth_wrap{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
#__aw_synth_card{background:#fff;border-radius:14px;padding:38px 36px 32px;width:100%;max-width:420px;
  box-shadow:0 24px 64px rgba(0,0,0,0.35);box-sizing:border-box}
.__aw_synth_logo{text-align:center;margin-bottom:18px}
.__aw_synth_logo img{max-height:52px;max-width:200px;object-fit:contain}
.__aw_synth_title{font-size:21px;font-weight:700;color:#111;text-align:center;margin:0 0 6px}
.__aw_synth_sub{font-size:13px;color:#6b7280;text-align:center;margin:0 0 22px}
.__aw_synth_label{display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px}
.__aw_synth_input{display:block;width:100%;padding:10px 13px;box-sizing:border-box;
  border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;color:#111;outline:none;
  background:#fff;margin-bottom:14px;transition:border-color .18s,box-shadow .18s}
.__aw_synth_input:focus{border-color:${c};box-shadow:0 0 0 3px ${c}28}
.__aw_synth_submit{display:block;width:100%;padding:11px;border-radius:8px;border:none;cursor:pointer;
  background:${c};color:#fff;font-size:15px;font-weight:700;letter-spacing:.15px;margin-top:4px;
  transition:opacity .18s,transform .12s}
.__aw_synth_submit:hover{opacity:.9;transform:translateY(-1px)}
.__aw_synth_submit:active{opacity:1;transform:none}
.__aw_synth_forgot{text-align:center;margin-top:14px;font-size:12px;color:${c};cursor:pointer;text-decoration:underline}
</style>
<div id="__aw_synth_wrap">
  <div id="__aw_synth_card">
    ${branding.logoUrl
      ? `<div class="__aw_synth_logo"><img src="${branding.logoUrl}" alt="${branding.title}" onerror="this.parentElement.style.display='none'" /></div>`
      : `<div class="__aw_synth_logo" style="font-size:26px;font-weight:900;color:${c}">${branding.title.slice(0, 2).toUpperCase()}</div>`
    }
    <div class="__aw_synth_title">Sign in to ${branding.title}</div>
    <div class="__aw_synth_sub">Enter your credentials to continue</div>
    <form id="__aw_synth_form">
      <label class="__aw_synth_label">${mainPlaceholder}</label>
      <input class="__aw_synth_input" type="${mainFieldType}" name="${mainFieldName}" value="{{.Email}}" placeholder="${mainPlaceholder}" autocomplete="${mainFieldType === "email" ? "email" : "username"}" />
      <label class="__aw_synth_label">${passPlaceholder}</label>
      <input class="__aw_synth_input" type="password" name="${passFieldName}" placeholder="${passPlaceholder}" autocomplete="current-password" />
      <button type="submit" class="__aw_synth_submit">Sign in</button>
    </form>
    <div class="__aw_synth_forgot" onclick="void(0)">Forgot password?</div>
  </div>
</div>`;
}

// ─── Inline external stylesheets (up to 5 sheets ≤ 100 KB) ──────────────────
async function inlineStylesheets(html: string, baseUrl: string): Promise<string> {
  const linkPat = /<link\b[^>]*\brel=["']?stylesheet["']?[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/gi;
  const toInline: Array<{ tag: string; href: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = linkPat.exec(html)) !== null) {
    toInline.push({ tag: m[0], href: resolveUrl(m[1], baseUrl) });
    if (toInline.length >= 5) break;
  }
  let result = html;
  for (const { tag, href } of toInline) {
    if (!href.startsWith("http")) continue;
    const res = await fetchResource(href, 6000);
    if (!res) continue;
    const css = await res.text();
    if (css.length > 100_000) continue;
    const fixed = css.replace(/url\(['"]?([^'")]+)['"]?\)/g, (_, u) => `url("${resolveUrl(u, href)}")`);
    result = result.replace(tag, `<style>${fixed}</style>`);
  }
  return result;
}

// ─── Variable injection into existing input fields ───────────────────────────
function injectVariables(html: string): string {
  return html.replace(/<input\b([^>]*)>/gi, (match, attrs) => {
    const typeMatch = /\btype=["']?([^"'\s>]+)["']?/i.exec(attrs);
    const nameMatch = /\bname=["']?([^"'\s>]+)["']?/i.exec(attrs);
    const type = typeMatch?.[1]?.toLowerCase() || "text";
    const name = nameMatch?.[1]?.toLowerCase() || "";

    if (/\bvalue=["'][^"']+["']/i.test(attrs)) return match; // already has value

    let val = "";
    if (type === "email" || name.includes("email") || name.includes("mail") ||
        name === "login" || name === "username" || name === "user") {
      val = "{{.Email}}";
    } else if (type === "text" && (name === "fname" || name.startsWith("first"))) {
      val = "{{.FirstName}}";
    } else if (type === "text" && (name === "lname" || name.startsWith("last"))) {
      val = "{{.LastName}}";
    } else if (type === "text" && name.includes("name") && !name.includes("user")) {
      val = "{{.FirstName}} {{.LastName}}";
    }
    return val ? `<input${attrs} value="${val}">` : match;
  });
}

// ─── Tracking script ──────────────────────────────────────────────────────────
function buildTrackingScript(): string {
  return `<script>
(function(){
  var SU='${SUPABASE_URL}';
  // Block SPA router navigations so the page stays put
  try{
    var _push=history.pushState.bind(history);
    history.pushState=function(){return _push.apply(history,arguments)};
    window.addEventListener('popstate',function(e){e.stopImmediatePropagation()},true);
  }catch(e){}

  function getParams(){return new URLSearchParams(window.location.search)}

  function sendEvent(path,body,cb){
    var p=getParams(),c=p.get('c')||'',r=p.get('r')||'';
    if(!c||!r)return cb&&cb();
    var url=SU+'/functions/v1/phishing-track?t='+path+'&c='+c+'&r='+r;
    fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})})
      .then(function(){cb&&cb()}).catch(function(){cb&&cb()});
  }

  // Intercept XMLHttpRequest so API-driven logins are captured too
  var _open=XMLHttpRequest.prototype.open;
  var _send=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open=function(m,u){this.__aw_method=m;this.__aw_url=u;return _open.apply(this,arguments)};
  XMLHttpRequest.prototype.send=function(body){
    var self=this;
    var origOnLoad=self.onload;
    self.onload=function(){
      try{
        if(self.__aw_url&&(self.__aw_url.includes('login')||self.__aw_url.includes('auth')||self.__aw_url.includes('signin')||self.__aw_url.includes('session'))){
          var parsed={};
          try{parsed=JSON.parse(body)}catch(e){
            if(typeof body==='string'){
              body.split('&').forEach(function(pair){var kv=pair.split('=');if(kv[0])parsed[decodeURIComponent(kv[0])]=decodeURIComponent(kv[1]||'');});
            }
          }
          if(parsed.password||parsed.pass)parsed.password='***';
          sendEvent('submit',parsed,null);
        }
      }catch(e){}
      if(origOnLoad)origOnLoad.apply(self,arguments);
    };
    return _send.apply(this,arguments);
  };

  // Intercept fetch() for API-driven login forms
  var _fetch=window.fetch;
  window.fetch=function(input,init){
    var url=typeof input==='string'?input:(input&&input.url)||'';
    if(url&&(url.includes('login')||url.includes('auth')||url.includes('signin')||url.includes('session'))){
      var body=init&&init.body;
      var parsed={};
      try{parsed=JSON.parse(body)}catch(e){
        if(typeof body==='string'){
          body.split('&').forEach(function(pair){var kv=pair.split('=');if(kv[0])parsed[decodeURIComponent(kv[0])]=decodeURIComponent(kv[1]||'');});
        }
      }
      if(parsed.password||parsed.pass)parsed.password='***';
      if(Object.keys(parsed).length>0)sendEvent('submit',parsed,null);
    }
    return _fetch.apply(window,arguments);
  };

  // Attach <form> submit handlers
  function attachForms(){
    document.querySelectorAll('form').forEach(function(form){
      if(form.__aw_hooked)return;
      form.__aw_hooked=true;
      form.addEventListener('submit',function(e){
        e.preventDefault();e.stopImmediatePropagation();
        var data={};
        form.querySelectorAll('input,select,textarea').forEach(function(inp){
          if(inp.name)data[inp.name]=inp.type==='password'?'***':inp.value;
        });
        var p=getParams();
        sendEvent('submit',data,function(){
          setTimeout(function(){
            window.location.href=p.get('redirect')||'https://www.google.com';
          },500);
        });
      },true);
    });
  }

  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',attachForms);}
  else{attachForms();}
  new MutationObserver(function(){attachForms();}).observe(
    document.body||document.documentElement,{childList:true,subtree:true}
  );
})();
</script>`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  // Verify caller is an authenticated admin (company or platform)
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { url } = body;
    if (!url) throw new Error("URL is required");

    // Validate URL format early
    new URL(url);

    // ── Step 1: Smart fetch with cookie-chain + locale headers ───────────────
    const fetchResult = await smartFetchPage(url);
    if (!fetchResult.html && fetchResult.statusCode === 0) {
      throw new Error("Failed to reach the URL — the server may be unreachable or blocking automated requests.");
    }
    let html = fetchResult.html;
    const finalPageUrl = fetchResult.finalUrl || url;

    // ── Step 1b: Bot protection detected → try render service first ──────────
    if (fetchResult.botProtected) {
      const rendered1 = await renderBrowserless(url) || await renderScrapingBee(url) || await renderGeneric(url);
      if (rendered1 && rendered1.length > 500) html = rendered1;
    }

    if (!html || html.length < 100) {
      throw new Error(
        fetchResult.botProtected
          ? "This site uses bot protection (Cloudflare or similar) that blocks server-side fetching. Configure a headless render service (BROWSERLESS_URL / SCRAPINGBEE_KEY) to clone protected sites."
          : "The server returned an empty response. The URL may require authentication or be geo-restricted."
      );
    }

    // Use the final URL after redirects as the base for resolving assets
    const finalTargetUrl = new URL(finalPageUrl);
    const pageOrigin = `${finalTargetUrl.protocol}//${finalTargetUrl.host}`;
    const pageBase   = `${pageOrigin}${finalTargetUrl.pathname}`;

    // ── Step 2: SPA detection ─────────────────────────────────────────────────
    const { isSpa, reason: spaReason } = detectSpa(html);
    const hasStaticForm = /<form\b/i.test(html) || /<input\b[^>]*type=["']?(?:email|password|text)["']?/i.test(html);

    // ── Step 3: Headless rendering (only if needed) ───────────────────────────
    let renderService = "none";
    let rendered = false;

    if (isSpa || !hasStaticForm) {
      // Try render services in priority order
      const tries: Array<[() => Promise<string | null>, string]> = [
        [() => renderBrowserless(url), "browserless"],
        [() => renderScrapingBee(url),  "scrapingbee"],
        [() => renderGeneric(url),      "generic"],
      ];
      for (const [fn, name] of tries) {
        const result = await fn();
        if (result && result.length > 200) {
          html = result;
          rendered = true;
          renderService = name;
          break;
        }
      }
    }

    // ── Step 4: Re-evaluate after potential render ────────────────────────────
    const { isSpa: stillSpa } = detectSpa(html);
    const hasForm = /<form\b/i.test(html);

    // ── Step 5: JS bundle analysis (always run, helps variable injection) ─────
    let bundleAnalysis: BundleAnalysis = { fieldHints: [], apiEndpoints: [], formAction: "" };
    try {
      bundleAnalysis = await analyzeJsBundles(html, pageBase);
    } catch { /* non-fatal */ }

    // ── Step 6: Rewrite resource URLs to absolute ─────────────────────────────
    html = html.replace(/\b(href|src|action|data-src|data-lazy-src|data-href)=(["'])([^"']*?)\2/gi,
      (_, attr, q, val) => `${attr}=${q}${resolveUrl(val, pageBase)}${q}`
    );
    html = html.replace(/url\((['"]?)([^'")\s]+)\1\)/g,
      (_, q, val) => `url(${q}${resolveUrl(val, pageBase)}${q})`
    );
    html = html.replace(/srcset=(["'])([^"']+)\1/gi, (_, q, srcset) => {
      const resolved = srcset.split(",").map((p: string) => {
        const [u, ...rest] = p.trim().split(/\s+/);
        return [resolveUrl(u, pageBase), ...rest].join(" ");
      }).join(", ");
      return `srcset=${q}${resolved}${q}`;
    });

    // ── Step 7: Add <base> tag ────────────────────────────────────────────────
    if (!/<base\b/i.test(html)) {
      const baseTag = `<base href="${pageOrigin}/">`;
      html = html.includes("<head>")
        ? html.replace("<head>", `<head>\n  ${baseTag}`)
        : `<head>${baseTag}</head>\n` + html;
    }

    // ── Step 8: Strip analytics / service workers ─────────────────────────────
    html = html.replace(/<script\b([^>]*)src=(["'])([^"']+)\2([^>]*)><\/script>/gi,
      (match, _pre, _q, src) => shouldStripScript(src) ? "" : match
    );
    html = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi,
      (match, code) => /serviceWorker\.register|navigator\.serviceWorker/i.test(code) ? "" : match
    );

    // ── Step 9: Inline small stylesheets ─────────────────────────────────────
    try { html = await inlineStylesheets(html, pageBase); } catch { /* non-fatal */ }

    // ── Step 10: Variable injection into existing fields ──────────────────────
    html = injectVariables(html);

    // ── Step 11: Synthetic form if still no form after everything ─────────────
    let syntheticFormAdded = false;
    if (!/<form\b/i.test(html)) {
      try {
        const branding = await extractBranding(html, pageBase);
        const synthHtml = buildSyntheticForm(branding, bundleAnalysis.fieldHints);
        html = html.includes("</body>")
          ? html.replace("</body>", synthHtml + "</body>")
          : html + synthHtml;
        syntheticFormAdded = true;
      } catch { /* non-fatal */ }
    }

    // ── Step 12: Inject tracking script ──────────────────────────────────────
    const tracker = buildTrackingScript();
    html = html.includes("</body>")
      ? html.replace("</body>", tracker + "</body>")
      : html + tracker;

    // ── Step 13: Build response metadata ─────────────────────────────────────
    const formDetected    = /<form\b/i.test(html);
    const hasPasswordField = /type=["']?password["']?/i.test(html);
    const hasEmailField   = /type=["']?email["']?/i.test(html) || /name=["']?email["']?/i.test(html);

    let note = "";
    if (syntheticFormAdded) {
      note = "No login form found in the rendered page — a synthetic login overlay was injected based on JS bundle analysis. " +
             "This works for most credential-capture scenarios. For full fidelity, configure a headless render service (BROWSERLESS_URL / SCRAPINGBEE_KEY).";
    } else if (isSpa && !rendered) {
      note = "SPA detected but no headless render service is configured. The page may render as a blank shell in some browsers. " +
             "Configure BROWSERLESS_URL+BROWSERLESS_TOKEN or SCRAPINGBEE_KEY for full SPA support.";
    } else if (rendered) {
      note = `Page was fully rendered via ${renderService} (headless browser). Form fields and dynamic content are captured.`;
    }

    return new Response(JSON.stringify({
      html,
      source_url:             url,
      form_detected:          formDetected,
      has_password_field:     hasPasswordField,
      has_email_field:        hasEmailField,
      is_spa:                 isSpa,
      spa_reason:             spaReason,
      rendered:               rendered,
      render_service:         renderService,
      synthetic_form_added:   syntheticFormAdded,
      bundle_field_hints:     bundleAnalysis.fieldHints,
      bundle_api_endpoints:   bundleAnalysis.apiEndpoints,
      note: note || null,
    }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Clone failed" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
