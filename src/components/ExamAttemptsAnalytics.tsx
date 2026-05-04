import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy, TrendingUp, TrendingDown, CheckCircle,
  XCircle, Target, Users, BarChart3,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bg:          '#12140a',
  bgCard:      '#1a1e0e',
  accent:      '#c8ff00',
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
  red:         '#f87171',
  redBg:       'rgba(248,113,113,0.08)',
  redBorder:   'rgba(248,113,113,0.22)',
  purple:      '#a78bfa',
  purpleBg:    'rgba(167,139,250,0.08)',
  purpleBorder:'rgba(167,139,250,0.22)',
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-eaa-table { width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; }
  .aw-eaa-table th { padding: 10px 14px; text-align: left; font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 0.9px; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02); }
  .aw-eaa-table td { padding: 13px 14px; font-size: 13px; color: #cbd5e1; border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.14s; }
  .aw-eaa-table tr:last-child td { border-bottom: none; }
  .aw-eaa-table tr:hover td { background: rgba(255,255,255,0.025); }

  .aw-eaa-select {
    padding: 9px 32px 9px 13px; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09); border-radius: 9px;
    font-size: 13px; color: #ffffff; font-family: 'Inter', sans-serif; outline: none;
    appearance: none; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
    transition: border-color 0.2s;
  }
  .aw-eaa-select:focus { border-color: rgba(200,255,0,0.40); }
  .aw-eaa-select option { background: #1a1e0e; }

  .aw-eaa-scroll::-webkit-scrollbar { width: 3px; }
  .aw-eaa-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-eaa-scroll::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-eaa-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-eaa-styles'; tag.textContent = STYLES; document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface ExamAttempt {
  result_id: string; employee_id: string; employee_name: string;
  employee_email: string; department_name: string; exam_id: string;
  exam_title: string; assignment_id: string; score: number;
  total_questions: number; percentage: number; passed: boolean;
  started_at: string; completed_at: string; attempt_number: number;
  max_attempts: number; due_date: string | null; company_id: string;
}
interface Props { companyId: string; }

