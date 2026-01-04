import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, Award, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { EmployeesPage } from './EmployeesPage';
import { AnalyticsPage } from './AnalyticsPage';
import { DepartmentsPage } from './DepartmentsPage';
import { ExamAssignmentPage } from './ExamAssignmentPage';
import { EmployeeDetailPage } from './EmployeeDetailPage';
import { PhishingDashboardPage } from './PhishingDashboardPage';
import { PhishingRequestPage } from './PhishingRequestPage';
import { CourseAssignmentPage } from './CourseAssignmentPage';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface CompanyDashboardProps {
  onNavigate: (page: string) => void;
}

export const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    completedTraining: 0,
    averageScore: 0,
    pendingAssessments: 0
  });

  useEffect(() => {
    loadStats();
  }, [user]);

  const loadStats = async () => {
    if (!user?.company_id) return;

    try {
      const { data: employees } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', user.company_id)
        .eq('role', 'EMPLOYEE');

      const employeeIds = employees?.map(e => e.id) || [];

      if (employeeIds.length === 0) {
        setStats({
          totalEmployees: 0,
          completedTraining: 0,
          averageScore: 0,
          pendingAssessments: 0
        });
        return;
      }

      const [resultsRes, courseProgressRes] = await Promise.all([
        supabase
          .from('exam_results')
          .select('employee_id, percentage, passed')
          .in('employee_id', employeeIds),
        supabase
          .from('employee_courses')
          .select('employee_id, completed_at')
          .in('employee_id', employeeIds)
          .not('completed_at', 'is', null)
      ]);

      const employeesWithCompletedCourses = new Set(
        courseProgressRes.data?.map(ec => ec.employee_id) || []
      );

      const employeesWithPassedExams = new Set(
        resultsRes.data?.filter(r => r.passed).map(r => r.employee_id) || []
      );

      const totalCompleted = new Set([
        ...employeesWithCompletedCourses,
        ...employeesWithPassedExams
      ]).size;

      const avgScore = resultsRes.data && resultsRes.data.length > 0
        ? Math.round(resultsRes.data.reduce((sum, r) => sum + r.percentage, 0) / resultsRes.data.length)
        : 0;

      setStats({
        totalEmployees: employees?.length || 0,
        completedTraining: totalCompleted,
        averageScore: avgScore,
        pendingAssessments: (employees?.length || 0) - totalCompleted
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const renderContent = () => {
    if (activePage === 'employee-detail' && selectedEmployeeId) {
      return (
        <EmployeeDetailPage
          employeeId={selectedEmployeeId}
          onBack={() => {
            setActivePage('employees');
            setSelectedEmployeeId(null);
          }}
        />
      );
    }

    switch (activePage) {
      case 'employees':
        return <EmployeesPage onViewEmployee={(id) => {
          setSelectedEmployeeId(id);
          setActivePage('employee-detail');
        }} />;
      case 'departments':
        return <DepartmentsPage />;
      case 'exam-assignment':
        return <ExamAssignmentPage />;
      case 'course-assignment':
        return <CourseAssignmentPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'phishing-dashboard':
        return <PhishingDashboardPage />;
      case 'phishing-request':
        return <PhishingRequestPage />;
      default:
        return (
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Company Dashboard</h1>
            <p className="text-slate-600 mb-8">Overview of your organization's training progress</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <span className="text-3xl font-bold text-slate-900">{stats.totalEmployees}</span>
                </div>
                <div className="text-sm font-medium text-slate-600">Total Employees</div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <Award className="h-6 w-6 text-green-600" />
                  </div>
                  <span className="text-3xl font-bold text-slate-900">{stats.completedTraining}</span>
                </div>
                <div className="text-sm font-medium text-slate-600">Completed Training</div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                  <span className="text-3xl font-bold text-slate-900">{stats.averageScore}%</span>
                </div>
                <div className="text-sm font-medium text-slate-600">Average Score</div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <AlertCircle className="h-6 w-6 text-orange-600" />
                  </div>
                  <span className="text-3xl font-bold text-slate-900">{stats.pendingAssessments}</span>
                </div>
                <div className="text-sm font-medium text-slate-600">Pending Assessments</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setActivePage('employees')}
                    className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <div className="font-medium text-blue-900">Manage Employees</div>
                    <div className="text-sm text-blue-700">Add or edit employee accounts</div>
                  </button>
                  <button
                    onClick={() => setActivePage('analytics')}
                    className="w-full text-left px-4 py-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                  >
                    <div className="font-medium text-purple-900">View Analytics</div>
                    <div className="text-sm text-purple-700">Detailed performance reports</div>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-6">Training Overview</h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-slate-600">Completion Rate</span>
                      <span className="font-bold text-slate-900">{stats.totalEmployees > 0 ? Math.round((stats.completedTraining / stats.totalEmployees) * 100) : 0}%</span>
                    </div>
                    <div className="flex items-end gap-1 h-32">
                      <div className="flex-1 bg-green-500 rounded-t-lg hover:bg-green-600 transition-all relative group" style={{ height: `${stats.totalEmployees > 0 ? (stats.completedTraining / stats.totalEmployees) * 100 : 0}%` }}>
                        <div className="absolute inset-x-0 -top-8 text-center">
                          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {stats.completedTraining} Completed
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 bg-orange-400 rounded-t-lg hover:bg-orange-500 transition-all relative group" style={{ height: `${stats.totalEmployees > 0 ? (stats.pendingAssessments / stats.totalEmployees) * 100 : 0}%` }}>
                        <div className="absolute inset-x-0 -top-8 text-center">
                          <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {stats.pendingAssessments} Pending
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                      <span>Completed</span>
                      <span>Pending</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-slate-600">Average Score</span>
                      <span className="text-2xl font-bold text-blue-600">{stats.averageScore}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all"
                        style={{ width: `${stats.averageScore}%` }}
                      />
                    </div>
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
