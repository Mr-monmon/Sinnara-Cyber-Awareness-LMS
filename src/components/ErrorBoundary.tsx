import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronRight } from "lucide-react";
import { logErrorToSupabase } from "../lib/errorLogger";
import { captureException } from "../lib/sentry";
import { isChunkLoadError, reloadForFreshChunks } from "../lib/chunkReload";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  isChunkError: boolean;
}

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
  redBg: "rgba(248,113,113,0.08)",
  redBorder: "rgba(248,113,113,0.22)",
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null, showDetails: false, isChunkError: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // A stale-chunk failure after a deploy is an infrastructure/cache condition,
    // not an application bug — try a one-time reload to fetch fresh assets and
    // skip the noisy error reporting below.
    if (isChunkLoadError(error)) {
      console.warn("ErrorBoundary: stale chunk detected, reloading for fresh assets.", error);
      reloadForFreshChunks();
      return;
    }
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
    void logErrorToSupabase(error, errorInfo.componentStack ?? undefined);
    captureException(error, { componentStack: errorInfo.componentStack ?? "" });
  }

  handleReload = () => window.location.reload();

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    // Stale-chunk recovery screen — a reload is already in flight (see componentDidCatch).
    if (this.state.isChunkError) {
      return (
        <div style={{ minHeight: "100vh", background: T.bg, color: T.white, fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 440, width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(200,255,0,0.10)", border: "1px solid rgba(200,255,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
              <RefreshCw size={26} style={{ color: T.accent }} />
            </div>
            <h1 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 8px" }}>Updating to the latest version…</h1>
            <p style={{ fontSize: 13.5, color: T.body, margin: "0 0 20px", lineHeight: 1.6 }}>
              A new version of the app was deployed. We're refreshing automatically. If this screen stays, click below.
            </p>
            <button onClick={this.handleReload} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", background: T.accent, color: T.accentDark }}>
              <RefreshCw size={14} /> Reload now
            </button>
          </div>
        </div>
      );
    }

    if (this.props.fallback) return this.props.fallback;

    const { error, errorInfo, showDetails } = this.state;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: T.bg,
          color: T.white,
          fontFamily: "'Inter', sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 560,
            width: "100%",
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: 32,
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: T.redBg,
              border: `1px solid ${T.redBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <AlertTriangle size={30} style={{ color: T.red }} />
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, margin: "0 0 8px", letterSpacing: "-0.3px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: T.body, margin: "0 0 24px", lineHeight: 1.6 }}>
            An unexpected error occurred. Try reloading the page. If the problem persists, contact your administrator.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            <button
              onClick={this.handleReload}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "inherit",
                background: T.accent,
                color: T.accentDark,
              }}
            >
              <RefreshCw size={14} /> Reload Page
            </button>
            <button
              onClick={this.handleGoHome}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                borderRadius: 9,
                border: `1px solid ${T.border}`,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "inherit",
                background: "transparent",
                color: T.white,
              }}
            >
              <Home size={14} /> Go to Home
            </button>
          </div>

          {error && (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
              <button
                onClick={() => this.setState({ showDetails: !showDetails })}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "none",
                  border: "none",
                  color: T.muted,
                  cursor: "pointer",
                  fontSize: 12,
                  padding: 0,
                  fontFamily: "inherit",
                }}
              >
                {showDetails ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {showDetails ? "Hide" : "Show"} technical details
              </button>

              {showDetails && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    background: "rgba(0,0,0,0.3)",
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    fontSize: 11,
                    fontFamily: "ui-monospace, monospace",
                    color: T.body,
                    maxHeight: 240,
                    overflow: "auto",
                  }}
                >
                  <div style={{ color: T.red, fontWeight: 700, marginBottom: 6 }}>
                    {error.name}: {error.message}
                  </div>
                  {error.stack && (
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 10 }}>
                      {error.stack}
                    </pre>
                  )}
                  {errorInfo?.componentStack && (
                    <pre
                      style={{
                        margin: "8px 0 0",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontSize: 10,
                        color: T.muted,
                      }}
                    >
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}
