import React, { useState, useEffect } from "react";
import { ShieldCheck, CheckCircle2, Copy } from "lucide-react";
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
  green: "#34d399",
  greenBg: "rgba(52,211,153,0.08)",
  greenBorder: "rgba(52,211,153,0.22)",
} as const;

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  .tfs-input {
    width: 100%; padding: 10px 14px; box-sizing: border-box;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; color: #ffffff; letter-spacing: 3px;
    font-family: 'Inter', sans-serif; outline: none; text-align: center;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .tfs-input:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .tfs-input::placeholder { color: rgba(148,163,184,0.40); letter-spacing: normal; }
  .tfs-btn-accent {
    background: #c8ff00; color: #12140a; border: none;
    border-radius: 10px; font-size: 14px; font-weight: 700;
    padding: 11px 24px; cursor: pointer; font-family: 'Inter', sans-serif;
    transition: opacity 0.15s, transform 0.1s; width: 100%;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .tfs-btn-accent:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .tfs-btn-accent:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .tfs-btn-ghost {
    background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; font-weight: 500; width: 100%;
    padding: 10px 20px; cursor: pointer; font-family: 'Inter', sans-serif;
    transition: background 0.15s;
  }
  .tfs-btn-ghost:hover { background: rgba(255,255,255,0.09); }
  .tfs-copy-btn {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 6px; padding: 4px 8px; cursor: pointer;
    display: flex; align-items: center; gap: 4px; color: #64748b; font-size: 11px;
    font-family: 'Inter', sans-serif; transition: background 0.15s, color 0.15s;
  }
  .tfs-copy-btn:hover { background: rgba(255,255,255,0.09); color: #cbd5e1; }
  @keyframes tfs-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .tfs-modal-in { animation: tfs-modal-in 0.28s ease both; }
`;

if (typeof document !== "undefined" && !document.getElementById("tfs-styles")) {
  const tag = document.createElement("style");
  tag.id = "tfs-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

interface Props {
  onComplete: () => void;
  onSkip?: () => void;
}

export const TwoFactorSetupModal: React.FC<Props> = ({ onComplete, onSkip }) => {
  const { enrollTotp, verifyTotpEnrollment } = useAuth();
  const [step, setStep] = useState<"loading" | "scan" | "verify" | "success" | "error">("loading");
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const start = async () => {
      const result = await enrollTotp();
      if (!result) {
        setStep("error");
        return;
      }
      setQrCode(result.qrCode);
      setSecret(result.secret);
      setFactorId(result.factorId);
      setStep("scan");
    };
    void start();
  }, [enrollTotp]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setVerifying(true);
    setVerifyError(null);
    const result = await verifyTotpEnrollment(factorId, code);
    setVerifying(false);
    if (!result.ok) {
      setVerifyError(result.error ?? "Invalid code. Please try again.");
      return;
    }
    setStep("success");
    setTimeout(() => onComplete(), 1500);
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(val);
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
        className="tfs-modal-in"
        style={{
          background: T.bgCard, border: `1px solid ${T.border}`,
          borderRadius: 16, padding: 40, width: "100%", maxWidth: 460,
          margin: "0 16px",
        }}
      >
        {step === "loading" && (
          <div style={{ textAlign: "center", padding: "40px 0", color: T.textMuted }}>
            <div style={{ fontSize: 14 }}>Setting up 2FA...</div>
          </div>
        )}

        {step === "error" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p style={{ color: T.red, fontSize: 14 }}>Failed to initialize 2FA setup. Please try again later.</p>
            {onSkip && (
              <button className="tfs-btn-ghost" style={{ marginTop: 16 }} onClick={onSkip}>
                Skip for now
              </button>
            )}
          </div>
        )}

        {step === "scan" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "rgba(200,255,0,0.10)", border: "1px solid rgba(200,255,0,0.22)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 14px",
              }}>
                <ShieldCheck size={22} color={T.accent} />
              </div>
              <h2 style={{ color: T.white, fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
                Set Up Two-Factor Authentication
              </h2>
              <p style={{ color: T.textMuted, fontSize: 13, margin: 0 }}>
                Scan this QR code with Google Authenticator, Microsoft Authenticator, Authy, or any TOTP app.
              </p>
            </div>

            {/* QR Code */}
            <div style={{
              background: "#ffffff", borderRadius: 12, padding: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20,
            }}>
              <img src={qrCode} alt="TOTP QR Code" style={{ width: 180, height: 180 }} />
            </div>

            {/* Manual entry fallback */}
            <div style={{
              background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`,
              borderRadius: 10, padding: "12px 14px", marginBottom: 24,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  Manual entry key
                </span>
                <button className="tfs-copy-btn" onClick={handleCopySecret}>
                  <Copy size={11} />
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <code style={{
                color: T.textBody, fontSize: 13, wordBreak: "break-all",
                fontFamily: "'Courier New', monospace", letterSpacing: "1px",
              }}>
                {secret}
              </code>
            </div>

            <button className="tfs-btn-accent" onClick={() => setStep("verify")}>
              Next: Enter Verification Code
            </button>

            {onSkip && (
              <button className="tfs-btn-ghost" style={{ marginTop: 10 }} onClick={onSkip}>
                Skip for now
              </button>
            )}
          </>
        )}

        {step === "verify" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <h2 style={{ color: T.white, fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
                Verify Your Code
              </h2>
              <p style={{ color: T.textMuted, fontSize: 13, margin: 0 }}>
                Enter the 6-digit code from your authenticator app to confirm setup.
              </p>
            </div>

            <form onSubmit={handleVerify}>
              <div style={{ marginBottom: 20 }}>
                <input
                  className="tfs-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  value={code}
                  onChange={handleCodeInput}
                  autoFocus
                  maxLength={6}
                />
              </div>

              {verifyError && (
                <div style={{
                  background: T.redBg, border: `1px solid ${T.redBorder}`,
                  borderRadius: 8, padding: "10px 14px", marginBottom: 16,
                  color: T.red, fontSize: 13,
                }}>
                  {verifyError}
                </div>
              )}

              <button
                type="submit"
                className="tfs-btn-accent"
                disabled={code.length !== 6 || verifying}
              >
                {verifying ? "Verifying..." : "Verify & Enable 2FA"}
              </button>

              <button
                type="button"
                className="tfs-btn-ghost"
                style={{ marginTop: 10 }}
                onClick={() => setStep("scan")}
              >
                Back
              </button>
            </form>
          </>
        )}

        {step === "success" && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: T.greenBg, border: `1px solid ${T.greenBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <CheckCircle2 size={30} color={T.green} />
            </div>
            <h2 style={{ color: T.green, fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
              2FA Enabled Successfully
            </h2>
            <p style={{ color: T.textMuted, fontSize: 13, margin: 0 }}>
              Your account is now protected with two-factor authentication.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
