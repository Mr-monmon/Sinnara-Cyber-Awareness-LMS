import React, { useState, useEffect } from "react";
import {
  ArrowLeft, Award, BookOpen, ClipboardCheck,
  TrendingUp, Download, Calendar, CheckCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

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
  orange:      '#fb923c',
  orangeBg:    'rgba(251,146,60,0.08)',
  red:         '#f87171',
  redBg:       'rgba(248,113,113,0.08)',
  redBorder:   'rgba(248,113,113,0.22)',
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
  goldBorder:  'rgba(251,191,36,0.22)',
  purple:      '#a78bfa',
  purpleBg:    'rgba(167,139,250,0.08)',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-detail-section {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 14px;
    overflow: hidden;
    font-family: 'Inter', sans-serif;
  }
  .aw-detail-section-header {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    font-size: 15px; font-weight: 700; color: #ffffff;
    display: flex; align-items: center; gap: 8px;
  }

  .aw-exam-table { width: 100%; border-collapse: collapse; }
  .aw-exam-table th {
    padding: 10px 14px; text-align: left;
    font-size: 10px; font-weight: 700; color: #64748b;
    letter-spacing: 0.9px; text-transform: uppercase;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
  }
  .aw-exam-table td {
    padding: 12px 14px; font-size: 13px; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .aw-exam-table tr:last-child td { border-bottom: none; }
  .aw-exam-table tr:hover td { background: rgba(255,255,255,0.02); }

  .aw-dl-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: rgba(200,255,0,0.10); border: 1px solid rgba(200,255,0,0.25);
    color: #c8ff00; transition: background 0.18s;
  }
  .aw-dl-btn:hover { background: rgba(200,255,0,0.18); }

  .aw-back-btn {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 13px; font-weight: 600; color: #94a3b8;
    background: none; border: none; cursor: pointer;
    font-family: 'Inter', sans-serif; transition: color 0.18s; padding: 0;
  }
  .aw-back-btn:hover { color: #ffffff; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-emp-detail-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-emp-detail-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   DATE FORMATTER
───────────────────────────────────────── */
const fmt = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
};

/* ─────────────────────────────────────────
   CIRCULAR PROGRESS SVG
───────────────────────────────────────── */
const CircleProgress: React.FC<{ pct: number; size?: number; color?: string; label?: string }> = ({
  pct, size = 48, color = T.accent, label,
}) => {
  const R = (size - 6) / 2;
  const circ = 2 * Math.PI * R;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={color}
          strokeWidth={5} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      {label && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: T.white }}>
          {label}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────
   PIE CHART (SVG)
───────────────────────────────────────── */
const PieChart: React.FC<{ completed: number; inProgress: number; notStarted: number }> = ({
  completed, inProgress, notStarted,
}) => {
  const total = completed + inProgress + notStarted || 1;
  const slices = [
    { value: completed,   color: T.green,  label: 'Completed'   },
    { value: inProgress,  color: T.blue,   label: 'In Progress' },
    { value: notStarted,  color: 'rgba(255,255,255,0.10)', label: 'Not Started' },
  ];
  const R = 48; const cx = 60; const cy = 60;
  const polarToXY = (deg: number) => ({ x: cx + R * Math.cos(deg * Math.PI / 180), y: cy + R * Math.sin(deg * Math.PI / 180) });
  let angle = -90;
  const paths = slices.map(s => {
    const sweep = (s.value / total) * 360;
    if (sweep < 0.5) { angle += sweep; return null; }
    const start = polarToXY(angle);
    const end   = polarToXY(angle + sweep);
    const large = sweep > 180 ? 1 : 0;
    const path  = `M ${cx} ${cy} L ${start.x} ${start.y} A ${R} ${R} 0 ${large} 1 ${end.x} ${end.y} Z`;
    angle += sweep;
    return { ...s, path };
  }).filter(Boolean);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={120} height={120} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
        {paths.map((s, i) => s && <path key={i} d={s.path} fill={s!.color} opacity={0.90} />)}
        <circle cx={cx} cy={cy} r={28} fill={T.bgCard} />
        <text x={cx} y={cy - 6}  textAnchor="middle" fill={T.white}    fontSize="14" fontWeight="800" fontFamily="Inter">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill={T.textMuted} fontSize="9"  fontFamily="Inter">courses</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {slices.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.textMuted }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
              {s.label}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.textBody }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   LINE CHART (SVG) — exam scores over time
───────────────────────────────────────── */
const LineChart: React.FC<{ exams: { score: number; label: string; passed: boolean }[] }> = ({ exams }) => {
  if (exams.length < 2) return (
    <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: T.textMuted }}>Need at least 2 attempts to show chart</p>
    </div>
  );

  const W = 320; const H = 100; const PAD = 16;
  const scores = exams.map(e => e.score);
  const minS = Math.max(0, Math.min(...scores) - 10);
  const maxS = Math.min(100, Math.max(...scores) + 10);
  const xStep = (W - PAD * 2) / (exams.length - 1);

  const toXY = (i: number, s: number) => ({
    x: PAD + i * xStep,
    y: PAD + ((maxS - s) / (maxS - minS)) * (H - PAD * 2),
  });

  const points = exams.map((e, i) => toXY(i, e.score));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} style={{ overflow: 'visible' }}>
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map(v => {
        const y = PAD + ((maxS - Math.min(v, maxS)) / (maxS - minS)) * (H - PAD * 2);
        if (y < 0 || y > H) return null;
        return (
          <g key={v}>
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <text x={0} y={y + 4} fontSize={8} fill={T.textMuted} fontFamily="Inter">{v}%</text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={areaPath} fill={`${T.accent}12`} />

      {/* Line */}
      <path d={linePath} fill="none" stroke={T.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill={exams[i].passed ? T.green : T.red}
            stroke={T.bgCard} strokeWidth={2} />
          <text x={p.x} y={H + 15} textAnchor="middle" fontSize={8} fill={T.textMuted} fontFamily="Inter">
            #{i + 1}
          </text>
          <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={9} fill={T.white} fontWeight="700" fontFamily="Inter">
            {exams[i].score.toFixed(0)}%
          </text>
        </g>
      ))}
    </svg>
  );
};

