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
