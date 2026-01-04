import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Award } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ExamResult, User as UserType } from '../../types';
import { ExamAttemptsAnalytics } from '../../components/ExamAttemptsAnalytics';

interface EmployeePerformance {
  employee: UserType;
  preScore?: number;
  postScore?: number;
  improvement: number;
  status: string;
  coursesCompleted: number;
  totalCourses: number;
  examsCompleted: number;
  totalExams: number;
}

interface CourseStats {
  totalAssigned: number;
  totalCompleted: number;
  completionRate: number;
  employeesCompleted: any[];
  employeesIncomplete: any[];
}

interface ExamStats {
  totalAttempts: number;
  uniqueEmployees: number;
  passedCount: number;
  failedCount: number;
  passRate: number;
  avgScore: number;
}

export const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const [performance, setPerformance] = useState<EmployeePerformance[]>([]);
  const [courseStats, setCourseStats] = useState<CourseStats | null>(null);
  const [examStats, setExamStats] = useState<ExamStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
    loadCourseStats();
    loadExamStats();
  }, [user]);

  const loadCourseStats = async () => {
    if (!user?.company_id) return;

    try {
      const { data: completions, count: completedCount } = await supabase
        .from('employee_courses')
        .select(`
          id,
          employee_id,
          course_id,
          employee:users!employee_courses_employee_id_fkey(id, full_name, email, department:departments(name)),
          course:courses(id, title)
        `, { count: 'exact' })
        .eq('status', 'COMPLETED');

      const { data: assigned, count: assignedCount } = await supabase
        .from('employee_courses')
        .select('id, employee_id, course_id', { count: 'exact' });

      const completionRate = assignedCount && assignedCount > 0
        ? (completedCount || 0) / assignedCount * 100
        : 0;

      const completedEmployeeIds = [...new Set(completions?.map(c => c.employee_id))];

      const { data: allEmployees } = await supabase
        .from('users')
        .select('id, full_name, email, department:departments(name)')
        .eq('company_id', user.company_id)
        .eq('role', 'EMPLOYEE');

      const incompleteEmployees = allEmployees?.filter(
        emp => !completedEmployeeIds.includes(emp.id)
      ) || [];

      setCourseStats({
        totalAssigned: assignedCount || 0,
        totalCompleted: completedCount || 0,
        completionRate,
        employeesCompleted: completions || [],
        employeesIncomplete: incompleteEmployees
      });
    } catch (error) {
      console.error('Error loading course stats:', error);
    }
  };

  const loadExamStats = async () => {
    if (!user?.company_id) return;

    try {
      const { data: attempts } = await supabase
        .from('exam_results')
        .select('id, employee_id, exam_id, passed, percentage');

      if (!attempts) return;

      const uniqueEmployees = [...new Set(attempts.map(a => a.employee_id))].length;
      const passedCount = attempts.filter(a => a.passed).length;
      const failedCount = attempts.length - passedCount;
      const passRate = attempts.length > 0 ? (passedCount / attempts.length) * 100 : 0;
      const avgScore = attempts.length > 0
        ? attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / attempts.length
        : 0;

      setExamStats({
        totalAttempts: attempts.length,
        uniqueEmployees,
        passedCount,
        failedCount,
        passRate,
        avgScore
      });
    } catch (error) {
      console.error('Error loading exam stats:', error);
    }
  };

  const loadAnalytics = async () => {
    if (!user?.company_id) return;

    try {
      const { data: employees } = await supabase
        .from('users')
        .select('*')
        .eq('company_id', user.company_id)
        .eq('role', 'EMPLOYEE');

      if (!employees) return;

      const { data: preExam } = await supabase
        .from('exams')
        .select('id')
        .eq('exam_type', 'PRE_ASSESSMENT')
        .maybeSingle();

      const { data: postExam } = await supabase
        .from('exams')
        .select('id')
        .eq('exam_type', 'POST_ASSESSMENT')
        .maybeSingle();

      const { data: allCourses } = await supabase
        .from('courses')
        .select('id')
        .eq('company_id', user.company_id);

      const totalCoursesCount = allCourses?.length || 0;

      const { data: allExams } = await supabase
        .from('exams')
        .select('id');

      const totalExamsCount = allExams?.length || 0;

      const performanceData: EmployeePerformance[] = await Promise.all(
        employees.map(async (emp) => {
          let preScore: number | undefined;
          let postScore: number | undefined;

          if (preExam) {
            const { data: preResult } = await supabase
              .from('exam_results')
              .select('percentage')
              .eq('employee_id', emp.id)
              .eq('exam_id', preExam.id)
              .order('completed_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (preResult) preScore = Math.round(preResult.percentage);
          }

          if (postExam) {
            const { data: postResult } = await supabase
              .from('exam_results')
              .select('percentage')
              .eq('employee_id', emp.id)
              .eq('exam_id', postExam.id)
              .order('completed_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (postResult) postScore = Math.round(postResult.percentage);
          }

          const { data: courseProgress } = await supabase
            .from('employee_courses')
            .select('id, completed_at')
            .eq('employee_id', emp.id);

          const coursesCompleted = courseProgress?.filter(cp => cp.completed_at !== null).length || 0;

          const { data: examResults } = await supabase
            .from('exam_results')
            .select('id')
            .eq('employee_id', emp.id);

          const examsCompleted = examResults?.length || 0;

          const improvement = (postScore && preScore) ? postScore - preScore : 0;
          const status = postScore
            ? postScore >= 70
              ? 'Passed'
              : 'Failed'
            : preScore
            ? 'In Progress'
            : 'Not Started';

          return {
            employee: emp,
            preScore,
            postScore,
            improvement,
            status,
            coursesCompleted,
            totalCourses: totalCoursesCount,
            examsCompleted,
            totalExams: totalExamsCount
          };
        })
      );

      setPerformance(performanceData);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const avgImprovement = performance.length > 0
    ? Math.round(performance.reduce((sum, p) => sum + p.improvement, 0) / performance.length)
    : 0;

  const passedCount = performance.filter(p => p.status === 'Passed').length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Analytics & Reports</h1>
        <p className="text-slate-600">Pre/Post assessment comparison and performance tracking</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-green-50 rounded-lg">
              <Award className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{passedCount}</span>
          </div>
          <div className="text-sm font-medium text-slate-600">Employees Passed</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-blue-50 rounded-lg">
              {avgImprovement >= 0 ? (
                <TrendingUp className="h-6 w-6 text-blue-600" />
              ) : (
                <TrendingDown className="h-6 w-6 text-blue-600" />
              )}
            </div>
            <span className="text-3xl font-bold text-slate-900">{avgImprovement > 0 ? '+' : ''}{avgImprovement}%</span>
          </div>
          <div className="text-sm font-medium text-slate-600">Avg Improvement</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-purple-50 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">
              {performance.length > 0 ? Math.round((passedCount / performance.length) * 100) : 0}%
            </span>
          </div>
          <div className="text-sm font-medium text-slate-600">Pass Rate</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Employee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Courses Progress
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Exams Taken
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Pre-Assessment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Post-Assessment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Improvement
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {performance.map((perf) => (
              <tr key={perf.employee.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">
                  {perf.employee.full_name}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-slate-600 mb-1">
                        <span>{perf.coursesCompleted}/{perf.totalCourses}</span>
                        <span>{perf.totalCourses > 0 ? Math.round((perf.coursesCompleted / perf.totalCourses) * 100) : 0}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${perf.totalCourses > 0 ? (perf.coursesCompleted / perf.totalCourses) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600">
                  <span className="px-2 py-1 bg-slate-100 rounded-full text-sm">
                    {perf.examsCompleted}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {perf.preScore !== undefined ? `${perf.preScore}%` : '-'}
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {perf.postScore !== undefined ? `${perf.postScore}%` : '-'}
                </td>
                <td className="px-6 py-4">
                  {perf.improvement !== 0 ? (
                    <span className={`inline-flex items-center gap-1 ${
                      perf.improvement > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {perf.improvement > 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {perf.improvement > 0 ? '+' : ''}{perf.improvement}%
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    perf.status === 'Passed'
                      ? 'bg-green-100 text-green-800'
                      : perf.status === 'Failed'
                      ? 'bg-red-100 text-red-800'
                      : perf.status === 'In Progress'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}>
                    {perf.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {performance.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No employee data available yet.
          </div>
        )}
      </div>

      {courseStats && (
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-xl font-bold mb-4">Course Completion Statistics</h3>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-600">Total Assigned</p>
              <p className="text-3xl font-bold text-blue-900">{courseStats.totalAssigned}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600">Completed</p>
              <p className="text-3xl font-bold text-green-900">{courseStats.totalCompleted}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600">Completion Rate</p>
              <p className="text-3xl font-bold text-purple-900">{courseStats.completionRate.toFixed(1)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2 text-green-700">
                Completed Employees ({courseStats.employeesCompleted.length})
              </h4>
              <div className="max-h-48 overflow-y-auto border rounded p-2 bg-slate-50">
                {courseStats.employeesCompleted.map((comp: any) => (
                  <div key={comp.id} className="py-1 text-sm">
                    {comp.employee?.full_name} - {comp.course?.title}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-red-700">
                Incomplete Employees ({courseStats.employeesIncomplete.length})
              </h4>
              <div className="max-h-48 overflow-y-auto border rounded p-2 bg-slate-50">
                {courseStats.employeesIncomplete.map((emp: any) => (
                  <div key={emp.id} className="py-1 text-sm">
                    {emp.full_name} - {emp.department?.name || 'No Dept'}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {examStats && (
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-xl font-bold mb-4">Exam Performance Statistics</h3>

          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600">Total Attempts</p>
              <p className="text-3xl font-bold">{examStats.totalAttempts}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-600">Employees Tested</p>
              <p className="text-3xl font-bold text-blue-900">{examStats.uniqueEmployees}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600">Pass Rate</p>
              <p className="text-3xl font-bold text-green-900">{examStats.passRate.toFixed(1)}%</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600">Avg Score</p>
              <p className="text-3xl font-bold text-purple-900">{examStats.avgScore.toFixed(1)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <p className="text-sm text-green-600 mb-2">Passed</p>
              <p className="text-4xl font-bold text-green-900">{examStats.passedCount}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg text-center">
              <p className="text-sm text-red-600 mb-2">Failed</p>
              <p className="text-4xl font-bold text-red-900">{examStats.failedCount}</p>
            </div>
          </div>
        </div>
      )}

      {user?.company_id && (
        <div className="mt-8">
          <ExamAttemptsAnalytics companyId={user.company_id} />
        </div>
      )}
    </div>
  );
};
