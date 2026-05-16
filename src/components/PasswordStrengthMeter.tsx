import { Check, X } from "lucide-react";
import { checkPassword, SCORE_COLORS, SCORE_LABELS } from "../lib/passwordPolicy";

interface Props {
  password: string;
  email?: string;
  showRequirements?: boolean;
}

export function PasswordStrengthMeter({ password, email, showRequirements = true }: Props) {
  const { errors, score, valid } = checkPassword(password, email);
  if (!password) return null;

  const color = SCORE_COLORS[score];
  const label = SCORE_LABELS[score];
  const fillPct = ((score + 1) / 5) * 100;

  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          height: 4,
          width: "100%",
          background: "rgba(255,255,255,0.08)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${fillPct}%`,
            background: color,
            transition: "width 0.2s, background 0.2s",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          fontSize: 11,
        }}
      >
        <span style={{ color, fontWeight: 600 }}>{label}</span>
        {valid && (
          <span style={{ color: "#22c55e", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Check size={11} /> Meets policy
          </span>
        )}
      </div>
      {showRequirements && errors.length > 0 && (
        <ul
          style={{
            marginTop: 6,
            paddingLeft: 0,
            listStyle: "none",
            fontSize: 11,
            color: "#94a3b8",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {errors.map((e) => (
            <li key={e} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <X size={10} style={{ color: "#f87171", flexShrink: 0 }} />
              {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
