import React, { useState, useEffect } from 'react';
import { BookOpen, ClipboardCheck, Award } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { MyCoursesPage } from './MyCoursesPage';
import { MyExamsPage } from './MyExamsPage';
import { CertificatesPage } from './CertificatesPage';
import { FraudAlertsPage } from './FraudAlertsPage';
import { FraudAlertWidget } from '../../components/FraudAlertWidget';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface EmployeeDashboardProps {
  onNavigate: (page: string) => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [stats, setStats] = useState({
    assignedCourses: 0,
    completedCourses: 0,
    pendingExams: 0,
    certificates: 0
  });

  useEffect(() => {
    loadStats();
  }, [user]);

  const loadStats = async () => {
    if (!user?.id) return;

    try {
      const { data: courses } = await supabase
        .from('employee_courses')
        .select('*')
        .eq('employee_id', user.id);

      const assignedToEmployee = await supabase
        .from('assigned_exams')
        .select('id, exam_id')
        .eq('assigned_to_employee', user.id)
        .eq('status', 'active');

      const assignedToDepartment = user.department_id ? await supabase
        .from('assigned_exams')
        .select('id, exam_id')
        .eq('assigned_to_department', user.department_id)
        .eq('status', 'active') : { data: null };

      const allAssignedExams = [
        ...(assignedToEmployee.data || []),
        ...(assignedToDepartment.data || [])
      ];

      const assignedExamIds = [...new Set(allAssignedExams.map(ae => ae.exam_id))];

      let availableExamsQuery = supabase.from('exams').select('id');

      if (assignedExamIds.length > 0) {
        availableExamsQuery = availableExamsQuery.or(`exam_type.in.(PRE_ASSESSMENT,POST_ASSESSMENT),id.in.(${assignedExamIds.join(',')})`);
      } else {
        availableExamsQuery = availableExamsQuery.in('exam_type', ['PRE_ASSESSMENT', 'POST_ASSESSMENT']);
      }

      const { data: availableExams } = await availableExamsQuery;
      const allExamIds = availableExams?.map(e => e.id) || [];

      const { data: examAttempts } = await supabase
        .from('exam_attempts')
        .select('exam_id, passed')
        .eq('employee_id', user.id);

      const completedExamIds = new Set(
        examAttempts?.filter(a => a.passed).map(a => a.exam_id) || []
      );

      const pendingExamsCount = allExamIds.filter(id => !completedExamIds.has(id)).length;

      const { data: certificates } = await supabase
        .from('exam_attempts')
        .select('id')
        .eq('employee_id', user.id)
        .eq('passed', true);

      setStats({
        assignedCourses: courses?.length || 0,
        completedCourses: courses?.filter(c => c.status === 'COMPLETED').length || 0,
        pendingExams: pendingExamsCount,
        certificates: certificates?.length || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const renderContent = () => {
    switch (activePage) {
      case 'my-courses':
        return <MyCoursesPage />;
      case 'my-exams':
        return <MyExamsPage />;
      case 'fraud-alerts':
        return <FraudAlertsPage />;
      case 'certificates':
        return <CertificatesPage />;
      default:
        return (
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">My Dashboard</h1>
            <p className="text-slate-600 mb-8">Welcome back! Continue your cybersecurity training journey.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                  </div>
                  <span className="text-3xl font-bold text-slate-900">{stats.assignedCourses}</span>
                </div>
                <div className="text-sm font-medium text-slate-600">Assigned Courses</div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <ClipboardCheck className="h-6 w-6 text-green-600" />
                  </div>
                  <span className="text-3xl font-bold text-slate-900">{stats.completedCourses}</span>
                </div>
                <div className="text-sm font-medium text-slate-600">Completed Courses</div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <ClipboardCheck className="h-6 w-6 text-orange-600" />
                  </div>
                  <span className="text-3xl font-bold text-slate-900">{stats.pendingExams}</span>
                </div>
                <div className="text-sm font-medium text-slate-600">Pending Assessments</div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <Award className="h-6 w-6 text-purple-600" />
                  </div>
                  <span className="text-3xl font-bold text-slate-900">{stats.certificates}</span>
                </div>
                <div className="text-sm font-medium text-slate-600">Certificates Earned</div>
              </div>
            </div>

            <FraudAlertWidget onNavigate={setActivePage} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setActivePage('my-courses')}
                    className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <div className="font-medium text-blue-900">Continue Learning</div>
                    <div className="text-sm text-blue-700">Access your assigned courses</div>
                  </button>
                  <button
                    onClick={() => setActivePage('my-exams')}
                    className="w-full text-left px-4 py-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                  >
                    <div className="font-medium text-orange-900">Take Assessments</div>
                    <div className="text-sm text-orange-700">Complete your pending tests</div>
                  </button>
                  <button
                    onClick={() => setActivePage('certificates')}
                    className="w-full text-left px-4 py-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                  >
                    <div className="font-medium text-purple-900">View Certificates</div>
                    <div className="text-sm text-purple-700">Download your achievements</div>
                  </button>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl shadow-lg p-6 text-white">
                <h3 className="text-lg font-semibold mb-4">Your Progress</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Course Completion</span>
                      <span>{stats.assignedCourses > 0 ? Math.round((stats.completedCourses / stats.assignedCourses) * 100) : 0}%</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2">
                      <div
                        className="bg-white h-2 rounded-full transition-all"
                        style={{ width: `${stats.assignedCourses > 0 ? (stats.completedCourses / stats.assignedCourses) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/20 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm opacity-90">Completed Courses</span>
                      <span className="font-bold">{stats.completedCourses}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm opacity-90">Certificates</span>
                      <span className="font-bold">{stats.certificates}</span>
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
