/**
 * rateLimit — best-effort, per-isolate in-memory sliding-window limiter.
 *
 * Used to blunt floods against PUBLIC, unauthenticated endpoints (phishing
 * tracking) where a caller who guesses or harvests campaign/recipient tokens
 * could otherwise spam events or POST submit bodies without limit.
 *
 * SCOPE / HONESTY:
 *   • This is an L1 control. Supabase runs Edge Functions across many short-lived
 *     isolates, so the counter is NOT global — a distributed flood spread over
 *     many isolates is only partially mitigated. It reliably stops a single
 *     hot isolate / single-host burst, which is the common abuse shape.
 *   • For a hard global guarantee, pair this with an L2 control at the gateway
 *     / WAF / CDN (per-IP rate rules). This is documented in
 *     docs/SECURITY_HARDENING.md.
 *   • Fails OPEN: if bookkeeping ever throws, the request is allowed — tracking
 *     availability is preferred over blocking a legitimate recipient.
 */

interface Bucket {
  hits: number[]; // epoch-ms timestamps within the current window
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/** Drop stale buckets occasionally so the map can't grow unbounded. */
function sweep(now: number, windowMs: number) {
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.hits.length === 0 || b.hits[b.hits.length - 1] < now - windowMs) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Record a hit for `key` and report whether it is within `limit` per `windowMs`.
 * Fails open on any internal error.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  try {
    const now = Date.now();
    sweep(now, windowMs);
    const cutoff = now - windowMs;
    const bucket = buckets.get(key) ?? { hits: [] };
    // Drop timestamps outside the window.
    bucket.hits = bucket.hits.filter((t) => t >= cutoff);
    if (bucket.hits.length >= limit) {
      buckets.set(key, bucket);
      const oldest = bucket.hits[0];
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      return { allowed: false, remaining: 0, retryAfterSec };
    }
    bucket.hits.push(now);
    buckets.set(key, bucket);
    return { allowed: true, remaining: Math.max(0, limit - bucket.hits.length), retryAfterSec: 0 };
  } catch {
    return { allowed: true, remaining: limit, retryAfterSec: 0 };
  }
}
