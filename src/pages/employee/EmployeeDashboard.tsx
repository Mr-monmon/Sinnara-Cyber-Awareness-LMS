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
  blue:        '#60a5fa',
  orange:      '#fb923c',
  orangeBg:    'rgba(251,146,60,0.08)',
  purple:      '#a78bfa',
  purpleBg:    'rgba(167,139,250,0.08)',
  red:         '#f87171',
} as const;

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
const TIPS = [
  { Icon: Key,           color: '#c8ff00', title: 'Never Share Your OTP',             body: 'One-Time Passwords are confidential. No bank, government body, or colleague should ever ask for them.' },
  { Icon: Globe,         color: '#60a5fa', title: 'Verify Links Before Clicking',     body: 'Attackers use lookalike domains. Always inspect URLs carefully before clicking any link.' },
  { Icon: Shield,        color: '#34d399', title: 'Use Strong Unique Passwords',      body: 'Never reuse passwords across sites. Use a password manager to generate complex credentials.' },
  { Icon: Wifi,          color: '#a78bfa', title: 'Avoid Public Wi-Fi for Work',      body: 'Public networks can be monitored. Use a VPN or mobile data when accessing work systems.' },
  { Icon: Smartphone,    color: '#fb923c', title: 'Enable Two-Factor Authentication', body: 'Even if your password leaks, attackers cannot log in without your second factor.' },
  { Icon: UserX,         color: '#f87171', title: 'Beware of Shoulder Surfing',       body: 'In public spaces, shield your screen. Sensitive data can be stolen just by looking over your shoulder.' },
  { Icon: Bell,          color: '#60a5fa', title: 'Report Suspicious Activity',       body: 'If you receive an unusual login alert or suspect a breach, notify your security team immediately.' },
  { Icon: AlertTriangle, color: '#fb923c', title: 'Lock Your Screen When Away',       body: 'Always lock your computer when stepping away, even for a few minutes. Win+L or Cmd+Ctrl+Q.' },
  { Icon: CheckCircle,   color: '#34d399', title: 'Recognize Phishing Emails',        body: 'Suspicious urgency, unknown senders, and unusual requests are red flags. When in doubt, report to IT.' },
];

/* ── Tip carousel ── */
const TipCarousel: React.FC = () => {
  const [idx, setIdx]     = useState(0);
  const [cls, setCls]     = useState('aw-d-tip-in');
  const timer             = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = (next: number) => {
    setCls('aw-d-tip-out');
    setTimeout(() => { setIdx(next); setCls('aw-d-tip-in'); }, 370);
  };

  const reset = (next: number) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => go((next + 1) % TIPS.length), 5000);
  };

  useEffect(() => {
    reset(idx);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [idx]);

  const tip = TIPS[idx];
  const TipIcon = tip.Icon;

  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Shield size={13} style={{ color: T.accent }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '1px', textTransform: 'uppercase' }}>Security Tip</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted }}>{idx + 1} / {TIPS.length}</span>
      </div>

      <div className={cls} style={{ display: 'flex', gap: 13, alignItems: 'flex-start', minHeight: 70 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: tip.color + '14', border: '1px solid ' + tip.color + '28', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <TipIcon size={16} style={{ color: tip.color }} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: T.white, margin: '0 0 4px' }}>{tip.title}</p>
          <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: '19px', margin: 0 }}>{tip.body}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 14, flexWrap: 'wrap' }}>
        {TIPS.map((_, i) => (
          <button key={i} onClick={() => { reset(i); go(i); }} style={{
            width: i === idx ? 18 : 6, height: 6, borderRadius: 9999, border: 'none', cursor: 'pointer', padding: 0,
            background: i === idx ? T.accent : 'rgba(255,255,255,0.15)',
            transition: 'width 0.3s, background 0.3s',
          }} />
        ))}
      </div>
    </div>
  );
};

