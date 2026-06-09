/**
 * Stale-chunk recovery helpers.
 *
 * After a new deploy the hashed asset filenames change. A browser that still
 * holds the previous index.html (or a CDN that serves it) will request chunk
 * hashes that no longer exist, so every lazy-loaded page fails with
 * "Failed to fetch dynamically imported module" and the app white-screens.
 *
 * These helpers detect that condition and reload the page once to pull the
 * fresh index.html and its updated chunk map.
 */

export function isChunkLoadError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("'text/html' is not a valid javascript mime type") ||
    (err instanceof Error && err.name === "ChunkLoadError")
  );
}

/**
 * Reload once to fetch fresh assets. A short sessionStorage timestamp guards
 * against an infinite reload loop when the failure is genuinely persistent
 * (e.g. the device is offline). Returns true if a reload was triggered.
 */
export function reloadForFreshChunks(): boolean {
  const KEY = "aw-chunk-reload-ts";
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last > 10_000) {
      sessionStorage.setItem(KEY, String(Date.now()));
      window.location.reload();
      return true;
    }
  } catch {
    // sessionStorage unavailable (private mode quota, etc.) — fall back to a plain reload.
    window.location.reload();
    return true;
  }
  return false;
}
