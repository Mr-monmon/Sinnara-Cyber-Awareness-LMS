import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Users, Building2, BookOpen,
  Target, Award, Activity, CheckCircle, Download,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

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
  red:         '#f87171',
  redBg:       'rgba(248,113,113,0.08)',
  redBorder:   'rgba(248,113,113,0.22)',
  purple:      '#a78bfa',
  purpleBg:    'rgba(167,139,250,0.08)',
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
} as const;

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface AnalyticsData {
  totalCompanies: number; activeCompanies: number;
  totalUsers: number;     totalEmployees: number;
  totalCourses: number;   completedCourses: number;
  totalExams: number;     passedExams: number;
  averageScore: number;   platformUsage: number;
}
interface CompanyStats {
  company_id: string; company_name: string;
  employees: number;  completed_courses: number;
  completed_exams: number; average_score: number;
}

/* ─────────────────────────────────────────
   AWARENESS LEVEL
───────────────────────────────────────── */
const awareLvl = (score: number) => {
  if (score >= 90) return { label: 'Excellent', color: T.green,  bg: T.greenBg,  border: T.greenBorder  };
  if (score >= 70) return { label: 'Good',      color: T.blue,   bg: T.blueBg,   border: T.blueBorder   };
  if (score >= 50) return { label: 'Average',   color: T.gold,   bg: T.goldBg,   border: 'rgba(251,191,36,0.28)' };
  return              { label: 'Poor',      color: T.red,    bg: T.redBg,    border: T.redBorder    };
};

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-an-table { width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; }
  .aw-an-table th {
    padding: 10px 14px; text-align: left;
    font-size: 10px; font-weight: 700; color: #64748b;
    letter-spacing: 0.9px; text-transform: uppercase;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
  }
  .aw-an-table td {
    padding: 12px 14px; font-size: 13px; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .aw-an-table tr:last-child td { border-bottom: none; }
  .aw-an-table tr:hover td { background: rgba(255,255,255,0.025); }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-bar-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  .aw-fade-up { animation: aw-fade-up 0.45s ease both; }
`;
if (typeof document !== 'undefined' && !document.getElementById('aw-an-styles')) {
  const t = document.createElement('style'); t.id = 'aw-an-styles'; t.textContent = STYLES; document.head.appendChild(t);
}

/* ═══════════════════════════════════════════════════════
   CHART: PIE (donut) — active vs inactive companies
═══════════════════════════════════════════════════════ */
const PieChart: React.FC<{ active: number; total: number }> = ({ active, total }) => {
  const inactive = Math.max(0, total - active);
  const R = 54; const CX = 75; const CY = 75; const circ = 2 * Math.PI * R;
  const activeFrac = total > 0 ? active / total : 0;
  const inactiveFrac = 1 - activeFrac;
  const activeDash   = activeFrac   * circ;
  const inactiveDash = inactiveFrac * circ;

  // segments start at 12-o'clock (-90°)
  const segments = [
    { color: T.green,  label: 'Active',   value: active,   frac: activeFrac,   offset: 0            },
    { color: T.red,    label: 'Inactive', value: inactive,  frac: inactiveFrac, offset: activeDash   },
  ].filter(s => s.value > 0);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      {/* Donut */}
      <div style={{ flexShrink: 0, position: 'relative' }}>
        <svg width={150} height={150} viewBox="0 0 150 150">
          {/* bg ring */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={16} />
          {/* segments */}
          {segments.map(s => (
            <circle key={s.label}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={16}
              strokeLinecap="butt"
              strokeDasharray={`${s.frac * circ} ${circ - s.frac * circ}`}
              strokeDashoffset={circ / 4 - s.offset}
              style={{ filter: `drop-shadow(0 0 6px ${s.color}55)` }}
            />
          ))}
          {/* center */}
          <circle cx={CX} cy={CY} r={36} fill={T.bgCard} />
          <text x={CX} y={CY - 7}  textAnchor="middle" fill={T.white}     fontSize="20" fontWeight="900" fontFamily="Inter">{total}</text>
          <text x={CX} y={CY + 10} textAnchor="middle" fill={T.textMuted} fontSize="9"  fontFamily="Inter">companies</text>
        </svg>
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { label: 'Active',   value: active,   color: T.green, bg: T.greenBg, border: T.greenBorder },
          { label: 'Inactive', value: inactive,  color: T.red,   bg: T.redBg,   border: T.redBorder   },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
              <span style={{ fontSize: 12, color: T.textMuted }}>{s.label}</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</span>
          </div>
        ))}
        <div style={{ padding: '8px 12px', background: 'rgba(200,255,0,0.06)', border: '1px solid rgba(200,255,0,0.18)', borderRadius: 8, textAlign: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: T.accent }}>
            {total > 0 ? Math.round((active / total) * 100) : 0}%
          </span>
          <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 5 }}>active rate</span>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   CHART: BAR — employees per company (top 8)
═══════════════════════════════════════════════════════ */
const BarChart: React.FC<{ companies: CompanyStats[] }> = ({ companies }) => {
  const top = companies.slice(0, 8);
  if (!top.length) return <p style={{ fontSize: 13, color: T.textMuted }}>No data</p>;

  const maxEmp  = Math.max(...top.map(c => c.employees), 1);
  const W = 420; const H = 120; const PAD_L = 26; const PAD_B = 28;
  const chartW  = W - PAD_L - 8;
  const chartH  = H - PAD_B;
  const barGap  = chartW / top.length;
  const barW    = barGap * 0.55;

  const gridLines = [0, 25, 50, 75, 100];

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {/* Grid lines */}
        {gridLines.map(pct => {
          const y = chartH - (pct / 100) * chartH;
          const val = Math.round((pct / 100) * maxEmp);
          return (
            <g key={pct}>
              <line x1={PAD_L} y1={y} x2={W - 4} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} strokeDasharray={pct === 0 ? '0' : '3 3'} />
              <text x={PAD_L - 4} y={y + 4} textAnchor="end" fontSize={7} fill={T.textMuted} fontFamily="Inter">{val}</text>
            </g>
          );
        })}

        {/* Bars */}
        {top.map((co, i) => {
          const lvl   = awareLvl(co.average_score);
          const bh    = Math.max(4, (co.employees / maxEmp) * chartH);
          const x     = PAD_L + i * barGap + (barGap - barW) / 2;
          const y     = chartH - bh;
          const label = co.company_name.length > 7 ? co.company_name.slice(0, 7) + '…' : co.company_name;

          return (
            <g key={co.company_id}>
              {/* Bar shadow */}
              <rect x={x + 2} y={y + 3} width={barW} height={bh} rx={4} fill={`${lvl.color}20`} />
              {/* Bar */}
              <rect x={x} y={y} width={barW} height={bh} rx={4} fill={lvl.color} opacity={0.88}
                style={{ filter: `drop-shadow(0 0 4px ${lvl.color}50)` }} />
              {/* Value label */}
              {co.employees > 0 && (
                <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={8} fill={lvl.color} fontWeight="700" fontFamily="Inter">
                  {co.employees}
                </text>
              )}
              {/* X-axis label */}
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={7} fill={T.textMuted} fontFamily="Inter">
                {label}
              </text>
            </g>
          );
        })}
        {/* X-axis line */}
        <line x1={PAD_L} y1={chartH} x2={W - 4} y2={chartH} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
        {[
          { label: 'Excellent (90%+)', color: T.green  },
          { label: 'Good (70–89%)',    color: T.blue   },
          { label: 'Average (50–69%)', color: T.gold   },
          { label: 'Poor (<50%)',      color: T.red    },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: T.textMuted }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   CHART: AWARENESS GAUGE (SVG half-arc)
═══════════════════════════════════════════════════════ */
const AwarenessGauge: React.FC<{ score: number }> = ({ score }) => {
  const lvl = awareLvl(score);
  const R = 62; const CX = 90; const CY = 88;
  const toXY = (deg: number) => ({
    x: CX + R * Math.cos((deg * Math.PI) / 180),
    y: CY + R * Math.sin((deg * Math.PI) / 180),
  });
  const startDeg  = -180;
  const scoreDeg  = startDeg + (score / 100) * 180;
  const start     = toXY(startDeg);
  const scoreEnd  = toXY(scoreDeg);
  const bgEnd     = toXY(0);
  const largeArc  = score > 50 ? 1 : 0;

  // tick marks
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <svg width={180} height={110} viewBox="0 0 180 110" style={{ overflow: 'visible' }}>
        {/* BG arc */}
        <path d={`M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${bgEnd.x} ${bgEnd.y}`}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={14} strokeLinecap="round" />

        {/* Colored fill arc */}
        {score > 0 && (
          <path d={`M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${scoreEnd.x} ${scoreEnd.y}`}
            fill="none" stroke={lvl.color} strokeWidth={14} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 8px ${lvl.color}70)` }} />
        )}

        {/* Ticks */}
        {ticks.map(v => {
          const deg = -180 + (v / 100) * 180;
          const inner = { x: CX + (R - 9) * Math.cos((deg * Math.PI) / 180), y: CY + (R - 9) * Math.sin((deg * Math.PI) / 180) };
          const outer = { x: CX + (R - 2) * Math.cos((deg * Math.PI) / 180), y: CY + (R - 2) * Math.sin((deg * Math.PI) / 180) };
          return <line key={v} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />;
        })}

        {/* Needle */}
        {(() => {
          const needleDeg = -180 + (score / 100) * 180;
          const tip  = { x: CX + (R - 18) * Math.cos((needleDeg * Math.PI) / 180), y: CY + (R - 18) * Math.sin((needleDeg * Math.PI) / 180) };
          const base = { x: CX + 7 * Math.cos(((needleDeg + 90) * Math.PI) / 180), y: CY + 7 * Math.sin(((needleDeg + 90) * Math.PI) / 180) };
          const base2 = { x: CX + 7 * Math.cos(((needleDeg - 90) * Math.PI) / 180), y: CY + 7 * Math.sin(((needleDeg - 90) * Math.PI) / 180) };
          return (
            <polygon points={`${tip.x},${tip.y} ${base.x},${base.y} ${base2.x},${base2.y}`}
              fill={lvl.color} opacity={0.95}
              style={{ filter: `drop-shadow(0 0 5px ${lvl.color}80)` }} />
          );
        })()}

        {/* Center circle */}
        <circle cx={CX} cy={CY} r={9} fill={T.bgCard} stroke={T.border} strokeWidth={1.5} />
        <circle cx={CX} cy={CY} r={4} fill={lvl.color} />

        {/* Score text */}
        <text x={CX} y={CY - 18} textAnchor="middle" fill={T.white}    fontSize="22" fontWeight="900" fontFamily="Inter">{score}%</text>
        <text x={CX} y={CY - 2}  textAnchor="middle" fill={lvl.color}  fontSize="11" fontWeight="700" fontFamily="Inter">{lvl.label}</text>

        {/* Range labels */}
        <text x={26}  y={CY + 18} textAnchor="middle" fontSize={8} fill={T.textMuted} fontFamily="Inter">0%</text>
        <text x={CX}  y={CY - 72} textAnchor="middle" fontSize={8} fill={T.textMuted} fontFamily="Inter">50%</text>
        <text x={154} y={CY + 18} textAnchor="middle" fontSize={8} fill={T.textMuted} fontFamily="Inter">100%</text>
      </svg>
      <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>Avg Score — All Exams</p>
    </div>
  );
};

