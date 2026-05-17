// Reads env vars at runtime first (injected by the Cloudflare Worker into
// window.__ENV__), then falls back to import.meta.env (baked at build time
// for local dev). This lets Cloudflare dashboard variables work without
// needing a .env file present during `npm run build`.

export function getRuntimeEnv(key: string): string | undefined {
  if (typeof window !== "undefined" && window.__ENV__) {
    const value = window.__ENV__[key];
    if (value && value.length > 0) return value;
  }
  const buildValue = (import.meta.env as Record<string, string | undefined>)[key];
  return buildValue && buildValue.length > 0 ? buildValue : undefined;
}
