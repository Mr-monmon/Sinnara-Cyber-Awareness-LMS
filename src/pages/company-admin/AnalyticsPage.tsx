import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Award, BookOpen,
  ClipboardCheck, Users, BarChart3, CheckCircle,
  XCircle, AlertCircle, Target, Activity,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { User as UserType } from '../../lib/types';
import { ExamAttemptsAnalytics } from '../../components/ExamAttemptsAnalytics';

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
  purpleBorder:'rgba(167,139,250,0.22)',
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-ca-table { width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; }
  .aw-ca-table th {
    padding: 10px 14px; text-align: left;
    font-size: 10px; font-weight: 700; color: #64748b;
    letter-spacing: 0.9px; text-transform: uppercase;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
  }
  .aw-ca-table td {
    padding: 13px 14px; font-size: 13px; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .aw-ca-table tr:last-child td { border-bottom: none; }
  .aw-ca-table tr:hover td { background: rgba(255,255,255,0.025); transition: background 0.14s; }

  .aw-ca-list { max-height: 200px; overflow-y: auto; }
  .aw-ca-list::-webkit-scrollbar { width: 3px; }
  .aw-ca-list::-webkit-scrollbar-track { background: transparent; }
  .aw-ca-list::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-ca-styles')) {
  const t = document.createElement('style'); t.id = 'aw-ca-styles'; t.textContent = STYLES; document.head.appendChild(t);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface EmployeePerformance {
  employee: UserType; preScore?: number; postScore?: number;
  improvement: number; status: string;
  coursesCompleted: number; totalCourses: number;
  examsCompleted: number; totalExams: number;
}
interface CourseStats {
  totalAssigned: number; totalCompleted: number; completionRate: number;
  employeesCompleted: any[]; employeesIncomplete: any[];
}
interface ExamStats {
  totalAttempts: number; uniqueEmployees: number;
  passedCount: number; failedCount: number; passRate: number; avgScore: number;
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const statusCfg = (s: string) => {
  if (s === 'Passed')      return { color: T.green,  bg: T.greenBg,  border: T.greenBorder  };
  if (s === 'Failed')      return { color: T.red,    bg: T.redBg,    border: T.redBorder    };
  if (s === 'In Progress') return { color: T.blue,   bg: T.blueBg,   border: T.blueBorder   };
  return                          { color: T.textMuted, bg: 'rgba(255,255,255,0.04)', border: T.borderFaint };
};

/* ─────────────────────────────────────────
   STAT CARD
───────────────────────────────────────── */
const StatCard: React.FC<{ icon: React.ElementType; color: string; bg: string; label: string; value: string | number; sub?: string; delay?: string }> = ({
  icon: Icon, color, bg, label, value, sub, delay = '0s',
}) => (
  <div className="aw-fade-up" style={{ animationDelay: delay, padding: '18px 20px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 13, position: 'relative', overflow: 'hidden', flex: '1 1 160px' }}>
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
   SECTION HEADER
───────────────────────────────────────── */
const SectionHeader: React.FC<{ icon: React.ElementType; color: string; title: string; badge?: string }> = ({ icon: Icon, color, title, badge }) => (
  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 9 }}>
    <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}18`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={13} style={{ color }} />
    </div>
    <span style={{ fontSize: 14, fontWeight: 800, color: T.white }}>{title}</span>
    {badge && <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted }}>{badge}</span>}
  </div>
);

/* ─────────────────────────────────────────
   PIE DONUT CHART — course completion
───────────────────────────────────────── */
const CourseDonut: React.FC<{ completed: number; total: number }> = ({ completed, total }) => {
  const remaining = Math.max(0, total - completed);
  const R = 52; const CX = 68; const CY = 68; const circ = 2 * Math.PI * R;
  const compFrac = total > 0 ? completed / total : 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <div style={{ flexShrink: 0 }}>
        <svg width={136} height={136} viewBox="0 0 136 136">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={14} />
          {compFrac > 0 && (
            <circle cx={CX} cy={CY} r={R} fill="none" stroke={T.green} strokeWidth={14} strokeLinecap="butt"
              strokeDasharray={`${compFrac * circ} ${circ - compFrac * circ}`}
              strokeDashoffset={circ / 4}
              style={{ filter: `drop-shadow(0 0 6px ${T.green}55)` }} />
          )}
          {remaining > 0 && compFrac < 1 && (
            <circle cx={CX} cy={CY} r={R} fill="none" stroke={T.orange} strokeWidth={14} strokeLinecap="butt"
              strokeDasharray={`${(1 - compFrac) * circ} ${compFrac * circ}`}
              strokeDashoffset={circ / 4 - compFrac * circ}
              opacity={0.75} />
          )}
          <circle cx={CX} cy={CY} r={34} fill={T.bgCard} />
          <text x={CX} y={CY - 6} textAnchor="middle" fill={T.white}    fontSize="17" fontWeight="900" fontFamily="Inter">{Math.round(compFrac * 100)}%</text>
          <text x={CX} y={CY + 10} textAnchor="middle" fill={T.textMuted} fontSize="9" fontFamily="Inter">complete</text>
        </svg>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { label: 'Completed',  value: completed,  color: T.green  },
          { label: 'Remaining',  value: remaining,   color: T.orange },
          { label: 'Total',      value: total,       color: T.accent },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: s.color }} />
              <span style={{ fontSize: 12, color: T.textMuted }}>{s.label}</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</span>
          </div>
        ))}
        {/* Progress bar */}
        <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden', marginTop: 4 }}>
          <div style={{ height: '100%', width: `${compFrac * 100}%`, background: T.green, borderRadius: 9999, boxShadow: `0 0 8px ${T.green}50`, transition: 'width 0.5s ease' }} />
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   BAR CHART — exam pass vs fail
───────────────────────────────────────── */
const ExamBarChart: React.FC<{ passed: number; failed: number; avgScore: number }> = ({ passed, failed, avgScore }) => {
  const total = passed + failed;
  const passW = total > 0 ? (passed / total) * 100 : 0;
  const failW = total > 0 ? (failed / total) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stacked bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.textMuted, marginBottom: 8 }}>
          <span>Exam Results Distribution</span>
          <span style={{ color: T.textBody }}>{total} total attempts</span>
        </div>
        <div style={{ height: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 9999, overflow: 'hidden', display: 'flex' }}>
          {passW > 0 && (
            <div style={{ width: `${passW}%`, background: T.green, height: '100%', transition: 'width 0.6s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {passW > 12 && <span style={{ fontSize: 10, fontWeight: 800, color: T.accentDark, fontFamily: 'Inter' }}>{passed}</span>}
            </div>
          )}
          {failW > 0 && (
            <div style={{ width: `${failW}%`, background: T.red, height: '100%', opacity: 0.85, transition: 'width 0.6s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {failW > 12 && <span style={{ fontSize: 10, fontWeight: 800, color: T.white, fontFamily: 'Inter' }}>{failed}</span>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textMuted }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: T.green }} />
            Passed {passW.toFixed(0)}%
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textMuted }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: T.red }} />
            Failed {failW.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Big pass/fail boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { label: 'Passed', value: passed, color: T.green, bg: T.greenBg, border: T.greenBorder, icon: CheckCircle },
          { label: 'Failed', value: failed, color: T.red,   bg: T.redBg,   border: T.redBorder,   icon: XCircle    },
        ].map(({ label, value, color, bg, border, icon: Icon }) => (
          <div key={label} style={{ padding: '16px', background: bg, border: `1px solid ${border}`, borderRadius: 11, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon size={22} style={{ color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
              <div style={{ fontSize: 11, color, opacity: 0.75 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Avg score bar */}
      <div style={{ padding: '14px 16px', background: 'rgba(200,255,0,0.04)', border: '1px solid rgba(200,255,0,0.14)', borderRadius: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: T.textMuted }}>Average Score</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: T.accent }}>{avgScore.toFixed(1)}%</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${avgScore}%`, background: T.accent, borderRadius: 9999, boxShadow: '0 0 8px rgba(200,255,0,0.35)', transition: 'width 0.6s ease' }} />
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   MINI PROGRESS BAR (table)
───────────────────────────────────────── */
const MiniBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ minWidth: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textMuted, marginBottom: 5 }}>
        <span>{value}/{max}</span>
        <span style={{ fontWeight: 700, color }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 9999 }} />
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const [performance, setPerformance] = useState<EmployeePerformance[]>([]);
  const [courseStats, setCourseStats] = useState<CourseStats | null>(null);
  const [examStats, setExamStats]     = useState<ExamStats | null>(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    loadAnalytics();
    loadCourseStats();
    loadExamStats();
  }, [user]);

  const loadCourseStats = async () => {
    if (!user?.company_id) return;
    try {
      const { data: allEmployees } = await supabase.from('users').select('id, full_name, email, department:departments(name)').eq('company_id', user.company_id).eq('role', 'EMPLOYEE');
      if (!allEmployees?.length) { setCourseStats({ totalAssigned: 0, totalCompleted: 0, completionRate: 0, employeesCompleted: [], employeesIncomplete: [] }); return; }
      const ids = allEmployees.map(e => e.id);
      const { data: completions, count: completedCount } = await supabase.from('employee_courses').select('id,employee_id,course_id,employee:users!employee_courses_employee_id_fkey(id,full_name,email,department:departments(name)),course:courses(id,title)', { count: 'exact' }).in('employee_id', ids).eq('status', 'COMPLETED');
      const { count: assignedCount } = await supabase.from('employee_courses').select('id', { count: 'exact', head: true }).in('employee_id', ids);
      const completionRate = assignedCount && assignedCount > 0 ? ((completedCount || 0) / assignedCount) * 100 : 0;
      const completedIds = [...new Set(completions?.map(c => c.employee_id))];
      const incompleteEmployees = allEmployees.filter(emp => !completedIds.includes(emp.id));
      setCourseStats({ totalAssigned: assignedCount || 0, totalCompleted: completedCount || 0, completionRate, employeesCompleted: completions || [], employeesIncomplete: incompleteEmployees });
    } catch (err) { console.error(err); }
  };

  const loadExamStats = async () => {
    if (!user?.company_id) return;
    try {
      const { data: employees } = await supabase.from('users').select('id').eq('company_id', user.company_id).eq('role', 'EMPLOYEE');
      if (!employees?.length) { setExamStats({ totalAttempts: 0, uniqueEmployees: 0, passedCount: 0, failedCount: 0, passRate: 0, avgScore: 0 }); return; }
      const ids = employees.map(e => e.id);
      const { data: attempts } = await supabase.from('exam_results').select('id,employee_id,exam_id,passed,percentage').in('employee_id', ids);
      if (!attempts) return;
      const uniqueEmployees = [...new Set(attempts.map(a => a.employee_id))].length;
      const passedCount = attempts.filter(a => a.passed).length;
      const failedCount = attempts.length - passedCount;
      const passRate = attempts.length > 0 ? (passedCount / attempts.length) * 100 : 0;
      const avgScore = attempts.length > 0 ? attempts.reduce((s, a) => s + (a.percentage || 0), 0) / attempts.length : 0;
      setExamStats({ totalAttempts: attempts.length, uniqueEmployees, passedCount, failedCount, passRate, avgScore });
    } catch (err) { console.error(err); }
  };

  const loadAnalytics = async () => {
    if (!user?.company_id) return;
    try {
      const { data: employees } = await supabase.from('users').select('*').eq('company_id', user.company_id).eq('role', 'EMPLOYEE');
      if (!employees) return;
      const { data: preExam  } = await supabase.from('exams').select('id').eq('exam_type', 'PRE_ASSESSMENT').maybeSingle();
      const { data: postExam } = await supabase.from('exams').select('id').eq('exam_type', 'POST_ASSESSMENT').maybeSingle();
      const { data: allCourses } = await supabase.from('courses').select('id').eq('company_id', user.company_id);
      const { data: allExams   } = await supabase.from('exams').select('id');
      const totalCourses = allCourses?.length || 0;
      const totalExams   = allExams?.length || 0;

      const perfData: EmployeePerformance[] = await Promise.all(employees.map(async emp => {
        let preScore: number | undefined;
        let postScore: number | undefined;
        if (preExam) {
          const { data: r } = await supabase.from('exam_results').select('percentage').eq('employee_id', emp.id).eq('exam_id', preExam.id).order('completed_at', { ascending: false }).limit(1).maybeSingle();
          if (r) preScore = Math.round(r.percentage);
        }
        if (postExam) {
          const { data: r } = await supabase.from('exam_results').select('percentage').eq('employee_id', emp.id).eq('exam_id', postExam.id).order('completed_at', { ascending: false }).limit(1).maybeSingle();
          if (r) postScore = Math.round(r.percentage);
        }
        const { data: cp } = await supabase.from('employee_courses').select('id,completed_at').eq('employee_id', emp.id);
        const coursesCompleted = cp?.filter(c => c.completed_at !== null).length || 0;
        const { data: er } = await supabase.from('exam_results').select('id').eq('employee_id', emp.id);
        const examsCompleted = er?.length || 0;
        const improvement = postScore !== undefined && preScore !== undefined ? postScore - preScore : 0;
        const status = postScore !== undefined ? (postScore >= 70 ? 'Passed' : 'Failed') : preScore !== undefined ? 'In Progress' : 'Not Started';
        return { employee: emp, preScore, postScore, improvement, status, coursesCompleted, totalCourses, examsCompleted, totalExams };
      }));
      setPerformance(perfData);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', flexDirection: 'column', gap: 14, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 13, color: T.textMuted }}>Loading analytics…</span>
    </div>
  );

  const avgImprovement = performance.length > 0
    ? Math.round(performance.reduce((s, p) => s + p.improvement, 0) / performance.length) : 0;
  const passedCount = performance.filter(p => p.status === 'Passed').length;
  const passRate    = performance.length > 0 ? Math.round((passedCount / performance.length) * 100) : 0;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart3 size={19} style={{ color: T.blue }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Analytics & Reports</h1>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>Pre/Post assessment comparison and full employee performance tracking.</p>
        </div>
      </div>

      {/* ── Top Stat cards ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.04s', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard icon={Award}        color={T.green}  bg={T.greenBg}               label="Employees Passed"   value={passedCount}                         sub={`of ${performance.length} employees`} delay="0.04s" />
        <StatCard icon={TrendingUp}   color={T.blue}   bg={T.blueBg}                label="Avg Improvement"    value={`${avgImprovement > 0 ? '+' : ''}${avgImprovement}%`} sub="Post vs Pre score"  delay="0.08s" />
        <StatCard icon={Target}       color={T.accent} bg="rgba(200,255,0,0.08)"    label="Pass Rate"           value={`${passRate}%`}                      sub="Overall pass rate"                   delay="0.12s" />
        <StatCard icon={Users}        color={T.purple} bg={T.purpleBg}              label="Total Employees"    value={performance.length}                  sub="In this company"                      delay="0.16s" />
        {examStats && <>
          <StatCard icon={ClipboardCheck} color={T.orange} bg={T.orangeBg}           label="Exam Attempts"      value={examStats.totalAttempts}              sub={`${examStats.uniqueEmployees} employees`} delay="0.20s" />
          <StatCard icon={Activity}      color={T.gold}   bg={T.goldBg}             label="Exam Avg Score"     value={`${examStats.avgScore.toFixed(1)}%`} sub="Across all exams"                      delay="0.24s" />
        </>}
      </div>

      {/* ── Charts row: Course donut + Exam bar ── */}
      {(courseStats || examStats) && (
        <div className="aw-fade-up" style={{ animationDelay: '0.26s', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {/* Course Donut */}
          {courseStats && (
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <SectionHeader icon={BookOpen} color={T.green} title="Course Completion" badge={`${courseStats.completionRate.toFixed(1)}% rate`} />
              <div style={{ padding: '20px' }}>
                <CourseDonut completed={courseStats.totalCompleted} total={courseStats.totalAssigned} />
              </div>
            </div>
          )}

          {/* Exam Bar */}
          {examStats && (
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <SectionHeader icon={ClipboardCheck} color={T.blue} title="Exam Performance" badge={`${examStats.passRate.toFixed(1)}% pass rate`} />
              <div style={{ padding: '20px' }}>
                <ExamBarChart passed={examStats.passedCount} failed={examStats.failedCount} avgScore={examStats.avgScore} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Employee Performance Table ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.30s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <SectionHeader icon={Users} color={T.purple} title="Employee Performance" badge={`${performance.length} employees`} />
        <div style={{ overflowX: 'auto' }}>
          <table className="aw-ca-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Courses Progress</th>
                <th>Exams Taken</th>
                <th>Pre-Assessment</th>
                <th>Post-Assessment</th>
                <th>Improvement</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {performance.map(perf => {
                const imp  = perf.improvement;
                const cfg  = statusCfg(perf.status);
                const initials = (perf.employee.full_name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <tr key={perf.employee.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: T.accent, flexShrink: 0 }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: T.white }}>{perf.employee.full_name}</div>
                          <div style={{ fontSize: 11, color: T.textMuted }}>{perf.employee.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><MiniBar value={perf.coursesCompleted} max={perf.totalCourses} color={T.blue} /></td>
                    <td>
                      <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textBody }}>
                        {perf.examsCompleted}
                      </span>
                    </td>
                    <td>
                      {perf.preScore !== undefined
                        ? <span style={{ fontSize: 14, fontWeight: 800, color: perf.preScore >= 70 ? T.green : T.orange }}>{perf.preScore}%</span>
                        : <span style={{ color: T.textMuted }}>—</span>
                      }
                    </td>
                    <td>
                      {perf.postScore !== undefined
                        ? <span style={{ fontSize: 14, fontWeight: 800, color: perf.postScore >= 70 ? T.green : T.red }}>{perf.postScore}%</span>
                        : <span style={{ color: T.textMuted }}>—</span>
                      }
                    </td>
                    <td>
                      {imp !== 0 ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 800, color: imp > 0 ? T.green : T.red }}>
                          {imp > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {imp > 0 ? '+' : ''}{imp}%
                        </div>
                      ) : <span style={{ color: T.textMuted }}>—</span>}
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                        {perf.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {performance.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: T.textMuted }}>No employee data available yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Course completion detail lists ── */}
      {courseStats && (courseStats.employeesCompleted.length > 0 || courseStats.employeesIncomplete.length > 0) && (
        <div className="aw-fade-up" style={{ animationDelay: '0.34s', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {/* Completed */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '13px 18px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={13} style={{ color: T.green }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Completed</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: T.green, fontWeight: 700 }}>{courseStats.employeesCompleted.length}</span>
            </div>
            <div className="aw-ca-list" style={{ padding: '10px 0' }}>
              {courseStats.employeesCompleted.map((comp: any) => (
                <div key={comp.id} style={{ padding: '8px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: T.textBody, fontWeight: 500 }}>{comp.employee?.full_name}</span>
                  <span style={{ fontSize: 11, color: T.textMuted, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp.course?.title}</span>
                </div>
              ))}
              {courseStats.employeesCompleted.length === 0 && (
                <p style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', padding: '20px' }}>No completions yet</p>
              )}
            </div>
          </div>

          {/* Incomplete */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '13px 18px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={13} style={{ color: T.orange }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Not Completed</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: T.orange, fontWeight: 700 }}>{courseStats.employeesIncomplete.length}</span>
            </div>
            <div className="aw-ca-list" style={{ padding: '10px 0' }}>
              {courseStats.employeesIncomplete.map((emp: any) => (
                <div key={emp.id} style={{ padding: '8px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: T.textBody, fontWeight: 500 }}>{emp.full_name}</span>
                  <span style={{ fontSize: 11, color: T.textMuted }}>{emp.department?.name || 'No Dept'}</span>
                </div>
              ))}
              {courseStats.employeesIncomplete.length === 0 && (
                <p style={{ fontSize: 12, color: T.green, textAlign: 'center', padding: '20px', fontWeight: 600 }}>🎉 All employees completed!</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ExamAttemptsAnalytics (external component) ── */}
      {user?.company_id && (
        <div className="aw-fade-up" style={{ animationDelay: '0.38s' }}>
          <ExamAttemptsAnalytics companyId={user.company_id} />
        </div>
      )}
    </div>
  );
};
