import { useState, useEffect } from "react";
import {
  Building2, Users, BookOpen, FileText, BarChart3,
  CreditCard, History, Shield, ChevronRight,
  Mail, Globe, Bell, Award, Zap, AlertTriangle,
} from "lucide-react";
import { DashboardLayout } from "../../components/layouts/DashboardLayout";
import { CompaniesPage }              from "./CompaniesPage";
import { CoursesPage }                from "./CoursesPage";
import { ExamsPage }                  from "./ExamsPage";
import { PublicSubmissionsPage }      from "./PublicSubmissionsPage";
import { UsersManagementPage }        from "./UsersManagementPage";
import { SubscriptionsPage }          from "./SubscriptionsPage";
import { AnalyticsPage }              from "./AnalyticsPage";
import { AuditLogsPage }              from "./AuditLogsPage";
import { CertificateTemplatesPage }   from "./CertificateTemplatesPage";
import { PhishingManagementPage }     from "./PhishingManagementPage";
import { PhishingTemplatesPage }      from "./PhishingTemplatesPage";
import { PhishingCampaignResultsPage } from "./PhishingCampaignResultsPage";
import { DemoRequestsPage }           from "./DemoRequestsPage";
import { PartnersManagementPage }     from "./PartnersManagementPage";
import { FraudAlertsManagementPage }  from "./FraudAlertsManagementPage";
import { supabase }                   from "../../lib/supabase";
import SupportRequestsPage            from "./SupportRequestsPage";
import EmailPage                      from "./EmailPage";

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
  cyan:        '#22d3ee',
  cyanBg:      'rgba(34,211,238,0.08)',
  cyanBorder:  'rgba(34,211,238,0.22)',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-pd-stat {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; padding: 20px;
    position: relative; overflow: hidden;
    transition: border-color 0.2s, transform 0.18s;
    font-family: 'Inter', sans-serif;
  }
  .aw-pd-stat:hover { border-color: rgba(255,255,255,0.14); transform: translateY(-1px); }

  .aw-pd-action {
    display: flex; align-items: center; justify-content: space-between;
    padding: 13px 16px; border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02); cursor: pointer;
    text-align: left; font-family: 'Inter', sans-serif;
    transition: all 0.18s;
  }
  .aw-pd-action:hover {
    background: rgba(255,255,255,0.05);
    border-color: rgba(200,255,0,0.18);
    transform: translateX(3px);
  }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-pulse   { 0%,100% { opacity:1; } 50% { opacity:0.50; } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-pd-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-pd-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   QUICK ACTIONS CONFIG
───────────────────────────────────────── */
const ACTIONS = [
  { page: 'companies',               icon: Building2, color: T.accent,  label: 'Manage Companies',       sub: 'Add or edit companies'          },
  { page: 'users',                   icon: Users,     color: T.green,   label: 'Manage Users',           sub: 'Users and permissions'          },
  { page: 'subscriptions',           icon: CreditCard, color: T.purple, label: 'Subscriptions & Invoices', sub: 'Payments and billing'         },
  { page: 'analytics',               icon: BarChart3, color: T.blue,    label: 'Analytics & Reports',    sub: 'Platform statistics'            },
  { page: 'courses',                 icon: BookOpen,  color: T.cyan,    label: 'Manage Courses',         sub: 'Training content'               },
  { page: 'exams',                   icon: FileText,  color: T.orange,  label: 'Manage Exams',           sub: 'Assessments & quizzes'          },
  { page: 'phishing-management',     icon: Shield,    color: T.red,     label: 'Phishing Management',    sub: 'Campaign oversight'             },
  { page: 'fraud-alerts-management', icon: AlertTriangle, color: T.orange, label: 'Fraud Alerts',        sub: 'Manage public alerts'           },
  { page: 'demo-requests',           icon: Bell,      color: T.purple,  label: 'Demo Requests',          sub: 'Incoming demo inquiries'        },
  { page: 'public-submissions',      icon: Globe,     color: T.blue,    label: 'Public Submissions',     sub: 'Assessment submissions'         },
  { page: 'certificates',            icon: Award,     color: T.cyan,    label: 'Certificate Templates',  sub: 'Manage certificate designs'     },
  { page: 'audit-logs',              icon: History,   color: T.red,     label: 'Audit Logs',             sub: 'Track all activities'           },
  { page: 'email',                   icon: Mail,      color: T.green,   label: 'Email',                  sub: 'Send and manage emails'         },
  { page: 'support-requests',        icon: Zap,       color: T.gold,    label: 'Support Requests',       sub: 'Customer support tickets'       },
] as const;

/* ─────────────────────────────────────────
   STAT CARD
───────────────────────────────────────── */
const StatCard: React.FC<{ icon: React.ElementType; color: string; bg: string; label: string; value: number; delay?: string }> = ({
  icon: Icon, color, bg, label, value, delay = '0s',
}) => (
  <div className={`aw-pd-stat aw-fade-up`} style={{ animationDelay: delay }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, ${color}40)` }} />
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} style={{ color }} />
      </div>
      <span style={{ fontSize: 28, fontWeight: 900, color: T.white }}>{value.toLocaleString()}</span>
    </div>
    <div style={{ fontSize: 13, fontWeight: 600, color: T.textBody }}>{label}</div>
  </div>
);

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const PlatformDashboard = () => {
  const [activePage, setActivePage] = useState("dashboard");
  const [stats, setStats] = useState({ companies: 0, totalEmployees: 0, courses: 0, publicSubmissions: 0 });

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const [coRes, usRes, crRes, subRes] = await Promise.all([
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "EMPLOYEE"),
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("public_assessments").select("id", { count: "exact", head: true }),
      ]);
      setStats({ companies: coRes.count || 0, totalEmployees: usRes.count || 0, courses: crRes.count || 0, publicSubmissions: subRes.count || 0 });
    } catch (err) { console.error(err); }
  };

  const renderContent = () => {
    switch (activePage) {
      case "companies":                return <CompaniesPage />;
      case "courses":                  return <CoursesPage />;
      case "exams":                    return <ExamsPage />;
      case "public-submissions":       return <PublicSubmissionsPage />;
      case "demo-requests":            return <DemoRequestsPage />;
      case "homepage-content":         return <PartnersManagementPage />;
      case "users":                    return <UsersManagementPage />;
      case "subscriptions":            return <SubscriptionsPage />;
      case "analytics":                return <AnalyticsPage />;
      case "audit-logs":               return <AuditLogsPage />;
      case "certificates":             return <CertificateTemplatesPage />;
      case "phishing-management":      return <PhishingManagementPage />;
      case "phishing-templates":       return <PhishingTemplatesPage />;
      case "phishing-results":         return <PhishingCampaignResultsPage />;
      case "fraud-alerts-management":  return <FraudAlertsManagementPage />;
      case "partners-management":      return <PartnersManagementPage />;
      case "support-requests":         return <SupportRequestsPage />;
      case "email":                    return <EmailPage />;
      default:                         return renderDashboard();
    }
  };

  const renderDashboard = () => (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Hero banner ── */}
      <div className="aw-fade-up" style={{ background: T.bgCard, border: `1px solid rgba(200,255,0,0.16)`, borderRadius: 16, padding: '24px 28px', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ position: 'absolute', top: -50, right: -50, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,255,0,0.07), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, boxShadow: '0 0 8px rgba(200,255,0,0.60)', animation: 'aw-pulse 2s ease infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '1.2px', textTransform: 'uppercase' }}>Platform Admin</span>
          </div>
          <h1 style={{ fontSize: 'clamp(20px, 2.5vw, 26px)', fontWeight: 900, color: T.white, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
            AwareOne Platform Dashboard
          </h1>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
            Complete control over all companies, users, content, and platform operations.
          </p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
        <StatCard icon={Building2} color={T.accent}  bg="rgba(200,255,0,0.08)"  label="Total Companies"   value={stats.companies}         delay="0.00s" />
        <StatCard icon={Users}     color={T.green}   bg={T.greenBg}             label="Total Employees"   value={stats.totalEmployees}    delay="0.04s" />
        <StatCard icon={BookOpen}  color={T.purple}  bg={T.purpleBg}            label="Training Courses"  value={stats.courses}           delay="0.08s" />
        <StatCard icon={FileText}  color={T.orange}  bg={T.orangeBg}            label="Public Tests"      value={stats.publicSubmissions} delay="0.12s" />
      </div>

      {/* ── Actions grid + Status card ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'flex-start' }}>

        {/* Quick Actions */}
        <div className="aw-fade-up" style={{ animationDelay: '0.16s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={14} style={{ color: T.accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Quick Actions</span>
          </div>
          <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {ACTIONS.map(({ page, icon: Icon, color, label, sub }) => (
              <button key={page} className="aw-pd-action" onClick={() => setActivePage(page)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}12`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{label}</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>{sub}</div>
                  </div>
                </div>
                <ChevronRight size={13} style={{ color: T.textMuted, flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>

        {/* Platform Status */}
        <div className="aw-fade-up" style={{ animationDelay: '0.20s', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* System health */}
          <div style={{ background: `linear-gradient(135deg, #0e100a 0%, #1a2210 60%, #0e1614 100%)`, border: `1px solid rgba(200,255,0,0.18)`, borderRadius: 14, padding: '20px', position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden="true" style={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,255,0,0.07), transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, position: 'relative' }}>
              <Shield size={14} style={{ color: T.accent }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Platform Status</span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', background: T.greenBg, border: `1px solid ${T.greenBorder}`, borderRadius: 9999, fontSize: 10, fontWeight: 700, color: T.green, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.green, animation: 'aw-pulse 2s ease infinite' }} />
                Healthy
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
              {[
                { label: 'Active Companies', value: stats.companies,      color: T.accent  },
                { label: 'Total Employees',  value: stats.totalEmployees, color: T.green   },
                { label: 'Live Courses',     value: stats.courses,        color: T.purple  },
                { label: 'Public Tests',     value: stats.publicSubmissions, color: T.blue },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: T.textBody }}>{label}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color }}>{value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Platform overview card */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={13} style={{ color: T.accent }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.white }}>At a Glance</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Avg employees/company', value: stats.companies ? Math.round(stats.totalEmployees / stats.companies) : 0, color: T.cyan    },
                { label: 'Courses per company',   value: stats.companies ? Math.round(stats.courses / stats.companies) : 0,       color: T.purple  },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.textBody, marginBottom: 6 }}>
                    <span>{label}</span>
                    <span style={{ fontWeight: 700, color }}>{value}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, value * 5)}%`, background: color, borderRadius: 9999 }} />
                  </div>
                </div>
              ))}

              {/* Shortcut links */}
              <div style={{ paddingTop: 8, borderTop: `1px solid ${T.borderFaint}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { page: 'audit-logs',    icon: History, label: 'View Audit Logs',      color: T.red    },
                  { page: 'email',         icon: Mail,    label: 'Send Email',            color: T.green  },
                  { page: 'demo-requests', icon: Bell,    label: 'Demo Requests',         color: T.purple },
                ].map(({ page, icon: Icon, label, color }) => (
                  <button key={page} onClick={() => setActivePage(page)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 8, cursor: 'pointer', transition: 'background 0.18s', fontFamily: 'inherit' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  >
                    <Icon size={12} style={{ color }} />
                    <span style={{ fontSize: 12, color: T.textBody }}>{label}</span>
                    <ChevronRight size={11} style={{ color: T.textMuted, marginLeft: 'auto' }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout activePage={activePage} onNavigate={setActivePage}>
      {renderContent()}
    </DashboardLayout>
  );
};
