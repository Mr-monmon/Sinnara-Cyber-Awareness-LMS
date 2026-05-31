/**
 * Lightweight Sentry error reporter for Supabase Edge Functions (Deno).
 * Uses Sentry's HTTP store API — no SDK import needed.
 * Set SENTRY_DSN env var in Supabase Dashboard → Edge Functions → Secrets.
 */

function parseDsn(dsn: string): { key: string; host: string; projectId: string } | null {
  const m = dsn.match(/^https?:\/\/([^@]+)@([^/]+)\/(.+)$/);
  if (!m) return null;
  return { key: m[1], host: m[2], projectId: m[3] };
}

export async function captureException(
  error: unknown,
  context: { function: string; [key: string]: unknown } = { function: "unknown" },
): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;

  const parsed = parseDsn(dsn);
  if (!parsed) return;

  const { key, host, projectId } = parsed;

  const err     = error instanceof Error ? error : new Error(String(error));
  const frames  = (err.stack ?? "").split("\n").slice(1).map(line => ({
    filename: line.trim(),
    function: line.trim().split(" ")[1] ?? "<anonymous>",
  }));

  const event = {
    event_id:    crypto.randomUUID().replace(/-/g, ""),
    timestamp:   new Date().toISOString(),
    platform:    "node",
    level:       "error",
    server_name: "supabase-edge",
    tags:        { function: context.function },
    extra:       context,
    exception: {
      values: [{
        type:  err.name,
        value: err.message,
        ...(frames.length ? { stacktrace: { frames } } : {}),
      }],
    },
  };

  try {
    await fetch(`https://${host}/api/${projectId}/store/`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${key}`,
      },
      body: JSON.stringify(event),
    });
  } catch {
    // Never let Sentry reporting break the function
  }
}
