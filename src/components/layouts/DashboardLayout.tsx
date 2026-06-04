import React, { useState, useEffect } from "react";
import {
  LogOut,
  Menu,
  X,
  Building2,
  Users,
  BookOpen,
  ClipboardCheck,
  BarChart3,
  FileText,
  CreditCard,
  History,
  Award,
  FolderTree,
  Send,
  ChevronDown,
  ChevronRight,
  Shield,
  Mail,
  AlertCircle,
  AlertTriangle,
  Settings,
  HelpCircle,
  Globe,
  Activity,
  TrendingUp,
  FileCheck,
  Target,
  Server,
  Bell,
  Zap,
  Variable,
  UserCog,
  Eye,
  Sun,
  Moon,
  LayoutTemplate,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { NotificationBell } from "../NotificationBell";
import i18n from "../../i18n";
import { useTheme } from "../../contexts/ThemeContext";

/* tokens are injected per-render via useTheme() inside the component */

/* ─────────────────────────────────────────
   GLOBAL CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* sidebar scrollbar */
  .aw-sidebar-nav::-webkit-scrollbar        { width: 3px; }
  .aw-sidebar-nav::-webkit-scrollbar-track  { background: transparent; }
  .aw-sidebar-nav::-webkit-scrollbar-thumb  { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  /* menu item hover */
  .aw-menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 13.5px;
    font-weight: 500;
    color: #94a3b8;
    background: none;
    border: none;
    cursor: pointer;
    transition: background 0.18s, color 0.18s;
    text-align: left;
    font-family: 'Inter', sans-serif;
    white-space: nowrap;
  }
  .aw-menu-item:hover {
    background: rgba(255,255,255,0.05);
    color: #ffffff;
  }
  .aw-menu-item.active {
    background: rgba(200,255,0,0.10);
    color: #c8ff00;
    font-weight: 600;
  }
  .aw-menu-item.parent-active {
    background: rgba(255,255,255,0.05);
    color: #ffffff;
  }

  /* child items */
  .aw-child-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #64748b;
    background: none;
    border: none;
    cursor: pointer;
    transition: background 0.18s, color 0.18s;
    text-align: left;
    font-family: 'Inter', sans-serif;
    white-space: nowrap;
  }
  .aw-child-item:hover {
    background: rgba(255,255,255,0.04);
    color: #cbd5e1;
  }
  .aw-child-item.active {
    background: rgba(200,255,0,0.08);
    color: #c8ff00;
    font-weight: 600;
  }

  /* section label */
  .aw-section-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #475569;
    padding: 16px 12px 6px;
    font-family: 'Inter', sans-serif;
  }
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById("aw-layout-styles")
) {
  const tag = document.createElement("style");
  tag.id = "aw-layout-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface DashboardLayoutProps {
  children: React.ReactNode;
  activePage: string;
  onNavigate: (page: string, itemId?: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  section?: string;
  children?: MenuItem[];
}

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activePage,
  onNavigate,
}) => {
  const { user, logout } = useAuth();
  const { t } = useTranslation("common");
  const { isDark, tokens: T, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [phishingMode, setPhishingMode] = useState<"TICKET" | "CUSTOM">("CUSTOM");

  /* Load the company's phishing delivery mode (controls which phishing pages show) */
  useEffect(() => {
    const isCompanyRole =
      user?.role === "COMPANY_ADMIN" ||
      user?.role === "COMPANY_SUPER_ADMIN" ||
      user?.role === "PHISHING_OPERATOR";
    if (!isCompanyRole || !user?.company_id) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("company_phishing_limits")
        .select("phishing_mode")
        .eq("company_id", user.company_id)
        .maybeSingle();
      if (active && data?.phishing_mode) setPhishingMode(data.phishing_mode);
    })();
    return () => { active = false; };
  }, [user?.company_id, user?.role]);
  const [language, setLanguage] = useState(
    i18n.resolvedLanguage || i18n.language || "en"
  );

  /* Auto-expand parent menu for current page */
  useEffect(() => {
    const parentMap: Record<string, string> = {
      companies: "company-management",
      users: "company-management",
      subscriptions: "company-management",
      courses: "content-management",
      exams: "content-management",
      certificates: "content-management",
      // Platform admin phishing pages
      "phishing-requests":       "phishing-campaigns",
      "phishing-results":        "phishing-campaigns",
      "phishing-domains":        "phishing-campaigns",
      "phishing-smtp-admin":     "phishing-campaigns",
      "phishing-landing-admin":  "phishing-campaigns",
      "phishing-scenarios":      "phishing-campaigns",
      "phishing-company-limits": "phishing-campaigns",
      // Company admin phishing pages
      "phishing-dashboard":        "phishing-campaigns",
      "phishing-request":          "phishing-campaigns",
      "phishing-campaigns":        "phishing-campaigns",
      "phishing-smtp":             "phishing-campaigns",
      "phishing-groups":           "phishing-campaigns",
      "phishing-landing":          "phishing-campaigns",
      "phishing-email-templates":  "phishing-campaigns",
      "phishing-variables":        "phishing-campaigns",
      "phishing-alerts":           "phishing-campaigns",
      "analytics": "reports",
      "advanced-analytics": "reports",
      "risk-scores": "reports",
    };
    const parent = parentMap[activePage];
    if (parent)
      setExpandedMenus((prev) =>
        prev.includes(parent) ? prev : [...prev, parent]
      );
  }, [activePage]);

  useEffect(() => {
    const handleLanguageChange = (nextLanguage: string) => {
      setLanguage(nextLanguage);
    };

    i18n.on("languageChanged", handleLanguageChange);
    return () => {
      i18n.off("languageChanged", handleLanguageChange);
    };
  }, []);

  const toggleMenu = (id: string) =>
    setExpandedMenus((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  /* ── Menu definitions ── */
  const getMenuItems = (): MenuItem[] => {
    if (user?.role === "PLATFORM_ADMIN")
      return [
        {
          id: "dashboard",
          label: "Dashboard",
          icon: BarChart3,
          section: "Overview",
        },
        {
          id: "company-management",
          label: "Company Management",
          icon: Building2,
          section: "Management",
          children: [
            { id: "companies", label: "Companies", icon: Building2 },
            { id: "users", label: "Users", icon: Users },
            {
              id: "subscriptions",
              label: "Subscriptions & Bills",
              icon: CreditCard,
            },
          ],
        },
        {
          id: "content-management",
          label: "Training Content",
          icon: BookOpen,
          children: [
            { id: "courses", label: "Courses", icon: BookOpen },
            { id: "exams", label: "Tests", icon: ClipboardCheck },
            {
              id: "certificates",
              label: "Certificate Templates",
              icon: Award,
            },
          ],
        },
        {
          id: "phishing-campaigns",
          label: "Phishing Campaigns",
          icon: Shield,
          section: "Phishing",
          children: [
            { id: "phishing-requests",       label: "Campaign Requests",      icon: Target  },
            { id: "phishing-results",        label: "Campaign Results",       icon: Activity },
            { id: "phishing-domains",        label: "Phishing Domains",       icon: Globe   },
            { id: "phishing-smtp-admin",     label: "Platform SMTP Profiles", icon: Server  },
            { id: "phishing-landing-admin",  label: "Landing Pages",          icon: LayoutTemplate },
            { id: "phishing-scenarios",      label: "Phishing Scenarios",     icon: Zap     },
            { id: "phishing-company-limits", label: "Company Limits",         icon: Shield  },
          ],
        },
        {
          id: "analytics",
          label: "Analysis & Reports",
          icon: BarChart3,
          section: "Data",
        },
        {
          id: "fraud-alerts-management",
          label: "Fraud Alerts",
          icon: AlertCircle,
        },
        {
          id: "partners-management",
          label: "Partners",
          icon: Building2,
        },
        {
          id: "audit-logs",
          label: "Activity Log",
          icon: History,
          section: "System",
        },
        {
          id: "error-logs",
          label: "Error Logs",
          icon: AlertTriangle,
        },
        { id: "demo-requests", label: "Demo Requests", icon: Users },
        {
          id: "public-submissions",
          label: "Public Submissions",
          icon: FileText,
        },
        {
          id: "support-requests",
          label: "Support Requests",
          icon: HelpCircle,
        },
        {
          id: "email",
          label: "Email",
          icon: Mail,
        }
      ];

    if (user?.role === "COMPANY_SUPER_ADMIN" || user?.role === "COMPANY_ADMIN")
      return [
        {
          id: "dashboard",
          label: "Dashboard",
          icon: BarChart3,
          section: "Overview",
        },
        {
          id: "platform-users",
          label: "Platform Users",
          icon: UserCog,
          section: "Administration",
        },
        {
          id: "employees",
          label: "Employees",
          icon: Users,
          section: "People",
        },
        { id: "departments", label: "Departments", icon: FolderTree },
        {
          id: "course-assignment",
          label: "Course Assignment",
          icon: BookOpen,
          section: "Training",
        },
        {
          id: "exam-assignment",
          label: "Test Assignments",
          icon: Send,
        },
        {
          id: "phishing-campaigns",
          label: "Phishing Simulation",
          icon: Shield,
          section: "Phishing",
          children: phishingMode === "TICKET"
            ? [
                { id: "phishing-dashboard",       label: "Dashboard",         icon: BarChart3  },
                { id: "phishing-request",         label: "Request Campaign",  icon: Target     },
              ]
            : [
                { id: "phishing-dashboard",       label: "Dashboard",         icon: BarChart3  },
                { id: "phishing-campaigns",       label: "Campaigns",         icon: Target     },
                { id: "phishing-smtp",            label: "SMTP Profiles",     icon: Server     },
                { id: "phishing-groups",          label: "Target Groups",     icon: Users      },
                { id: "phishing-landing",         label: "Landing Pages",     icon: Globe      },
                { id: "phishing-email-templates", label: "Email Templates",   icon: Mail       },
                { id: "phishing-variables",       label: "Custom Variables",  icon: Variable   },
                { id: "phishing-alerts",          label: "Alerts",            icon: Bell       },
              ],
        },
        {
          id: "reports",
          label: "Reports",
          icon: BarChart3,
          section: "Reports",
          children: [
            {
              id: "analytics",
              label: "Analytics",
              icon: BarChart3,
            },
            {
              id: "advanced-analytics",
              label: "Advanced Reports",
              icon: TrendingUp,
            },
            {
              id: "risk-scores",
              label: "Risk Scores",
              icon: Activity,
            },
          ],
        },
        {
          id: "compliance",
          label: "Compliance Report",
          icon: FileCheck,
          section: "System",
        },
        {
          id: "support-requests",
          label: "Support Requests",
          icon: HelpCircle,
          section: "Support",
        },
        {
          id: "account",
          label: "Account Settings",
          icon: Settings,
          section: "Account",
        },
      ];

    if (user?.role === "PHISHING_OPERATOR")
      return [
        {
          id: "phishing-campaigns",
          label: "Phishing Simulation",
          icon: Shield,
          section: "Phishing",
          children: phishingMode === "TICKET"
            ? [
                { id: "phishing-dashboard",       label: "Dashboard",         icon: BarChart3  },
                { id: "phishing-request",         label: "Request Campaign",  icon: Target     },
              ]
            : [
                { id: "phishing-dashboard",       label: "Dashboard",         icon: BarChart3  },
                { id: "phishing-campaigns",       label: "Campaigns",         icon: Target     },
                { id: "phishing-smtp",            label: "SMTP Profiles",     icon: Server     },
                { id: "phishing-groups",          label: "Target Groups",     icon: Users      },
                { id: "phishing-landing",         label: "Landing Pages",     icon: Globe      },
                { id: "phishing-email-templates", label: "Email Templates",   icon: Mail       },
                { id: "phishing-variables",       label: "Custom Variables",  icon: Variable   },
                { id: "phishing-alerts",          label: "Alerts",            icon: Bell       },
              ],
        },
        {
          id: "account",
          label: "Account Settings",
          icon: Settings,
          section: "Account",
        },
      ];

    if (user?.role === "REVIEWER")
      return [
        {
          id: "phishing-dashboard",
          label: "Phishing Results",
          icon: Eye,
          section: "Phishing",
        },
        {
          id: "analytics",
          label: "Analytics",
          icon: BarChart3,
        },
        {
          id: "account",
          label: "Account Settings",
          icon: Settings,
          section: "Account",
        },
      ];

    return [
      {
        id: "dashboard",
        label: t("sidebar.items.dashboard"),
        icon: BarChart3,
        section: t("sidebar.sections.overview"),
      },
      {
        id: "my-courses",
        label: t("sidebar.items.myCourses"),
        icon: BookOpen,
        section: t("sidebar.sections.learning"),
      },
      {
        id: "my-exams",
        label: t("sidebar.items.assessments"),
        icon: ClipboardCheck,
      },
      {
        id: "fraud-alerts",
        label: t("sidebar.items.fraudAlerts"),
        icon: AlertCircle,
        section: t("sidebar.sections.awareness"),
      },
      {
        id: "certificates",
        label: t("sidebar.items.certificates"),
        icon: FileText,
      },
      {
        id: "account",
        label: t("sidebar.items.accountSettings"),
        icon: Settings,
        section: t("sidebar.sections.account"),
      },
    ];
  };

  const menuItems = getMenuItems();
  let lastSection = "";

  /* ── Render a single menu item (recursive) ── */
  const renderItem = (item: MenuItem) => {
    const hasChildren = !!item.children?.length;
    const isExpanded = expandedMenus.includes(item.id);
    const isActive = activePage === item.id;
    const isParentActive =
      item.children?.some((c) => c.id === activePage) ?? false;

    /* Section label */
    const sectionLabel =
      item.section && item.section !== lastSection
        ? (() => {
            lastSection = item.section!;
            return sidebarOpen ? (
              <div key={`section-${item.section}`} className="aw-section-label">
                {item.section}
              </div>
            ) : (
              <div key={`section-${item.section}`} style={{ height: 16 }} />
            );
          })()
        : null;

    if (hasChildren) {
      return (
        <React.Fragment key={item.id}>
          {sectionLabel}
          <button
            className={`aw-menu-item ${isParentActive ? "parent-active" : ""}`}
            onClick={() => toggleMenu(item.id)}
            title={!sidebarOpen ? item.label : undefined}
          >
            <item.icon size={16} style={{ flexShrink: 0, opacity: 0.8 }} />
            {sidebarOpen && (
              <>
                <span style={{ flex: 1 }}>{item.label}</span>
                <ChevronDown
                  size={14}
                  style={{
                    opacity: 0.5,
                    flexShrink: 0,
                    transform: isExpanded ? "rotate(180deg)" : "none",
                    transition: "transform 0.25s",
                  }}
                />
              </>
            )}
          </button>

          {sidebarOpen && isExpanded && (
            <div
              style={{
                marginLeft: 14,
                paddingLeft: 12,
                borderLeft: `1px solid ${T.borderFaint}`,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                marginTop: 2,
                marginBottom: 2,
              }}
            >
              {item.children!.map((child) => (
                <button
                  key={child.id}
                  className={`aw-child-item ${
                    activePage === child.id ? "active" : ""
                  }`}
                  onClick={() => onNavigate(child.id)}
                >
                  <child.icon
                    size={14}
                    style={{ flexShrink: 0, opacity: 0.7 }}
                  />
                  {child.label}
                </button>
              ))}
            </div>
          )}
        </React.Fragment>
      );
    }

    return (
      <React.Fragment key={item.id}>
        {sectionLabel}
        <button
          className={`aw-menu-item ${isActive ? "active" : ""}`}
          onClick={() => onNavigate(item.id)}
          title={!sidebarOpen ? item.label : undefined}
        >
          <item.icon
            size={16}
            style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }}
          />
          {sidebarOpen && <span style={{ flex: 1 }}>{item.label}</span>}
          {sidebarOpen && isActive && (
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: T.accent,
                flexShrink: 0,
                boxShadow: "0 0 6px rgba(200,255,0,0.60)",
              }}
            />
          )}
        </button>
      </React.Fragment>
    );
  };

  const roleLabel =
    user?.role === "EMPLOYEE"
      ? "Employee Portal"
      : user?.role === "COMPANY_SUPER_ADMIN"
      ? "Super Admin"
      : user?.role === "COMPANY_ADMIN"
      ? "Company Admin"
      : user?.role === "PHISHING_OPERATOR"
      ? "Phishing Operator"
      : user?.role === "REVIEWER"
      ? "Reviewer"
      : "Platform Admin";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: T.bg,
        fontFamily: "'Inter', sans-serif",
        colorScheme: isDark ? "dark" : "light",
      }}
    >
      {/* ══════════════════════
          SIDEBAR
      ══════════════════════ */}
      <aside
        style={{
          width: sidebarOpen ? 248 : 64,
          background: T.sidebar,
          borderRight: `1px solid ${T.border}`,
          boxShadow: isDark ? "none" : "2px 0 12px rgba(0,0,0,0.06)",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.25s ease",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* Logo area */}
        <div
          style={{
            height: 64,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              overflow: "hidden",
            }}
          >
            <img
              src="/icon logo 1 .png"
              alt="AwareOne"
              style={{
                width: 32,
                height: 32,
                objectFit: "contain",
                flexShrink: 0,
              }}
            />
            {sidebarOpen && (
              <div style={{ overflow: "hidden" }}>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: T.white,
                    letterSpacing: "-0.2px",
                    whiteSpace: "nowrap",
                  }}
                >
                  AWARE<span style={{ color: T.accent }}>ONE</span>
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarOpen((v) => !v)}
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
              border: `1px solid ${T.borderFaint}`,
              borderRadius: 6,
              cursor: "pointer",
              color: T.textMuted,
              flexShrink: 0,
              transition: "background 0.2s, color 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
              (e.currentTarget as HTMLElement).style.color = T.white;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
              (e.currentTarget as HTMLElement).style.color = T.textMuted;
            }}
          >
            {sidebarOpen ? <X size={14} /> : <Menu size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav
          className="aw-sidebar-nav"
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "8px 8px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {(() => {
            lastSection = "";
            return menuItems.map((item) => renderItem(item));
          })()}
        </nav>

        {/* User info + Logout */}
        <div
          style={{
            padding: "12px 8px",
            borderTop: `1px solid ${T.border}`,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {sidebarOpen && (
            <div
              style={{
                padding: "10px 12px",
                background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
                border: `1px solid ${T.borderFaint}`,
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: T.textMuted,
                  marginBottom: 2,
                  letterSpacing: "0.4px",
                }}
              >
                Signed in as
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.white,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user?.full_name}
              </div>
              <div style={{ fontSize: 11, color: T.accent, marginTop: 1 }}>
                {user?.role?.replace("_", " ")}
              </div>
            </div>
          )}

          <button
            onClick={logout}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: sidebarOpen ? "flex-start" : "center",
              gap: 8,
              padding: sidebarOpen ? "9px 12px" : "9px 0",
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.20)",
              borderRadius: 8,
              color: "#fca5a5",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 0.2s, border-color 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(239,68,68,0.18)";
              (e.currentTarget as HTMLElement).style.borderColor =
                "rgba(239,68,68,0.35)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(239,68,68,0.10)";
              (e.currentTarget as HTMLElement).style.borderColor =
                "rgba(239,68,68,0.20)";
            }}
            title={!sidebarOpen ? "Logout" : undefined}
          >
            <LogOut size={14} style={{ flexShrink: 0 }} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ══════════════════════
          MAIN CONTENT
      ══════════════════════ */}
      <main
        style={{
          flex: 1,
          overflow: "auto",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          background: T.bg,
        }}
      >
        {/* Top bar */}
        <div
          style={{
            height: 64,
            flexShrink: 0,
            background: T.topbar,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderBottom: `1px solid ${T.border}`,
            boxShadow: isDark ? "none" : "0 1px 8px rgba(0,0,0,0.07)",
            position: "sticky",
            top: 0,
            zIndex: 30,
            padding: "0 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Breadcrumb / role */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: T.accent,
                boxShadow: "0 0 8px rgba(200,255,0,0.60)",
              }}
            />
            <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}>
              {roleLabel}
            </span>
            {activePage !== "dashboard" && (
              <>
                <ChevronRight
                  size={12}
                  style={{ color: T.textMuted, opacity: 0.5 }}
                />
                <span
                  style={{
                    fontSize: 13,
                    color: T.textLabel,
                    fontWeight: 600,
                    textTransform: "capitalize",
                  }}
                >
                  {activePage.replace(/-/g, " ")}
                </span>
              </>
            )}
          </div>

          {/* Right: actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {user?.role === "EMPLOYEE" && (
              <>
                {/* Theme toggle */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                    color: T.textLabel,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.2s, border-color 0.2s, color 0.2s",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
                    (e.currentTarget as HTMLElement).style.borderColor = T.accent;
                    (e.currentTarget as HTMLElement).style.color = T.accent;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
                    (e.currentTarget as HTMLElement).style.borderColor = T.border;
                    (e.currentTarget as HTMLElement).style.color = T.textLabel;
                  }}
                >
                  {isDark ? <Sun size={14} /> : <Moon size={14} />}
                </button>

                {/* Language toggle */}
                <button
                  type="button"
                  onClick={() => {
                    void i18n.changeLanguage(language === "ar" ? "en" : "ar");
                  }}
                  title={
                    language === "ar"
                      ? "Switch to English"
                      : "التبديل إلى العربية"
                  }
                  aria-label={
                    language === "ar" ? "Switch to English" : "Switch to Arabic"
                  }
                  style={{
                    minWidth: 56,
                    height: 30,
                    padding: "0 10px",
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                    color: T.textLabel,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.2px",
                    cursor: "pointer",
                    transition: "background 0.2s, border-color 0.2s, color 0.2s",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
                    (e.currentTarget as HTMLElement).style.borderColor = T.accent;
                    (e.currentTarget as HTMLElement).style.color = T.white;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
                    (e.currentTarget as HTMLElement).style.borderColor = T.border;
                    (e.currentTarget as HTMLElement).style.color = T.textLabel;
                  }}
                >
                  {language === "ar" ? "AR" : "EN"}
                </button>
              </>
            )}

            <NotificationBell onNavigate={onNavigate} />
          </div>
        </div>

        {/* Page content */}
        <div
          style={{
            flex: 1,
            maxWidth: 1280,
            width: "100%",
            margin: "0 auto",
            padding: "32px",
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
};
