import { useState, useEffect } from "react";
import {
  Users, TrendingUp, Award, AlertCircle,
  BookOpen, ClipboardCheck, BarChart2,
  ChevronRight, Shield, Send, Medal,
} from "lucide-react";
import { DashboardLayout } from "../../components/layouts/DashboardLayout";
import { EmployeesPage } from "./EmployeesPage";
import { AnalyticsPage } from "./AnalyticsPage";
import { DepartmentsPage } from "./DepartmentsPage";
import { ExamAssignmentPage } from "./ExamAssignmentPage";
import { EmployeeDetailPage } from "./EmployeeDetailPage";
import { PhishingDashboardPage } from "./PhishingDashboardPage";
import { PhishingRequestPage } from "./PhishingRequestPage";
import { CourseAssignmentPage } from "./CourseAssignmentPage";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { Company } from "../../lib/types";
import LoadingScreen from "../../components/LoadingScreen";
import InactivatedSubscription from "../../components/InactivatedSubscription";
import AccountSettings from "./AccountSettings";
import { SupportRequestsPage } from "./SupportRequestsPage";

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bg:          '#12140a',
  bgCard:      '#1a1e0e',
  accent:      '#c8ff00',
  accentDark:  '#12140a',
  white:       '#ffffff',
  textBody:    '#cbd5e1',
  textMuted:   '#64748b',
  border:      'rgba(255,255,255,0.09)',
  borderFaint: 'rgba(255,255,255,0.05)',
  green:       '#34d399',
  greenBg:     'rgba(52,211,153,0.08)',
  greenBorder: 'rgba(52,211,153,0.22)',
  blue:        '#60a5fa',
  blueBg:      'rgba(96,165,250,0.08)',
  blueBorder:  'rgba(96,165,250,0.22)',
  orange:      '#fb923c',
  orangeBg:    'rgba(251,146,60,0.08)',
  orangeBorder:'rgba(251,146,60,0.22)',
  purple:      '#a78bfa',
  purpleBg:    'rgba(167,139,250,0.08)',
  purpleBorder:'rgba(167,139,250,0.22)',
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
  goldBorder:  'rgba(251,191,36,0.22)',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Stat card ── */
  .aw-cd-stat {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 20px;
    position: relative; overflow: hidden;
    transition: border-color 0.2s, transform 0.2s;
    font-family: 'Inter', sans-serif;
  }
  .aw-cd-stat:hover { border-color: rgba(255,255,255,0.15); transform: translateY(-1px); }

  /* ── Quick action btn ── */
  .aw-cd-action {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; border-radius: 11px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.03); cursor: pointer;
    text-align: left; font-family: 'Inter', sans-serif;
    transition: all 0.18s;
  }
  .aw-cd-action:hover {
    background: rgba(255,255,255,0.06);
    border-color: rgba(200,255,0,0.20);
    transform: translateX(3px);
  }

  /* ── Top performer row ── */
  .aw-cd-perf-row {
    display: flex; align-items: center; gap: 14px;
    padding: 12px 16px; border-radius: 10px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.05);
    transition: background 0.18s, border-color 0.18s;
  }
  .aw-cd-perf-row:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.10); }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-bar-grow { from { width:0%; } to { width:var(--bar-w); } }
  .aw-fade-up { animation: aw-fade-up 0.45s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-cd-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-cd-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   DONUT CHART (SVG)
───────────────────────────────────────── */
const DonutChart: React.FC<{ completed: number; pending: number; pct: number }> = ({ completed, pending, pct }) => {
  const R = 52; const cx = 70; const cy = 70;
  const circ = 2 * Math.PI * R;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
        <svg width={140} height={140} viewBox="0 0 140 140">
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={10} />
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={T.orange} strokeWidth={10} strokeLinecap="round"
            strokeDasharray={`${circ - dash} ${dash}`}
            strokeDashoffset={dash * 0}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '70px 70px' }}
          />
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={T.green} strokeWidth={10} strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '70px 70px' }}
          />
          <circle cx={cx} cy={cy} r={32} fill={T.bgCard} />
          <text x={cx} y={cy - 6}  textAnchor="middle" fill={T.white}    fontSize="16" fontWeight="900" fontFamily="Inter">{pct}%</text>
          <text x={cx} y={cy + 11} textAnchor="middle" fill={T.textMuted} fontSize="9"  fontFamily="Inter">complete</text>
        </svg>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { label: 'Completed Training', value: completed, color: T.green, bg: T.greenBg },
          { label: 'Pending Assessments', value: pending,  color: T.orange, bg: T.orangeBg },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 14px', background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: T.white }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   MINI BAR CHART (SVG)