/* ── Bar chart ── */
const BarChart: React.FC<{ completed: number; total: number }> = ({ completed, total }) => {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <BarChart2 size={13} style={{ color: T.accent }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '1px', textTransform: 'uppercase' }}>Course Completion</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 14 }}>
        <span style={{ fontSize: 34, fontWeight: 900, color: T.white, lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>completed</span>
      </div>
      {[
        { label: 'Completed', value: completed, color: T.green, p: total > 0 ? (completed / total) * 100 : 0 },
        { label: 'Remaining', value: total - completed, color: 'rgba(255,255,255,0.08)', p: total > 0 ? ((total - completed) / total) * 100 : 0 },
      ].map(b => (
        <div key={b.label} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textMuted, marginBottom: 5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: b.color, display: 'inline-block' }} />
              {b.label}
            </span>
            <span style={{ color: '#94a3b8', fontWeight: 600 }}>{b.value}</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 9999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: b.p + '%', background: b.color === T.green ? 'linear-gradient(90deg,#34d399,rgba(52,211,153,0.55))' : b.color, borderRadius: 9999, transition: 'width 0.8s ease' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/* ── Donut chart ── */
const Donut: React.FC<{ completed: number; inProgress: number; notStarted: number }> = ({ completed, inProgress, notStarted }) => {
  const total = Math.max(completed + inProgress + notStarted, 1);
  const slices = [
    { v: completed,   c: T.green,                  label: 'Completed'   },
    { v: inProgress,  c: T.blue,                   label: 'In Progress' },
    { v: notStarted,  c: 'rgba(255,255,255,0.10)', label: 'Not Started' },
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
        <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '1px', textTransform: 'uppercase' }}>Courses Breakdown</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <svg width={116} height={116} viewBox="0 0 116 116" style={{ flexShrink: 0 }}>
          {paths.map((s, i) => <path key={i} d={s.d} fill={s.c} />)}
          <circle cx={cx} cy={cy} r={26} fill={T.bgCard} />
          <text x={cx} y={cy - 5} textAnchor="middle" fill={T.white} fontSize="14" fontWeight="800" fontFamily="Inter,sans-serif">{total}</text>
          <text x={cx} y={cy + 9} textAnchor="middle" fill={T.textMuted} fontSize="9" fontFamily="Inter,sans-serif">total</text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
          {[
            { label: 'Completed',   value: completed,   color: T.green },
            { label: 'In Progress', value: inProgress,  color: T.blue  },
            { label: 'Not Started', value: notStarted,  color: 'rgba(255,255,255,0.20)' },
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
const Stat: React.FC<{ Icon: React.ElementType; color: string; bg: string; label: string; value: string | number; delay: string }> = ({ Icon, color, bg, label, value, delay }) => (
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

/* ═══════════════════════════════════════════
   MAIN
═══════════════════════════════════════════ */
export const EmployeeDashboard: React.FC = () => {
  const { user }    = useAuth();
  const { t, i18n } = useTranslation("employee");
  const [activePage, setActivePage]       = useState("dashboard");
  const [isLoading, setIsLoading]         = useState(true);
  const [assignedExams, setAssignedExams] = useState<EmployeeAvailableExam[]>([]);
  const [company, setCompany]             = useState<Company | null>(null);
  const [stats, setStats] = useState({ assignedCourses: 0, completedCourses: 0, inProgressCourses: 0, pendingExams: 0, certificates: 0 });
  const [userRank, setUserRank] = useState(0);
  const currentLanguage = i18n.resolvedLanguage;
  const isRtl = i18n.dir() === "rtl";

  useEffect(() => { loadCompany(); loadAssignedExams(); loadStats(); }, [user]);
  useEffect(() => { if (!isLoading && assignedExams.length > 0) setActivePage("my-exams"); }, [isLoading, assignedExams]);

  const loadAssignedExams = async () => {
    if (!user) return;
    const { data } = await supabase.from("employee_available_exams").select("*").eq("employee_id", user.id);
    setAssignedExams((data as EmployeeAvailableExam[]) || []);
  };

  const loadCompany = async () => {
    if (!user?.company_id) return;
    setIsLoading(true);
    try {
      const { data } = await supabase.from("companies").select("id, name, is_active").eq("id", user.company_id).single();
      setCompany(data);
    } catch { setIsLoading(false); }
  };

  const loadStats = async () => {
    if (!user?.id) return;
    try {
      const { data: courses } = await supabase.from("employee_courses").select("*").eq("employee_id", user.id);
      const { data: certs }   = await supabase.from("exam_attempts").select("id").eq("employee_id", user.id).eq("passed", true);
      const { data: rankData } = await supabase.functions.invoke("get_user_rank", { method: "POST", body: { company_id: user.company_id, employee_id: user.id } });
      setUserRank(rankData?.index || 0);
      setStats({
        assignedCourses:   courses?.length || 0,
        completedCourses:  courses?.filter((c: any) => c.status === "COMPLETED").length   || 0,
        inProgressCourses: courses?.filter((c: any) => c.status === "IN_PROGRESS").length || 0,
        pendingExams:      assignedExams.length,
        certificates:      certs?.length || 0,
      });
      setIsLoading(false);
    } catch { setIsLoading(false); }
  };

  const renderDashboard = () => {
    const notStarted = Math.max(0, stats.assignedCourses - stats.completedCourses - stats.inProgressCourses);
    const pct = stats.assignedCourses > 0 ? Math.round((stats.completedCourses / stats.assignedCourses) * 100) : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, fontFamily: "'Inter',sans-serif" }}>

        {/* Header */}
        <div className="aw-d-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, margin: '0 0 5px', letterSpacing: '-0.3px' }}>{t("dashboard.title")} 👋</h1>
            <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>{t("dashboard.subtitle")}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 16px', background: T.bgCard, border: '1px solid rgba(200,255,0,0.18)', borderRadius: 11 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(200,255,0,0.10)', border: '2px solid rgba(200,255,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 900, color: T.accent }}>{formatLocalizedNumber(userRank, currentLanguage)}</span>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{t("dashboard.rankLabel")}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{t("dashboard.rankHint")}</div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 12 }}>
          <Stat Icon={BookOpen}       color={T.accent} bg="rgba(200,255,0,0.08)" label={t("dashboard.stats.assignedCourses")}    value={formatLocalizedNumber(stats.assignedCourses,  currentLanguage)} delay="0.00s" />
          <Stat Icon={CheckCircle}    color={T.green}  bg={T.greenBg}            label={t("dashboard.stats.completedCourses")}   value={formatLocalizedNumber(stats.completedCourses, currentLanguage)} delay="0.05s" />
          <Stat Icon={ClipboardCheck} color={T.orange} bg={T.orangeBg}           label={t("dashboard.stats.pendingAssessments")} value={formatLocalizedNumber(stats.pendingExams,     currentLanguage)} delay="0.10s" />
          <Stat Icon={Award}          color={T.purple} bg={T.purpleBg}           label={t("dashboard.stats.certificatesEarned")} value={formatLocalizedNumber(stats.certificates,     currentLanguage)} delay="0.15s" />
        </div>

        {/* Charts + tip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
          <BarChart completed={stats.completedCourses} total={stats.assignedCourses} />
          <Donut completed={stats.completedCourses} inProgress={stats.inProgressCourses} notStarted={notStarted} />
          <TipCarousel />
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

          <div style={{ background: T.bgCard, border: '1px solid rgba(200,255,0,0.14)', borderRadius: 14, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden="true" style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(200,255,0,0.07),transparent 70%)', pointerEvents: 'none' }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: T.white, margin: '0 0 16px', position: 'relative' }}>{t("dashboard.progressCard.title")}</p>
            <div style={{ position: 'relative' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 7 }}>
                  <span>{t("dashboard.progressCard.courseCompletion")}</span>
                  <span style={{ color: T.accent, fontWeight: 700 }}>{pct}%</span>
                </div>
                <div style={{ height: 7, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct + '%', background: 'linear-gradient(90deg,#c8ff00,rgba(200,255,0,0.55))', borderRadius: 9999, boxShadow: '0 0 10px rgba(200,255,0,0.28)', transition: 'width 0.8s ease' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12, borderTop: `1px solid ${T.borderFaint}` }}>
                {[
                  { label: t("dashboard.progressCard.completedCourses"), value: stats.completedCourses, color: T.green  },
                  { label: t("dashboard.progressCard.certificates"),      value: stats.certificates,     color: T.purple },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>{label}</span>
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
      case "my-exams":     return <MyExamsPage onExamCompleted={() => { loadAssignedExams(); loadStats(); }} />;
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
        <DashboardLayout activePage={activePage} onNavigate={(page) => { if (assignedExams.length > 0 && page !== "my-exams") return; setActivePage(page); }}>
          {renderContent()}
        </DashboardLayout>
      ) : (
        <InactivatedSubscription />
      )}
    </>
  );
};
