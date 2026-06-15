/**
 * cloudflare-stream — secure server-side proxy for Cloudflare Stream.
 *
 * The Cloudflare API token is a server-only secret and is NEVER sent to the
 * browser. The admin UI calls this function (authenticated as a PLATFORM_ADMIN,
 * the only role allowed to author course sections) to:
 *
 *   action "create-upload" → mint a one-time direct-creator-upload URL. The
 *       browser then POSTs the video file straight to Cloudflare using that URL
 *       (no token needed client-side). Returns { uid, uploadURL, ... }.
 *
 *   action "get-video"     → fetch a video's processing status / duration /
 *       thumbnail / playback info by UID (e.g. to poll until "ready", or to
 *       validate a manually-entered UID).
 *
 * Required Edge Function secrets (Supabase Dashboard → Edge Functions → Secrets):
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_API_TOKEN
 *   CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN   (optional; used to build embed URLs)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as buildCors } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/httpError.ts";

const CF_API = "https://api.cloudflare.com/client/v4";

/** Map Cloudflare's lifecycle state to the frontend's normalised status. */
function normaliseStatus(state: string | undefined): "ready" | "processing" | "error" | "pending" {
  switch ((state ?? "").toLowerCase()) {
    case "ready":          return "ready";
    case "error":          return "error";
    case "pendingupload":  return "pending";
    default:               return "processing"; // downloading | queued | inprogress | unknown
  }
}

function clampDuration(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3600;
  return Math.min(Math.max(Math.round(n), 1), 21600); // 1s … 6h
}

Deno.serve(async (req) => {
  const corsHeaders = { ...buildCors(req, { methods: "POST, OPTIONS" }), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
    // ── Authenticate the caller (must be a PLATFORM_ADMIN) ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: callerRow } = await serviceClient
      .from("users").select("role").eq("id", user.id).single();

    if (!callerRow || callerRow.role !== "PLATFORM_ADMIN") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    // ── Server-only Cloudflare config ──
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const apiToken  = Deno.env.get("CLOUDFLARE_API_TOKEN");
    const subdomain = (Deno.env.get("CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN") ?? "").trim();
    if (!accountId || !apiToken) {
      return new Response(
        JSON.stringify({ error: "Cloudflare Stream is not configured on the server (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN missing)." }),
        { status: 500, headers: corsHeaders },
      );
    }
    const iframeUrl    = (uid: string) => (subdomain ? `https://${subdomain}/${uid}/iframe` : null);
    const thumbnailUrl = (uid: string) => (subdomain ? `https://${subdomain}/${uid}/thumbnails/thumbnail.jpg` : null);

    let body: Record<string, unknown>;
    try { body = await req.json(); }
    catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders }); }

    const action = String(body.action ?? "");

    // ── action: create-upload ──
    if (action === "create-upload") {
      const maxDurationSeconds = clampDuration(body.maxDurationSeconds);
      const name = typeof body.name === "string" ? body.name.slice(0, 256) : undefined;

      const cfResp = await fetch(`${CF_API}/accounts/${accountId}/stream/direct_upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          maxDurationSeconds,
          requireSignedURLs: false,
          ...(name ? { meta: { name } } : {}),
        }),
      });
      const cfJson = await cfResp.json().catch(() => null);
      if (!cfResp.ok || !cfJson?.success) {
        console.error("[cloudflare-stream] create-upload failed:", cfResp.status, JSON.stringify(cfJson?.errors ?? cfJson));
        return new Response(JSON.stringify({ error: "Cloudflare rejected the upload request. Check the account ID and API token." }), { status: 502, headers: corsHeaders });
      }
      const uid = cfJson.result?.uid as string;
      const uploadURL = cfJson.result?.uploadURL as string;
      return new Response(JSON.stringify({
        uid,
        uploadURL,
        playbackUrl: iframeUrl(uid),
        thumbnailUrl: thumbnailUrl(uid),
      }), { status: 200, headers: corsHeaders });
    }

    // ── action: get-video ──
    if (action === "get-video") {
      const uid = String(body.uid ?? "").trim();
      if (!uid) {
        return new Response(JSON.stringify({ error: "uid is required" }), { status: 400, headers: corsHeaders });
      }

      const cfResp = await fetch(`${CF_API}/accounts/${accountId}/stream/${encodeURIComponent(uid)}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const cfJson = await cfResp.json().catch(() => null);
      if (cfResp.status === 404) {
        return new Response(JSON.stringify({ error: "No Cloudflare Stream video found for that UID." }), { status: 404, headers: corsHeaders });
      }
      if (!cfResp.ok || !cfJson?.success) {
        console.error("[cloudflare-stream] get-video failed:", cfResp.status, JSON.stringify(cfJson?.errors ?? cfJson));
        return new Response(JSON.stringify({ error: "Cloudflare could not return the video metadata." }), { status: 502, headers: corsHeaders });
      }

      const r = cfJson.result ?? {};
      return new Response(JSON.stringify({
        uid: r.uid ?? uid,
        status: normaliseStatus(r.status?.state),
        readyToStream: Boolean(r.readyToStream),
        durationSeconds: typeof r.duration === "number" && r.duration > 0 ? Math.round(r.duration) : null,
        thumbnail: r.thumbnail ?? thumbnailUrl(uid),
        playbackUrl: iframeUrl(uid),
        name: r.meta?.name ?? null,
      }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: corsHeaders });

  } catch (err) {
    const headers = { ...buildCors(req, { methods: "POST, OPTIONS" }), "Content-Type": "application/json" };
    return safeErrorResponse("[cloudflare-stream] unhandled exception", err, { headers });
  }
});
