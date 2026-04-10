import React, { useState } from "react";
import { ArrowLeft, Shield, Lock, Mail } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { buildApexRedirectUrl } from "../lib/browserTenant";

/* ─────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────── */
const T = {
  bg: "#12140a",
  bgCard: "#1a1e0e",
  accent: "#c8ff00",
  accentDark: "#12140a",
  white: "#ffffff",
  textBody: "#94a3b8",
  textLabel: "#cbd5e1",
  textMuted: "#64748b",
  border: "rgba(255,255,255,0.10)",
  borderFaint: "rgba(255,255,255,0.05)",
} as const;

/* ─────────────────────────────────────────
   GLOBAL CSS — :focus via CSS, not JS state
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .aw-login-input {
    width: 100%;
    padding: 12px 14px 12px 42px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 8px;
    font-size: 14px;
    color: #ffffff;
    outline: none;
    transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
    font-family: 'Inter', sans-serif;
    display: block;
  }
  .aw-login-input:focus {
    background: rgba(255,255,255,0.08);
    border-color: rgba(200,255,0,0.50);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.10);
  }
  .aw-login-input::placeholder {
    color: rgba(148,163,184,0.40);
  }
  .aw-login-input:-webkit-autofill,
  .aw-login-input:-webkit-autofill:hover,
  .aw-login-input:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0 1000px #1a1e0e inset !important;
    -webkit-text-fill-color: #ffffff !important;
    caret-color: #ffffff;
    border-color: rgba(200,255,0,0.50) !important;
    transition: background-color 9999s ease-in-out 0s;
  }

  .aw-demo-btn {
    width: 100%;
    text-align: left;
    padding: 12px 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
    font-family: 'Inter', sans-serif;
  }
  .aw-demo-btn:hover {
    background: rgba(200,255,0,0.06);
    border-color: rgba(200,255,0,0.20);
  }
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById("aw-login-styles")
) {
  const tag = document.createElement("style");
  tag.id = "aw-login-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}
/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
interface LoginPageProps {
  backLabel?: string;
  backTo?: string;
}

export const LoginPage = ({
  backLabel = "Back to Home",
  backTo = "/",
}: LoginPageProps) => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleBack = () => {
    if (/^https?:\/\//.test(backTo)) {
      window.location.href = backTo;
      return;
    }

    navigate(backTo);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);

      if (result === "success") {
        navigate("/dashboard", { replace: true });
        return;
      }

      if (result === "wrong_tenant") {
        window.location.replace(buildApexRedirectUrl(window.location.href, "/"));
        return;
      }

      setError("Invalid email or password. Please try again.");
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 16px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Background radial glow ── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(200,255,0,0.08) 0%, transparent 60%)",
        }}
      />

      <div style={{ position: "relative", width: "100%", maxWidth: 440 }}>
        {/* ── Back button ── */}
        <button
          onClick={handleBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            color: T.textBody,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0 0 24px",
            transition: "color 0.2s",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = T.white)}
          onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}
        >
          <ArrowLeft size={16} /> {backLabel}
        </button>

        {/* ── Card ── */}
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: "40px",
            boxShadow: "0 25px 60px rgba(0,0,0,0.50)",
          }}
        >
          {/* Accent bar */}
          <div
            style={{
              width: 40,
              height: 3,
              background: T.accent,
              borderRadius: 9999,
              marginBottom: 28,
            }}
          />

          {/* Logo + heading */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              marginBottom: 32,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 14,
                background: "rgba(200,255,0,0.08)",
                border: "1px solid rgba(200,255,0,0.20)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <Shield size={30} style={{ color: T.accent }} />
            </div>
            <img
              src={"logo.svg"}
              alt="AwareOne"
              style={{ height: 130, width: "auto", marginBottom: 20 }}
            />
            <h1
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: T.white,
                letterSpacing: "-0.3px",
                margin: "0 0 6px",
              }}
            >
              Welcome Back
            </h1>
            <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
              Sign in to access your dashboard
            </p>
          </div>

          {/* ── Error message ── */}
          {error && (
            <div
              style={{
                marginBottom: 20,
                padding: "12px 14px",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.25)",
                borderRadius: 8,
                fontSize: 13,
                color: "#fca5a5",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ flexShrink: 0 }}>⚠</span>
              {error}
            </div>
          )}

          {/* ── Form ── */}
          <form
            onSubmit={handleSubmit}
            autoComplete="on"
            style={{ display: "flex", flexDirection: "column", gap: 18 }}
          >
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.textLabel,
                  marginBottom: 6,
                }}
              >
                Email Address
                <span style={{ color: T.accent, marginLeft: 3 }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={16}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: T.textMuted,
                    pointerEvents: "none",
                  }}
                />
                <input
                  id="login-email"
                  className="aw-login-input"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.textLabel,
                  marginBottom: 6,
                }}
              >
                Password
                <span style={{ color: T.accent, marginLeft: 3 }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={16}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: T.textMuted,
                    pointerEvents: "none",
                  }}
                />
                <input
                  id="login-password"
                  className="aw-login-input"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                width: "100%",
                padding: "14px 24px",
                background: loading ? "rgba(200,255,0,0.50)" : T.accent,
                color: T.accentDark,
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 10,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 0 20px rgba(200,255,0,0.25)",
                transition: "opacity 0.2s, transform 0.15s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.opacity = "0.88";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.transform = "none";
              }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        {/* ── Footer note ── */}
        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: T.textMuted,
            marginTop: 20,
          }}
        >
          Accounts are created by administrators only
        </p>
      </div>
    </div>
  );
};
