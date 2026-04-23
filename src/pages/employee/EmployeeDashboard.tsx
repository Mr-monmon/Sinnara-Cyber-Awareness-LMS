import { useState, useEffect, useRef } from "react";
import {
  BookOpen, ClipboardCheck, Award, Shield,
  TrendingUp, ChevronRight, AlertTriangle,
  CheckCircle, BarChart2, Lock, Eye, Wifi,
  Smartphone, Key, Globe, UserX, Bell,
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
  blueBg:      'rgba(96,165,250,0.08)',
  orange:      '#fb923c',
  orangeBg:    'rgba(251,146,60,0.08)',
  purple:      '#a78bfa',
  purpleBg:    'rgba(167,139,250,0.08)',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  @keyframes aw-tip-fade-in  { from { opacity:0; transform:translateY(8px);  } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-tip-fade-out { from { opacity:1; transform:translateY(0);    } to { opacity:0; transform:translateY(-8px); } }
  @keyframes aw-spin          { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up       { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-bar-grow      { from { width:0%; } to { width:var(--bar-w); } }

  .aw-tip-in  { animation: aw-tip-fade-in  0.45s ease both; }
  .aw-tip-out { animation: aw-tip-fade-out 0.35s ease both; }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }

  .aw-quick-btn {
    width:100%; display:flex; align-items:center; justify-content:space-between;
    padding:14px 16px; border-radius:10px; border:1px solid rgba(255,255,255,0.07);
    background:rgba(255,255,255,0.03); cursor:pointer;
    font-family:'Inter',sans-serif; transition:background 0.18s, border-color 0.18s, transform 0.15s;
    text-align:left;
  }
  .aw-quick-btn:hover { background:rgba(255,255,255,0.06); border-color:rgba(255,255,255,0.13); transform:translateX(3px); }

  .aw-bar-fill { height:100%; border-radius:9999px; animation: aw-bar-grow 0.8s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-emp-dash-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-emp-dash-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   SECURITY TIPS
───────────────────────────────────────── */
const TIPS = [
  { icon: Key,        color: T.accent,  title: 'Never Share Your OTP', body: 'One-Time Passwords are confidential. No bank, government body, or colleague should ever ask for them.' },
  { icon: Globe,      color: T.blue,    title: 'Verify Links Before Clicking', body: 'Always inspect URLs carefully. Attackers use lookalike domains like "arnazon.com" instead of "amazon.com".' },
  { icon: Lock,       color: T.green,   title: 'Use Strong, Unique Passwords', body: 'Never reuse passwords across sites. Use a password manager to generate and store complex credentials.' },
  { icon: Wifi,       color: T.purple,  title: 'Avoid Public Wi-Fi for Sensitive Tasks', body: 'Public networks can be monitored. Use a VPN or mobile data when accessing work systems remotely.' },
  { icon: Smartphone, color: T.orange,  title: 'Enable Two-Factor Authentication', body: 'Add an extra layer of security to all your accounts. Even if your password leaks, attackers cannot log in.' },
  { icon: Eye,        color: '#f87171', title: 'Be Aware of Shoulder Surfing', body: 'In public spaces, shield your screen and keyboard. Sensitive data can be stolen just by looking over your shoulder.' },
  { icon: UserX,      color: T.accent,  title: 'Recognize Phishing Emails', body: 'Suspicious urgency, unknown senders, and unusual requests are red flags. When in doubt, report to IT.' },
  { icon: Bell,       color: T.blue,    title: 'Report Suspicious Activity Immediately', body: 'If you receive an unusual login alert or suspect a breach, notify your security team without delay.' },
  { icon: AlertTriangle, color: T.orange, title: 'Lock Your Screen When Away', body: 'Always lock your computer (Win+L or Cmd+Ctrl+Q) when stepping away, even for a few minutes.' },
];

/* ─────────────────────────────────────────
   SECURITY TIP CAROUSEL
───────────────────────────────────────── */
const SecurityTipCarousel: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [animClass, setAnimClass] = useState('aw-tip-in');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = (index: number) => {
    setAnimClass('aw-tip-out');
    setTimeout(() => { setCurrent(index); setAnimClass('aw-tip-in'); }, 360);
  };

  useEffect(() => {
    timerRef.current = setInterval(() => {
      goTo((current + 1) % TIPS.length);
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current]);

  const tip = TIPS[current];
  const Icon = tip.icon;

  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px', overflow: 'hidden', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Shield size={14} style={{ color: T.accent }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '1px', textTransform: 'uppercase' }}>Security Tip</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted }}>{current + 1} / {TIPS.length}</span>
      </div>

      {/* Tip content */}
      <div className={animClass} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${tip.color}14`, border: `1px solid ${tip.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={18} style={{ color: tip.color }} />
        </div>
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: T.white, margin: '0 0 5px' }}>{tip.title}</h4>
          <p style={{ fontSize: 13, color: T.textBody, lineHeight: '20px', margin: 0 }}>{tip.body}</p>
        </div>
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', gap: 5, marginTop: 16, flexWrap: 'wrap' }}>
        {TIPS.map((_, i) => (
          <button
            key={i}
            onClick={() => { if (timerRef.current) clearInterval(timerRef.current); goTo(i); }}
            style={{
              width: i === current ? 20 : 6, height: 6, borderRadius: 9999,
              background: i === current ? T.accent : 'rgba(255,255,255,0.15)',
              border: 'none', cursor: 'pointer', padding: 0,
              transition: 'width 0.3s, background 0.3s',
            }}
          />
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   MINI BAR CHART
───────────────────────────────────────── */
const MiniBarChart: React.FC<{ completed: number; total: number; label: string }> = ({ completed, total, label }) => {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const bars = [
    { label: 'Completed', value: completed, color: T.green  },
    { label: 'Remaining', value: total - completed, color: 'rgba(255,255,255,0.08)' },
  ];
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <BarChart2 size={14} style={{ color: T.accent }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</span>
      </div>

      {/* Big percent */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 16 }}>
        <span style={{ fontSize: 36, fontWeight: 900, color: T.white, lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 13, color: T.textMuted, marginBottom: 4 }}>completion</span>
      </div>

      {/* Stacked bar */}
      <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 9999, overflow: 'hidden', marginBottom: 14 }}>
        <div
          className="aw-bar-fill"
          style={{
            '--bar-w': `${pct}%`,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${T.green}, rgba(52,211,153,0.60))`,
            boxShadow: '0 0 10px rgba(52,211,153,0.35)',
          } as React.CSSProperties}
        />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16 }}>
        {bars.map(b => (
          <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textMuted }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: b.color }} />
            {b.label}: <strong style={{ color: T.textBody }}>{b.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   MINI PIE CHART (SVG)
───────────────────────────────────────── */
const MiniPieChart: React.FC<{ completed: number; inProgress: number; notStarted: number }> = ({ completed, inProgress, notStarted }) => {
  const total = completed + inProgress + notStarted || 1;
  const slices = [
    { value: completed,  color: T.green,  label: 'Completed'   },
    { value: inProgress, color: T.blue,   label: 'In Progress' },
    { value: notStarted, color: 'rgba(255,255,255,0.12)', label: 'Not Started' },
  ];

  let cumAngle = -90;
  const R = 44, cx = 60, cy = 60;

  const polarToXY = (angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const paths = slices.map(s => {
    const angle = (s.value / total) * 360;
    const start = polarToXY(cumAngle, R);
    const end   = polarToXY(cumAngle + angle, R);
    const large = angle > 180 ? 1 : 0;
    const path  = `M ${cx} ${cy} L ${start.x} ${start.y} A ${R} ${R} 0 ${large} 1 ${end.x} ${end.y} Z`;
    cumAngle += angle;
    return { ...s, path };
  }).filter(s => s.value > 0);

  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <TrendingUp size={14} style={{ color: T.accent }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '1px', textTransform: 'uppercase' }}>Courses Breakdown</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* SVG pie */}
        <svg width={120} height={120} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
          {paths.map((s, i) => (
            <path key={i} d={s.path} fill={s.color} style={{ opacity: 0.90 }} />
          ))}
          {/* Center hole */}
          <circle cx={cx} cy={cy} r={26} fill={T.bgCard} />
          {/* Center text */}
          <text x={cx} y={cy - 5}  textAnchor="middle" fill={T.white}    fontSize="13" fontWeight="800" fontFamily="Inter">{total}</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill={T.textMuted} fontSize="9"  fontFamily="Inter">total</text>
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          {slices.map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.textMuted }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                {s.label}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.textBody }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   STAT CARD
───────────────────────────────────────── */
const StatCard: React.FC<{ icon: React.ElementType; color: string; bg: string; label: string; value: number | string; delay?: string }> = ({ icon: Icon, color, bg, label, value, delay = '0s' }) => (
  <div className="aw-fade-up" style={{ animationDelay: delay, padding: '18px 20px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{ width: 44, height: 44, borderRadius: 11, background: bg, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={20} style={{ color }} />
    </div>
    <div>
      <div style={{ fontSize: 24, fontWeight: 900, color: T.white, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: T.textMuted }}>{label}</div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export const EmployeeDashboard = () => {
  const { user }    = useAuth();
  const { t, i18n } = useTranslation("employee");
  const [activePage, setActivePage]       = useState("dashboard");
  const [isLoading, setIsLoading]         = useState(true);
  const [assignedExams, setAssignedExams] = useState<EmployeeAvailableExam[]>([]);
  const [company, setCompany]             = useState<Company | null>(null);
  const [stats, setStats] = useState({ assignedCourses: 0, completedCourses: 0, inProgressCourses: 0, pendingExams: 0, certificates: 0 });
  const [userRank, setUserRank]           = useState(0);
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
      const { data: certificates } = await supabase.from("exam_attempts").select("id").eq("employee_id", user.id).eq("passed", true);
      const { data: userRankData } = await supabase.functions.invoke("get_user_rank", { method: "POST", body: { company_id: user.company_id, employee_id: user.id } });
      setUserRank(userRankData?.index || 0);
      setStats({
        assignedCourses:  courses?.length || 0,
        completedCourses: courses?.filter(c => c.status === "COMPLETED").length || 0,
        inProgressCourses: courses?.filter(c => c.status === "IN_PROGRESS").length || 0,
        pendingExams:     assignedExams.length,
        certificates:     certificates?.length || 0,
      });
      setIsLoading(false);
    } catch { setIsLoading(false); }
  };

  /* ── Dashboard home ── */
  const renderDashboard = () => {
    const notStarted = stats.assignedCourses - stats.completedCourses - stats.inProgressCourses;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter', sans-serif" }}>

        {/* ── Welcome header ── */}
        <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: T.white, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
              {t("dashboard.title")} 👋
            </h1>
            <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>{t("dashboard.subtitle")}</p>
          </div>

          {/* Rank badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: T.bgCard, border: `1px solid rgba(200,255,0,0.18)`, borderRadius: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(200,255,0,0.10)', border: '2px solid rgba(200,255,0,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: T.accent }}>{formatLocalizedNumber(userRank, currentLanguage)}</span>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{t("dashboard.rankLabel")}</div>
              <div style={{ fontSize: 12, color: T.textBody }}>{t("dashboard.rankHint")}</div>
            </div>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <StatCard icon={BookOpen}      color={T.accent}  bg="rgba(200,255,0,0.08)"  label={t("dashboard.stats.assignedCourses")}    value={formatLocalizedNumber(stats.assignedCourses,  currentLanguage)} delay="0.00s" />
          <StatCard icon={CheckCircle}   color={T.green}   bg={T.greenBg}             label={t("dashboard.stats.completedCourses")}   value={formatLocalizedNumber(stats.completedCourses, currentLanguage)} delay="0.05s" />
          <StatCard icon={ClipboardCheck} color={T.orange} bg={T.orangeBg}            label={t("dashboard.stats.pendingAssessments")} value={formatLocalizedNumber(stats.pendingExams,     currentLanguage)} delay="0.10s" />
          <StatCard icon={Award}          color={T.purple} bg={T.purpleBg}            label={t("dashboard.stats.certificatesEarned")} value={formatLocalizedNumber(stats.certificates,     currentLanguage)} delay="0.15s" />
        </div>

        {/* ── Charts + tips row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          <MiniBarChart completed={stats.completedCourses} total={stats.assignedCourses} label="Course Completion" />
          <MiniPieChart completed={stats.completedCourses} inProgress={stats.inProgressCourses} notStarted={notStarted} />
          <SecurityTipCarousel />
        </div>

        {/* ── Fraud alert widget ── */}
        <FraudAlertWidget onNavigate={setActivePage} />

        {/* ── Quick actions + Progress card ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>

          {/* Quick actions */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.white, marginBottom: 14 }}>
              {t("dashboard.quickActions.title")}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { page: 'my-courses',    color: T.accent,  icon: BookOpen,       titleKey: 'dashboard.quickActions.continueLearning.title',  subtitleKey: 'dashboard.quickActions.continueLearning.subtitle'  },
                { page: 'my-exams',      color: T.orange,  icon: ClipboardCheck, titleKey: 'dashboard.quickActions.takeAssessments.title',   subtitleKey: 'dashboard.quickActions.takeAssessments.subtitle'   },
                { page: 'certificates',  color: T.purple,  icon: Award,          titleKey: 'dashboard.quickActions.viewCertificates.title',  subtitleKey: 'dashboard.quickActions.viewCertificates.subtitle'  },
              ].map(({ page, color, icon: Icon, titleKey, subtitleKey }) => (
                <button
                  key={page}
                  className="aw-quick-btn"
                  onClick={() => setActivePage(page)}
                  style={{ textAlign: isRtl ? 'right' : 'left' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}14`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={15} style={{ color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.white }}>{t(titleKey)}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{t(subtitleKey)}</div>
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: T.textMuted, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>

          {/* Progress summary card */}
          <div style={{ background: T.bgCard, border: `1px solid rgba(200,255,0,0.14)`, borderRadius: 14, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden="true" style={{ position: 'absolute', top: -40, right: -40, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,255,0,0.07), transparent 70%)', pointerEvents: 'none' }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: T.white, marginBottom: 18, position: 'relative' }}>
              {t("dashboard.progressCard.title")}
            </p>
            <div style={{ position: 'relative' }}>
              {/* Course completion bar */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.textBody, marginBottom: 7 }}>
                  <span>{t("dashboard.progressCard.courseCompletion")}</span>
                  <span style={{ color: T.accent, fontWeight: 700 }}>
                    {stats.assignedCourses > 0 ? Math.round((stats.completedCourses / stats.assignedCourses) * 100) : 0}%
                  </span>
                </div>
                <div style={{ height: 7, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
                  <div
                    className="aw-bar-fill"
                    style={{
                      '--bar-w': `${stats.assignedCourses > 0 ? (stats.completedCourses / stats.assignedCourses) * 100 : 0}%`,
                      width: `${stats.assignedCourses > 0 ? (stats.completedCourses / stats.assignedCourses) * 100 : 0}%`,
                      background: `linear-gradient(90deg, ${T.accent}, rgba(200,255,0,0.55))`,
                      boxShadow: '0 0 10px rgba(200,255,0,0.30)',
                    } as React.CSSProperties}
                  />
                </div>
              </div>

              {/* Stats list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12, borderTop: 'rgba(255,255,255,0.05) 1px solid' }}>
                {[
                  { label: t("dashboard.progressCard.completedCourses"), value: stats.completedCourses, color: T.green  },
                  { label: t("dashboard.progressCard.certificates"),      value: stats.certificates,     color: T.purple },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: T.textBody }}>{label}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color }}>{formatLocalizedNumber(value, currentLanguage)}</span>
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
      case "my-courses":    return <MyCoursesPage navigateToCertificates={() => setActivePage("certificates")} />;
      case "my-exams":      return <MyExamsPage onExamCompleted={() => { loadAssignedExams(); loadStats(); }} />;
      case "fraud-alerts":  return <FraudAlertsPage />;
      case "certificates":  return <CertificatesPage />;
      case "account":       return <AccountSettings />;
      default:              return renderDashboard();
    }
  };

  return (
    <>
      {isLoading ? (
        <LoadingScreen />
      ) : company?.is_active ? (
        <DashboardLayout
          activePage={activePage}
          onNavigate={(page) => {
            if (assignedExams.length > 0 && page !== "my-exams") return;
            setActivePage(page);
          }}
        >
          {renderContent()}
        </DashboardLayout>
      ) : (
        <InactivatedSubscription />
      )}
    </>
  );
};
