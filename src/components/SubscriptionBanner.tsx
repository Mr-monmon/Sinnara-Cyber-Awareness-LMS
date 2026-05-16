import { AlertTriangle, Clock } from "lucide-react";
import type { SubscriptionInfo } from "../lib/subscription";

const T = {
  warnBg:     "rgba(251,146,60,0.10)",
  warnBorder: "rgba(251,146,60,0.35)",
  warn:       "#fb923c",
  dangerBg:   "rgba(248,113,113,0.10)",
  danger:     "#f87171",
  dangerBorder: "rgba(248,113,113,0.35)",
  white:      "#ffffff",
};

export function SubscriptionBanner({ sub }: { sub: SubscriptionInfo | null }) {
  if (!sub) return null;
  if (!sub.expires_soon && !sub.expired) return null;

  const isExpired = sub.expired;
  const tone = isExpired ? T.danger : T.warn;
  const bg = isExpired ? T.dangerBg : T.warnBg;
  const border = isExpired ? T.dangerBorder : T.warnBorder;
  const Icon = isExpired ? AlertTriangle : Clock;

  const title = isExpired
    ? "Your subscription has expired"
    : `Your subscription expires in ${sub.days_remaining} day${sub.days_remaining === 1 ? "" : "s"}`;
  const message = isExpired
    ? "Contact your account manager to renew. The workspace will become read-only soon."
    : `Renew before ${new Date(sub.end_date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })} to avoid service interruption.`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 18px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `${tone}1f`,
          border: `1px solid ${tone}3f`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={17} style={{ color: tone }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#cbd5e1" }}>{message}</div>
      </div>
    </div>
  );
}
