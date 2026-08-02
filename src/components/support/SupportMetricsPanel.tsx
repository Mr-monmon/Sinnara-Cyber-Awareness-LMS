import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { captureException } from "../../lib/sentry";

/**
 * SupportMetricsPanel — how long customers are actually waiting.
 *
 * Two numbers matter and they answer different questions. The medians say how
 * the queue has been handled over the window; "overdue" says what needs doing
 * today. A dashboard with only the first is a report, not a tool.
 *
 * Medians rather than averages throughout: a single ticket left over a weekend
 * moves a mean far enough to hide how the other ninety-nine were handled.
 *
 * "Overdue" counts tickets still unanswered and already past the target for
 * their priority (4h urgent, 8h high, 24h normal, 72h low — defined once in
 * `support_first_response_target_hours`). A ticket answered late is late, but it
 * is no longer something to act on now, so it is not counted here.
 */

interface MetricRow {
  priority: string;
  tickets: number;
  open_tickets: number;
  awaiting_first_reply: number;
  overdue_first_reply: number;
  median_first_response_h: number | null;
  median_resolution_h: number | null;
}

const PRIORITY_LABEL: Record<string, string> = {
  all: "All priorities",
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};

const PRIORITY_COLOR: Record<string, string> = {
  all: "#c8ff00",
  urgent: "#f87171",
  high: "#fb923c",
  normal: "#60a5fa",
  low: "#94a3b8",
};

const WINDOWS = [7, 30, 90] as const;

function formatHours(h: number | null): string {
  if (h === null || h === undefined || !Number.isFinite(Number(h))) return "—";
  const hours = Number(h);
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export interface SupportMetricsPanelProps {
  tokens: {
    bgCard: string;
    bgHover: string;
    border: string;
    borderFaint: string;
    text: string;
    textMuted: string;
    textSub: string;
    accent: string;
    red: string;
  };
}

export const SupportMetricsPanel = ({ tokens: T }: SupportMetricsPanelProps) => {
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc("get_support_response_metrics", { p_days: days });
      if (e) throw new Error(e.message);
      setRows((data ?? []) as MetricRow[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[SupportMetricsPanel] load failed:", message, err);
      captureException(err, { scope: "SupportMetricsPanel", days });
      setError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const total = rows.find((r) => r.priority === "all");
  const byPriority = rows.filter((r) => r.priority !== "all");
  const overdue = total?.overdue_first_reply ?? 0;

  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Clock size={16} style={{ color: T.accent }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Response times</div>

        <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDays(w)}
              style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 12, fontFamily: "inherit", cursor: "pointer",
                background: days === w ? `${T.accent}1a` : "transparent",
                border: `1px solid ${days === w ? T.accent + "55" : T.border}`,
                color: days === w ? T.accent : T.textMuted,
              }}
            >
              {w}d
            </button>
          ))}
          <button
            type="button"
            onClick={() => void load()}
            title="Refresh"
            style={{ padding: "5px 9px", borderRadius: 8, background: "transparent", border: `1px solid ${T.border}`, color: T.textMuted, cursor: "pointer", display: "inline-flex" }}
          >
            <RefreshCw size={13} style={loading ? { animation: "aw-smp-spin 0.8s linear infinite" } : undefined} />
          </button>
        </div>
        <style>{`@keyframes aw-smp-spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {loading && rows.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.textMuted, fontSize: 13 }}>
          <Loader2 size={14} style={{ animation: "aw-smp-spin 0.8s linear infinite" }} /> Loading…
        </div>
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 8, background: "rgba(255,136,0,0.08)", border: "1px solid rgba(255,136,0,0.25)" }}>
          <AlertTriangle size={15} style={{ color: "#ff8800", flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.6 }}>{error}</div>
        </div>
      )}

      {!error && rows.length > 0 && (
        <>
          {/* The number that is a call to action, not a report. */}
          {overdue > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", marginBottom: 14,
              borderRadius: 10, background: `${T.red}14`, border: `1px solid ${T.red}40`,
            }}>
              <AlertTriangle size={16} style={{ color: T.red, flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: T.text }}>
                <strong>{overdue}</strong> {overdue === 1 ? "ticket is" : "tickets are"} past the first-response
                target and still unanswered.
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Tickets in window", value: String(total?.tickets ?? 0) },
              { label: "Still open", value: String(total?.open_tickets ?? 0) },
              { label: "Awaiting first reply", value: String(total?.awaiting_first_reply ?? 0) },
              { label: "Median first reply", value: formatHours(total?.median_first_response_h ?? null) },
              { label: "Median time to close", value: formatHours(total?.median_resolution_h ?? null) },
            ].map((k) => (
              <div key={k.label} style={{ padding: "12px 14px", borderRadius: 10, background: T.bgHover, border: `1px solid ${T.borderFaint}` }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.text, fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{k.label}</div>
              </div>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Priority", "Tickets", "Open", "Awaiting reply", "Overdue", "Median first reply", "Median to close"].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 10px", color: T.textMuted, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byPriority.map((r) => (
                  <tr key={r.priority} style={{ borderTop: `1px solid ${T.borderFaint}` }}>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: T.textSub }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: PRIORITY_COLOR[r.priority] ?? T.textMuted }} />
                        {PRIORITY_LABEL[r.priority] ?? r.priority}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: T.text, fontVariantNumeric: "tabular-nums" }}>{r.tickets}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: T.text, fontVariantNumeric: "tabular-nums" }}>{r.open_tickets}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: T.text, fontVariantNumeric: "tabular-nums" }}>{r.awaiting_first_reply}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: r.overdue_first_reply > 0 ? T.red : T.textMuted }}>
                      {r.overdue_first_reply}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: T.text, fontVariantNumeric: "tabular-nums" }}>{formatHours(r.median_first_response_h)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: T.text, fontVariantNumeric: "tabular-nums" }}>{formatHours(r.median_resolution_h)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 11, color: T.textMuted, marginTop: 12, lineHeight: 1.6 }}>
            A first response is the first reply from someone other than the requester; internal notes
            do not count. Targets are 4h urgent, 8h high, 24h normal, 72h low. Medians are used because
            one ticket left over a weekend moves an average far enough to hide the rest.
          </p>
        </>
      )}
    </div>
  );
};

export default SupportMetricsPanel;
