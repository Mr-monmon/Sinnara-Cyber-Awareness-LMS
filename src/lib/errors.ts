// Normalizes any thrown value into a human-readable message.
//
// Supabase / PostgREST and Edge Function errors are frequently plain objects
// (not Error instances) carrying `message`, `error`, `details`, or `hint`
// fields. Catch blocks that only handle `err instanceof Error` therefore drop
// the real reason and surface a useless "Unknown error". This helper digs the
// most specific message out of whatever was thrown.
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;

  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;

    if (typeof obj.message === "string" && obj.message) return obj.message;
    if (typeof obj.error === "string" && obj.error) return obj.error;
    if (typeof obj.details === "string" && obj.details) return obj.details;
    if (typeof obj.hint === "string" && obj.hint) return obj.hint;

    try {
      return JSON.stringify(obj);
    } catch {
      return "Unknown error";
    }
  }

  if (typeof err === "string" && err) return err;
  return "Unknown error";
}

// Supabase Edge Function invokes throw a FunctionsHttpError whose `.message` is
// the useless generic "Edge Function returned a non-2xx status code". The real
// reason is in the response body (`error.context` is a Response). This async
// helper reads that body and returns the specific { error } / { message } the
// function actually sent, falling back to getErrorMessage otherwise.
export async function getEdgeFunctionError(err: unknown): Promise<string> {
  const ctx = (err as { context?: unknown })?.context;
  // `context` is a Response when the function returned a non-2xx with a body.
  if (ctx && typeof (ctx as Response).text === "function") {
    try {
      const raw = await (ctx as Response).clone().text();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const msg = getErrorMessage(parsed);
          if (msg && msg !== "Unknown error") return msg;
        } catch {
          // Not JSON (e.g. text/plain EDGE_FUNCTION_ERROR) — return as-is.
          return raw;
        }
      }
    } catch {
      // fall through to generic handling
    }
  }
  return getErrorMessage(err);
}

