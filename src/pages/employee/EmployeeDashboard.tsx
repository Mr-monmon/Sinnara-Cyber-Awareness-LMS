import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen, ClipboardCheck, Award, Shield,
  TrendingUp, ChevronRight, CheckCircle, BarChart2,
  Wifi, Smartphone, Key, Globe, UserX,
  Bell, AlertTriangle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "../../components/layouts/DashboardLayout";
import { MyCoursesPage } from "./MyCoursesPage";
import { MyExamsPage } from "./MyExamsPage";
import { CertificatesPage } from "./CertificatesPage";
import { FraudAlertsPage } from "./FraudAlertsPage";
import { FraudAlertWidget } from "../../components/FraudAlertWidget";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { EmployeeAvailableExam, Company } from "../../lib/types";
import { formatLocalizedNumber } from "../../i18n/utils";
import LoadingScreen from "../../components/LoadingScreen";
import InactivatedSubscription from "../../components/InactivatedSubscription";
import AccountSettings from "../company-admin/AccountSettings";
import { ThemeProvider, useTheme } from "../../contexts/ThemeContext";

/* tokens are consumed via useTheme() inside each component */

/* ─────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  @keyframes aw-d-fade-in  { from { opacity:0; transform:translateY(8px);  } to { opacity:1; transform:translateY(0);     } }
  @keyframes aw-d-fade-out { from { opacity:1; transform:translateY(0);    } to { opacity:0; transform:translateY(-8px); } }
  @keyframes aw-d-fade-up  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0);     } }
  .aw-d-tip-in  { animation: aw-d-fade-in  0.45s ease both; }
  .aw-d-tip-out { animation: aw-d-fade-out 0.35s ease both; }
  .aw-d-fade-up { animation: aw-d-fade-up  0.40s ease both; }
  .aw-d-qbtn {
    width:100%; display:flex; align-items:center; justify-content:space-between;
    padding:13px 16px; border-radius:10px; border:1px solid rgba(255,255,255,0.07);
    background:rgba(255,255,255,0.03); cursor:pointer; font-family:'Inter',sans-serif;
    text-align:left; transition:background 0.18s, border-color 0.18s, transform 0.15s;
  }
  .aw-d-qbtn:hover { background:rgba(255,255,255,0.06); border-color:rgba(255,255,255,0.13); transform:translateX(3px); }
`;
if (typeof document !== 'undefined' && !document.getElementById('aw-d-styles')) {
  const s = document.createElement('style'); s.id = 'aw-d-styles'; s.textContent = STYLES; document.head.appendChild(s);
}

/* ─────────────────────────────────────────
   SECURITY TIPS
───────────────────────────────────────── */
const TIP_ICONS = [Key, Globe, Shield, Wifi, Smartphone, UserX, Bell, AlertTriangle, CheckCircle];
const TIP_COLORS_DARK  = ['#c8ff00', '#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#f87171', '#60a5fa', '#fb923c', '#34d399'];
const TIP_COLORS_LIGHT = ['#16a34a', '#2563eb', '#16a34a', '#7c3aed', '#ea580c', '#dc2626', '#2563eb', '#ea580c', '#16a34a'];

