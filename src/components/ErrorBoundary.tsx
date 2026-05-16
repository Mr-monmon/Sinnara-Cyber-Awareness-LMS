import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronRight } from "lucide-react";
import { Sentry } from "../lib/sentry";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
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
  state: State = { hasError: false, error: null, errorInfo: null, showDetails: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleReload = () => window.location.reload();

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;
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