/* ─────────────────────────────────────────
   STAT CARD
───────────────────────────────────────── */
const StatCard: React.FC<{ icon: React.ElementType; color: string; bg: string; label: string; value: number | string; sub?: string; delay?: string }> = ({
  icon: Icon, color, bg, label, value, sub, delay = '0s',
}) => (
  <div className="aw-fade-up" style={{ animationDelay: delay, padding: '18px 20px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 13, position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, ${color}40)` }} />
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ width: 38, height: 38, borderRadius: 9, background: bg, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={17} style={{ color }} />
      </div>
      <span style={{ fontSize: 26, fontWeight: 900, color: T.white }}>{value}</span>
    </div>
    <div style={{ fontSize: 13, fontWeight: 700, color: T.textBody }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{sub}</div>}
  </div>
);

/* ─────────────────────────────────────────
   MINI PROGRESS BAR
───────────────────────────────────────── */
const MiniBar: React.FC<{ label: string; value: number; max: number; color: string }> = ({ label, value, max, color }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <span style={{ fontSize: 13, color: T.textBody }}>{label}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: T.textMuted }}>{value}/{max}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color }}>{pct}%</span>
        </div>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}bb)`, borderRadius: 9999, boxShadow: `0 0 8px ${color}40`, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const AnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalCompanies: 0, activeCompanies: 0, totalUsers: 0, totalEmployees: 0,
    totalCourses: 0, completedCourses: 0, totalExams: 0, passedExams: 0,
    averageScore: 0, platformUsage: 0,
  });
  const [companyStats, setCompanyStats] = useState<CompanyStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAnalytics(); }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [coRes, usRes, crRes, ecRes, exRes, erRes] = await Promise.all([
        supabase.from('companies').select('*'),
        supabase.from('users').select('*'),
        supabase.from('courses').select('*'),
        supabase.from('employee_courses').select('*'),
        supabase.from('exams').select('*'),
        supabase.from('exam_results').select('*'),
      ]);

      const companies       = coRes.data || [];
      const users           = usRes.data || [];
      const courses         = crRes.data || [];
      const employeeCourses = ecRes.data || [];
      const exams           = exRes.data || [];
      const examResults     = erRes.data || [];

      const activeCompanies  = companies.filter(c => (c as any).is_active !== false).length;
      const employees        = users.filter(u => u.role === 'EMPLOYEE');
      const completedCourses = employeeCourses.filter(ec => ec.status === 'COMPLETED').length;
      const passedExams      = examResults.filter(er => er.passed).length;
      const avgScore         = examResults.length > 0
        ? examResults.reduce((sum, er) => sum + (er.percentage || 0), 0) / examResults.length : 0;

      setAnalytics({
        totalCompanies: companies.length, activeCompanies,
        totalUsers: users.length, totalEmployees: employees.length,
        totalCourses: courses.length, completedCourses,
        totalExams: exams.length, passedExams,
        averageScore: Math.round(avgScore),
        platformUsage: employeeCourses.length + examResults.length,
      });

      const statsMap = new Map<string, CompanyStats>();
      companies.forEach(c => statsMap.set(c.id, { company_id: c.id, company_name: c.name, employees: 0, completed_courses: 0, completed_exams: 0, average_score: 0 }));
      employees.forEach(emp => { if (emp.company_id && statsMap.has(emp.company_id)) statsMap.get(emp.company_id)!.employees++; });
      employeeCourses.forEach(ec => {
        const emp = users.find(u => u.id === ec.employee_id);
        if (emp?.company_id && statsMap.has(emp.company_id) && ec.status === 'COMPLETED')
          statsMap.get(emp.company_id)!.completed_courses++;
      });
      const scoreMap = new Map<string, number[]>();
      examResults.forEach(er => {
        const emp = users.find(u => u.id === er.employee_id);
        if (emp?.company_id && statsMap.has(emp.company_id)) {
          if (er.passed) statsMap.get(emp.company_id)!.completed_exams++;
          if (!scoreMap.has(emp.company_id)) scoreMap.set(emp.company_id, []);
          scoreMap.get(emp.company_id)!.push(er.percentage || 0);
        }
      });
      scoreMap.forEach((scores, id) => {
        if (statsMap.has(id) && scores.length > 0)
          statsMap.get(id)!.average_score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      });
      setCompanyStats(Array.from(statsMap.values()).sort((a, b) => b.employees - a.employees));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', flexDirection: 'column', gap: 14, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 13, color: T.textMuted }}>Loading analytics…</span>
    </div>
  );

  const lvl = awareLvl(analytics.averageScore);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart3 size={18} style={{ color: T.blue }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Analytics & Reports</h1>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>Comprehensive platform performance and awareness overview.</p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: 12 }}>
        <StatCard icon={Building2}  color={T.accent}  bg="rgba(200,255,0,0.08)"  label="Total Companies"   value={analytics.totalCompanies}   sub={`${analytics.activeCompanies} active`}      delay="0.00s" />
        <StatCard icon={Users}      color={T.green}   bg={T.greenBg}             label="Total Employees"   value={analytics.totalEmployees}   sub={`${analytics.totalUsers} total users`}      delay="0.04s" />
        <StatCard icon={BookOpen}   color={T.purple}  bg={T.purpleBg}            label="Completed Courses" value={analytics.completedCourses} sub={`of ${analytics.totalCourses} total`}       delay="0.08s" />
        <StatCard icon={Award}      color={T.orange}  bg={T.orangeBg}            label="Passed Exams"      value={analytics.passedExams}      sub={`of ${analytics.totalExams} exams`}         delay="0.12s" />
        <StatCard icon={Activity}   color={T.blue}    bg={T.blueBg}              label="Total Activities"  value={analytics.platformUsage}    sub="courses + exams"                            delay="0.16s" />
        <StatCard icon={TrendingUp} color={T.accent}  bg="rgba(200,255,0,0.08)" label="Avg Score"         value={`${analytics.averageScore}%`} sub={`Platform-wide · ${lvl.label}`}           delay="0.20s" />
      </div>

      {/* ── Charts row: Gauge + Pie + Usage Bars ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>

        {/* Gauge */}
        <div className="aw-fade-up" style={{ animationDelay: '0.22s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={14} style={{ color: T.accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Awareness Level</span>
          </div>
          <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <AwarenessGauge score={analytics.averageScore} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[{ l: 'Poor', c: T.red }, { l: 'Average', c: T.gold }, { l: 'Good', c: T.blue }, { l: 'Excellent', c: T.green }].map(({ l, c }) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T.textMuted }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} /> {l}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pie */}
        <div className="aw-fade-up" style={{ animationDelay: '0.26s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={14} style={{ color: T.accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Company Status</span>
          </div>
          <div style={{ padding: '20px' }}>
            <PieChart active={analytics.activeCompanies} total={analytics.totalCompanies} />
          </div>
        </div>

        {/* Usage bars */}
        <div className="aw-fade-up" style={{ animationDelay: '0.30s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={14} style={{ color: T.accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Platform Usage</span>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <MiniBar label="Course Completion" value={analytics.completedCourses} max={analytics.totalCourses}  color={T.purple} />
            <MiniBar label="Exam Pass Rate"    value={analytics.passedExams}      max={analytics.totalExams}    color={T.green}  />
            <MiniBar label="Employee Coverage" value={analytics.totalEmployees}   max={analytics.totalUsers}    color={T.blue}   />
            <div style={{ paddingTop: 12, borderTop: `1px solid ${T.borderFaint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: T.textBody }}>Total Activities</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: T.accent }}>{analytics.platformUsage.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bar Chart: employees per company ── */}
      {companyStats.length > 0 && (
        <div className="aw-fade-up" style={{ animationDelay: '0.33s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={14} style={{ color: T.accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Employees per Company</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted }}>Top 8 · bar color = awareness level</span>
          </div>
          <div style={{ padding: '16px 20px 20px' }}>
            <BarChart companies={companyStats} />
          </div>
        </div>
      )}

      {/* ── Company stats table ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.36s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building2 size={14} style={{ color: T.accent }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Company Statistics</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted }}>{companyStats.length} companies</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="aw-an-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Employees</th>
                <th>Completed Courses</th>
                <th>Passed Exams</th>
                <th>Avg Score</th>
                <th>Level</th>
                <th>Score Bar</th>
                <th style={{ textAlign: 'center' }}>Cert</th>
              </tr>
            </thead>
            <tbody>
              {companyStats.map(co => {
                const lvl = awareLvl(co.average_score);
                return (
                  <tr key={co.company_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: T.accent, flexShrink: 0 }}>
                          {co.company_name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: T.white }}>{co.company_name}</span>
                      </div>
                    </td>
                    <td>{co.employees}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle size={11} style={{ color: T.purple }} /> {co.completed_courses}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Award size={11} style={{ color: T.orange }} /> {co.completed_exams}
                      </div>
                    </td>
                    <td><span style={{ fontWeight: 800, color: lvl.color }}>{co.average_score}%</span></td>
                    <td>
                      <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', background: lvl.bg, border: `1px solid ${lvl.border}`, color: lvl.color }}>
                        {lvl.label}
                      </span>
                    </td>
                    <td style={{ minWidth: 90 }}>
                      <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${co.average_score}%`, background: lvl.color, borderRadius: 9999, transition: 'width 0.5s ease' }} />
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        title={co.average_score >= 80 ? 'Issue certificate' : 'Score too low'}
                        disabled={co.average_score < 80}
                        style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', background: co.average_score >= 80 ? T.greenBg : 'rgba(255,255,255,0.03)', border: `1px solid ${co.average_score >= 80 ? T.greenBorder : T.borderFaint}`, color: co.average_score >= 80 ? T.green : T.textMuted, cursor: co.average_score >= 80 ? 'pointer' : 'not-allowed', opacity: co.average_score >= 80 ? 1 : 0.4 }}
                      >
                        <Download size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {companyStats.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: T.textMuted }}>No data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Performance summary ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.38s', padding: '20px 24px', background: 'linear-gradient(135deg, #0e100a 0%, #1a2210 100%)', border: '1px solid rgba(200,255,0,0.18)', borderRadius: 14, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <TrendingUp size={19} style={{ color: T.accent }} />
        </div>
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: T.white, margin: '0 0 8px' }}>Performance Summary</h4>
          <p style={{ fontSize: 13, color: T.textBody, lineHeight: '22px', margin: 0 }}>
            The platform has <strong style={{ color: T.accent }}>{analytics.totalCompanies}</strong> companies with <strong style={{ color: T.accent }}>{analytics.totalEmployees}</strong> active employees.{' '}
            <strong style={{ color: T.purple }}>{analytics.completedCourses}</strong> courses completed and <strong style={{ color: T.orange }}>{analytics.passedExams}</strong> exams passed.{' '}
            Overall cybersecurity awareness is <strong style={{ color: lvl.color }}>{analytics.averageScore}%</strong> — rated <strong style={{ color: lvl.color }}>{lvl.label}</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};
