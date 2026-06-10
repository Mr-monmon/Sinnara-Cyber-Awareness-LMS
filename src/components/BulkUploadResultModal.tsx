import React from "react";
import { Upload, X, CheckCircle, AlertTriangle, Building2 } from "lucide-react";

/* Per-row outcome surfaced in the upload-results modal */
export type UploadRowOutcome = {
  row: number;
  name: string;
  email: string;
  reason: string;
};

export type UploadResult = {
  totalRows: number;
  succeeded: number;
  duplicates: UploadRowOutcome[];
  failed: UploadRowOutcome[];
  departmentsCreated: string[];
  emailsSent: number;
  emailsFailed: number;
};

const T = {
  bgCard: "#1a1e0e",
  accent: "#c8ff00",
  accentDark: "#12140a",
  white: "#ffffff",
  textBody: "#cbd5e1",
  textMuted: "#64748b",
  border: "rgba(255,255,255,0.09)",
  borderFaint: "rgba(255,255,255,0.05)",
  green: "#34d399",
  greenBg: "rgba(52,211,153,0.08)",
  greenBorder: "rgba(52,211,153,0.22)",
  orange: "#fb923c",
  red: "#f87171",
  blueBorder: "rgba(96,165,250,0.22)",
} as const;

/* Results modal shown after a bulk CSV upload (shared by company + platform admin) */
export const BulkUploadResultModal: React.FC<{
  result: UploadResult;
  onClose: () => void;
}> = ({ result, onClose }) => {
  const stat = (label: string, value: number, color: string) => (
    <div
      style={{
        flex: 1,
        minWidth: 110,
        padding: "14px 16px",
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, marginTop: 6 }}>{label}</div>
    </div>
  );

  const problems = [
    ...result.failed.map((r) => ({ ...r, kind: "fail" as const })),
    ...result.duplicates.map((r) => ({ ...r, kind: "dup" as const })),
  ].sort((a, b) => a.row - b.row);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.62)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px",
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Upload size={18} style={{ color: T.accent }} />
            <h2 style={{ fontSize: 17, fontWeight: 800, color: T.white, margin: 0 }}>
              Import Results
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: "auto" }}>
          {/* Stat cards */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {stat("Total rows", result.totalRows, T.white)}
            {stat("Imported", result.succeeded, T.green)}
            {stat("Duplicates", result.duplicates.length, T.orange)}
            {stat("Failed", result.failed.length, T.red)}
          </div>

          {/* Email + departments summary */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: problems.length ? 18 : 0,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: T.textBody,
                background: "rgba(96,165,250,0.08)",
                border: `1px solid ${T.blueBorder}`,
                borderRadius: 8,
                padding: "6px 10px",
              }}
            >
              ✉️ Welcome emails sent: {result.emailsSent}
              {result.emailsFailed > 0 ? ` · failed: ${result.emailsFailed}` : ""}
            </span>
            {result.departmentsCreated.length > 0 && (
              <span
                style={{
                  fontSize: 12,
                  color: T.textBody,
                  background: "rgba(52,211,153,0.08)",
                  border: `1px solid ${T.greenBorder}`,
                  borderRadius: 8,
                  padding: "6px 10px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Building2 size={13} style={{ color: T.green }} />
                New departments: {result.departmentsCreated.join(", ")}
              </span>
            )}
          </div>

          {/* Problem list */}
          {problems.length > 0 ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>
                ROWS NOT IMPORTED ({problems.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {problems.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "9px 12px",
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${T.borderFaint}`,
                      borderRadius: 9,
                    }}
                  >
                    <AlertTriangle
                      size={15}
                      style={{ color: p.kind === "dup" ? T.orange : T.red, flexShrink: 0, marginTop: 2 }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, color: T.white, fontWeight: 600 }}>
                        {p.name !== "—" ? p.name : "(no name)"}{" "}
                        <span style={{ color: T.textMuted, fontWeight: 400 }}>· {p.email}</span>
                      </div>
                      <div style={{ fontSize: 12, color: p.kind === "dup" ? T.orange : T.red, marginTop: 2 }}>
                        Row {p.row || "?"} — {p.reason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 16px",
                background: T.greenBg,
                border: `1px solid ${T.greenBorder}`,
                borderRadius: 10,
              }}
            >
              <CheckCircle size={18} style={{ color: T.green }} />
              <span style={{ fontSize: 13, color: T.green, fontWeight: 600 }}>
                All {result.succeeded} rows imported successfully.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: `1px solid ${T.border}`,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background: T.accent,
              color: T.accentDark,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
