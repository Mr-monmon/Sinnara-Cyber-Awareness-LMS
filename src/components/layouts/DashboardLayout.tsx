import React, { useState, useEffect } from 'react';
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
  Layout,
  FolderTree,
  Send,
  ChevronDown,
  ChevronUp,
  Shield,
  Mail,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../NotificationBell';

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

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  /* 🔹 فتح القائمة الأم تلقائياً عند الدخول لصفحة فرعية */
  useEffect(() => {
    const parentMenus: Record<string, string> = {
      companies: 'company-management',
      users: 'company-management',
      subscriptions: 'company-management',

      courses: 'content-management',
      exams: 'content-management',
      certificates: 'content-management',

      'phishing-management': 'phishing-campaigns',
      'phishing-templates': 'phishing-campaigns',
      'phishing-results': 'phishing-campaigns',
    };

    const parent = parentMenus[activePage];

    if (parent && !expandedMenus.includes(parent)) {
      setExpandedMenus(prev => [...prev, parent]);
    }
  }, [activePage]);

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev =>
      prev.includes(menuId)
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  const getMenuItems = (): MenuItem[] => {
    if (user?.role === 'PLATFORM_ADMIN') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
        {
          id: 'company-management',
          label: 'Company Management',
          icon: Building2,
          children: [
            { id: 'companies', label: 'Companies', icon: Building2 },
            { id: 'users', label: 'Users', icon: Users },
            {
              id: 'subscriptions',
              label: 'Subscriptions & Bills',
              icon: CreditCard,
            },
          ],
        },
        {
          id: 'content-management',
          label: 'Training Content',
          icon: BookOpen,
          children: [
            { id: 'courses', label: 'Courses', icon: BookOpen },
            { id: 'exams', label: 'Tests', icon: ClipboardCheck },
            {
              id: 'certificates',
              label: 'Certificate Templates',
              icon: Award,
            },
          ],
        },
        {
          id: 'phishing-campaigns',
          label: 'Phishing Campaigns',
          icon: Shield,
          children: [
            {
              id: 'phishing-management',
              label: 'Campaign Requests',
              icon: Shield,
            },
            {
              id: 'phishing-templates',
              label: 'Email Templates',
              icon: Mail,
            },
            {
              id: 'phishing-results',
              label: 'Campaign Results',
              icon: Mail,
            },
          ],
        },
        { id: 'analytics', label: 'Analysis & Reports', icon: BarChart3 },
        {
          id: 'fraud-alerts-management',
          label: 'Fraud Alerts Management',
          icon: AlertCircle,
        },
        {
          id: 'partners-management',
          label: 'Partners Management',
          icon: Building2,
        },
        {
          id: 'homepage-content',
          label: 'Content Management',
          icon: Layout,
        },
        { id: 'audit-logs', label: 'Activity Log', icon: History },
        { id: 'demo-requests', label: 'Demo Requests', icon: Users },
        {
          id: 'public-submissions',
          label: 'Public Submissions',
          icon: FileText,
        },
      ];
    }

    if (user?.role === 'COMPANY_ADMIN') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
        { id: 'employees', label: 'Employees', icon: Users },
        { id: 'departments', label: 'Departments', icon: FolderTree },
        {
          id: 'course-assignment',
          label: 'Course Assignment',
          icon: BookOpen,
        },
        {
          id: 'exam-assignment',
          label: 'Test Assignments',
          icon: Send,
        },
        {
          id: 'phishing-campaigns',
          label: 'Phishing Campaigns',
          icon: Shield,
          children: [
            {
              id: 'phishing-dashboard',
              label: 'Campaign Board',
              icon: Shield,
            },
            {
              id: 'phishing-request',
              label: 'Request Campaign',
              icon: Send,
            },
          ],
        },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      ];
    }

    return [
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
      { id: 'my-courses', label: 'My Courses', icon: BookOpen },
      { id: 'my-exams', label: 'Assessments', icon: ClipboardCheck },
      { id: 'fraud-alerts', label: 'Fraud Alerts', icon: AlertCircle },
      { id: 'certificates', label: 'Certificates', icon: FileText },
    ];
  };

  const renderMenuItem = (item: MenuItem) => {
    const hasChildren = !!item.children?.length;
    const isExpanded = expandedMenus.includes(item.id);
    const isActive =
      activePage === item.id ||
      item.children?.some(child => child.id === activePage);

    const baseClasses =
      'w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition-all';

    if (hasChildren) {
      return (
        <div key={item.id} className="space-y-1">
          <button
            onClick={() => toggleMenu(item.id)}
            className={`${baseClasses} ${
              isActive
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
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
            <div className="ml-6 pl-3 border-l border-slate-700 space-y-1">
              {item.children?.map(child => renderMenuItem(child))}
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
            ? 'bg-blue-500/10 text-blue-400 border-l-2 border-blue-500'
            : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
        }`}
      >
        <item.icon className="h-4 w-4 opacity-80" />
        {sidebarOpen && <span>{item.label}</span>}
      </button>
    );
  };

  const menuItems = getMenuItems();

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
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
          {menuItems.map(item => renderMenuItem(item))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          {sidebarOpen && (
            <div className="bg-slate-800/60 rounded-md p-3 text-sm">
              <div className="text-slate-400 text-xs mb-1">Signed in as</div>
              <div className="font-medium truncate">{user?.full_name}</div>
              <div className="text-xs text-slate-400">
                {user?.role.replace('_', ' ')}
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 py-2.5 rounded-md transition-colors"
          >
            <LogOut size={16} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="bg-white border-b border-slate-200 sticky top-0 z-30 px-8 py-4 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            {user?.role === 'EMPLOYEE'
              ? 'Employee Portal'
              : user?.role === 'COMPANY_ADMIN'
              ? 'Company Admin Panel'
              : 'Platform Admin Panel'}
          </div>
          <NotificationBell onNavigate={onNavigate} />
        </div>

        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
};
