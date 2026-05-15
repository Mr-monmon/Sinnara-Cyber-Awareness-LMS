import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle, CheckCircle, Shield, TrendingDown,
  Users, ChevronDown, ChevronUp, RefreshCw, Search,
  BookOpen, ClipboardCheck, Mail,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

const T = {
  bg: "#12140a",
  bgCard: "#1a1e0e",
  bgHover: "#1e2410",
  border: "rgba(200,255,0,0.12)",
  accent: "#c8ff00",
  text: "#e8f5d0",
  textMuted: "#6b7a4a",
  textSub: "#9aaa6a",
  red: "#ff4444",
  orange: "#ff8800",
  yellow: "#ffcc00",
  green: "#44ff88",
  blue: "#4488ff",
  redBg: "rgba(255,68,68,0.08)",
  redBorder: "rgba(255,68,68,0.20)",
  orangeBg: "rgba(255,136,0,0.08)",
  orangeBorder: "rgba(255,136,0,0.20)",
  yellowBg: "rgba(255,204,0,0.08)",
  yellowBorder: "rgba(255,204,0,0.20)",
  greenBg: "rgba(68,255,136,0.08)",
  greenBorder: "rgba(68,255,136,0.20)",
};

interface RiskRow {
  employee_id: string;
  company_id: string;
  full_name: string;
  email: string;
  department_id: string | null;
  department_name: string | null;
  course_risk: number;
  exam_risk: number;
  phishing_risk: number;
  risk_score: number;
  risk_level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  total_assigned: number;
  completed: number;
  completion_pct: number;
  avg_exam_pct: number;
  phishing_total: number;
  phishing_clicked: number;
  phishing_creds_entered: number;
}

const LEVEL_CONFIG = {
  CRITICAL: { color: T.red,    bg: T.redBg,    border: T.redBorder,    icon: AlertTriangle, label: "Critical" },
  HIGH:     { color: T.orange, bg: T.orangeBg, border: T.orangeBorder, icon: TrendingDown,  label: "High"     },
  MEDIUM:   { color: T.yellow, bg: T.yellowBg, border: T.yellowBorder, icon: Shield,        label: "Medium"   },
  LOW:      { color: T.green,  bg: T.greenBg,  border: T.greenBorder,  icon: CheckCircle,   label: "Low"      },
};

