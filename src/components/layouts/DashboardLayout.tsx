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
  ChevronUp,
  Shield,
  Mail,
  AlertCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { SupportedLanguage } from "../../i18n";
import { NotificationBell } from "../NotificationBell";

interface DashboardLayoutProps {
  children: React.ReactNode;
  activePage: string;
  onNavigate: (page: string, itemId?: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  children?: MenuItem[];
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activePage,
  onNavigate,
}) => {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation(["common", "employee"]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const isEmployee = user?.role === "EMPLOYEE";
  const isRtl = i18n.dir() === "rtl";
  const currentLanguage = i18n.resolvedLanguage === "ar" ? "ar" : "en";

  /* 🔹 فتح القائمة الأم تلقائياً عند الدخول لصفحة فرعية */
  useEffect(() => {
    const parentMenus: Record<string, string> = {
      companies: "company-management",
      users: "company-management",
      subscriptions: "company-management",

      courses: "content-management",
      exams: "content-management",
      certificates: "content-management",

      "phishing-management": "phishing-campaigns",
      "phishing-templates": "phishing-campaigns",
      "phishing-results": "phishing-campaigns",
    };

    const parent = parentMenus[activePage];

    if (parent && !expandedMenus.includes(parent)) {
      setExpandedMenus((prev) => [...prev, parent]);
    }
  }, [activePage]);

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId]
    );
  };

  const getMenuItems = (): MenuItem[] => {
    if (user?.role === "PLATFORM_ADMIN") {
      return [
        { id: "dashboard", label: "Dashboard", icon: BarChart3 },
        {
          id: "company-management",
          label: "Company Management",
          icon: Building2,
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
          children: [
            {
              id: "phishing-management",
              label: "Campaign Requests",
              icon: Shield,
            },
            {
              id: "phishing-templates",
              label: "Email Templates",
              icon: Mail,
            },
            {
              id: "phishing-results",
              label: "Campaign Results",
              icon: Mail,
            },
          ],
        },
        { id: "analytics", label: "Analysis & Reports", icon: BarChart3 },
        {
          id: "fraud-alerts-management",
          label: "Fraud Alerts Management",
          icon: AlertCircle,
        },
        {
          id: "partners-management",
          label: "Partners Management",
          icon: Building2,
        },

        { id: "audit-logs", label: "Activity Log", icon: History },
        { id: "demo-requests", label: "Demo Requests", icon: Users },
        {
          id: "public-submissions",
          label: "Public Submissions",
          icon: FileText,
        },
      ];
    }

    if (user?.role === "COMPANY_ADMIN") {
      return [
        { id: "dashboard", label: "Dashboard", icon: BarChart3 },
        { id: "employees", label: "Employees", icon: Users },
        { id: "departments", label: "Departments", icon: FolderTree },
        {
          id: "course-assignment",
          label: "Course Assignment",
          icon: BookOpen,
        },
        {
          id: "exam-assignment",
          label: "Test Assignments",
          icon: Send,
        },
        {
          id: "phishing-campaigns",
          label: "Phishing Campaigns",
          icon: Shield,
          children: [
            {
              id: "phishing-dashboard",
              label: "Campaign Board",
              icon: Shield,
            },
            {
              id: "phishing-request",
              label: "Request Campaign",
              icon: Send,
            },
          ],
        },
        { id: "analytics", label: "Analytics", icon: BarChart3 },
      ];
    }

    return [
      {
        id: "dashboard",
        label: t("navigation.dashboard", { ns: "employee" }),
        icon: BarChart3,
      },
      {
        id: "my-courses",
        label: t("navigation.myCourses", { ns: "employee" }),
        icon: BookOpen,
      },
      {
        id: "my-exams",
        label: t("navigation.myExams", { ns: "employee" }),
        icon: ClipboardCheck,
      },
      {
        id: "fraud-alerts",
        label: t("navigation.fraudAlerts", { ns: "employee" }),
        icon: AlertCircle,
      },
      {
        id: "certificates",
        label: t("navigation.certificates", { ns: "employee" }),
        icon: FileText,
      },
    ];
  };

  const handleLanguageChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    void i18n.changeLanguage(event.target.value as SupportedLanguage);
  };

  const renderMenuItem = (item: MenuItem) => {
    const hasChildren = !!item.children?.length;
    const isExpanded = expandedMenus.includes(item.id);
    const isActive =
      activePage === item.id ||
      item.children?.some((child) => child.id === activePage);

    const baseClasses =
      "w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition-all";

    if (hasChildren) {
      return (
        <div key={item.id} className="space-y-1">
          <button
            onClick={() => toggleMenu(item.id)}
            className={`${baseClasses} ${
              isActive
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <item.icon className="h-4 w-4 opacity-80" />
            {sidebarOpen && (
              <span className="flex-1 font-medium">{item.label}</span>
            )}
            {sidebarOpen &&
              (isExpanded ? (
                <ChevronUp className="h-4 w-4 opacity-60" />
              ) : (
                <ChevronDown className="h-4 w-4 opacity-60" />
              ))}
          </button>

          {sidebarOpen && isExpanded && (
            <div
              className={`space-y-1 ${
                isRtl
                  ? "mr-6 pr-3 border-r border-slate-700"
                  : "ml-6 pl-3 border-l border-slate-700"
              }`}
            >
              {item.children?.map((child) => renderMenuItem(child))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        className={`${baseClasses} ${
          activePage === item.id
            ? `bg-blue-500/10 text-blue-400 ${
                isRtl ? "border-r-2 border-blue-500" : "border-l-2 border-blue-500"
              }`
            : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
        }`}
      >
        <item.icon className="h-4 w-4 opacity-80" />
        {sidebarOpen && <span>{item.label}</span>}
      </button>
    );
  };

  const menuItems = getMenuItems();

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen flex bg-slate-50">
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-slate-900 text-white transition-all duration-300 flex flex-col`}
      >
        <div className="p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src="/icon logo 1 .png"
              alt="Sinnara"
              className="h-10 w-10 object-contain"
            />
            {sidebarOpen && (
              <span className="text-lg font-semibold">Sinnara</span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md hover:bg-slate-800"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => renderMenuItem(item))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          {sidebarOpen && (
            <div className="bg-slate-800/60 rounded-md p-3 text-sm">
              <div className="text-slate-400 text-xs mb-1">
                {t("auth.signedInAs", { ns: "common" })}
              </div>
              <div className="font-medium truncate">{user?.full_name}</div>
              <div className="text-xs text-slate-400">
                {user?.role.replace("_", " ")}
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 py-2.5 rounded-md transition-colors"
          >
            <LogOut size={16} />
            {sidebarOpen && <span>{t("auth.logout", { ns: "common" })}</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="bg-white border-b border-slate-200 sticky top-0 z-30 px-8 py-4 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            {user?.role === "EMPLOYEE"
              ? t("portal.employee", { ns: "common" })
              : user?.role === "COMPANY_ADMIN"
              ? t("portal.companyAdmin", { ns: "common" })
              : t("portal.platformAdmin", { ns: "common" })}
          </div>
          <div className="flex items-center gap-3">
            {isEmployee && (
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span>{t("language.switcherLabel", { ns: "common" })}</span>
                <select
                  value={currentLanguage}
                  onChange={handleLanguageChange}
                  className="bg-transparent font-medium text-slate-900 outline-none"
                >
                  <option value="en">
                    {t("language.english", { ns: "common" })}
                  </option>
                  <option value="ar">
                    {t("language.arabic", { ns: "common" })}
                  </option>
                </select>
              </label>
            )}
            <NotificationBell onNavigate={onNavigate} />
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
};
