import React, { useState, useEffect } from "react";
import {
  LogOut, Menu, X, Building2, Users, BookOpen,
  ClipboardCheck, BarChart3, FileText, CreditCard,
  History, Award, Layout, FolderTree, Send,
  ChevronDown, ChevronRight, Shield, Mail,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../NotificationBell';

/* ─────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────── */
const T = {
  bg:           '#12140a',
  sidebar:      '#0e100a',          /* slightly darker than bg */
  sidebarHover: 'rgba(255,255,255,0.05)',
  sidebarActive:'rgba(200,255,0,0.10)',
  accent:       '#c8ff00',
  accentDark:   '#12140a',
  topbar:       'rgba(18,20,10,0.95)',
  white:        '#ffffff',
  textBody:     '#94a3b8',
  textLabel:    '#cbd5e1',
  textMuted:    '#64748b',
  border:       'rgba(255,255,255,0.08)',
  borderFaint:  'rgba(255,255,255,0.05)',
} as const;

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

if (typeof document !== 'undefined' && !document.getElementById('aw-layout-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-layout-styles';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus]   = useState<string[]>([]);

  /* Auto-expand parent menu for current page */
  useEffect(() => {
    const parentMap: Record<string, string> = {
      companies: 'company-management',
      users: 'company-management',
      subscriptions: 'company-management',
      courses: 'content-management',
      exams: 'content-management',
      certificates: 'content-management',
      'phishing-management': 'phishing-campaigns',
      'phishing-templates': 'phishing-campaigns',
      'phishing-results': 'phishing-campaigns',
      'phishing-dashboard': 'phishing-campaigns',
      'phishing-request': 'phishing-campaigns',
    };
    const parent = parentMap[activePage];
    if (parent) setExpandedMenus(prev => prev.includes(parent) ? prev : [...prev, parent]);
  }, [activePage]);

  const toggleMenu = (id: string) =>
    setExpandedMenus(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  /* ── Menu definitions ── */
  const getMenuItems = (): MenuItem[] => {
    if (user?.role === 'PLATFORM_ADMIN') return [
      { id: 'dashboard',             label: 'Dashboard',              icon: BarChart3,    section: 'Overview' },
      { id: 'company-management',    label: 'Company Management',     icon: Building2,    section: 'Management',
        children: [
          { id: 'companies',     label: 'Companies',           icon: Building2 },
          { id: 'users',         label: 'Users',               icon: Users },
          { id: 'subscriptions', label: 'Subscriptions & Bills', icon: CreditCard },
        ],
      },
      { id: 'content-management',    label: 'Training Content',       icon: BookOpen,
        children: [
          { id: 'courses',      label: 'Courses',               icon: BookOpen },
          { id: 'exams',        label: 'Tests',                 icon: ClipboardCheck },
          { id: 'certificates', label: 'Certificate Templates', icon: Award },
        ],
      },
      { id: 'phishing-campaigns',    label: 'Phishing Campaigns',     icon: Shield,
        children: [
          { id: 'phishing-management', label: 'Campaign Requests', icon: Shield },
          { id: 'phishing-templates',  label: 'Email Templates',   icon: Mail },
          { id: 'phishing-results',    label: 'Campaign Results',  icon: BarChart3 },
        ],
      },
      { id: 'analytics',             label: 'Analysis & Reports',     icon: BarChart3,    section: 'Data' },
      { id: 'fraud-alerts-management', label: 'Fraud Alerts',         icon: AlertCircle },
      { id: 'partners-management',   label: 'Partners',               icon: Building2 },
      { id: 'homepage-content',      label: 'Content Management',     icon: Layout },
      { id: 'audit-logs',            label: 'Activity Log',           icon: History,      section: 'System' },
      { id: 'demo-requests',         label: 'Demo Requests',          icon: Users },
      { id: 'public-submissions',    label: 'Public Submissions',     icon: FileText },
    ];

    if (user?.role === 'COMPANY_ADMIN') return [
      { id: 'dashboard',         label: 'Dashboard',          icon: BarChart3,  section: 'Overview' },
      { id: 'employees',         label: 'Employees',          icon: Users,      section: 'People' },
      { id: 'departments',       label: 'Departments',        icon: FolderTree },
      { id: 'course-assignment', label: 'Course Assignment',  icon: BookOpen,   section: 'Training' },
      { id: 'exam-assignment',   label: 'Test Assignments',   icon: Send },
      { id: 'phishing-campaigns', label: 'Phishing Campaigns', icon: Shield,
        children: [
          { id: 'phishing-dashboard', label: 'Campaign Board',     icon: Shield },
          { id: 'phishing-request',   label: 'Request Campaign',   icon: Send },
        ],
      },
      { id: 'analytics',         label: 'Analytics',          icon: BarChart3,  section: 'Reports' },
    ];

    return [
      { id: 'dashboard',   label: 'Dashboard',    icon: BarChart3,   section: 'Overview' },
      { id: 'my-courses',  label: 'My Courses',   icon: BookOpen,    section: 'Learning' },
      { id: 'my-exams',    label: 'Assessments',  icon: ClipboardCheck },
      { id: 'fraud-alerts', label: 'Fraud Alerts', icon: AlertCircle, section: 'Awareness' },
      { id: 'certificates', label: 'Certificates', icon: FileText },
    ];
  };

  const menuItems = getMenuItems();
  let lastSection = '';

  /* ── Render a single menu item (recursive) ── */
  const renderItem = (item: MenuItem) => {
    const hasChildren = !!item.children?.length;
    const isExpanded  = expandedMenus.includes(item.id);
    const isActive    = activePage === item.id;
    const isParentActive = item.children?.some(c => c.id === activePage) ?? false;

    /* Section label */
    const sectionLabel = item.section && item.section !== lastSection ? (() => {
      lastSection = item.section!;
      return sidebarOpen
        ? <div key={`section-${item.section}`} className="aw-section-label">{item.section}</div>
        : <div key={`section-${item.section}`} style={{ height: 16 }} />;
    })() : null;

    if (hasChildren) {
      return (
        <React.Fragment key={item.id}>
          {sectionLabel}
          <button
            className={`aw-menu-item ${isParentActive ? 'parent-active' : ''}`}
            onClick={() => toggleMenu(item.id)}
            title={!sidebarOpen ? item.label : undefined}
          >
            <item.icon size={16} style={{ flexShrink: 0, opacity: 0.80 }} />
            {sidebarOpen && <>
              <span style={{ flex: 1 }}>{item.label}</span>
              <ChevronDown
                size={14}
                style={{ opacity: 0.50, flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }}
              />
            </>}
          </button>

          {sidebarOpen && isExpanded && (
            <div style={{
              marginLeft: 14,
              paddingLeft: 12,
              borderLeft: `1px solid ${T.borderFaint}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              marginTop: 2,
              marginBottom: 2,
            }}>
              {item.children!.map(child => (
                <button
                  key={child.id}
                  className={`aw-child-item ${activePage === child.id ? 'active' : ''}`}
                  onClick={() => onNavigate(child.id)}
                >
                  <child.icon size={14} style={{ flexShrink: 0, opacity: 0.70 }} />
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
          className={`aw-menu-item ${isActive ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
          title={!sidebarOpen ? item.label : undefined}
        >
          <item.icon size={16} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.70 }} />
          {sidebarOpen && <span style={{ flex: 1 }}>{item.label}</span>}
          {sidebarOpen && isActive && (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, flexShrink: 0, boxShadow: '0 0 6px rgba(200,255,0,0.60)' }} />
          )}
        </button>
      </React.Fragment>
    );
  };

  const roleLabel =
    user?.role === 'EMPLOYEE'     ? 'Employee Portal' :
    user?.role === 'COMPANY_ADMIN' ? 'Company Admin' :
    'Platform Admin';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: T.bg, fontFamily: "'Inter', sans-serif" }}>

      {/* ══════════════════════
          SIDEBAR
      ══════════════════════ */}
      <aside style={{
        width: sidebarOpen ? 248 : 64,
        background: T.sidebar,
        borderRight: `1px solid ${T.border}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s ease',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflow: 'hidden',
      }}>

        {/* Logo area */}
        <div style={{
          height: 64,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${T.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <img
              src="/icon logo 1 .png"
              alt="AwareOne"
              style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }}
            />
            {sidebarOpen && (
              <div style={{ overflow: 'hidden' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: T.white, letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>
                  AWARE<span style={{ color: T.accent }}>ONE</span>
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarOpen(v => !v)}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, borderRadius: 6, cursor: 'pointer', color: T.textMuted, flexShrink: 0, transition: 'background 0.2s, color 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'; (e.currentTarget as HTMLElement).style.color = T.white; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = T.textMuted; }}
          >
            {sidebarOpen ? <X size={14} /> : <Menu size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav
          className="aw-sidebar-nav"
          style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 8px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {(() => { lastSection = ''; return menuItems.map(item => renderItem(item)); })()}
        </nav>

        {/* User info + Logout */}
        <div style={{ padding: '12px 8px', borderTop: `1px solid ${T.border}`, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sidebarOpen && (
            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderFaint}`, borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 2, letterSpacing: '0.4px' }}>Signed in as</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.full_name}</div>
              <div style={{ fontSize: 11, color: T.accent, marginTop: 1 }}>{user?.role?.replace('_', ' ')}</div>
            </div>
          )}

          <button
            onClick={logout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: sidebarOpen ? 'flex-start' : 'center',
              gap: 8, padding: sidebarOpen ? '9px 12px' : '9px 0',
              background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.20)', borderRadius: 8,
              color: '#fca5a5', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.18)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.35)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.10)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.20)'; }}
            title={!sidebarOpen ? 'Logout' : undefined}
          >
            <LogOut size={14} style={{ flexShrink: 0 }} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ══════════════════════
          MAIN CONTENT
      ══════════════════════ */}
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <div style={{
          height: 64, flexShrink: 0,
          background: T.topbar,
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${T.border}`,
          position: 'sticky', top: 0, zIndex: 30,
          padding: '0 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Breadcrumb / role */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, boxShadow: '0 0 8px rgba(200,255,0,0.60)' }} />
            <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}>{roleLabel}</span>
            {activePage !== 'dashboard' && (
              <>
                <ChevronRight size={12} style={{ color: T.textMuted, opacity: 0.50 }} />
                <span style={{ fontSize: 13, color: T.textLabel, fontWeight: 600, textTransform: 'capitalize' }}>
                  {activePage.replace(/-/g, ' ')}
                </span>
              </>
            )}
          </div>

          {/* Right: notifications */}
          <NotificationBell onNavigate={onNavigate} />
        </div>

        {/* Page content */}
        <div style={{ flex: 1, maxWidth: 1280, width: '100%', margin: '0 auto', padding: '32px' }}>
          {children}
        </div>
      </main>
    </div>
  );
};
