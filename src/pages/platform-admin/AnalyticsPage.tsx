import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Building2, BookOpen, Target, Award, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AnalyticsData {
  totalCompanies: number;
  activeCompanies: number;
  totalUsers: number;
  totalEmployees: number;
  totalCourses: number;
  completedCourses: number;
  totalExams: number;
  passedExams: number;
  averageScore: number;
  platformUsage: number;
}

interface CompanyStats {
  company_id: string;
  company_name: string;
  employees: number;
  completed_courses: number;
  completed_exams: number;
  average_score: number;
}

export const AnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalCompanies: 0,
    activeCompanies: 0,
    totalUsers: 0,
    totalEmployees: 0,
    totalCourses: 0,
    completedCourses: 0,
    totalExams: 0,
    passedExams: 0,
    averageScore: 0,
    platformUsage: 0
  });
  const [companyStats, setCompanyStats] = useState<CompanyStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [
        companiesRes,
        usersRes,
        coursesRes,
        employeeCoursesRes,
        examsRes,
        examResultsRes
      ] = await Promise.all([
        supabase.from('companies').select('*'),
        supabase.from('users').select('*'),
        supabase.from('courses').select('*'),
        supabase.from('employee_courses').select('*'),
        supabase.from('exams').select('*'),
        supabase.from('exam_results').select('*')
      ]);

      const companies = companiesRes.data || [];
      const users = usersRes.data || [];
      const courses = coursesRes.data || [];
      const employeeCourses = employeeCoursesRes.data || [];
      const exams = examsRes.data || [];
      const examResults = examResultsRes.data || [];

      const activeCompanies = companies.filter(c => (c as any).is_active !== false).length;
      const employees = users.filter(u => u.role === 'EMPLOYEE');
      const completedCourses = employeeCourses.filter(ec => ec.status === 'COMPLETED').length;
      const passedExams = examResults.filter(er => er.passed).length;
      const avgScore = examResults.length > 0
        ? examResults.reduce((sum, er) => sum + (er.score || 0), 0) / examResults.length
        : 0;

      setAnalytics({
        totalCompanies: companies.length,
        activeCompanies,
        totalUsers: users.length,
        totalEmployees: employees.length,
        totalCourses: courses.length,
        completedCourses,
        totalExams: exams.length,
        passedExams,
        averageScore: Math.round(avgScore),
        platformUsage: employeeCourses.length + examResults.length
      });

      const statsMap = new Map<string, CompanyStats>();

      companies.forEach(company => {
        statsMap.set(company.id, {
          company_id: company.id,
          company_name: company.name,
          employees: 0,
          completed_courses: 0,
          completed_exams: 0,
          average_score: 0
        });
      });

      employees.forEach(emp => {
        if (emp.company_id && statsMap.has(emp.company_id)) {
          const stats = statsMap.get(emp.company_id)!;
          stats.employees++;
        }
      });

      employeeCourses.forEach(ec => {
        const employee = users.find(u => u.id === ec.employee_id);
        if (employee?.company_id && statsMap.has(employee.company_id) && ec.status === 'COMPLETED') {
          const stats = statsMap.get(employee.company_id)!;
          stats.completed_courses++;
        }
      });

      const companyExamScores = new Map<string, number[]>();
      examResults.forEach(er => {
        const employee = users.find(u => u.id === er.employee_id);
        if (employee?.company_id && statsMap.has(employee.company_id)) {
          const stats = statsMap.get(employee.company_id)!;
          if (er.passed) stats.completed_exams++;

          if (!companyExamScores.has(employee.company_id)) {
            companyExamScores.set(employee.company_id, []);
          }
          companyExamScores.get(employee.company_id)!.push(er.score || 0);
        }
      });

      companyExamScores.forEach((scores, companyId) => {
        if (statsMap.has(companyId) && scores.length > 0) {
          const stats = statsMap.get(companyId)!;
          stats.average_score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        }
      });

      setCompanyStats(Array.from(statsMap.values()).sort((a, b) => b.employees - a.employees));
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAwarenessLevel = (score: number) => {
    if (score >= 90) return { label: 'ممتاز', color: 'text-green-600', bg: 'bg-green-100' };
    if (score >= 70) return { label: 'جيد', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (score >= 50) return { label: 'متوسط', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { label: 'ضعيف', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const awarenessLevel = getAwarenessLevel(analytics.averageScore);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">التحليلات والتقارير</h1>
        <p className="text-slate-600">نظرة شاملة على أداء المنصة ومستوى الوعي</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{analytics.totalCompanies}</span>
          </div>
          <div className="text-sm font-medium text-slate-600">إجمالي الشركات</div>
          <div className="mt-2 text-xs text-slate-500">
            {analytics.activeCompanies} نشطة
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{analytics.totalEmployees}</span>
          </div>
          <div className="text-sm font-medium text-slate-600">إجمالي الموظفين</div>
          <div className="mt-2 text-xs text-slate-500">
            {analytics.totalUsers} مستخدم كلي
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <BookOpen className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{analytics.completedCourses}</span>
          </div>
          <div className="text-sm font-medium text-slate-600">دورات مكتملة</div>
          <div className="mt-2 text-xs text-slate-500">
            من أصل {analytics.totalCourses} دورة
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <Award className="h-6 w-6 text-orange-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{analytics.passedExams}</span>
          </div>
          <div className="text-sm font-medium text-slate-600">اختبارات ناجحة</div>
          <div className="mt-2 text-xs text-slate-500">
            من أصل {analytics.totalExams} اختبار
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">مستوى الوعي العام</h3>
            <Target className="h-8 w-8 opacity-80" />
          </div>

          <div className="mb-6">
            <div className="flex items-end gap-3 mb-3">
              <span className="text-5xl font-bold">{analytics.averageScore}%</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${awarenessLevel.bg} ${awarenessLevel.color}`}>
                {awarenessLevel.label}
              </span>
            </div>
            <p className="text-blue-100 text-sm">متوسط درجات جميع الاختبارات</p>
          </div>

          <div className="w-full bg-white/20 rounded-full h-3">
            <div
              className="bg-white h-3 rounded-full transition-all duration-500"
              style={{ width: `${analytics.averageScore}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">استخدام المنصة</h3>
            <Activity className="h-6 w-6 text-slate-400" />
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">إكمال الدورات</span>
                <span className="font-medium text-slate-900">
                  {analytics.totalCourses > 0
                    ? Math.round((analytics.completedCourses / analytics.totalCourses) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${analytics.totalCourses > 0
                      ? (analytics.completedCourses / analytics.totalCourses) * 100
                      : 0}%`
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">نجاح الاختبارات</span>
                <span className="font-medium text-slate-900">
                  {analytics.totalExams > 0
                    ? Math.round((analytics.passedExams / analytics.totalExams) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${analytics.totalExams > 0
                      ? (analytics.passedExams / analytics.totalExams) * 100
                      : 0}%`
                  }}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">إجمالي النشاطات</span>
                <span className="text-2xl font-bold text-slate-900">{analytics.platformUsage}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900">إحصائيات الشركات</h3>
          <BarChart3 className="h-6 w-6 text-slate-400" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase">الشركة</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase">الموظفين</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase">دورات مكتملة</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase">اختبارات ناجحة</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase">المتوسط</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase">مستوى الوعي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {companyStats.map((stat) => {
                const level = getAwarenessLevel(stat.average_score);
                return (
                  <tr key={stat.company_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 font-medium text-slate-900">{stat.company_name}</td>
                    <td className="px-4 py-4 text-slate-600">{stat.employees}</td>
                    <td className="px-4 py-4 text-slate-600">{stat.completed_courses}</td>
                    <td className="px-4 py-4 text-slate-600">{stat.completed_exams}</td>
                    <td className="px-4 py-4">
                      <span className="font-medium text-slate-900">{stat.average_score}%</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${level.bg} ${level.color}`}>
                        {level.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {companyStats.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              No data available
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <TrendingUp className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">ملخص الأداء</h4>
            <p className="text-sm text-blue-800 leading-relaxed">
              تشير البيانات إلى أن المنصة تحتوي على <strong>{analytics.totalCompanies}</strong> شركة
              مع <strong>{analytics.totalEmployees}</strong> موظف نشط.
              تم إكمال <strong>{analytics.completedCourses}</strong> دورة تدريبية
              وإجراء <strong>{analytics.passedExams}</strong> اختبار ناجح.
              مستوى الوعي العام للمنصة هو <strong>{analytics.averageScore}%</strong> وهو مستوى <strong>{awarenessLevel.label}</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