/* ── Tip carousel ── */
const TipCarousel: React.FC = () => {
  const { t } = useTranslation('employee');
  const { isDark, tokens: T } = useTheme();
  const tipColors = isDark ? TIP_COLORS_DARK : TIP_COLORS_LIGHT;
  const tips: { title: string; body: string }[] = t('dashboard.securityTip.tips', { returnObjects: true }) as any;
  const [idx, setIdx]     = useState(0);
  const [cls, setCls]     = useState('aw-d-tip-in');
  const timer             = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = (next: number) => {
    setCls('aw-d-tip-out');
    setTimeout(() => { setIdx(next); setCls('aw-d-tip-in'); }, 370);
  };

  const reset = (next: number) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => go((next + 1) % tips.length), 5000);
  };

  useEffect(() => {
    reset(idx);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [idx]);

  const tip = tips[idx];
  const TipIcon = TIP_ICONS[idx];
  const tipColor = tipColors[idx];

  return (
    <div style={{
      background: `linear-gradient(135deg, ${T.bgCard} 0%, ${isDark ? 'rgba(200,255,0,0.04)' : 'rgba(22,163,74,0.04)'} 100%)`,
      border: `1px solid ${tipColor}33`,
      borderRadius: 16, padding: '28px 32px', position: 'relative', overflow: 'hidden',
    }}>
      <div aria-hidden="true" style={{
        position: 'absolute', top: -60, right: -60, width: 180, height: 180,
        borderRadius: '50%', background: `radial-gradient(circle, ${tipColor}14, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, position: 'relative' }}>
        <Shield size={16} style={{ color: T.accent }} />
        <span style={{ fontSize: 12, fontWeight: 800, color: T.accent, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          {t('dashboard.securityTip.label')}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: T.textMuted }}>
          {idx + 1} / {tips.length}
        </span>
      </div>

      <div className={cls} style={{ display: 'flex', gap: 22, alignItems: 'center', minHeight: 110, position: 'relative' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 16,
          background: tipColor + '1a', border: '1px solid ' + tipColor + '40',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: `0 0 24px ${tipColor}33`,
        }}>
          <TipIcon size={34} style={{ color: tipColor }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 20, fontWeight: 800, color: T.white, margin: '0 0 8px', lineHeight: 1.25 }}>{tip.title}</p>
          <p style={{ fontSize: 14, color: T.textBody, lineHeight: '22px', margin: 0 }}>{tip.body}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 5, marginTop: 22, flexWrap: 'wrap', position: 'relative' }}>
        {tips.map((_, i) => (
          <button key={i} onClick={() => { reset(i); go(i); }} style={{
            width: i === idx ? 28 : 8, height: 8, borderRadius: 9999, border: 'none', cursor: 'pointer', padding: 0,
            background: i === idx ? T.accent : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'),
            transition: 'width 0.3s, background 0.3s',
          }} />
        ))}
      </div>
    </div>
  );
};

/* ── Bar chart ── */
const BarChart: React.FC<{ completed: number; total: number; labels: { courseCompletion: string; completed: string; remaining: string } }> = ({ completed, total, labels }) => {
  const { tokens: T } = useTheme();
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <BarChart2 size={13} style={{ color: T.accent }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '1px', textTransform: 'uppercase' }}>{labels.courseCompletion}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 14 }}>
        <span style={{ fontSize: 34, fontWeight: 900, color: T.white, lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>{labels.completed}</span>
      </div>
      {[
        { label: labels.completed, value: completed,         color: T.green,  p: total > 0 ? (completed / total) * 100 : 0 },
        { label: labels.remaining, value: total - completed, color: T.border, p: total > 0 ? ((total - completed) / total) * 100 : 0 },
      ].map(b => (
        <div key={b.label} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textMuted, marginBottom: 5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: b.color, display: 'inline-block' }} />
              {b.label}
            </span>
            <span style={{ color: T.textMuted, fontWeight: 600 }}>{b.value}</span>
          </div>
          <div style={{ height: 6, background: T.borderFaint, borderRadius: 9999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: b.p + '%', background: b.color === T.green ? `linear-gradient(90deg,${T.green},${T.green}8c)` : b.color, borderRadius: 9999, transition: 'width 0.8s ease' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/* ── Donut chart ── */
const Donut: React.FC<{ completed: number; inProgress: number; notStarted: number; labels: { coursesBreakdown: string; completed: string; inProgress: string; notStarted: string; total: string } }> = ({ completed, inProgress, notStarted, labels }) => {
  const { tokens: T } = useTheme();
  const total = Math.max(completed + inProgress + notStarted, 1);
  const slices = [
    { v: completed,   c: T.green,  label: labels.completed   },
    { v: inProgress,  c: T.blue,   label: labels.inProgress  },
    { v: notStarted,  c: T.border, label: labels.notStarted  },
  ].filter(s => s.v > 0);
  const R = 42; const cx = 58; const cy = 58;
  const toXY = (deg: number) => ({ x: cx + R * Math.cos((deg * Math.PI) / 180), y: cy + R * Math.sin((deg * Math.PI) / 180) });
  let cum = -90;
  const paths = slices.map(s => {
    const a = (s.v / total) * 360;
    const p1 = toXY(cum); const p2 = toXY(cum + a - 0.5);
    const d = `M ${cx} ${cy} L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${R} ${R} 0 ${a > 180 ? 1 : 0} 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} Z`;
    cum += a;
    return { ...s, d };
  });
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <TrendingUp size={13} style={{ color: T.accent }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '1px', textTransform: 'uppercase' }}>{labels.coursesBreakdown}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <svg width={116} height={116} viewBox="0 0 116 116" style={{ flexShrink: 0 }}>
          {paths.map((s, i) => <path key={i} d={s.d} fill={s.c} />)}
          <circle cx={cx} cy={cy} r={26} fill={T.bgCard} />
          <text x={cx} y={cy - 5} textAnchor="middle" fill={T.white} fontSize="14" fontWeight="800" fontFamily="Inter,sans-serif">{total}</text>
          <text x={cx} y={cy + 9} textAnchor="middle" fill={T.textMuted} fontSize="9" fontFamily="Inter,sans-serif">{labels.total}</text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
          {[
            { label: labels.completed,   value: completed,   color: T.green  },
            { label: labels.inProgress,  value: inProgress,  color: T.blue   },
            { label: labels.notStarted,  value: notStarted,  color: T.border },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.textMuted }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                {s.label}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Stat card ── */
const Stat: React.FC<{ Icon: React.ElementType; color: string; bg: string; label: string; value: string | number; delay: string }> = ({ Icon, color, bg, label, value, delay }) => {
  const { tokens: T } = useTheme();
  return (
  <div className="aw-d-fade-up" style={{ animationDelay: delay, padding: '18px 20px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{ width: 44, height: 44, borderRadius: 11, background: bg, border: '1px solid ' + color + '28', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={20} style={{ color }} />
    </div>
    <div>
      <div style={{ fontSize: 24, fontWeight: 900, color: T.white, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: T.textMuted }}>{label}</div>
    </div>
  </div>
  );
};

/* ═══════════════════════════════════════════
   MAIN
═══════════════════════════════════════════ */
const EmployeeDashboardInner: React.FC = () => {
  const { user }    = useAuth();
  const { t, i18n } = useTranslation("employee");
  const { tokens: T } = useTheme();
  const [activePage, setActivePage]       = useState("dashboard");
  const [isLoading, setIsLoading]         = useState(true);
  const [assignedExams, setAssignedExams] = useState<EmployeeAvailableExam[]>([]);
  const [company, setCompany]             = useState<Company | null>(null);
  const [stats, setStats] = useState({ assignedCourses: 0, completedCourses: 0, inProgressCourses: 0, pendingExams: 0, certificates: 0 });
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [lastCourse, setLastCourse] = useState<{ title: string; progress_percentage: number; last_accessed_at: string | null } | null>(null);
  const currentLanguage = i18n.resolvedLanguage;
  const isRtl = i18n.dir() === "rtl";

  useEffect(() => { loadCompany(); loadStats(); }, [user]);
  // intentionally not auto-redirecting to exams — employee can navigate freely

  const loadAssignedExams = async () => {
    if (!user) return;
    const { data } = await supabase.from("employee_available_exams").select("*").eq("employee_id", user.id);
    const exams = (data as EmployeeAvailableExam[]) || [];
    setAssignedExams(exams);
    return exams;
  };

  const loadCompany = async () => {
    if (!user?.company_id) return;
    setIsLoading(true);
    try {
      const { data } = await supabase.from("companies").select("id, name, is_active").eq("id", user.company_id).single();
      setCompany(data);
    } catch {
      setIsLoading(false);
      setLoadError(true);
    }
  };

  const loadStats = async () => {
    if (!user?.id || !user?.company_id) return;
    try {
      // Step 1: company courses
      const { data: ccData } = await supabase
        .from("company_courses").select("course_id").eq("company_id", user.company_id);
      const companyCourseIds: string[] = (ccData ?? []).map((r: any) => r.course_id);

      // Step 2: department restrictions
      const { data: deptRestrictions } = await supabase
        .from("company_course_departments")
        .select("course_id, department_id")
        .eq("company_id", user.company_id)
        .in("course_id", companyCourseIds.length ? companyCourseIds : ["00000000-0000-0000-0000-000000000000"]);
      const courseDeptMap: Record<string, string[]> = {};
      (deptRestrictions ?? []).forEach((r: any) => {
        if (!courseDeptMap[r.course_id]) courseDeptMap[r.course_id] = [];
        courseDeptMap[r.course_id].push(r.department_id);
      });

      // Step 3: accessible courses for this employee
      const accessibleCourseIds = companyCourseIds.filter(courseId => {
        const allowedDepts = courseDeptMap[courseId];
        if (!allowedDepts || allowedDepts.length === 0) return true;
        if (user.department_id) return allowedDepts.includes(user.department_id);
        return false;
      });

      // Step 4: employee_courses scoped to accessible courses, deduped by course_id
      let completedCount = 0, inProgressCount = 0, totalCount = 0;
      if (accessibleCourseIds.length > 0) {
        const { data: ecRows } = await supabase
          .from("employee_courses")
          .select("course_id, status")
          .eq("employee_id", user.id)
          .in("course_id", accessibleCourseIds);

        const latestByCourse = new Map<string, string>();
        (ecRows ?? []).forEach((r: any) => latestByCourse.set(r.course_id, r.status));

        totalCount = accessibleCourseIds.length;
        latestByCourse.forEach(status => {
          if (status === "COMPLETED") completedCount++;
          else if (status === "IN_PROGRESS") inProgressCount++;
        });
      }

      // Step 5: real certificates from issued_certificates
      const { data: certs } = await supabase
        .from("issued_certificates").select("id").eq("employee_id", user.id);

      // Step 6: last accessed in-progress course for "Continue Learning".
      // Must be scoped to the courses this employee can actually access — otherwise
      // we surface stale enrolment rows for courses that were de-assigned from the
      // company or department.
      if (accessibleCourseIds.length > 0) {
        const { data: lastCourseRow } = await supabase
          .from("employee_courses")
          .select("progress_percentage, last_accessed_at, courses(title)")
          .eq("employee_id", user.id)
          .eq("status", "IN_PROGRESS")
          .in("course_id", accessibleCourseIds)
          .order("last_accessed_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        if (lastCourseRow) {
          setLastCourse({
            title: (lastCourseRow.courses as any)?.title || "Course",
            progress_percentage: parseFloat(lastCourseRow.progress_percentage as any) || 0,
            last_accessed_at: lastCourseRow.last_accessed_at ?? null,
          });
        } else {
          setLastCourse(null);
        }
      } else {
        setLastCourse(null);
      }

      const { data: rankData } = await supabase.functions.invoke("get_user_rank", {
        method: "POST", body: { company_id: user.company_id, employee_id: user.id }
      });
      setUserRank(rankData?.index ?? null);

      const exams = await loadAssignedExams() ?? [];

      setStats({
        assignedCourses:   totalCount,
        completedCourses:  completedCount,
        inProgressCourses: inProgressCount,
        pendingExams:      exams.length,
        certificates:      certs?.length || 0,
      });
      setIsLoading(false);
    } catch {
      setIsLoading(false);
      setLoadError(true);
    }
  };

  const renderDashboard = () => {
    const notStarted = Math.max(0, stats.assignedCourses - stats.completedCourses - stats.inProgressCourses);
    const pct = stats.assignedCourses > 0 ? Math.round((stats.completedCourses / stats.assignedCourses) * 100) : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, fontFamily: "'Inter',sans-serif" }}>

        {/* Load error */}
        {loadError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.22)', borderRadius: 10 }}>
            <AlertTriangle size={16} style={{ color: T.red, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: T.red }}>{t('dashboard.loadError')}</span>
          </div>
        )}

        {/* Header */}
        <div className="aw-d-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, margin: '0 0 5px', letterSpacing: '-0.3px' }}>{t("dashboard.title")} 👋</h1>
            <p style={{ fontSize: 14, color: T.textMuted, margin: 0 }}>{t("dashboard.subtitle")}</p>
          </div>
          {userRank !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 16px', background: T.bgCard, border: `1px solid ${T.accent}2e`, borderRadius: 11 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: T.accent + '1a', border: `2px solid ${T.accent}47`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: T.accent }}>{formatLocalizedNumber(userRank, currentLanguage)}</span>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{t("dashboard.rankLabel")}</div>
                <div style={{ fontSize: 11, color: T.textMuted }}>{t("dashboard.rankHint")}</div>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 12 }}>
          <Stat Icon={BookOpen}       color={T.accent} bg={T.accent + '14'}       label={t("dashboard.stats.assignedCourses")}    value={formatLocalizedNumber(stats.assignedCourses,  currentLanguage)} delay="0.00s" />
          <Stat Icon={CheckCircle}    color={T.green}  bg={T.greenBg}            label={t("dashboard.stats.completedCourses")}   value={formatLocalizedNumber(stats.completedCourses, currentLanguage)} delay="0.05s" />
          <Stat Icon={ClipboardCheck} color={T.orange} bg={T.orangeBg}           label={t("dashboard.stats.pendingAssessments")} value={formatLocalizedNumber(stats.pendingExams,     currentLanguage)} delay="0.10s" />
          <Stat Icon={Award}          color={T.purple} bg={T.purpleBg}           label={t("dashboard.stats.certificatesEarned")} value={formatLocalizedNumber(stats.certificates,     currentLanguage)} delay="0.15s" />
        </div>

        {/* All Done — employee has assigned courses and finished every one */}
        {!lastCourse && stats.assignedCourses > 0 && stats.completedCourses >= stats.assignedCourses && (
          <div className="aw-d-fade-up" style={{ background: T.bgCard, border: `1px solid ${T.greenBorder}`, borderRadius: 14, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: T.greenBg, border: `1px solid ${T.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircle size={24} style={{ color: T.green }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.white, marginBottom: 4 }}>
                {t('dashboard.allDone.title')} 🎉
              </div>
              <div style={{ fontSize: 12, color: T.textBody }}>
                {t('dashboard.allDone.subtitle')}
              </div>
            </div>
          </div>
        )}

        {/* Continue Learning — shown only when an in-progress course exists */}
        {lastCourse && (
          <div className="aw-d-fade-up" style={{ background: T.bgCard, border: `1px solid ${T.blueBorder}`, borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookOpen size={20} style={{ color: T.blue }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.blue, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>
                {t('dashboard.quickActions.continueLearning.title')}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
                {lastCourse.title}
              </div>
              <div style={{ height: 4, background: T.borderFaint, borderRadius: 9999, overflow: 'hidden', maxWidth: 220 }}>
                <div style={{ height: '100%', width: `${lastCourse.progress_percentage}%`, background: T.blue, borderRadius: 9999, transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
                {Math.round(lastCourse.progress_percentage)}% {t('dashboard.charts.completed').toLowerCase()}
              </div>
            </div>
            <button
              onClick={() => setActivePage('my-courses')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 9, border: `1px solid ${T.blueBorder}`, background: T.blueBg, color: T.blue, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
            >
              {t('actions.continue', { ns: 'common' })} <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Security tip — full width, prominent */}
        <TipCarousel />

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          <BarChart
            completed={stats.completedCourses}
            total={stats.assignedCourses}
            labels={{
              courseCompletion: t('dashboard.charts.courseCompletion'),
              completed: t('dashboard.charts.completed'),
              remaining: t('dashboard.charts.remaining'),
            }}
          />
          <Donut
            completed={stats.completedCourses}
            inProgress={stats.inProgressCourses}
            notStarted={notStarted}
            labels={{
              coursesBreakdown: t('dashboard.charts.coursesBreakdown'),
              completed: t('dashboard.charts.completed'),
              inProgress: t('dashboard.charts.inProgress'),
              notStarted: t('dashboard.charts.notStarted'),
              total: t('dashboard.charts.total'),
            }}
          />
        </div>

        {/* Fraud alerts */}
        <FraudAlertWidget onNavigate={setActivePage} />

        {/* Quick actions + progress */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>

          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.white, margin: '0 0 14px' }}>{t("dashboard.quickActions.title")}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                ['my-courses',   T.accent, BookOpen,       'dashboard.quickActions.continueLearning.title',  'dashboard.quickActions.continueLearning.subtitle'  ],
                ['my-exams',     T.orange, ClipboardCheck, 'dashboard.quickActions.takeAssessments.title',   'dashboard.quickActions.takeAssessments.subtitle'   ],
                ['certificates', T.purple, Award,          'dashboard.quickActions.viewCertificates.title',  'dashboard.quickActions.viewCertificates.subtitle'  ],
              ] as [string, string, React.ElementType, string, string][]).map(([page, color, Icon, tk, sk]) => (
                <button key={page} className="aw-d-qbtn" onClick={() => setActivePage(page)} style={{ textAlign: isRtl ? 'right' : 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: color + '14', border: '1px solid ' + color + '28', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={14} style={{ color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.white }}>{t(tk)}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{t(sk)}</div>
                    </div>
                  </div>
                  <ChevronRight size={13} style={{ color: T.textMuted, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: T.bgCard, border: `1px solid ${T.accent}24`, borderRadius: 14, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden="true" style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle,${T.accent}12,transparent 70%)`, pointerEvents: 'none' }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: T.white, margin: '0 0 16px', position: 'relative' }}>{t("dashboard.progressCard.title")}</p>
            <div style={{ position: 'relative' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.textMuted, marginBottom: 7 }}>
                  <span>{t("dashboard.progressCard.courseCompletion")}</span>
                  <span style={{ color: T.accent, fontWeight: 700 }}>{pct}%</span>
                </div>
                <div style={{ height: 7, background: T.borderFaint, borderRadius: 9999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct + '%', background: `linear-gradient(90deg,${T.accent},${T.accent}8c)`, borderRadius: 9999, transition: 'width 0.8s ease' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12, borderTop: `1px solid ${T.borderFaint}` }}>
                {[
                  { label: t("dashboard.progressCard.completedCourses"), value: stats.completedCourses, color: T.green  },
                  { label: t("dashboard.progressCard.certificates"),      value: stats.certificates,     color: T.purple },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: T.textMuted }}>{label}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color }}>{formatLocalizedNumber(value, currentLanguage)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activePage) {
      case "my-courses":   return <MyCoursesPage navigateToCertificates={() => setActivePage("certificates")} />;
      case "my-exams":     return <MyExamsPage onExamCompleted={() => { void loadStats(); }} />;
      case "fraud-alerts": return <FraudAlertsPage />;
      case "certificates": return <CertificatesPage />;
      case "account":      return <AccountSettings />;
      default:             return renderDashboard();
    }
  };

  return (
    <>
      {isLoading ? (
        <LoadingScreen />
      ) : company?.is_active ? (
        <DashboardLayout activePage={activePage} onNavigate={(page) => setActivePage(page)}>
          {renderContent()}
        </DashboardLayout>
      ) : (
        <InactivatedSubscription />
      )}
    </>
  );
};

export const EmployeeDashboard: React.FC = () => (
  <ThemeProvider>
    <EmployeeDashboardInner />
  </ThemeProvider>
);