const fmt = (d: string) => new Date(d).toLocaleDateString('en-SA', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtShort = (d: string) => new Date(d).toLocaleDateString('en-SA', { month: 'short', day: 'numeric' });

/* ─────────────────────────────────────────
   STAT CARD
───────────────────────────────────────── */
const StatCard: React.FC<{ icon: React.ElementType; color: string; bg: string; label: string; value: string | number; sub?: string; delay?: string }> = ({
  icon: Icon, color, bg, label, value, sub, delay = '0s',
}) => (
  <div className="aw-fade-up" style={{ animationDelay: delay, padding: '16px 18px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, position: 'relative', overflow: 'hidden', flex: '1 1 130px' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},${color}40)` }} />
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: bg, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={15} style={{ color }} />
      </div>
      <span style={{ fontSize: 24, fontWeight: 900, color: T.white }}>{value}</span>
    </div>
    <div style={{ fontSize: 12, fontWeight: 600, color: T.textBody }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{sub}</div>}
  </div>
);

/* ─────────────────────────────────────────
   DONUT CHART — Pass vs Fail
───────────────────────────────────────── */
const DonutChart: React.FC<{ passed: number; failed: number }> = ({ passed, failed }) => {
  const total = passed + failed;
  const R = 52; const CX = 70; const CY = 70; const circ = 2 * Math.PI * R;
  const passFrac = total > 0 ? passed / total : 0;
  const failFrac = total > 0 ? failed / total : 0;
  const passDash = passFrac * circ;
  const failDash = failFrac * circ;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
        {/* Track */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={14} />
        {total === 0 ? null : (
          <>
            {/* Passed arc */}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke={T.green} strokeWidth={14}
              strokeDasharray={`${passDash} ${circ - passDash}`}
              strokeDashoffset={circ / 4}
              style={{ filter: `drop-shadow(0 0 6px ${T.green}55)` }} />
            {/* Failed arc */}
            {failDash > 0 && (
              <circle cx={CX} cy={CY} r={R} fill="none" stroke={T.red} strokeWidth={14}
                strokeDasharray={`${failDash} ${circ - failDash}`}
                strokeDashoffset={circ / 4 - passDash}
                opacity={0.80} />
            )}
          </>
        )}
        {/* Center */}
        <circle cx={CX} cy={CY} r={34} fill={T.bgCard} />
        <text x={CX} y={CY - 5} textAnchor="middle" fill={T.white}    fontSize="18" fontWeight="900" fontFamily="Inter">{total > 0 ? Math.round(passFrac * 100) : 0}%</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fill={T.textMuted} fontSize="9"  fontFamily="Inter">pass rate</text>
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {[
          { label: 'Passed',  value: passed, color: T.green, frac: passFrac },
          { label: 'Failed',  value: failed, color: T.red,   frac: failFrac },
          { label: 'Total',   value: total,  color: T.accent, frac: 1 },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: T.textMuted }}>{s.label}</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</span>
          </div>
        ))}
        <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${passFrac * 100}%`, background: T.green, borderRadius: 9999, boxShadow: `0 0 8px ${T.green}50` }} />
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   LINE CHART — Score trend over time
───────────────────────────────────────── */
const LineChart: React.FC<{ data: Array<{ date: string; avgScore: number; count: number }> }> = ({ data }) => {
  if (data.length < 2) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: T.textMuted, fontSize: 13 }}>
      Not enough data to draw trend
    </div>
  );

  const W = 440; const H = 130; const PAD = { t: 16, r: 16, b: 32, l: 44 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  const scores = data.map(d => d.avgScore);
  const minS = Math.max(0,  Math.floor(Math.min(...scores) / 10) * 10 - 10);
  const maxS = Math.min(100, Math.ceil(Math.max(...scores)  / 10) * 10 + 10);
  const range = maxS - minS || 10;

  const toX = (i: number) => PAD.l + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => PAD.t + chartH - ((v - minS) / range) * chartH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.avgScore)}`).join(' ');
  const areaPath = `${linePath} L${toX(data.length - 1)},${PAD.t + chartH} L${toX(0)},${PAD.t + chartH} Z`;

  const yTicks = [minS, minS + range * 0.5, maxS];
  const xStep = Math.ceil(data.length / 5);
  const xTicks = data.filter((_, i) => i % xStep === 0 || i === data.length - 1).map((d, _, arr) => d);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="aw-line-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={T.accent} stopOpacity="0.22" />
          <stop offset="100%" stopColor={T.accent} stopOpacity="0.00" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PAD.l} y1={toY(v)} x2={PAD.l + chartW} y2={toY(v)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={PAD.l - 6} y={toY(v) + 4} textAnchor="end" fill={T.textMuted} fontSize="9" fontFamily="Inter">{v}%</text>
        </g>
      ))}

      {/* X labels */}
      {data.map((d, i) => (i % xStep === 0 || i === data.length - 1) && (
        <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fill={T.textMuted} fontSize="9" fontFamily="Inter">
          {fmtShort(d.date)}
        </text>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#aw-line-grad)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke={T.accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 5px ${T.accent}70)` }} />

      {/* Dots */}
      {data.map((d, i) => (
        <circle key={i} cx={toX(i)} cy={toY(d.avgScore)} r="3.5" fill={T.accent}
          style={{ filter: `drop-shadow(0 0 4px ${T.accent}80)` }} />
      ))}
    </svg>
  );
};

/* ─────────────────────────────────────────
   BAR CHART — Attempts per exam
───────────────────────────────────────── */
const BarChart: React.FC<{ data: Array<{ label: string; passed: number; failed: number }> }> = ({ data }) => {
  if (!data.length) return null;
  const W = 440; const H = 130; const PAD = { t: 10, r: 16, b: 32, l: 16 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const maxVal = Math.max(...data.map(d => d.passed + d.failed), 1);
  const barW = Math.max(6, (chartW / data.length) * 0.55);
  const gap   = chartW / data.length;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {data.map((d, i) => {
        const total   = d.passed + d.failed;
        const passH   = (d.passed / maxVal) * chartH;
        const failH   = (d.failed / maxVal) * chartH;
        const cx      = PAD.l + i * gap + gap / 2;
        const label   = d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label;

        return (
          <g key={i}>
            {/* Passed bar */}
            <rect x={cx - barW / 2} y={PAD.t + chartH - passH - failH}
              width={barW} height={passH}
              fill={T.green} opacity={0.85} rx={2}
              style={{ filter: `drop-shadow(0 0 4px ${T.green}40)` }} />
            {/* Failed bar stacked */}
            {failH > 0 && (
              <rect x={cx - barW / 2} y={PAD.t + chartH - failH}
                width={barW} height={failH}
                fill={T.red} opacity={0.75} rx={2} />
            )}
            {/* Label */}
            <text x={cx} y={H - 4} textAnchor="middle" fill={T.textMuted} fontSize="9" fontFamily="Inter">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const ExamAttemptsAnalytics: React.FC<Props> = ({ companyId }) => {
  const [attempts, setAttempts]         = useState<ExamAttempt[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [employees, setEmployees]       = useState<Array<{ id: string; name: string }>>([]);
  const [selectedExam, setSelectedExam] = useState('all');

  useEffect(() => { loadEmployees(); }, [companyId]);
  useEffect(() => { loadAttempts(); }, [companyId, selectedEmployee, selectedExam]);

  const loadEmployees = async () => {
    const { data } = await supabase.from('users').select('id,full_name').eq('company_id', companyId).eq('role', 'EMPLOYEE').order('full_name');
    if (data) setEmployees(data.map(e => ({ id: e.id, name: e.full_name })));
  };

  const loadAttempts = async () => {
    setLoading(true);
    let q = supabase.from('exam_attempts_detail').select('*').eq('company_id', companyId).order('completed_at', { ascending: false });
    if (selectedEmployee !== 'all') q = q.eq('employee_id', selectedEmployee);
    if (selectedExam     !== 'all') q = q.eq('exam_id', selectedExam);
    const { data, error } = await q;
    if (!error && data) setAttempts(data);
    setLoading(false);
  };

  /* ── Derived stats ── */
  const totalAttempts  = attempts.length;
  const passedAttempts = attempts.filter(a => a.passed).length;
  const failedAttempts = totalAttempts - passedAttempts;
  const avgScore       = totalAttempts > 0 ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / totalAttempts) : 0;
  const uniqueEmps     = new Set(attempts.map(a => a.employee_id)).size;
  const uniqueExams    = [...new Set(attempts.map(a => a.exam_id))];

  /* ── Improvement per employee+exam ── */
  const calcImprovement = (empId: string, examId: string) => {
    const sorted = attempts.filter(a => a.employee_id === empId && a.exam_id === examId).sort((a, b) => a.attempt_number - b.attempt_number);
    if (sorted.length < 2) return null;
    return sorted[sorted.length - 1].percentage - sorted[0].percentage;
  };

  /* ── Line chart data: daily average score ── */
  const lineData = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    attempts.forEach(a => {
      const day = a.completed_at.slice(0, 10);
      const prev = map.get(day) || { sum: 0, count: 0 };
      map.set(day, { sum: prev.sum + a.percentage, count: prev.count + 1 });
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { sum, count }]) => ({ date, avgScore: Math.round(sum / count), count }))
      .slice(-14); // last 14 days
  }, [attempts]);

  /* ── Bar chart data: attempts per exam ── */
  const barData = useMemo(() => {
    return uniqueExams.map(examId => {
      const rows = attempts.filter(a => a.exam_id === examId);
      return {
        label: rows[0]?.exam_title || 'Unknown',
        passed: rows.filter(a => a.passed).length,
        failed: rows.filter(a => !a.passed).length,
      };
    }).sort((a, b) => (b.passed + b.failed) - (a.passed + a.failed)).slice(0, 8);
  }, [attempts, uniqueExams]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', flexDirection: 'column', gap: 12, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 13, color: T.textMuted }}>Loading analytics…</span>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={17} style={{ color: T.purple }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: T.white, letterSpacing: '-0.2px', margin: 0 }}>Assessment Progress Tracking</h2>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 9 }}>
          <select className="aw-eaa-select" value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}>
            <option value="all">All Employees</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
          <select className="aw-eaa-select" value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
            <option value="all">All Exams</option>
            {uniqueExams.map(examId => {
              const title = attempts.find(a => a.exam_id === examId)?.exam_title || examId;
              return <option key={examId} value={examId}>{title}</option>;
            })}
          </select>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.04s', display: 'flex', gap: 11, flexWrap: 'wrap' }}>
        <StatCard icon={Trophy}      color={T.accent} bg="rgba(200,255,0,0.08)" label="Total Attempts"  value={totalAttempts}  delay="0.04s" />
        <StatCard icon={CheckCircle} color={T.green}  bg={T.greenBg}            label="Passed"          value={passedAttempts} delay="0.07s" />
        <StatCard icon={XCircle}     color={T.red}    bg={T.redBg}              label="Failed"          value={failedAttempts} delay="0.10s" />
        <StatCard icon={TrendingUp}  color={T.blue}   bg={T.blueBg}             label="Avg Score"       value={`${avgScore}%`} delay="0.13s" />
        <StatCard icon={Users}       color={T.purple} bg={T.purpleBg}           label="Employees Tested" value={uniqueEmps}    delay="0.16s" />
        <StatCard icon={Target}      color={T.gold}   bg={T.goldBg}             label="Exams Covered"   value={uniqueExams.length} delay="0.19s" />
      </div>

      {/* ── Charts row ── */}
      {totalAttempts > 0 && (
        <div className="aw-fade-up" style={{ animationDelay: '0.22s', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>

          {/* Donut — Pass/Fail */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '13px 18px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={13} style={{ color: T.green }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Pass / Fail Distribution</span>
            </div>
            <div style={{ padding: '18px' }}>
              <DonutChart passed={passedAttempts} failed={failedAttempts} />
            </div>
          </div>

          {/* Bar — Attempts per exam */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '13px 18px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={13} style={{ color: T.blue }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Attempts per Exam</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: T.textMuted }}><div style={{ width: 8, height: 8, borderRadius: 2, background: T.green }} />Passed</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: T.textMuted }}><div style={{ width: 8, height: 8, borderRadius: 2, background: T.red }} />Failed</span>
              </div>
            </div>
            <div style={{ padding: '14px 18px' }}>
              <BarChart data={barData} />
            </div>
          </div>

          {/* Line — Score trend */}
          {lineData.length >= 2 && (
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', gridColumn: 'span 2' }}>
              <div style={{ padding: '13px 18px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={13} style={{ color: T.accent }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Score Trend (daily average)</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted }}>Last {lineData.length} days</span>
              </div>
              <div style={{ padding: '14px 18px 10px' }}>
                <LineChart data={lineData} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Attempts table ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.26s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '13px 18px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={13} style={{ color: T.accent }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Detailed Attempt Log</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted }}>{attempts.length} records</span>
        </div>
        <div style={{ overflowX: 'auto' }} className="aw-eaa-scroll">
          <table className="aw-eaa-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Assessment</th>
                <th style={{ textAlign: 'center' }}>Attempt</th>
                <th style={{ textAlign: 'center' }}>Score</th>
                <th style={{ textAlign: 'center' }}>Result</th>
                <th style={{ textAlign: 'center' }}>Improvement</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map(attempt => {
                const improvement = calcImprovement(attempt.employee_id, attempt.exam_id);
                return (
                  <tr key={attempt.result_id}>
                    <td>
                      <div style={{ fontWeight: 600, color: T.white }}>{attempt.employee_name}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{attempt.department_name}</div>
                    </td>
                    <td>
                      <div style={{ color: T.textBody, fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {attempt.exam_title}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ padding: '3px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: T.blueBg, border: `1px solid ${T.blueBorder}`, color: T.blue }}>
                        {attempt.attempt_number}/{attempt.max_attempts}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: attempt.percentage >= 70 ? T.green : T.red }}>
                        {attempt.percentage.toFixed(1)}%
                      </div>
                      <div style={{ fontSize: 10, color: T.textMuted }}>{attempt.score}/{attempt.total_questions}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ padding: '3px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', background: attempt.passed ? T.greenBg : T.redBg, border: `1px solid ${attempt.passed ? T.greenBorder : T.redBorder}`, color: attempt.passed ? T.green : T.red }}>
                        {attempt.passed ? 'Passed' : 'Failed'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {improvement !== null ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: improvement > 0 ? T.green : improvement < 0 ? T.red : T.textMuted }}>
                          {improvement > 0 ? <TrendingUp size={13} /> : improvement < 0 ? <TrendingDown size={13} /> : null}
                          {improvement > 0 ? '+' : ''}{improvement.toFixed(1)}%
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: T.textMuted }}>First</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: T.textMuted }}>{fmt(attempt.completed_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {attempts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: T.textMuted, fontSize: 13 }}>
              No assessment attempts found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
