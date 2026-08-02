import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { captureException } from "../../lib/sentry";

/**
 * DepartmentTrendChart — one line per department, months across the bottom, the
 * chosen metric (0–100) up the side. Higher and rising is always better.
 *
 * Three metrics share this component because they share a shape and a story;
 * the caller picks which one is plotted:
 *
 *   courseProgress — share of assigned training completed. Are they doing it?
 *   awareness      — assessment results and phishing resistance, weighted 2:1.
 *                    Do they actually know it, and do they fall for attacks?
 *   maturity       — all three components together; the headline number.
 *
 * Data comes from `department_metric_snapshots`, written monthly by cron. The
 * chart never recomputes history on load: doing that per page view was tens of
 * thousands of index lookups at ten companies and 1500 employees.
 *
 * Every metric scores missing evidence as the worst case, not the best. An
 * employee nobody has trained or tested counts as 0, so a department starts low
 * and climbs as the work gets done — which is the line a customer is paying to
 * see, and the honest one.
 *
 * The series palette is the validated categorical set for a dark surface: eight
 * fixed slots, assigned in order and never cycled. Colour follows the department,
 * not its rank, so toggling one off in the legend never repaints the others.
 * Past eight departments the remainder folds into a single "Other" line rather
 * than inventing a ninth hue that nobody could tell apart — the count is stated
 * in the caption so nothing is silently dropped.
 */

/* Categorical slots for a dark surface. Validated against this app's card
 * background (#1a1e0e): lightness band, chroma floor, CVD separation, normal
 * vision separation and 3:1 contrast all pass for the full set of eight. */
const SERIES_COLORS = [
  "#3987e5", // blue
  "#d95926", // orange
  "#199e70", // aqua
  "#c98500", // yellow
  "#d55181", // magenta
  "#008300", // green
  "#9085e9", // violet
  "#e66767", // red
] as const;

const OTHER_COLOR = "#8a9a6a";
const MAX_SERIES = SERIES_COLORS.length;

export type DepartmentMetric = "courseProgress" | "awareness" | "maturity";

interface TrendRow {
  month_start: string;
  department_id: string;
  department_name: string;
  course_progress: number | null;
  awareness: number | null;
  maturity: number | null;
  employees: number;
  measured_employees: number;
}

const METRIC_COLUMN: Record<DepartmentMetric, "course_progress" | "awareness" | "maturity"> = {
  courseProgress: "course_progress",
  awareness: "awareness",
  maturity: "maturity",
};

const METRIC_COPY: Record<DepartmentMetric, { title: string; caption: string }> = {
  courseProgress: {
    title: "Course progress by department",
    caption:
      "Share of assigned training completed each month. Employees with no courses assigned count as 0%, so a department is not flattered by never being given work.",
  },
  awareness: {
    title: "Security awareness by department",
    caption:
      "Assessment results and phishing resistance combined, weighted 2:1. Never assessed and never simulated both count as 0 — untested is not the same as safe.",
  },
  maturity: {
    title: "Overall maturity by department",
    caption:
      "Training, assessments and phishing resistance together — 100 minus the risk score. Higher is better.",
  },
};

interface Series {
  key: string;
  name: string;
  color: string;
  /** One entry per month; null where the department had nothing measured yet. */
  points: (number | null)[];
}

export interface DepartmentTrendChartProps {
  companyId: string | undefined;
  /** Which of the three measures to plot. */
  metric: DepartmentMetric;
  months?: number;
  /** Theme tokens from the host page — this chart is embedded in two different shells. */
  tokens: {
    bgCard: string;
    border: string;
    text: string;
    textMuted: string;
    textSub: string;
    accent: string;
  };
  title?: string;
  height?: number;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return MONTH_LABELS[d.getUTCMonth()];
}