───────────────────────────────────────── */
const MiniBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
      <div
        className="aw-bar-fill"
        style={{ '--bar-w': `${pct}%`, width: `${pct}%`, height: '100%', background: color, borderRadius: 9999, animation: 'aw-bar-grow 0.8s ease both' } as React.CSSProperties}
      />
    </div>
  );
};

/* ─────────────────────────────────────────
   RANK MEDAL COLORS
───────────────────────────────────────── */
const RANK_COLORS = ['#fbbf24', '#94a3b8', '#fb923c'] as const;

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const CompanyDashboard = () => {
  const { user }    = useAuth();
  const [activePage, setActivePage]             = useState("dashboard");
  const [company, setCompany]                   = useState<Company | null>(null);
  const [isLoading, setIsLoading]               = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalEmployees: 0, completedTraining: 0, averageScore: 0, pendingAssessments: 0 });
  const [topEmployees, setTopEmployees] = useState<{ id: string; name: string; email: string; averageScore: number; examsTaken: number }[]>([]);

  useEffect(() => { loadCompany(); loadStats(); }, [user]);

  const loadStats = async () => {
    if (!user?.company_id) return;
    try {
      const { data: employees } = await supabase.from("users").select("id, full_name, email").eq("company_id", user.company_id).eq("role", "EMPLOYEE");
      const ids = employees?.map(e => e.id) || [];
      if (ids.length === 0) { setStats({ totalEmployees: 0, completedTraining: 0, averageScore: 0, pendingAssessments: 0 }); return; }

      const [resultsRes, courseRes, examsRes] = await Promise.all([
        supabase.from("exam_results").select("employee_id, percentage, passed").in("employee_id", ids),
        supabase.from("employee_courses").select("employee_id, completed_at").in("employee_id", ids).not("completed_at", "is", null),
        supabase.from("employee_available_exams").select("employee_id").in("employee_id", ids),
      ]);

      const completedSet = new Set([
        ...(courseRes.data?.map(e => e.employee_id) || []),
        ...(resultsRes.data?.filter(r => r.passed).map(r => r.employee_id) || []),
      ]);

      const { data: topData } = await supabase.functions.invoke("get_top_performance", { method: "POST", body: { company_id: user.company_id } });
      setStats({ totalEmployees: employees?.length || 0, completedTraining: completedSet.size, averageScore: topData?.avgScore || 0, pendingAssessments: examsRes.data?.length || 0 });
      setTopEmployees(topData?.rankedEmployees || []);
      setIsLoading(false);
    } catch (err) { console.error(err); setIsLoading(false); }
  };

  const loadCompany = async () => {
    setIsLoading(true);
    if (!user?.company_id) return;
    try {
      const { data } = await supabase.from("companies").select("id, name, is_active, subdomain").eq("id", user.company_id).single();
      setCompany(data);
      setIsLoading(false);
    } catch { setIsLoading(false); }
  };

  const renderContent = () => {
    if (activePage === "employee-detail" && selectedEmployeeId) {
      return <EmployeeDetailPage employeeId={selectedEmployeeId} onBack={() => { setActivePage("employees"); setSelectedEmployeeId(null); }} />;
    }
    switch (activePage) {
      case "employees":        return <EmployeesPage onViewEmployee={id => { setSelectedEmployeeId(id); setActivePage("employee-detail"); }} />;
      case "departments":      return <DepartmentsPage />;
      case "exam-assignment":  return <ExamAssignmentPage />;
      case "course-assignment": return <CourseAssignmentPage />;
      case "analytics":        return <AnalyticsPage />;
      case "phishing-dashboard": return <PhishingDashboardPage />;
      case "phishing-request": return <PhishingRequestPage />;
      case "account":          return <AccountSettings />;
      case "support-requests": return <SupportRequestsPage />;
      default:                 return renderDashboard();
    }
  };

  const renderDashboard = () => {
    const completionRate = stats.totalEmployees > 0 ? Math.round((stats.completedTraining / stats.totalEmployees) * 100) : 0;
    const pendingRate    = 100 - completionRate;

    /* Stat card definitions */
    const STATS = [
      { icon: Users,          color: T.accent,  bg: 'rgba(200,255,0,0.08)',  border: 'rgba(200,255,0,0.20)',  label: 'Total Employees',     sub: 'Active accounts',         value: stats.totalEmployees,     pct: null },
      { icon: Award,          color: T.green,   bg: T.greenBg,              border: T.greenBorder,            label: 'Completed Training',  sub: 'Certified or passed',     value: stats.completedTraining,  pct: completionRate },
      { icon: TrendingUp,     color: T.blue,    bg: T.blueBg,               border: T.blueBorder,             label: 'Average Score',       sub: 'Across all assessments',  value: `${stats.averageScore}%`, pct: stats.averageScore },
      { icon: AlertCircle,    color: T.orange,  bg: T.orangeBg,             border: T.orangeBorder,           label: 'Pending Assessments', sub: 'Needs attention',         value: stats.pendingAssessments, pct: null },
    ] as const;

    /* Quick actions */
    const ACTIONS = [
      { icon: Users,          color: T.accent,  page: 'employees',        label: 'Manage Employees',   sub: 'Add or edit employee accounts'   },
      { icon: BookOpen,       color: T.green,   page: 'course-assignment', label: 'Assign Courses',     sub: 'Launch new training plans'       },
      { icon: ClipboardCheck, color: T.gold,    page: 'exam-assignment',  label: 'Assign Exams',       sub: 'Schedule assessments'            },
      { icon: BarChart2,      color: T.purple,  page: 'analytics',        label: 'View Analytics',     sub: 'Detailed performance reports'    },
      { icon: Shield,         color: T.orange,  page: 'phishing-dashboard', label: 'Phishing Board',   sub: 'Campaign status overview'        },
      { icon: Send,           color: T.blue,    page: 'phishing-request', label: 'Request Campaign',   sub: 'Launch a phishing simulation'    },
    ] as const;

    return (
      <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Hero banner ── */}
        <div className="aw-fade-up" style={{ background: T.bgCard, border: `1px solid rgba(200,255,0,0.18)`, borderRadius: 16, padding: '26px 28px', position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,255,0,0.07), transparent 70%)', pointerEvents: 'none' }} />
          <div aria-hidden="true" style={{ position: 'absolute', bottom: -40, left: 200, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.05), transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', position: 'relative' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, boxShadow: '0 0 8px rgba(200,255,0,0.60)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '1.2px', textTransform: 'uppercase' }}>Company Dashboard</span>
              </div>
              <h1 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 900, color: T.white, margin: '0 0 6px', letterSpacing: '-0.4px' }}>
                {company?.name || 'Security Overview'}
              </h1>
              <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
                Real-time cybersecurity awareness metrics across your organization.
              </p>
            </div>

            {/* KPI pills */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Completion', value: `${completionRate}%`, color: T.green },
                { label: 'Avg Score',  value: `${stats.averageScore}%`, color: T.blue },
              ].map(k => (
                <div key={k.label} style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, borderRadius: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {STATS.map(({ icon: Icon, color, bg, border, label, sub, value, pct }, i) => (
            <div key={label} className={`aw-cd-stat aw-fade-up`} style={{ animationDelay: `${i * 0.05}s` }}>
              {/* Top color bar */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, ${color}40)`, borderRadius: '14px 14px 0 0' }} />

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} style={{ color }} />
                </div>
                <span style={{ fontSize: 24, fontWeight: 900, color: T.white }}>{value}</span>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: T.white, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: pct !== null ? 10 : 0 }}>{sub}</div>

              {pct !== null && (
                <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 9999, boxShadow: `0 0 6px ${color}60`, transition: 'width 0.5s ease' }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Charts row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>

          {/* Completion mix donut */}
          <div className="aw-fade-up" style={{ animationDelay: '0.20s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={14} style={{ color: T.accent }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Completion Mix</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted }}>Live</span>
            </div>
            <div style={{ padding: '20px' }}>
              <DonutChart completed={stats.completedTraining} pending={stats.pendingAssessments} pct={completionRate} />
            </div>
          </div>

          {/* Assessment breakdown */}
          <div className="aw-fade-up" style={{ animationDelay: '0.24s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={14} style={{ color: T.accent }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Assessment Breakdown</span>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Completed',  value: stats.completedTraining,  max: stats.totalEmployees, color: T.green  },
                { label: 'Pending',    value: stats.pendingAssessments, max: stats.totalEmployees, color: T.orange },
              ].map(row => (
                <div key={row.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.textBody, marginBottom: 7 }}>
                    <span>{row.label}</span>
                    <span style={{ fontWeight: 700, color: T.white }}>{row.value}</span>
                  </div>
                  <MiniBar value={row.value} max={row.max} color={row.color} />
                </div>
              ))}

              {/* Avg score */}
              <div style={{ padding: '14px 16px', background: 'rgba(200,255,0,0.04)', border: '1px solid rgba(200,255,0,0.14)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>Average Score</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: T.accent }}>{stats.averageScore}%</span>
                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${stats.averageScore}%`, background: `linear-gradient(90deg, ${T.accent}, rgba(200,255,0,0.55))`, borderRadius: 9999, boxShadow: '0 0 8px rgba(200,255,0,0.28)' }} />
                  </div>
                </div>
              </div>

              {/* Remaining */}
              <div style={{ fontSize: 12, color: T.textMuted, textAlign: 'center' }}>
                <span style={{ color: T.textBody, fontWeight: 700 }}>{pendingRate}%</span> training remaining across the organization
              </div>
            </div>
          </div>

          {/* Training overview live card */}
          <div className="aw-fade-up" style={{ animationDelay: '0.28s', background: `linear-gradient(135deg, #0e100a 0%, #1a2210 60%, #0e1614 100%)`, border: `1px solid rgba(200,255,0,0.20)`, borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
            <div aria-hidden="true" style={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,255,0,0.08), transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ padding: '14px 20px', borderBottom: `1px solid rgba(200,255,0,0.12)`, display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
              <TrendingUp size={14} style={{ color: T.accent }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Training Overview</span>
              <span style={{ marginLeft: 'auto', padding: '2px 10px', background: 'rgba(200,255,0,0.10)', border: '1px solid rgba(200,255,0,0.25)', borderRadius: 9999, fontSize: 10, fontWeight: 700, color: T.accent, letterSpacing: '0.5px', textTransform: 'uppercase' }}>LIVE</span>
            </div>
            <div style={{ padding: '20px', position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Completion bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.textBody, marginBottom: 8 }}>
                  <span>Completion Rate</span>
                  <span style={{ fontSize: 20, fontWeight: 900, color: T.accent }}>{completionRate}%</span>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${completionRate}%`, background: `linear-gradient(90deg, ${T.accent}, rgba(200,255,0,0.60))`, borderRadius: 9999, boxShadow: '0 0 12px rgba(200,255,0,0.35)', transition: 'width 0.5s ease' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 4, borderTop: 'rgba(255,255,255,0.06) 1px solid' }}>
                {[
                  { label: 'Employees',  value: stats.totalEmployees,    color: T.white },
                  { label: 'Completed',  value: stats.completedTraining, color: T.green },
                  { label: 'Pending',    value: stats.pendingAssessments, color: T.orange },
                  { label: 'Avg Score',  value: `${stats.averageScore}%`, color: T.blue },
                ].map(m => (
                  <div key={m.label} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.06)`, borderRadius: 9 }}>
                    <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Top performers ── */}
        <div className="aw-fade-up" style={{ animationDelay: '0.30s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Medal size={14} style={{ color: T.gold }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Top Performers</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted }}>Highest scores</span>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topEmployees.length > 0 ? topEmployees.slice(0, 5).map((emp, idx) => (
              <div key={emp.id} className="aw-cd-perf-row">
                {/* Rank badge */}
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: idx < 3 ? `${RANK_COLORS[idx]}18` : 'rgba(255,255,255,0.05)', border: `1px solid ${idx < 3 ? RANK_COLORS[idx] + '40' : T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: idx < 3 ? RANK_COLORS[idx] : T.textMuted, flexShrink: 0 }}>
                  {idx + 1}
                </div>

                {/* Avatar */}
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: T.accent, flexShrink: 0 }}>
                  {emp.name?.charAt(0)?.toUpperCase() || '?'}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{emp.examsTaken} exam{emp.examsTaken !== 1 ? 's' : ''}</div>
                </div>

                {/* Score badge */}
                <div style={{ padding: '4px 12px', background: idx === 0 ? T.goldBg : T.greenBg, border: `1px solid ${idx === 0 ? T.goldBorder : T.greenBorder}`, borderRadius: 9999, fontSize: 13, fontWeight: 800, color: idx === 0 ? T.gold : T.green, flexShrink: 0 }}>
                  {emp.averageScore}%
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Medal size={20} style={{ color: T.textMuted }} />
                </div>
                <p style={{ fontSize: 13, color: T.textBody, margin: 0 }}>No assessment results yet. Top scores will appear here once employees complete exams.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Quick actions ── */}
        <div className="aw-fade-up" style={{ animationDelay: '0.32s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ChevronRight size={14} style={{ color: T.accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Quick Actions</span>
          </div>
          <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
            {ACTIONS.map(({ icon: Icon, color, page, label, sub }) => (
              <button key={page} className="aw-cd-action" onClick={() => setActivePage(page)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}12`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{label}</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>{sub}</div>
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: T.textMuted, flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>

      </div>
    );
  };

  return (
    <>
      {isLoading ? <LoadingScreen /> :
       company?.is_active ? (
        <DashboardLayout activePage={activePage} onNavigate={setActivePage}>
          {renderContent()}
        </DashboardLayout>
      ) : <InactivatedSubscription />}
    </>
  );
};