function RiskBadge({ level }: { level: RiskRow["risk_level"] }) {
  const cfg = LEVEL_CONFIG[level];
  const Icon = cfg.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 9999,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      fontSize: 11, fontWeight: 700, color: cfg.color, letterSpacing: "0.5px",
    }}>
      <Icon size={11} />
      {cfg.label.toUpperCase()}
    </span>
  );
}

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        flex: 1, height: 6, background: "rgba(255,255,255,0.06)",
        borderRadius: 3, overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: color, borderRadius: 3,
          transition: "width 0.4s ease",
        }} />
      </div>
      <span style={{ fontSize: 11, color: T.textSub, minWidth: 26, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

type SortKey = "risk_score" | "full_name" | "completion_pct" | "avg_exam_pct" | "phishing_clicked";

export function RiskScorePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState<"all" | RiskRow["risk_level"]>("all");
  const [sortKey, setSortKey] = useState<SortKey>("risk_score");
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.company_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("employee_risk_scores")
      .select("*")
      .eq("company_id", user.company_id);
    if (!error && data) setRows(data as RiskRow[]);
    setLoading(false);
  }, [user?.company_id]);

  useEffect(() => { load(); }, [load]);

  const departments = Array.from(new Set(rows.map(r => r.department_name).filter(Boolean))) as string[];

  const filtered = rows
    .filter(r => {
      if (search && !r.full_name.toLowerCase().includes(search.toLowerCase()) &&
          !r.email.toLowerCase().includes(search.toLowerCase())) return false;
      if (deptFilter !== "all" && r.department_name !== deptFilter) return false;
      if (levelFilter !== "all" && r.risk_level !== levelFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      if (typeof av === "string") return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

  const stats = {
    total: rows.length,
    critical: rows.filter(r => r.risk_level === "CRITICAL").length,
    high: rows.filter(r => r.risk_level === "HIGH").length,
    medium: rows.filter(r => r.risk_level === "MEDIUM").length,
    low: rows.filter(r => r.risk_level === "LOW").length,
    avgScore: rows.length ? Math.round(rows.reduce((s, r) => s + r.risk_score, 0) / rows.length) : 0,
  };

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortAsc ? <ChevronUp size={12} style={{ color: T.accent }} /> : <ChevronDown size={12} style={{ color: T.accent }} />)
      : <ChevronDown size={12} style={{ color: T.textMuted }} />;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: T.textMuted, fontSize: 14 }}>
        Loading risk scores…
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 0", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Employee Risk Scores</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
            Cyber risk per employee — courses, exams, phishing
          </div>
        </div>
        <button
          onClick={load}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: "rgba(200,255,0,0.08)", border: "1px solid rgba(200,255,0,0.20)",
            color: T.accent, fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
        {([
          { label: "Total Employees", value: stats.total,    color: T.text,   bg: "rgba(255,255,255,0.04)", border: T.border },
          { label: "Critical Risk",   value: stats.critical, color: T.red,    bg: T.redBg,    border: T.redBorder    },
          { label: "High Risk",       value: stats.high,     color: T.orange, bg: T.orangeBg, border: T.orangeBorder },
          { label: "Medium Risk",     value: stats.medium,   color: T.yellow, bg: T.yellowBg, border: T.yellowBorder },
          { label: "Low Risk",        value: stats.low,      color: T.green,  bg: T.greenBg,  border: T.greenBorder  },
          { label: "Avg Risk Score",  value: stats.avgScore, color: T.text,   bg: "rgba(255,255,255,0.04)", border: T.border },
        ] as const).map(card => (
          <div key={card.label} style={{
            padding: "14px 16px", borderRadius: 10,
            background: card.bg, border: `1px solid ${card.border}`,
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.5px" }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employee…"
            style={{
              width: "100%", padding: "8px 10px 8px 32px",
              background: T.bgCard, border: `1px solid ${T.border}`,
              borderRadius: 8, color: T.text, fontSize: 13, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Department */}
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          style={{
            padding: "8px 12px", background: T.bgCard,
            border: `1px solid ${T.border}`, borderRadius: 8,
            color: T.text, fontSize: 13, outline: "none", cursor: "pointer",
          }}
        >
          <option value="all">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* Risk level */}
        <select
          value={levelFilter}
          onChange={e => setLevelFilter(e.target.value as typeof levelFilter)}
          style={{
            padding: "8px 12px", background: T.bgCard,
            border: `1px solid ${T.border}`, borderRadius: 8,
            color: T.text, fontSize: 13, outline: "none", cursor: "pointer",
          }}
        >
          <option value="all">All Risk Levels</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 80px",
          padding: "10px 16px",
          background: "rgba(200,255,0,0.04)",
          borderBottom: `1px solid ${T.border}`,
          gap: 8,
        }}>
          {([
            { label: "Employee",        key: "full_name"       },
            { label: "Risk Score",      key: "risk_score"      },
            { label: "Courses",         key: "completion_pct"  },
            { label: "Exams",           key: "avg_exam_pct"    },
            { label: "Phishing Clicks", key: "phishing_clicked"},
          ] as { label: string; key: SortKey }[]).map(col => (
            <button
              key={col.key}
              onClick={() => toggleSort(col.key)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 11, fontWeight: 700, color: T.textMuted,
                textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "left",
                padding: 0,
              }}
            >
              {col.label} <SortIcon k={col.key} />
            </button>
          ))}
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Level</div>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 14 }}>
            No employees found.
          </div>
        )}

        {filtered.map(row => {
          const isExpanded = expanded === row.employee_id;
          const cfg = LEVEL_CONFIG[row.risk_level];
          return (
            <div key={row.employee_id} style={{ borderBottom: `1px solid ${T.border}` }}>
              {/* Main row */}
              <div
                onClick={() => setExpanded(isExpanded ? null : row.employee_id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 80px",
                  padding: "12px 16px",
                  gap: 8,
                  cursor: "pointer",
                  background: isExpanded ? T.bgHover : "transparent",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = "rgba(200,255,0,0.03)"; }}
                onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
              >
                {/* Name + dept */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{row.full_name}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{row.department_name ?? "No department"}</div>
                </div>

                {/* Risk score */}
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: cfg.color }}>{row.risk_score}</div>
                  <div style={{ fontSize: 10, color: T.textMuted }}>/ 100</div>
                </div>

                {/* Course completion */}
                <div>
                  <div style={{ fontSize: 12, color: T.text, marginBottom: 4 }}>{row.completion_pct}%</div>
                  <ScoreBar value={row.course_risk} max={40} color={T.orange} />
                </div>

                {/* Exam score */}
                <div>
                  <div style={{ fontSize: 12, color: T.text, marginBottom: 4 }}>{row.avg_exam_pct}%</div>
                  <ScoreBar value={row.exam_risk} max={40} color={T.yellow} />
                </div>

                {/* Phishing */}
                <div>
                  <div style={{ fontSize: 12, color: T.text, marginBottom: 4 }}>
                    {row.phishing_clicked}/{row.phishing_total}
                  </div>
                  <ScoreBar value={row.phishing_risk} max={20} color={T.red} />
                </div>

                {/* Badge */}
                <div style={{ display: "flex", alignItems: "center" }}>
                  <RiskBadge level={row.risk_level} />
                </div>
              </div>

              {/* Expanded breakdown */}
              {isExpanded && (
                <div style={{
                  padding: "16px 16px 20px",
                  background: "rgba(200,255,0,0.02)",
                  borderTop: `1px solid ${T.border}`,
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>

                    {/* Courses breakdown */}
                    <div style={{
                      padding: 14, borderRadius: 8,
                      background: T.bgCard, border: `1px solid ${T.border}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                        <BookOpen size={14} color={T.orange} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Course Completion</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: T.textMuted }}>Assigned</span>
                        <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{row.total_assigned}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: T.textMuted }}>Completed</span>
                        <span style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>{row.completed}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: T.textMuted }}>Pending</span>
                        <span style={{ fontSize: 12, color: T.orange, fontWeight: 600 }}>{row.total_assigned - row.completed}</span>
                      </div>
                      <div style={{ height: 1, background: T.border, marginBottom: 8 }} />
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: T.textMuted }}>Risk contribution</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.orange }}>{row.course_risk} / 40 pts</span>
                      </div>
                    </div>

                    {/* Exams breakdown */}
                    <div style={{
                      padding: 14, borderRadius: 8,
                      background: T.bgCard, border: `1px solid ${T.border}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                        <ClipboardCheck size={14} color={T.yellow} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Exam Performance</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: T.textMuted }}>Average score</span>
                        <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{row.avg_exam_pct}%</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: T.textMuted }}>Status</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: row.avg_exam_pct >= 70 ? T.green : T.red }}>
                          {row.avg_exam_pct >= 70 ? "Passing" : "Needs Improvement"}
                        </span>
                      </div>
                      <div style={{ height: 1, background: T.border, marginBottom: 8 }} />
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: T.textMuted }}>Risk contribution</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.yellow }}>{row.exam_risk} / 40 pts</span>
                      </div>
                    </div>

                    {/* Phishing breakdown */}
                    <div style={{
                      padding: 14, borderRadius: 8,
                      background: T.bgCard, border: `1px solid ${T.border}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                        <Mail size={14} color={T.red} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Phishing Susceptibility</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: T.textMuted }}>Campaigns targeted</span>
                        <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{row.phishing_total}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: T.textMuted }}>Clicked link</span>
                        <span style={{ fontSize: 12, color: T.orange, fontWeight: 600 }}>{row.phishing_clicked}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: T.textMuted }}>Entered credentials</span>
                        <span style={{ fontSize: 12, color: T.red, fontWeight: 600 }}>{row.phishing_creds_entered}</span>
                      </div>
                      <div style={{ height: 1, background: T.border, marginBottom: 8 }} />
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: T.textMuted }}>Risk contribution</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.red }}>{row.phishing_risk} / 20 pts</span>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: T.textMuted, textAlign: "right" }}>
          Showing {filtered.length} of {rows.length} employees
        </div>
      )}

      {/* Legend */}
      <div style={{
        marginTop: 20, padding: "12px 16px", borderRadius: 10,
        background: T.bgCard, border: `1px solid ${T.border}`,
        display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center",
      }}>
        <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Score formula:</span>
        <span style={{ fontSize: 11, color: T.orange }}>Courses (0–40)</span>
        <span style={{ fontSize: 11, color: T.textMuted }}>+</span>
        <span style={{ fontSize: 11, color: T.yellow }}>Exams (0–40)</span>
        <span style={{ fontSize: 11, color: T.textMuted }}>+</span>
        <span style={{ fontSize: 11, color: T.red }}>Phishing (0–20)</span>
        <span style={{ fontSize: 11, color: T.textMuted }}>=</span>
        <span style={{ fontSize: 11, color: T.text }}>Risk Score (0–100). Higher = more risk.</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
          {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map(l => (
            <span key={l} style={{ fontSize: 11, color: LEVEL_CONFIG[l].color }}>
              {LEVEL_CONFIG[l].label}: {l === "CRITICAL" ? "≥70" : l === "HIGH" ? "≥40" : l === "MEDIUM" ? "≥20" : "<20"}
            </span>
          ))}
        </div>
      </div>

    </div>
  );
}
