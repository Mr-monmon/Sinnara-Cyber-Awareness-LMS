import { useState, useEffect, useCallback } from "react";
import {
  Download, RefreshCw, Users, BookOpen,
  ClipboardCheck, Shield, TrendingUp, AlertTriangle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

const T = {
  bg: "#12140a", bgCard: "#1a1e0e", bgHover: "#1e2410",
  border: "rgba(200,255,0,0.12)", accent: "#c8ff00",
  text: "#e8f5d0", textMuted: "#6b7a4a", textSub: "#9aaa6a",
  red: "#ff4444", orange: "#ff8800", yellow: "#ffcc00",
  green: "#44ff88", blue: "#4488ff", purple: "#aa88ff",
  redBg: "rgba(255,68,68,0.08)", redBorder: "rgba(255,68,68,0.20)",
  orangeBg: "rgba(255,136,0,0.08)", orangeBorder: "rgba(255,136,0,0.20)",
  yellowBg: "rgba(255,204,0,0.08)", yellowBorder: "rgba(255,204,0,0.20)",
  greenBg: "rgba(68,255,136,0.08)", greenBorder: "rgba(68,255,136,0.20)",
  blueBg: "rgba(68,136,255,0.08)", purpleBg: "rgba(170,136,255,0.08)",
};

/* ── Types ─────────────────────────────────────── */
interface DeptStat {
  department_id: string;
  department_name: string;
  employee_count: number;
  completed: number;
  total_assigned: number;
  avg_risk_score: number;
  avg_exam_pct: number;
  phishing_clicked: number;
  phishing_total: number;
}

interface CourseStat {
  course_id: string;
  title: string;
  total_assigned: number;
  completed: number;
  completion_pct: number;
}

interface RiskDist {
  level: string;
  count: number;
  color: string;
}

interface PhishingTrend {
  campaign_name: string;
  total_targets: number;
  opened: number;
  clicked: number;
  creds: number;
  reported: number;
  click_rate: number;
  open_rate: number;
  cred_rate: number;
  report_rate: number;
}

interface Overview {
  total_employees: number;
  completion_pct: number;
  avg_exam_score: number;
  avg_risk_score: number;
  phishing_click_rate: number;
  critical_count: number;
}

/* ── Helpers ────────────────────────────────────── */
function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map(r =>
      headers.map(h => {
        const v = String(r[h] ?? "").replace(/"/g, '""');
        return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v}"` : v;
      }).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ── SVG Bar Chart ──────────────────────────────── */
function HBarChart({ items, valueKey, labelKey, color, maxVal }: {
  items: Record<string, unknown>[];
  valueKey: string;
  labelKey: string;
  color: string;
  maxVal?: number;
}) {
  const max = maxVal ?? Math.max(...items.map(i => Number(i[valueKey]) || 0), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => {
        const val = Number(item[valueKey]) || 0;
        const pct = (val / max) * 100;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 100, fontSize: 11, color: T.textSub, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {String(item[labelKey])}
            </div>
            <div style={{ flex: 1, height: 20, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                width: `${pct}%`, height: "100%",
                background: color, borderRadius: 4,
                transition: "width 0.5s ease",
                display: "flex", alignItems: "center", justifyContent: "flex-end",
              }}>
                {pct > 15 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#000", paddingRight: 6 }}>
                    {val}%
                  </span>
                )}
              </div>
            </div>
            {pct <= 15 && (
              <span style={{ fontSize: 11, color: T.textSub, minWidth: 32 }}>{val}%</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Donut ──────────────────────────────────────── */
function Donut({ segments, size = 100 }: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = 36; const cx = size / 2; const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={14} />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ;
        const gap = circ - dash;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={seg.color} strokeWidth={14}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        offset += dash;
        return el;
      })}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 14, fontWeight: 800, fill: T.text }}>
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle"
        style={{ fontSize: 8, fill: T.textMuted }}>
        employees
      </text>
    </svg>
  );
}

/* ── Section wrapper ────────────────────────────── */
function Section({ title, icon: Icon, color, children, onExport }: {
  title: string; icon: React.ElementType; color: string;
  children: React.ReactNode; onExport?: () => void;
}) {
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px", borderBottom: `1px solid ${T.border}`,
        background: "rgba(200,255,0,0.03)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon size={16} color={color} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{title}</span>
        </div>
        {onExport && (
          <button onClick={onExport} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 10px", borderRadius: 6,
            background: "rgba(68,136,255,0.1)", border: "1px solid rgba(68,136,255,0.25)",
            color: T.blue, fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}>
            <Download size={11} /> Export CSV
          </button>
        )}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────── */
