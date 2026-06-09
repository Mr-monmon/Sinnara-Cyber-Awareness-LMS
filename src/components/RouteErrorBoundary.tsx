import { useRouteError } from "react-router-dom";
import { RefreshCw, AlertTriangle, Home } from "lucide-react";
import { useEffect } from "react";
import { isChunkLoadError, reloadForFreshChunks } from "../lib/chunkReload";

const T = {
  bg: "#12140a",
  card: "#1a1e0e",
  accent: "#c8ff00",
  accentDark: "#12140a",
  white: "#ffffff",
  body: "#cbd5e1",
  muted: "#64748b",
  border: "rgba(255,255,255,0.09)",
  red: "#f87171",
};

/**
 * Route-level error element for React Router. Without this, a failed lazy import
 * (stale chunk after a deploy) shows React Router's raw "Unexpected Application
 * Error!" screen and never recovers. Here we detect that case and reload once for
 * fresh assets; anything else gets a clean, branded fallback.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const chunk = isChunkLoadError(error);

  useEffect(() => {
    if (chunk) reloadForFreshChunks();
  }, [chunk]);

  if (chunk) {
    return (
      <Shell
        icon={<RefreshCw size={26} style={{ color: T.accent }} />}
        iconBg="rgba(200,255,0,0.10)"
        iconBorder="rgba(200,255,0,0.25)"
        title="Updating to the latest version…"
        body="A new version of the app was deployed. We're refreshing automatically. If this screen stays, click below."
        button={{ label: "Reload now", onClick: () => window.location.reload() }}
      />
    );
  }

  return (
    <Shell
      icon={<AlertTriangle size={28} style={{ color: T.red }} />}
      iconBg="rgba(248,113,113,0.08)"
      iconBorder="rgba(248,113,113,0.22)"
      title="Something went wrong"
      body="An unexpected error occurred while loading this page. Try reloading, or return to the home page."
      button={{ label: "Reload Page", onClick: () => window.location.reload() }}
      secondary={{ label: "Go to Home", onClick: () => { window.location.href = "/"; } }}
    />
  );
}

function Shell({
  icon, iconBg, iconBorder, title, body, button, secondary,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconBorder: string;
  title: string;
  body: string;
  button: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.white, fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 440, width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: iconBg, border: `1px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
          {icon}
        </div>
        <h1 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 8px" }}>{title}</h1>
        <p style={{ fontSize: 13.5, color: T.body, margin: "0 0 20px", lineHeight: 1.6 }}>{body}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={button.onClick} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", background: T.accent, color: T.accentDark }}>
            <RefreshCw size={14} /> {button.label}
          </button>
          {secondary && (
            <button onClick={secondary.onClick} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 9, border: `1px solid ${T.border}`, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", background: "transparent", color: T.white }}>
              <Home size={14} /> {secondary.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
