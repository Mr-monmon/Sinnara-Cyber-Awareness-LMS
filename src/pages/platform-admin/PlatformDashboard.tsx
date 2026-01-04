import React, { useState, useEffect } from 'react';
import { Building2, Users, BookOpen, FileText, BarChart3, CreditCard, History, Shield } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { CompaniesPage } from './CompaniesPage';
import { CoursesPage } from './CoursesPage';
import { ExamsPage } from './ExamsPage';
import { PublicSubmissionsPage } from './PublicSubmissionsPage';
import { UsersManagementPage } from './UsersManagementPage';
import { SubscriptionsPage } from './SubscriptionsPage';
import { AnalyticsPage } from './AnalyticsPage';
import { AuditLogsPage } from './AuditLogsPage';
import { CertificateTemplatesPage } from './CertificateTemplatesPage';
import { PhishingManagementPage } from './PhishingManagementPage';
import { PhishingTemplatesPage } from './PhishingTemplatesPage';
import { PhishingCampaignResultsPage } from './PhishingCampaignResultsPage';
import { DemoRequestsPage } from './DemoRequestsPage';
import { PartnersManagementPage } from './PartnersManagementPage';
import { FraudAlertsManagementPage } from './FraudAlertsManagementPage';
import { supabase } from '../../lib/supabase';

interface PlatformDashboardProps {
  onNavigate: (page: string) => void;
}

export const PlatformDashboard: React.FC<PlatformDashboardProps> = ({ onNavigate }) => {
  const [activePage, setActivePage] = useState('dashboard');
  const [stats, setStats] = useState({
    companies: 0,
    totalEmployees: 0,
    courses: 0,
    publicSubmissions: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [companiesData, usersData, coursesData, submissionsData] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'EMPLOYEE'),
        supabase.from('courses').select('id', { count: 'exact', head: true }),
        supabase.from('public_assessments').select('id', { count: 'exact', head: true })
      ]);

      setStats({
        companies: companiesData.count || 0,
        totalEmployees: usersData.count || 0,
        courses: coursesData.count || 0,
        publicSubmissions: submissionsData.count || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const renderContent = () => {
    switch (activePage) {
      case 'companies':
        return <CompaniesPage />;
      case 'courses':
        return <CoursesPage />;
      case 'exams':
        return <ExamsPage />;
      case 'public-submissions':
        return <PublicSubmissionsPage />;
      case 'demo-requests':
        return <DemoRequestsPage />;
      case 'homepage-content':
        return <PartnersManagementPage />;
      case 'users':
        return <UsersManagementPage />;
      case 'subscriptions':
        return <SubscriptionsPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'audit-logs':
        return <AuditLogsPage />;
      case 'certificates':
        return <CertificateTemplatesPage />;
      case 'phishing-management':
        return <PhishingManagementPage />;
      case 'phishing-templates':
        return <PhishingTemplatesPage />;
      case 'phishing-results':
        return <PhishingCampaignResultsPage />;
      case 'fraud-alerts-management':
        return <FraudAlertsManagementPage />;
      case 'partners-management':
        return <PartnersManagementPage />;
      default:
        return (
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Platform Dashboard</h1>
            <p className="text-slate-600 mb-8">Overview of all platform activities</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Building2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <span className="text-3xl font-bold text-slate-900">{stats.companies}</span>
                </div>
                <div className="text-sm font-medium text-slate-600">Total Companies</div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <span className="text-3xl font-bold text-slate-900">{stats.totalEmployees}</span>
                </div>
                <div className="text-sm font-medium text-slate-600">Total Employees</div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <BookOpen className="h-6 w-6 text-purple-600" />
                  </div>
                  <span className="text-3xl font-bold text-slate-900">{stats.courses}</span>
                </div>
                <div className="text-sm font-medium text-slate-600">Training Courses</div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <FileText className="h-6 w-6 text-orange-600" />
                  </div>
                  <span className="text-3xl font-bold text-slate-900">{stats.publicSubmissions}</span>
                </div>
                <div className="text-sm font-medium text-slate-600">Public Tests</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => setActivePage('companies')}
                    className="text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-blue-600" />
                      <div className="font-medium text-blue-900">إدارة الشركات</div>
                    </div>
                    <div className="text-xs text-blue-700">إضافة وتعديل الشركات</div>
                  </button>
                  <button
                    onClick={() => setActivePage('users')}
                    className="text-left px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="h-4 w-4 text-green-600" />
                      <div className="font-medium text-green-900">إدارة المستخدمين</div>
                    </div>
                    <div className="text-xs text-green-700">المستخدمين والصلاحيات</div>
                  </button>
                  <button
                    onClick={() => setActivePage('subscriptions')}
                    className="text-left px-4 py-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="h-4 w-4 text-purple-600" />
                      <div className="font-medium text-purple-900">الاشتراكات والفواتير</div>
                    </div>
                    <div className="text-xs text-purple-700">إدارة المدفوعات</div>
                  </button>
                  <button
                    onClick={() => setActivePage('analytics')}
                    className="text-left px-4 py-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="h-4 w-4 text-orange-600" />
                      <div className="font-medium text-orange-900">التحليلات والتقارير</div>
                    </div>
                    <div className="text-xs text-orange-700">إحصائيات المنصة</div>
                  </button>
                  <button
                    onClick={() => setActivePage('courses')}
                    className="text-left px-4 py-3 bg-cyan-50 hover:bg-cyan-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="h-4 w-4 text-cyan-600" />
                      <div className="font-medium text-cyan-900">إدارة الدورات</div>
                    </div>
                    <div className="text-xs text-cyan-700">المحتوى التدريبي</div>
                  </button>
                  <button
                    onClick={() => setActivePage('audit-logs')}
                    className="text-left px-4 py-3 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <History className="h-4 w-4 text-red-600" />
                      <div className="font-medium text-red-900">سجل الأنشطة</div>
                    </div>
                    <div className="text-xs text-red-700">تتبع العمليات</div>
                  </button>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl shadow-lg p-6 text-white">
                <h3 className="text-lg font-semibold mb-4">Platform Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>System Health</span>
                    <span className="px-3 py-1 bg-green-500 rounded-full text-sm font-medium">Healthy</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Active Companies</span>
                    <span className="font-bold">{stats.companies}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total Users</span>
                    <span className="font-bold">{stats.totalEmployees}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <DashboardLayout activePage={activePage} onNavigate={setActivePage}>
      {renderContent()}
    </DashboardLayout>
  );
};
