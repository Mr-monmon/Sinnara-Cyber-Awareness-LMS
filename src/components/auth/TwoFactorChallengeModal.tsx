import React, { useState, useRef, useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const T = {
  bg: "#12140a",
  bgCard: "#1a1e0e",
  accent: "#c8ff00",
  accentDark: "#12140a",
  white: "#ffffff",
  textBody: "#cbd5e1",
  textMuted: "#64748b",
  border: "rgba(255,255,255,0.09)",
  red: "#f87171",
  redBg: "rgba(248,113,113,0.08)",
  redBorder: "rgba(248,113,113,0.22)",
} as const;

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  .tfc-input {
    width: 100%; padding: 14px; box-sizing: border-box;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 22px; color: #ffffff; letter-spacing: 6px;
    font-family: 'Inter', sans-serif; outline: none; text-align: center;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .tfc-input:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .tfc-input::placeholder { color: rgba(148,163,184,0.40); letter-spacing: normal; font-size: 14px; }
  .tfc-btn-accent {
    background: #c8ff00; color: #12140a; border: none;
    border-radius: 10px; font-size: 14px; font-weight: 700;
    padding: 12px 24px; cursor: pointer; font-family: 'Inter', sans-serif;
    transition: opacity 0.15s, transform 0.1s; width: 100%;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .tfc-btn-accent:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .tfc-btn-accent:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  @keyframes tfc-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .tfc-modal-in { animation: tfc-modal-in 0.28s ease both; }
`;

if (typeof document !== "undefined" && !document.getElementById("tfc-styles")) {
  const tag = document.createElement("style");
  tag.id = "tfc-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

interface Props {
  onSuccess: () => void;
}

export const TwoFactorChallengeModal: React.FC<Props> = ({ onSuccess }) => {
  const { verifyMfa } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    const result = await verifyMfa(code);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Invalid code. Please try again.");
      setCode("");
      inputRef.current?.focus();
      return;
    }
    onSuccess();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        className="tfc-modal-in"
        style={{
          background: T.bgCard, border: `1px solid ${T.border}`,
          borderRadius: 16, padding: 40, width: "100%", maxWidth: 420,
          margin: "0 16px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "rgba(200,255,0,0.10)", border: "1px solid rgba(200,255,0,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <ShieldCheck size={24} color={T.accent} />
          </div>
          <h2 style={{ color: T.white, fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
            Two-Factor Authentication
          </h2>
          <p style={{ color: T.textMuted, fontSize: 14, margin: 0 }}>
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <input
              ref={inputRef}
              className="tfc-input"
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={code}
              onChange={handleCodeInput}
              maxLength={6}
              autoComplete="one-time-code"
            />
          </div>

          {error && (
            <div style={{
              background: T.redBg, border: `1px solid ${T.redBorder}`,
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
              color: T.red, fontSize: 13, textAlign: "center",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="tfc-btn-accent"
            disabled={code.length !== 6 || loading}
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>
      </div>
    </div>
  );
};