/* ─────────────────────────────────────────
   STAT CARD
───────────────────────────────────────── */
const StatCard: React.FC<{ icon: React.ElementType; color: string; bg: string; label: string; value: string | number; delay?: string }> = ({
  icon: Icon, color, bg, label, value, delay = '0s',
}) => (
  <div className="aw-fade-up" style={{ animationDelay: delay, padding: '16px 18px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
    <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={18} style={{ color }} />
    </div>
    <div>
      <div style={{ fontSize: 22, fontWeight: 900, color: T.white, lineHeight: 1, marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: 11, color: T.textMuted }}>{label}</div>
    </div>
  </div>
);

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface EmployeeDetailPageProps { employeeId: string; onBack: () => void; }
interface EmployeeData { id: string; full_name: string; email: string; phone: string | null; employee_id: string | null; pre_assessment_score: number | null; post_assessment_score: number | null; pre_assessment_date: string | null; post_assessment_date: string | null; department: { name: string }; }
interface CourseProgress { course_id: string; course_name: string; progress_percentage: number; status: string; assigned_at: string; completed_at: string | null; completed_sections: number; total_sections: number; }
interface ExamAttempt { exam_name: string; attempt_number: number; score: number; passed: boolean; completed_at: string; }
interface Certificate { id: string; course_name: string | null; certificate_number: string; issued_at: string; }

const STATUS_COLOR: Record<string, string> = { COMPLETED: T.green, IN_PROGRESS: T.blue, NOT_STARTED: 'rgba(255,255,255,0.15)' };
const STATUS_LABEL: Record<string, string> = { COMPLETED: 'Completed', IN_PROGRESS: 'In Progress', NOT_STARTED: 'Not Started' };

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const EmployeeDetailPage: React.FC<EmployeeDetailPageProps> = ({ employeeId, onBack }) => {
  const [employee, setEmployee]       = useState<EmployeeData | null>(null);
  const [courses, setCourses]         = useState<CourseProgress[]>([]);
  const [exams, setExams]             = useState<ExamAttempt[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => { loadAllData(); }, [employeeId]);

  const loadAllData = async () => {
    setLoading(true);
    try { await Promise.all([loadEmployee(), loadCourses(), loadExams(), loadCerts()]); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadEmployee = async () => {
    const { data } = await supabase.from("users").select("*, department:departments!users_department_id_fkey(name)").eq("id", employeeId).maybeSingle();
    if (data) setEmployee(data);
  };

  const loadCourses = async () => {
    const { data: ec } = await supabase.from("employee_courses").select("*, courses(title)").eq("employee_id", employeeId);
    if (!ec?.length) return;
    const withProgress = await Promise.all(ec.map(async (e: any) => {
      const pct = parseFloat(e.progress_percentage) || 0;
      const [{ data: secs }, { data: done }] = await Promise.all([
        supabase.from("course_sections").select("id").eq("course_id", e.course_id),
        supabase.from("course_section_progress").select("section_id").eq("employee_id", employeeId).eq("course_id", e.course_id).eq("completed", true),
      ]);
      return { course_id: e.course_id, course_name: e.courses?.title || "Unknown", progress_percentage: pct, status: pct >= 100 ? "COMPLETED" : pct > 0 ? "IN_PROGRESS" : "NOT_STARTED", assigned_at: e.assigned_at, completed_at: e.completed_at, completed_sections: done?.length || 0, total_sections: secs?.length || 0 };
    }));
    setCourses(withProgress);
  };

  const loadExams = async () => {
    const { data } = await supabase.from("exam_results").select("*, exams(title, passing_score)").eq("employee_id", employeeId).order("completed_at", { ascending: false });
    if (!data) return;
    const counts = new Map<string, number>();
    setExams(data.map((r: any) => {
      const c = (counts.get(r.exam_id) || 0) + 1;
      counts.set(r.exam_id, c);
      return { exam_name: r.exams?.title || "Unknown", attempt_number: c, score: r.percentage || 0, passed: r.passed || false, completed_at: r.completed_at };
    }));
  };

  const loadCerts = async () => {
    const { data } = await supabase.from("issued_certificates").select("*, courses(title)").eq("employee_id", employeeId).order("issued_at", { ascending: false });
    if (data) setCertificates(data.map((c: any) => ({ id: c.id, course_name: c.courses?.title || null, certificate_number: c.certificate_number, issued_at: c.issued_at })));
  };

  const generateReport = () => {
    if (!employee) return;
    const improvement = employee.pre_assessment_score && employee.post_assessment_score
      ? (((employee.post_assessment_score - employee.pre_assessment_score) / employee.pre_assessment_score) * 100).toFixed(1)
      : "N/A";
    const content = `=== Employee Progress Report ===\nName: ${employee.full_name}\nEmail: ${employee.email}\nPhone: ${employee.phone || "N/A"}\nEmployee ID: ${employee.employee_id || "N/A"}\n\n=== Assessments ===\nPre: ${employee.pre_assessment_score?.toFixed(1) || "N/A"}%\nPost: ${employee.post_assessment_score?.toFixed(1) || "N/A"}%\nImprovement: ${improvement}%\n\n=== Courses ===\n${courses.map(c => `- ${c.course_name}: ${c.progress_percentage}% (${c.status})`).join("\n")}\n\n=== Exams ===\n${exams.map(e => `- ${e.exam_name} #${e.attempt_number}: ${e.score.toFixed(1)}% ${e.passed ? "PASSED" : "FAILED"}`).join("\n")}\n\n=== Certificates ===\n${certificates.map(c => `- ${c.course_name || "Certificate"}: ${c.certificate_number}`).join("\n")}`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${employee.full_name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  /* ── Loading ── */
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 14, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
    </div>
  );

  if (!employee) return (
    <div style={{ textAlign: 'center', padding: '60px 24px', fontFamily: 'Inter, sans-serif' }}>
      <p style={{ fontSize: 14, color: T.textBody, marginBottom: 16 }}>Employee not found</p>
      <button className="aw-back-btn" onClick={onBack}>Go Back</button>
    </div>
  );

  const improvement = employee.pre_assessment_score && employee.post_assessment_score
    ? ((employee.post_assessment_score - employee.pre_assessment_score) / employee.pre_assessment_score) * 100
    : 0;

  const completedCourses  = courses.filter(c => c.status === "COMPLETED").length;
  const inProgressCourses = courses.filter(c => c.status === "IN_PROGRESS").length;
  const notStarted        = courses.length - completedCourses - inProgressCourses;
  const avgProgress       = courses.length > 0 ? courses.reduce((s, c) => s + c.progress_percentage, 0) / courses.length : 0;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Top bar ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <button className="aw-back-btn" onClick={onBack}>
          <ArrowLeft size={15} /> Back
        </button>
        <button className="aw-dl-btn" onClick={generateReport}>
          <Download size={14} /> Download Report
        </button>
      </div>

      {/* ── Employee hero card ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.03s', background: T.bgCard, border: `1px solid rgba(200,255,0,0.18)`, borderRadius: 14, padding: '24px', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,255,0,0.07), transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(200,255,0,0.10)', border: '2px solid rgba(200,255,0,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: T.accent, flexShrink: 0 }}>
            {employee.full_name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: T.white, margin: '0 0 4px', letterSpacing: '-0.3px' }}>{employee.full_name}</h1>
            <p style={{ fontSize: 13, color: T.textMuted, margin: '0 0 3px' }}>{employee.email}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
              {employee.department?.name && (
                <span style={{ display: 'inline-flex', padding: '3px 10px', background: 'rgba(200,255,0,0.07)', border: '1px solid rgba(200,255,0,0.20)', borderRadius: 9999, fontSize: 11, fontWeight: 700, color: T.accent }}>{employee.department.name}</span>
              )}
              {employee.employee_id && (
                <span style={{ display: 'inline-flex', padding: '3px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, borderRadius: 9999, fontSize: 11, color: T.textMuted }}>ID: {employee.employee_id}</span>
              )}
              {employee.phone && (
                <span style={{ display: 'inline-flex', padding: '3px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, borderRadius: 9999, fontSize: 11, color: T.textMuted }}>{employee.phone}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        <StatCard icon={TrendingUp}    color={improvement >= 0 ? T.green : T.red} bg={improvement >= 0 ? T.greenBg : T.redBg} label="Improvement" value={`${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}%`} delay="0.05s" />
        <StatCard icon={BookOpen}      color={T.accent}  bg="rgba(200,255,0,0.08)" label="Courses" value={`${completedCourses}/${courses.length}`} delay="0.09s" />
        <StatCard icon={ClipboardCheck} color={T.purple} bg={T.purpleBg}           label="Exam Attempts" value={exams.length} delay="0.13s" />
        <StatCard icon={Award}          color={T.gold}   bg={T.goldBg}             label="Certificates" value={certificates.length} delay="0.17s" />
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>

        {/* Pie chart */}
        <div className="aw-detail-section aw-fade-up" style={{ animationDelay: '0.20s' }}>
          <div className="aw-detail-section-header">
            <BookOpen size={15} style={{ color: T.accent }} /> Course Breakdown
          </div>
          <div style={{ padding: '20px' }}>
            <PieChart completed={completedCourses} inProgress={inProgressCourses} notStarted={notStarted} />
          </div>
        </div>

        {/* Exam line chart */}
        <div className="aw-detail-section aw-fade-up" style={{ animationDelay: '0.23s' }}>
          <div className="aw-detail-section-header">
            <TrendingUp size={15} style={{ color: T.accent }} /> Exam Score Trend
          </div>
          <div style={{ padding: '16px 20px 20px' }}>
            <LineChart exams={[...exams].reverse()} />
            <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.textMuted }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.green }} /> Passed
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.textMuted }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.red }} /> Failed
              </div>
            </div>
          </div>
        </div>

        {/* Assessments */}
        <div className="aw-detail-section aw-fade-up" style={{ animationDelay: '0.26s' }}>
          <div className="aw-detail-section-header">
            <ClipboardCheck size={15} style={{ color: T.accent }} /> Assessments
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Pre-Assessment', score: employee.pre_assessment_score, date: employee.pre_assessment_date },
              { label: 'Post-Assessment', score: employee.post_assessment_score, date: employee.post_assessment_date },
            ].map(({ label, score, date }) => (
              <div key={label} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
                <CircleProgress pct={score ?? 0} size={52} color={score ? (score >= 70 ? T.green : score >= 50 ? T.orange : T.red) : T.textMuted} label={score ? `${score.toFixed(0)}` : '—'} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: T.white, margin: '0 0 4px' }}>{label}</p>
                  {score
                    ? <p style={{ fontSize: 13, fontWeight: 800, color: T.accent, margin: '0 0 3px' }}>{score.toFixed(1)}%</p>
                    : <p style={{ fontSize: 12, color: T.textMuted, margin: '0 0 3px' }}>Not completed</p>
                  }
                  {date && (
                    <p style={{ fontSize: 11, color: T.textMuted, margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={10} /> {fmt(date)}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Avg progress bar */}
            <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.textBody, marginBottom: 7 }}>
                <span>Avg Course Progress</span>
                <span style={{ color: T.accent, fontWeight: 700 }}>{avgProgress.toFixed(0)}%</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${avgProgress}%`, background: `linear-gradient(90deg, ${T.accent}, rgba(200,255,0,0.55))`, borderRadius: 9999, boxShadow: '0 0 8px rgba(200,255,0,0.28)', transition: 'width 0.5s ease' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Courses list ── */}
      <div className="aw-detail-section aw-fade-up" style={{ animationDelay: '0.28s' }}>
        <div className="aw-detail-section-header">
          <BookOpen size={15} style={{ color: T.accent }} /> Training Courses
          <span style={{ marginLeft: 'auto', fontSize: 12, color: T.textMuted, fontWeight: 400 }}>{courses.length} course{courses.length !== 1 ? 's' : ''}</span>
        </div>
        {courses.length > 0 ? (
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {courses.map(course => {
              const color = STATUS_COLOR[course.status] ?? 'rgba(255,255,255,0.15)';
              return (
                <div key={course.course_id} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Circle progress */}
                  <CircleProgress pct={course.progress_percentage} size={48} color={color} label={`${Math.round(course.progress_percentage)}`} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: T.white, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.course_name}</h4>
                      <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', background: `${color}18`, border: `1px solid ${color}30`, color, whiteSpace: 'nowrap' }}>
                        {STATUS_LABEL[course.status]}
                      </span>
                    </div>

                    {/* Linear progress */}
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden', marginBottom: 5 }}>
                      <div style={{ height: '100%', width: `${course.progress_percentage}%`, background: color, borderRadius: 9999, transition: 'width 0.5s ease' }} />
                    </div>

                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: T.textMuted, flexWrap: 'wrap' }}>
                      <span>{course.completed_sections}/{course.total_sections} sections</span>
                      {course.completed_at && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle size={10} style={{ color: T.green }} /> Completed {fmt(course.completed_at)}
                        </span>
                      )}
                      {!course.completed_at && course.assigned_at && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={10} /> Assigned {fmt(course.assigned_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: T.textMuted, fontSize: 13 }}>No courses assigned yet</div>
        )}
      </div>

      {/* ── Exam history table ── */}
      {exams.length > 0 && (
        <div className="aw-detail-section aw-fade-up" style={{ animationDelay: '0.30s' }}>
          <div className="aw-detail-section-header">
            <ClipboardCheck size={15} style={{ color: T.accent }} /> Exam History
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="aw-exam-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th style={{ textAlign: 'center' }}>Attempt</th>
                  <th style={{ textAlign: 'center' }}>Score</th>
                  <th style={{ textAlign: 'center' }}>Result</th>
                  <th style={{ textAlign: 'center' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam, idx) => (
                  <tr key={idx}>
                    <td style={{ color: T.white, fontWeight: 600 }}>{exam.exam_name}</td>
                    <td style={{ textAlign: 'center', color: T.textMuted }}>#{exam.attempt_number}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: 800, color: exam.passed ? T.green : T.red }}>{exam.score.toFixed(1)}%</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', background: exam.passed ? T.greenBg : T.redBg, border: `1px solid ${exam.passed ? T.greenBorder : T.redBorder}`, color: exam.passed ? T.green : T.red }}>
                        {exam.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', color: T.textMuted }}>{fmt(exam.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Certificates ── */}
      {certificates.length > 0 && (
        <div className="aw-detail-section aw-fade-up" style={{ animationDelay: '0.32s' }}>
          <div className="aw-detail-section-header">
            <Award size={15} style={{ color: T.gold }} /> Certificates
          </div>
          <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {certificates.map(cert => (
              <div key={cert.id} style={{ padding: '14px 16px', background: T.goldBg, border: `1px solid ${T.goldBorder}`, borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(251,191,36,0.15)', border: `1px solid ${T.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Award size={18} style={{ color: T.gold }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: T.white, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cert.course_name || 'Certificate'}
                  </h4>
                  <p style={{ fontSize: 11, fontFamily: 'monospace', color: T.textMuted, margin: '0 0 4px' }}>{cert.certificate_number}</p>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={10} /> {fmt(cert.issued_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
