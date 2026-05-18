import React, { useState } from "react";
import { Lock, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { TwoFactorSetupModal } from "./TwoFactorSetupModal";

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
  green: "#34d399",
} as const;

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  .fpc-input {
    width: 100%; padding: 10px 14px; box-sizing: border-box;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .fpc-input:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .fpc-input::placeholder { color: rgba(148,163,184,0.40); }
  .fpc-btn-accent {
    background: #c8ff00; color: #12140a; border: none;
    border-radius: 10px; font-size: 14px; font-weight: 700;
    padding: 11px 24px; cursor: pointer; font-family: 'Inter', sans-serif;
    transition: opacity 0.15s, transform 0.1s;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .fpc-btn-accent:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .fpc-btn-accent:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .fpc-btn-ghost {
    background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; font-weight: 500;
    padding: 10px 20px; cursor: pointer; font-family: 'Inter', sans-serif;
    transition: background 0.15s;
  }
  .fpc-btn-ghost:hover { background: rgba(255,255,255,0.09); }
  @keyframes fpc-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .fpc-modal-in { animation: fpc-modal-in 0.28s ease both; }
`;

if (typeof document !== "undefined" && !document.getElementById("fpc-styles")) {
  const tag = document.createElement("style");
  tag.id = "fpc-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

interface Props {
  onComplete: () => void;
  mfaEnforced?: boolean;
}

export const ForcePasswordChangeModal: React.FC<Props> = ({ onComplete, mfaEnforced = false }) => {
  const { changePassword } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"change" | "mfa_setup" | "optional_2fa">("change");

  const hasMin8 = newPassword.length >= 8;
  const hasNumber = /\d/.test(newPassword);
  const hasUppercase = /[A-Z]/.test(newPassword);
  const isValid = hasMin8 && hasNumber && hasUppercase && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    setError(null);
    const result = await changePassword(newPassword);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Failed to change password");
      return;
    }
    if (mfaEnforced) {
      setPhase("mfa_setup");
    } else {
      setPhase("optional_2fa");
    }
  };

  if (phase === "mfa_setup") {
    return <TwoFactorSetupModal onComplete={onComplete} />;
  }

  if (phase === "optional_2fa") {
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
          className="fpc-modal-in"
          style={{
            background: T.bgCard, border: `1px solid ${T.border}`,
            borderRadius: 16, padding: 40, width: "100%", maxWidth: 440,
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
              <Lock size={24} color={T.accent} />
            </div>
            <h2 style={{ color: T.white, fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
              Optional: Enable 2-Factor Authentication
            </h2>
            <p style={{ color: T.textMuted, fontSize: 14, margin: 0 }}>
              Protect your account with an authenticator app. You can set it up now or later.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              className="fpc-btn-accent"
              style={{ width: "100%" }}
              onClick={() => setPhase("mfa_setup")}
            >
              Setup 2FA
            </button>
            <button
              className="fpc-btn-ghost"
              style={{ width: "100%" }}
              onClick={onComplete}
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        className="fpc-modal-in"
        style={{
          background: T.bgCard, border: `1px solid ${T.border}`,
          borderRadius: 16, padding: 40, width: "100%", maxWidth: 460,
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
            <Lock size={24} color={T.accent} />
          </div>
          <h2 style={{ color: T.white, fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
            Change Your Password
          </h2>
          <p style={{ color: T.textMuted, fontSize: 14, margin: 0 }}>
            Your account requires a password change before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", color: T.textBody, fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              New Password
            </label>
            <input
              className="fpc-input"
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", color: T.textBody, fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              Confirm New Password
            </label>
            <input
              className="fpc-input"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {/* Requirements checklist */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`,
              borderRadius: 10, padding: "12px 14px", marginBottom: 20,
            }}
          >
            <p style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 10px" }}>
              Requirements
            </p>
            {[
              { label: "At least 8 characters", met: hasMin8 },
              { label: "At least 1 number", met: hasNumber },
              { label: "At least 1 uppercase letter", met: hasUppercase },
              { label: "Passwords match", met: confirmPassword.length > 0 && newPassword === confirmPassword },
            ].map(({ label, met }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                {met
                  ? <CheckCircle2 size={14} color={T.green} />
                  : <XCircle size={14} color={T.textMuted} />}
                <span style={{ fontSize: 13, color: met ? T.green : T.textMuted }}>{label}</span>
              </div>
            ))}
          </div>

          {error && (
            <div
              style={{
                background: T.redBg, border: `1px solid ${T.redBorder}`,
                borderRadius: 8, padding: "10px 14px", marginBottom: 16,
                color: T.red, fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="fpc-btn-accent"
            style={{ width: "100%" }}
            disabled={!isValid || loading}
          >
            {loading ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
};
