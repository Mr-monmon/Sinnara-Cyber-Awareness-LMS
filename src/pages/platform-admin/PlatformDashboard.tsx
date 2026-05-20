import { useState, useEffect } from "react";
import {
  Building2, Users, BookOpen, FileText, BarChart3,
  CreditCard, History, Shield, ChevronRight,
  Mail, Globe, Bell, Award, Zap, AlertTriangle,
  TrendingUp, HelpCircle, Clock, CheckCircle, DollarSign, Server,
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
import { PhishingTemplatesPage }      from "./PhishingTemplatesPage";
import { PhishingCampaignResultsPage } from "./PhishingCampaignResultsPage";
import { PhishingDomainsPage }        from "./PhishingDomainsPage";
import { PhishingSmtpAdminPage }      from "./PhishingSmtpAdminPage";
import { PhishingScenariosPage }      from "./PhishingScenariosPage";
import { PhishingCompanyLimitsPage }  from "./PhishingCompanyLimitsPage";
import { DemoRequestsPage }           from "./DemoRequestsPage";
import { PartnersManagementPage }     from "./PartnersManagementPage";
import { FraudAlertsManagementPage }  from "./FraudAlertsManagementPage";
import { supabase }                   from "../../lib/supabase";
import SupportRequestsPage            from "./SupportRequestsPage";
import EmailPage                      from "./EmailPage";
import { EmailQueuePage }             from "./EmailQueuePage";
import { ErrorLogsPage }              from "./ErrorLogsPage";

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
  { page: 'phishing-domains',       icon: Globe,     color: T.blue,    label: 'Phishing Domains',       sub: 'Sending domain management'      },
  { page: 'phishing-smtp-admin',    icon: Server,    color: T.cyan,    label: 'Platform SMTP Profiles', sub: 'Push SMTP to companies'         },
  { page: 'phishing-scenarios',     icon: Zap,       color: T.orange,  label: 'Phishing Scenarios',     sub: 'Predefined attack templates'    },
  { page: 'phishing-company-limits',icon: Shield,    color: T.red,     label: 'Company Limits',         sub: 'Quotas & feature access'        },
  { page: 'fraud-alerts-management', icon: AlertTriangle, color: T.orange, label: 'Fraud Alerts',        sub: 'Manage public alerts'           },
  { page: 'demo-requests',           icon: Bell,      color: T.purple,  label: 'Demo Requests',          sub: 'Incoming demo inquiries'        },
  { page: 'public-submissions',      icon: Globe,     color: T.blue,    label: 'Public Submissions',     sub: 'Assessment submissions'         },
  { page: 'certificates',            icon: Award,     color: T.cyan,    label: 'Certificate Templates',  sub: 'Manage certificate designs'     },
  { page: 'audit-logs',              icon: History,   color: T.red,     label: 'Audit Logs',             sub: 'Track all activities'           },
  { page: 'email',                   icon: Mail,      color: T.green,   label: 'Email',                  sub: 'Send and manage emails'         },
  { page: 'email-queue',             icon: Clock,     color: T.purple,  label: 'Email Queue',            sub: 'Monitor outbound email delivery' },
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
interface DashStats {
  companies: number;
  activeCompanies: number;
  totalEmployees: number;
  courses: number;
  activeSubscriptions: number;
  expiringIn30: number;
  totalRevenue: number;
  pendingAmount: number;
  openSupport: number;
  pendingDemo: number;
}

interface TopCompany { name: string; employees: number; }
interface MonthRevenue { month: string; amount: number; }

const EMPTY_STATS: DashStats = {
  companies: 0, activeCompanies: 0, totalEmployees: 0, courses: 0,
  activeSubscriptions: 0, expiringIn30: 0,
  totalRevenue: 0, pendingAmount: 0,
  openSupport: 0, pendingDemo: 0,
};

export const PlatformDashboard = () => {
  const [activePage, setActivePage] = useState("dashboard");
  const [stats, setStats] = useState<DashStats>(EMPTY_STATS);
  const [topCompanies, setTopCompanies] = useState<TopCompany[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const [
        coRes, empRes, crRes,
        activeSubs, expiringSubs,
        invoicesRes,
        supportRes,
        demoRes,
        companiesWithEmp,
      ] = await Promise.all([
        supabase.from("companies").select("id, name, is_active", { count: "exact" }),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "EMPLOYEE"),
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "ACTIVE").lte("end_date", in30),
        supabase.from("invoices").select("total, status"),
        supabase.from("support_ticket").select("status"),
        supabase.from("demo_requests").select("status"),
        supabase.from("users").select("company_id").eq("role", "EMPLOYEE"),
      ]);

      // Revenue
      const invoices = invoicesRes.data ?? [];
      const totalRevenue = invoices.filter(i => i.status === "PAID").reduce((s, i) => s + Number(i.total), 0);
      const pendingAmount = invoices.filter(i => i.status === "PENDING" || i.status === "OVERDUE").reduce((s, i) => s + Number(i.total), 0);

      // Support tickets
      const tickets = supportRes.data ?? [];
      const openSupport = tickets.filter(t => t.status === "open" || t.status === "pending").length;

      // Demo
      const demos = demoRes.data ?? [];
      const pendingDemo = demos.filter(d => d.status === "pending").length;

      // Top companies by employee count
      const companies = coRes.data ?? [];
      const empByCompany = new Map<string, number>();
      (companiesWithEmp.data ?? []).forEach((u: { company_id: string }) => {
        if (u.company_id) empByCompany.set(u.company_id, (empByCompany.get(u.company_id) ?? 0) + 1);
      });
      const top = companies
        .map(c => ({ name: c.name, employees: empByCompany.get(c.id) ?? 0 }))
        .sort((a, b) => b.employees - a.employees)
        .slice(0, 6);
      setTopCompanies(top);

      // Monthly revenue (last 6 months from paid invoices)
      const { data: paidInvoices } = await supabase
        .from("invoices").select("total, payment_date").eq("status", "PAID");
      const monthMap = new Map<string, number>();
      const months: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleString("en", { month: "short", year: "2-digit" });
        months.push(label);
        monthMap.set(key, 0);
      }
      (paidInvoices ?? []).forEach(inv => {
        if (!inv.payment_date) return;
        const d = new Date(inv.payment_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key)! + Number(inv.total)));
      });
      const rev: MonthRevenue[] = Array.from(monthMap.entries()).map(([, amount], i) => ({ month: months[i], amount }));
      setMonthlyRevenue(rev);

      setStats({
        companies: coRes.count ?? 0,
        activeCompanies: companies.filter(c => c.is_active).length,
        totalEmployees: empRes.count ?? 0,
        courses: crRes.count ?? 0,
        activeSubscriptions: activeSubs.count ?? 0,
        expiringIn30: expiringSubs.count ?? 0,
        totalRevenue,
        pendingAmount,
        openSupport,
        pendingDemo,

      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
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
      case "error-logs":               return <ErrorLogsPage />;
      case "certificates":             return <CertificateTemplatesPage />;
      case "phishing-templates":       return <PhishingTemplatesPage />;
      case "phishing-results":         return <PhishingCampaignResultsPage />;
      case "phishing-domains":         return <PhishingDomainsPage />;
      case "phishing-smtp-admin":      return <PhishingSmtpAdminPage />;
      case "phishing-scenarios":       return <PhishingScenariosPage />;
      case "phishing-company-limits":  return <PhishingCompanyLimitsPage />;
      case "fraud-alerts-management":  return <FraudAlertsManagementPage />;
      case "partners-management":      return <PartnersManagementPage />;
      case "support-requests":         return <SupportRequestsPage />;
      case "email":                    return <EmailPage />;
      case "email-queue":              return <EmailQueuePage />;
      default:                         return renderDashboard();
    }
  };

  const fmt = (n: number) => n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toLocaleString();

  const fmtSAR = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M SAR`
    : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K SAR`
    : `${n.toFixed(0)} SAR`;

  const renderDashboard = () => {
    const maxRevenue = Math.max(...monthlyRevenue.map(m => m.amount), 1);
    const maxEmp     = Math.max(...topCompanies.map(c => c.employees), 1);

    return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero banner ── */}
      <div className="aw-fade-up" style={{ background: T.bgCard, border: `1px solid rgba(200,255,0,0.16)`, borderRadius: 16, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,255,0,0.07), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, boxShadow: '0 0 8px rgba(200,255,0,0.60)', animation: 'aw-pulse 2s ease infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '1.2px', textTransform: 'uppercase' }}>Platform Admin</span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, margin: '0 0 4px', letterSpacing: '-0.3px' }}>AwareOne Platform</h1>
            <p style={{ fontSize: 13, color: T.textBody, margin: 0 }}>Live overview of all companies, subscriptions, and operations.</p>
          </div>
          {loading && <div style={{ fontSize: 12, color: T.textMuted }}>Loading…</div>}
        </div>
      </div>

      {/* ── KPI Row 1: Platform size ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {[
          { icon: Building2,   color: T.accent,  bg: 'rgba(200,255,0,0.08)',  label: 'Total Companies',     value: fmt(stats.companies),       sub: `${stats.activeCompanies} active` },
          { icon: Users,       color: T.green,   bg: T.greenBg,              label: 'Total Employees',     value: fmt(stats.totalEmployees),  sub: 'across all companies' },
          { icon: BookOpen,    color: T.cyan,    bg: T.cyanBg,               label: 'Training Courses',    value: fmt(stats.courses),         sub: 'published content' },
          { icon: CheckCircle, color: T.green,   bg: T.greenBg,              label: 'Active Subscriptions',value: fmt(stats.activeSubscriptions), sub: 'currently running' },
          { icon: Clock,       color: T.orange,  bg: T.orangeBg,             label: 'Expiring in 30 Days', value: fmt(stats.expiringIn30),    sub: 'need renewal', alert: stats.expiringIn30 > 0 },
          { icon: DollarSign,  color: T.green,   bg: T.greenBg,              label: 'Total Revenue',       value: fmtSAR(stats.totalRevenue), sub: 'paid invoices' },
          { icon: CreditCard,  color: stats.pendingAmount > 0 ? T.orange : T.textMuted, bg: stats.pendingAmount > 0 ? T.orangeBg : 'rgba(255,255,255,0.03)', label: 'Pending Amount', value: fmtSAR(stats.pendingAmount), sub: 'awaiting payment', alert: stats.pendingAmount > 0 },
        ].map(({ icon: Icon, color, bg, label, value, sub, alert }) => (
          <div key={label} className="aw-pd-stat aw-fade-up" style={{ position: 'relative', overflow: 'hidden', background: T.bgCard, border: `1px solid ${alert ? color + '40' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, padding: 16 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},${color}40)` }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={15} style={{ color }} />
              </div>
              {alert && <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, animation: 'aw-pulse 2s ease infinite' }} />}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: T.white, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textBody, marginTop: 4 }}>{label}</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Attention Required ── */}
      {(stats.openSupport > 0 || stats.pendingDemo > 0 || stats.expiringIn30 > 0) && (
        <div className="aw-fade-up" style={{ background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.20)', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={14} style={{ color: T.orange }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.orange }}>Needs Attention</span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {stats.openSupport > 0 && (
              <button onClick={() => setActivePage('support-requests')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', cursor: 'pointer', fontFamily: 'inherit' }}>
                <HelpCircle size={13} style={{ color: T.red }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T.red }}>{stats.openSupport} Open Support {stats.openSupport === 1 ? 'Ticket' : 'Tickets'}</span>
                <ChevronRight size={11} style={{ color: T.red }} />
              </button>
            )}
            {stats.pendingDemo > 0 && (
              <button onClick={() => setActivePage('demo-requests')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Bell size={13} style={{ color: T.purple }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T.purple }}>{stats.pendingDemo} Demo {stats.pendingDemo === 1 ? 'Request' : 'Requests'} Pending</span>
                <ChevronRight size={11} style={{ color: T.purple }} />
              </button>
            )}
            {stats.expiringIn30 > 0 && (
              <button onClick={() => setActivePage('subscriptions')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Clock size={13} style={{ color: T.orange }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T.orange }}>{stats.expiringIn30} Subscription{stats.expiringIn30 > 1 ? 's' : ''} Expiring Soon</span>
                <ChevronRight size={11} style={{ color: T.orange }} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Monthly Revenue Chart */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '13px 18px', borderBottom: `1px solid rgba(255,255,255,0.05)`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={14} style={{ color: T.green }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Monthly Revenue (SAR)</span>
          </div>
          <div style={{ padding: '16px 18px' }}>
            {monthlyRevenue.every(m => m.amount === 0) ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: T.textMuted, fontSize: 13 }}>No paid invoices yet</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
                {monthlyRevenue.map(m => {
                  const pct = (m.amount / maxRevenue) * 100;
                  return (
                    <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 600 }}>
                        {m.amount > 0 ? fmtSAR(m.amount).replace(' SAR','') : ''}
                      </div>
                      <div style={{ width: '100%', height: `${Math.max(4, pct)}%`, background: `linear-gradient(180deg, ${T.green}, ${T.green}80)`, borderRadius: '3px 3px 0 0', minHeight: 4 }} />
                      <div style={{ fontSize: 10, color: T.textMuted }}>{m.month}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Top Companies by Employees */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '13px 18px', borderBottom: `1px solid rgba(255,255,255,0.05)`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={14} style={{ color: T.accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Top Companies by Employees</span>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topCompanies.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: T.textMuted, fontSize: 13 }}>No companies yet</div>
            ) : topCompanies.map(c => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 100, fontSize: 11, color: T.textBody, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{c.name}</div>
                <div style={{ flex: 1, height: 18, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${(c.employees / maxEmp) * 100}%`, height: '100%', background: T.accent, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: c.employees > 0 ? 4 : 0 }}>
                    {(c.employees / maxEmp) > 0.2 && <span style={{ fontSize: 9, fontWeight: 800, color: '#12140a', paddingRight: 5 }}>{c.employees}</span>}
                  </div>
                </div>
                {(c.employees / maxEmp) <= 0.2 && <span style={{ fontSize: 11, color: T.textMuted, minWidth: 20 }}>{c.employees}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick Actions + Shortcuts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, alignItems: 'flex-start' }}>
        <div className="aw-fade-up" style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid rgba(255,255,255,0.05)`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={14} style={{ color: T.accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Quick Actions</span>
          </div>
          <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
            {ACTIONS.map(({ page, icon: Icon, color, label, sub }) => (
              <button key={page} className="aw-pd-action" onClick={() => setActivePage(page)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}12`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.white }}>{label}</div>
                    <div style={{ fontSize: 10, color: T.textMuted }}>{sub}</div>
                  </div>
                </div>
                <ChevronRight size={12} style={{ color: T.textMuted, flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>

        {/* Platform Status sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: `linear-gradient(135deg, #0e100a, #1a2210 60%, #0e1614)`, border: `1px solid rgba(200,255,0,0.18)`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Shield size={13} style={{ color: T.accent }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Platform Status</span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', background: T.greenBg, border: `1px solid ${T.greenBorder}`, borderRadius: 9999, fontSize: 10, fontWeight: 700, color: T.green }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.green, animation: 'aw-pulse 2s ease infinite' }} />
                LIVE
              </span>
            </div>
            {[
              { label: 'Companies',       value: stats.companies,          color: T.accent  },
              { label: 'Employees',        value: stats.totalEmployees,    color: T.green   },
              { label: 'Active Subs',      value: stats.activeSubscriptions, color: T.cyan  },
              { label: 'Expiring Soon',    value: stats.expiringIn30,      color: stats.expiringIn30 > 0 ? T.orange : T.textMuted },
              { label: 'Open Support',     value: stats.openSupport,       color: stats.openSupport > 0 ? T.red : T.textMuted },
              { label: 'Demo Requests',    value: stats.pendingDemo,       color: stats.pendingDemo > 0 ? T.purple : T.textMuted },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: T.textBody }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color }}>{value.toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '11px 14px', borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Shortcuts</span>
            </div>
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { page: 'audit-logs',         icon: History,       label: 'View Audit Logs',       color: T.red    },
                { page: 'email',              icon: Mail,          label: 'Send Email',             color: T.green  },
                { page: 'demo-requests',      icon: Bell,          label: 'Demo Requests',          color: T.purple },
                { page: 'support-requests',   icon: HelpCircle,    label: 'Support Tickets',        color: T.orange },
              ].map(({ page, icon: Icon, label, color }) => (
                <button key={page} onClick={() => setActivePage(page)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.05)`, borderRadius: 7, cursor: 'pointer', transition: 'background 0.18s', fontFamily: 'inherit' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                >
                  <Icon size={12} style={{ color }} />
                  <span style={{ fontSize: 12, color: T.textBody }}>{label}</span>
                  <ChevronRight size={10} style={{ color: T.textMuted, marginLeft: 'auto' }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
    );
  };

  return (
    <DashboardLayout activePage={activePage} onNavigate={setActivePage}>
      {renderContent()}
    </DashboardLayout>
  );
};
