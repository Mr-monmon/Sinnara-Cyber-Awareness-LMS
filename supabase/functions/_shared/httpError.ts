/**
 * httpError — uniform, non-leaky error responses for Edge Functions.
 *
 * Internal failure detail (DB error text, stack traces, driver messages) must
 * never reach an HTTP client: it can disclose schema, query shape, or
 * infrastructure details useful to an attacker. These helpers log the full
 * detail server-side (visible in Edge Function logs) and return only a generic
 * message plus a short reference code the operator can grep for in the logs.
 */

/** Generate a short, log-greppable reference code, e.g. "ERR-LXM3K9-A1". */
export function makeRef(prefix = "ERR"): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `${prefix}-${t}-${r}`;
}

/**
 * Log full error detail server-side and return a `{ error, ref }` object the
 * caller can spread into its own response body (e.g. to preserve a
 * `{ success: false, ... }` shape the frontend expects). The client never sees
 * the underlying cause — only the generic message + reference code.
 */
export function logAndRef(
  tag: string,
  err: unknown,
  message = "An internal error occurred. Please try again or contact support.",
): { error: string; ref: string } {
  const ref = makeRef();
  const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
  console.error(`${tag} ${ref}:`, detail);
  return { error: message, ref };
}

/**
 * Log full error detail server-side and return a generic JSON error response.
 * The client sees only `message` and `ref`; the real cause goes to the logs.
 *
 * @param tag     log tag, e.g. "[save-smtp-profile]"
 * @param err     the caught error (any type)
 * @param opts.status   HTTP status (default 500)
 * @param opts.message  client-safe message (default generic)
 * @param opts.headers  response headers (must include CORS + content-type)
 */
export function safeErrorResponse(
  tag: string,
  err: unknown,
  opts: { status?: number; message?: string; headers: Record<string, string> },
): Response {
  const ref = makeRef();
  const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
  console.error(`${tag} ${ref}:`, detail);
  const status = opts.status ?? 500;
  const message = opts.message ?? "An internal error occurred. Please try again or contact support.";
  return new Response(JSON.stringify({ error: message, ref }), { status, headers: opts.headers });
}