export function AdvancedAnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [deptStats, setDeptStats] = useState<DeptStat[]>([]);
  const [courseStats, setCourseStats] = useState<CourseStat[]>([]);
  const [riskDist, setRiskDist] = useState<RiskDist[]>([]);
  const [phishingTrends, setPhishingTrends] = useState<PhishingTrend[]>([]);

  const load = useCallback(async () => {
    if (!user?.company_id) return;
    setLoading(true);
    const cid = user.company_id;

    // 1. Risk scores view — covers most metrics
    const { data: riskRows } = await supabase
      .from("employee_risk_scores")
      .select("*")
      .eq("company_id", cid);

    // 2. Course stats per course
    const { data: courseData } = await supabase
      .from("employee_courses")
      .select("course_id, status, courses(id, title)")
      .in("employee_id",
        (await supabase.from("users").select("id").eq("company_id", cid).eq("role", "EMPLOYEE"))
          .data?.map((u: { id: string }) => u.id) ?? []
      );

    // 3. Phishing campaigns for this company
    const { data: campaigns } = await supabase
      .from("phishing_campaigns")
      .select("id, name, total_queue_size, total_targets, emails_opened, links_clicked, credentials_entered, emails_reported")
      .eq("company_id", cid)
      .order("created_at", { ascending: false })
      .limit(8);

    // ── Process risk rows ──────────────────────────
    if (riskRows && riskRows.length > 0) {
      // Overview
      const total = riskRows.length;
      const avgRisk = riskRows.reduce((s, r) => s + Number(r.risk_score), 0) / total;
      const avgExam = riskRows.reduce((s, r) => s + Number(r.avg_exam_pct), 0) / total;
      const totalAssigned = riskRows.reduce((s, r) => s + Number(r.total_assigned), 0);
      const totalCompleted = riskRows.reduce((s, r) => s + Number(r.completed), 0);
      const totalPhishTargeted = riskRows.reduce((s, r) => s + Number(r.phishing_total), 0);
      const totalPhishClicked = riskRows.reduce((s, r) => s + Number(r.phishing_clicked), 0);
      const criticalCount = riskRows.filter(r => r.risk_level === "CRITICAL").length;

      setOverview({
        total_employees: total,
        completion_pct: totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0,
        avg_exam_score: Math.round(avgExam),
        avg_risk_score: Math.round(avgRisk),
        phishing_click_rate: totalPhishTargeted > 0 ? Math.round((totalPhishClicked / totalPhishTargeted) * 100) : 0,
        critical_count: criticalCount,
      });

      // Risk distribution
      const levels = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
      const levelColors = { CRITICAL: T.red, HIGH: T.orange, MEDIUM: T.yellow, LOW: T.green };
      setRiskDist(levels.map(lv => ({
        level: lv,
        count: riskRows.filter(r => r.risk_level === lv).length,
        color: levelColors[lv as keyof typeof levelColors],
      })));

      // Department stats
      const deptMap = new Map<string, DeptStat>();
      for (const r of riskRows) {
        const did = r.department_id ?? "__none__";
        const dname = r.department_name ?? "No Department";
        if (!deptMap.has(did)) {
          deptMap.set(did, {
            department_id: did, department_name: dname,
            employee_count: 0, completed: 0, total_assigned: 0,
            avg_risk_score: 0, avg_exam_pct: 0,
            phishing_clicked: 0, phishing_total: 0,
          });
        }
        const d = deptMap.get(did)!;
        d.employee_count++;
        d.completed += Number(r.completed);
        d.total_assigned += Number(r.total_assigned);
        d.avg_risk_score += Number(r.risk_score);
        d.avg_exam_pct += Number(r.avg_exam_pct);
        d.phishing_clicked += Number(r.phishing_clicked);
        d.phishing_total += Number(r.phishing_total);
      }
      const depts = Array.from(deptMap.values()).map(d => ({
        ...d,
        avg_risk_score: Math.round(d.avg_risk_score / d.employee_count),
        avg_exam_pct: Math.round(d.avg_exam_pct / d.employee_count),
      })).sort((a, b) => b.avg_risk_score - a.avg_risk_score);
      setDeptStats(depts);
    } else {
      setOverview({ total_employees: 0, completion_pct: 0, avg_exam_score: 0, avg_risk_score: 0, phishing_click_rate: 0, critical_count: 0 });
    }

    // ── Process course data ────────────────────────
    if (courseData) {
      const courseMap = new Map<string, CourseStat>();
      for (const row of courseData as any[]) {
        const cid2 = row.course_id;
        const title = row.courses?.title ?? "Unknown Course";
        if (!courseMap.has(cid2)) courseMap.set(cid2, { course_id: cid2, title, total_assigned: 0, completed: 0, completion_pct: 0 });
        const c = courseMap.get(cid2)!;
        c.total_assigned++;
        if (row.status === "COMPLETED") c.completed++;
      }
      const courses = Array.from(courseMap.values())
        .map(c => ({ ...c, completion_pct: c.total_assigned > 0 ? Math.round((c.completed / c.total_assigned) * 100) : 0 }))
        .sort((a, b) => b.total_assigned - a.total_assigned)
        .slice(0, 10);
      setCourseStats(courses);
    }

    // ── Process phishing campaigns ─────────────────
    if (campaigns) {
      setPhishingTrends(campaigns.map((c: any) => {
        // TICKET campaigns have no queue, so fall back to total_targets; otherwise
        // the denominator is 0 and the click rate is forced to 0% regardless of clicks.
        const targets = c.total_queue_size || c.total_targets || 0;
        const opened  = c.emails_opened ?? 0;
        const clicked = c.links_clicked ?? 0;
        const creds   = c.credentials_entered ?? 0;
        const reported = c.emails_reported ?? 0;
        return {
          campaign_name: c.name,
          total_targets: targets,
          opened,
          clicked,
          creds,
          reported,
          open_rate:   targets > 0 ? Math.round((opened   / targets) * 100) : 0,
          click_rate:  targets > 0 ? Math.round((clicked  / targets) * 100) : 0,
          cred_rate:   targets > 0 ? Math.round((creds    / targets) * 100) : 0,
          report_rate: targets > 0 ? Math.round((reported / targets) * 100) : 0,
        };
      }));
    }

    setLoading(false);
  }, [user?.company_id]);

  useEffect(() => { load(); }, [load]);

  // ── CSV exports ────────────────────────────────
  function exportDepts() {
    downloadCSV("departments_analytics.csv", deptStats.map(d => ({
      Department: d.department_name,
      Employees: d.employee_count,
      "Courses Completed": d.completed,
      "Courses Assigned": d.total_assigned,
      "Completion %": d.total_assigned > 0 ? Math.round((d.completed / d.total_assigned) * 100) : 0,
      "Avg Exam Score %": d.avg_exam_pct,
      "Avg Risk Score": d.avg_risk_score,
      "Phishing Clicks": d.phishing_clicked,
      "Phishing Targeted": d.phishing_total,
    })));
  }

  function exportCourses() {
    downloadCSV("courses_analytics.csv", courseStats.map(c => ({
      Course: c.title,
      "Total Assigned": c.total_assigned,
      Completed: c.completed,
      "Completion %": c.completion_pct,
    })));
  }

  function exportPhishing() {
    downloadCSV("phishing_analytics.csv", phishingTrends.map(p => ({
      Campaign: p.campaign_name,
      "Total Targets": p.total_targets,
      "Emails Opened": p.opened,
      "Open Rate %": p.open_rate,
      "Clicked Link": p.clicked,
      "Click Rate %": p.click_rate,
      "Credentials Submitted": p.creds,
      "Credential Rate %": p.cred_rate,
      "Emails Reported": p.reported,
      "Report Rate %": p.report_rate,
    })));
  }

  function exportAll() {
    // Full export combining all data
    const rows: Record<string, unknown>[] = [];
    deptStats.forEach(d => {
      rows.push({
        Section: "Department",
        Name: d.department_name,
        Employees: d.employee_count,
        "Completion %": d.total_assigned > 0 ? Math.round((d.completed / d.total_assigned) * 100) : 0,
        "Avg Exam %": d.avg_exam_pct,
        "Avg Risk Score": d.avg_risk_score,
        "Phishing Click Rate %": d.phishing_total > 0 ? Math.round((d.phishing_clicked / d.phishing_total) * 100) : 0,
      });
    });
    downloadCSV(`analytics_full_${new Date().toISOString().split("T")[0]}.csv`, rows);
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: T.textMuted, fontSize: 14 }}>
        Loading analytics…
      </div>
    );
  }

  const ov = overview!;

  return (
    <div style={{ padding: "24px 0", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Advanced Analytics</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
            Detailed performance reports — departments, courses, phishing, risk
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportAll} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: T.blueBg, border: "1px solid rgba(68,136,255,0.25)",
            color: T.blue, fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            <Download size={13} /> Export All
          </button>
          <button onClick={load} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: "rgba(200,255,0,0.08)", border: "1px solid rgba(200,255,0,0.20)",
            color: T.accent, fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        {[
          { label: "Total Employees",   value: ov.total_employees,          unit: "",   color: T.text,   icon: Users,          bg: "rgba(255,255,255,0.04)", border: T.border },
          { label: "Course Completion", value: ov.completion_pct,           unit: "%",  color: T.green,  icon: BookOpen,       bg: T.greenBg,  border: T.greenBorder  },
          { label: "Avg Exam Score",    value: ov.avg_exam_score,           unit: "%",  color: T.blue,   icon: ClipboardCheck, bg: T.blueBg,   border: "rgba(68,136,255,0.22)"  },
          { label: "Avg Risk Score",    value: ov.avg_risk_score,           unit: "/100", color: T.orange, icon: TrendingUp,     bg: T.orangeBg, border: T.orangeBorder },
          { label: "Phishing Click Rate", value: ov.phishing_click_rate,   unit: "%",  color: T.red,    icon: Shield,         bg: T.redBg,    border: T.redBorder    },
          { label: "Critical Risk",     value: ov.critical_count,           unit: " employees", color: T.red, icon: AlertTriangle, bg: T.redBg, border: T.redBorder },
        ].map(({ label, value, unit, color, icon: Icon, bg, border }) => (
          <div key={label} style={{ padding: "14px 16px", borderRadius: 10, background: bg, border: `1px solid ${border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Icon size={13} color={color} />
              <span style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>{label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>
              {value}<span style={{ fontSize: 12, fontWeight: 500, color: T.textMuted }}>{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Row 1: Risk Distribution + Department Comparison */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>

        {/* Risk Distribution Donut */}
        <Section title="Risk Distribution" icon={AlertTriangle} color={T.orange}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <Donut
              segments={riskDist.map(r => ({ value: r.count, color: r.color, label: r.level }))}
              size={120}
            />
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
              {riskDist.map(r => (
                <div key={r.level} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: r.color }} />
                    <span style={{ fontSize: 12, color: T.textSub }}>{r.level}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: r.color }}>{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Department Comparison */}
        <Section title="Department Comparison" icon={Users} color={T.accent} onExport={exportDepts}>
          {deptStats.length === 0 ? (
            <div style={{ color: T.textMuted, fontSize: 13, textAlign: "center", padding: 20 }}>No department data yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {["Department", "Employees", "Completion %", "Avg Exam %", "Risk Score", "Phishing Clicks"].map(h => (
                      <th key={h} style={{ padding: "6px 10px", textAlign: h === "Department" ? "left" : "right", color: T.textMuted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deptStats.map(d => {
                    const compPct = d.total_assigned > 0 ? Math.round((d.completed / d.total_assigned) * 100) : 0;
                    const phishPct = d.phishing_total > 0 ? Math.round((d.phishing_clicked / d.phishing_total) * 100) : 0;
                    return (
                      <tr key={d.department_id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                        <td style={{ padding: "10px 10px", color: T.text, fontWeight: 600 }}>{d.department_name}</td>
                        <td style={{ padding: "10px 10px", textAlign: "right", color: T.textSub }}>{d.employee_count}</td>
                        <td style={{ padding: "10px 10px", textAlign: "right" }}>
                          <span style={{ color: compPct >= 70 ? T.green : compPct >= 40 ? T.yellow : T.red, fontWeight: 700 }}>{compPct}%</span>
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right" }}>
                          <span style={{ color: d.avg_exam_pct >= 70 ? T.green : d.avg_exam_pct >= 50 ? T.yellow : T.red, fontWeight: 700 }}>{d.avg_exam_pct}%</span>
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right" }}>
                          <span style={{
                            padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 700,
                            color: d.avg_risk_score >= 70 ? T.red : d.avg_risk_score >= 40 ? T.orange : d.avg_risk_score >= 20 ? T.yellow : T.green,
                            background: d.avg_risk_score >= 70 ? T.redBg : d.avg_risk_score >= 40 ? T.orangeBg : d.avg_risk_score >= 20 ? T.yellowBg : T.greenBg,
                          }}>{d.avg_risk_score}</span>
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", color: phishPct > 20 ? T.red : T.textSub }}>
                          {d.phishing_clicked} ({phishPct}%)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      {/* Row 2: Course Performance */}
      <Section title="Course Completion Rate" icon={BookOpen} color={T.green} onExport={exportCourses}>
        {courseStats.length === 0 ? (
          <div style={{ color: T.textMuted, fontSize: 13, textAlign: "center", padding: 20 }}>No course data yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {courseStats.map(c => (
              <div key={c.course_id} style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px 80px", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 4 }}>{c.title}</div>
                  <div style={{ height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      width: `${c.completion_pct}%`, height: "100%", borderRadius: 4,
                      background: c.completion_pct >= 70 ? T.green : c.completion_pct >= 40 ? T.yellow : T.red,
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 11, color: T.textMuted }}>{c.total_assigned} assigned</div>
                <div style={{ textAlign: "right", fontSize: 11, color: T.green }}>{c.completed} done</div>
                <div style={{ textAlign: "right", fontSize: 13, fontWeight: 800, color: c.completion_pct >= 70 ? T.green : c.completion_pct >= 40 ? T.yellow : T.red }}>
                  {c.completion_pct}%
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Row 3: Phishing Campaigns */}
      <Section title="Phishing Campaign Results" icon={Shield} color={T.red} onExport={exportPhishing}>
        {phishingTrends.length === 0 ? (
          <div style={{ color: T.textMuted, fontSize: 13, textAlign: "center", padding: 20 }}>No phishing campaigns yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Campaign", "Targets", "Opened", "Open%", "Clicked", "Click%", "Credentials", "Cred%", "Reported", "Report%"].map(h => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: h === "Campaign" ? "left" : "right", color: T.textMuted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {phishingTrends.map((p, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <td style={{ padding: "10px 10px", color: T.text, fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.campaign_name}</td>
                    <td style={{ padding: "10px 10px", textAlign: "right", color: T.textSub }}>{p.total_targets}</td>
                    <td style={{ padding: "10px 10px", textAlign: "right", color: T.blue }}>{p.opened}</td>
                    <td style={{ padding: "10px 10px", textAlign: "right" }}>
                      <span style={{ padding: "2px 7px", borderRadius: 9999, fontSize: 11, fontWeight: 700, color: T.blue, background: T.blueBg }}>{p.open_rate}%</span>
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "right", color: T.orange, fontWeight: 600 }}>{p.clicked}</td>
                    <td style={{ padding: "10px 10px", textAlign: "right" }}>
                      <span style={{ padding: "2px 7px", borderRadius: 9999, fontSize: 11, fontWeight: 700, color: p.click_rate > 30 ? T.red : p.click_rate > 15 ? T.orange : T.green, background: p.click_rate > 30 ? T.redBg : p.click_rate > 15 ? T.orangeBg : T.greenBg }}>{p.click_rate}%</span>
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "right", color: T.red, fontWeight: 600 }}>{p.creds}</td>
                    <td style={{ padding: "10px 10px", textAlign: "right" }}>
                      <span style={{ padding: "2px 7px", borderRadius: 9999, fontSize: 11, fontWeight: 700, color: p.cred_rate > 20 ? T.red : p.cred_rate > 5 ? T.orange : T.green, background: p.cred_rate > 20 ? T.redBg : p.cred_rate > 5 ? T.orangeBg : T.greenBg }}>{p.cred_rate}%</span>
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "right", color: T.green }}>{p.reported}</td>
                    <td style={{ padding: "10px 10px", textAlign: "right" }}>
                      <span style={{ padding: "2px 7px", borderRadius: 9999, fontSize: 11, fontWeight: 700, color: T.green, background: T.greenBg }}>{p.report_rate}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Department Risk Bar Chart */}
      {deptStats.length > 0 && (
        <Section title="Risk Score by Department" icon={TrendingUp} color={T.purple}>
          <HBarChart
            items={deptStats.map(d => ({ name: d.department_name, value: d.avg_risk_score }))}
            labelKey="name"
            valueKey="value"
            color={T.orange}
            maxVal={100}
          />
        </Section>
      )}

    </div>
  );
}