function monthTitle(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export const DepartmentTrendChart = ({
  companyId,
  metric,
  months = 12,
  tokens: T,
  title,
  height = 320,
}: DepartmentTrendChartProps) => {
  const copy = METRIC_COPY[metric];
  const heading = title ?? copy.title;
  const [rows, setRows] = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const plotRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!companyId) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc("get_department_metric_trend", {
          p_company_id: companyId,
          p_months: months,
        });
        if (rpcError) throw new Error(rpcError.message);
        if (!cancelled) setRows((data ?? []) as TrendRow[]);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // An empty chart with no explanation reads as "no departments", which is
        // a very different thing from "the query failed".
        console.error(`[DepartmentTrendChart:${metric}] load failed:`, message, err);
        captureException(err, { scope: "DepartmentTrendChart", metric, companyId });
        if (!cancelled) { setError(message); setRows([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [companyId, months, metric]);

  /* ── Shape the flat rows into month buckets and per-department series ── */
  const { monthKeys, series, foldedCount } = useMemo(() => {
    if (rows.length === 0) return { monthKeys: [] as string[], series: [] as Series[], foldedCount: 0 };

    const keys = Array.from(new Set(rows.map((r) => r.month_start))).sort();
    const idxOf = new Map(keys.map((k, i) => [k, i]));

    const byDept = new Map<string, { name: string; points: (number | null)[]; latest: number }>();
    for (const r of rows) {
      let entry = byDept.get(r.department_id);
      if (!entry) {
        entry = { name: r.department_name, points: new Array(keys.length).fill(null), latest: -1 };
        byDept.set(r.department_id, entry);
      }
      const i = idxOf.get(r.month_start);
      if (i !== undefined) {
        const raw = r[METRIC_COLUMN[metric]];
        const value = raw === null || raw === undefined ? null : Number(raw);
        entry.points[i] = value;
        if (value !== null) entry.latest = value;
      }
    }

    // Rank by the most recent known value, lowest first, so the departments that
    // need attention keep their own colour instead of being folded into "Other".
    const ranked = Array.from(byDept.entries()).sort((a, b) => a[1].latest - b[1].latest);

    const kept = ranked.slice(0, MAX_SERIES);
    const folded = ranked.slice(MAX_SERIES);

    const out: Series[] = kept.map(([id, d], i) => ({
      key: id,
      name: d.name,
      color: SERIES_COLORS[i],
      points: d.points,
    }));

    if (folded.length > 0) {
      // Mean of the remainder, month by month, ignoring months they had no data.
      const points = keys.map((_, i) => {
        const vals = folded.map(([, d]) => d.points[i]).filter((v): v is number => v !== null);
        if (vals.length === 0) return null;
        return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
      });
      out.push({ key: "__other__", name: `Other (${folded.length})`, color: OTHER_COLOR, points });
    }

    return { monthKeys: keys, series: out, foldedCount: folded.length };
  }, [rows, metric]);

  const visible = series.filter((s) => !hidden.has(s.key));

  const toggleSeries = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /* ── Geometry ── */
  const W = 760;
  const H = height;
  const PAD = { top: 16, right: 18, bottom: 34, left: 40 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const n = monthKeys.length;

  const xAt = (i: number) => (n <= 1 ? PAD.left + plotW / 2 : PAD.left + (i * plotW) / (n - 1));
  const yAt = (v: number) => PAD.top + plotH * (1 - Math.max(0, Math.min(100, v)) / 100);

  /** Break the path wherever a month has no data, so a gap reads as a gap. */
  const pathFor = (points: (number | null)[]) => {
    let d = "";
    let pen = false;
    points.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const svg = plotRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const ratio = (x - PAD.left) / (plotW || 1);
    const idx = Math.round(ratio * (n - 1));
    setHoverIdx(Math.max(0, Math.min(n - 1, idx)));
  }, [n, plotW, PAD.left]);

  const card: React.CSSProperties = {
    background: T.bgCard,
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    padding: 20,
  };

  /* ── States that are not a chart ── */
  if (loading) {
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.textMuted, fontSize: 13 }}>
          <Loader2 size={15} style={{ animation: "aw-dmt-spin 0.8s linear infinite" }} />
          Loading trend…
        </div>
        <style>{`@keyframes aw-dmt-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <AlertTriangle size={16} style={{ color: "#ff8800", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Could not load the trend</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4, lineHeight: 1.6 }}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (series.length === 0 || n === 0) {
    return (
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>{heading}</div>
        <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>
          No monthly data yet. Snapshots are written nightly, so this fills in from the first run
          after departments have employees.
        </div>
      </div>
    );
  }

  const gridLines = [0, 25, 50, 75, 100];

  return (
    <div style={card}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
        <TrendingUp size={16} style={{ color: T.accent }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{heading}</div>
      </div>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
        {copy.caption}
        {foldedCount > 0 && ` The ${foldedCount} highest-scoring departments are combined into one "Other" line.`}
      </div>

      {/* ── Legend: identity is never colour alone ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginBottom: 12 }}>
        {series.map((s) => {
          const off = hidden.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleSeries(s.key)}
              aria-pressed={!off}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "none", border: "none", padding: 0, cursor: "pointer",
                fontSize: 12, fontFamily: "inherit",
                color: off ? T.textMuted : T.textSub,
                opacity: off ? 0.5 : 1,
                textDecoration: off ? "line-through" : "none",
              }}
            >
              <span style={{
                width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                background: s.color,
              }} />
              {s.name}
            </button>
          );
        })}
      </div>

      {/* ── Plot ── */}
      <div style={{ position: "relative", overflowX: "auto" }}>
        <svg
          ref={plotRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          role="img"
          aria-label={`${heading}, ${monthTitle(monthKeys[0])} to ${monthTitle(monthKeys[n - 1])}`}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHoverIdx(null)}
          style={{ display: "block", touchAction: "pan-y" }}
        >
          {/* Recessive grid */}
          {gridLines.map((g) => (
            <g key={g}>
              <line
                x1={PAD.left} x2={W - PAD.right} y1={yAt(g)} y2={yAt(g)}
                stroke={T.border} strokeWidth={1}
              />
              <text
                x={PAD.left - 8} y={yAt(g) + 3.5} textAnchor="end"
                fill={T.textMuted} fontSize={10}
              >
                {g}
              </text>
            </g>
          ))}

          {/* Month labels — thinned on narrow ranges so they never collide */}
          {monthKeys.map((k, i) => {
            const step = n > 8 ? Math.ceil(n / 8) : 1;
            if (i % step !== 0 && i !== n - 1) return null;
            return (
              <text
                key={k} x={xAt(i)} y={H - PAD.bottom + 16} textAnchor="middle"
                fill={T.textMuted} fontSize={10}
              >
                {monthLabel(k)}
              </text>
            );
          })}

          {/* Crosshair */}
          {hoverIdx !== null && (
            <line
              x1={xAt(hoverIdx)} x2={xAt(hoverIdx)} y1={PAD.top} y2={PAD.top + plotH}
              stroke={T.textMuted} strokeWidth={1} strokeDasharray="3 3"
            />
          )}

          {/* Series */}
          {visible.map((s) => (
            <path
              key={s.key}
              d={pathFor(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Markers on the hovered month, ringed against the surface */}
          {hoverIdx !== null && visible.map((s) => {
            const v = s.points[hoverIdx];
            if (v === null) return null;
            return (
              <circle
                key={s.key}
                cx={xAt(hoverIdx)} cy={yAt(v)} r={4.5}
                fill={s.color} stroke={T.bgCard} strokeWidth={2}
              />
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoverIdx !== null && (
          <div
            style={{
              position: "absolute", top: 8,
              left: `${(xAt(hoverIdx) / W) * 100}%`,
              transform: xAt(hoverIdx) > W / 2 ? "translateX(-104%)" : "translateX(4%)",
              background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: "8px 10px", pointerEvents: "none", minWidth: 150,
              boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 6 }}>
              {monthTitle(monthKeys[hoverIdx])}
            </div>
            {visible.map((s) => (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, marginTop: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{ color: T.textSub, flex: 1, whiteSpace: "nowrap" }}>{s.name}</span>
                <span style={{ color: T.text, fontVariantNumeric: "tabular-nums" }}>
                  {s.points[hoverIdx] === null ? "—" : s.points[hoverIdx]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Table view: the same numbers without relying on colour ── */}
      <button
        type="button"
        onClick={() => setShowTable((v) => !v)}
        style={{
          marginTop: 12, background: "none", border: "none", padding: 0, cursor: "pointer",
          fontSize: 12, color: T.textMuted, fontFamily: "inherit", textDecoration: "underline",
        }}
      >
        {showTable ? "Hide table" : "View as table"}
      </button>

      {showTable && (
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 8px", color: T.textMuted, fontWeight: 600, whiteSpace: "nowrap" }}>
                  Department
                </th>
                {monthKeys.map((k) => (
                  <th key={k} style={{ textAlign: "right", padding: "6px 8px", color: T.textMuted, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {monthLabel(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.key} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: "6px 8px", color: T.textSub, whiteSpace: "nowrap" }}>{s.name}</td>
                  {s.points.map((v, i) => (
                    <td key={i} style={{ padding: "6px 8px", textAlign: "right", color: T.text, fontVariantNumeric: "tabular-nums" }}>
                      {v === null ? "—" : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DepartmentTrendChart;
