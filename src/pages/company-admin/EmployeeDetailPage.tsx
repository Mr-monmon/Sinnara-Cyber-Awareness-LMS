import React, { useState, useEffect } from 'react';
import { ArrowLeft, Award, BookOpen, ClipboardCheck, TrendingUp, Download, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EmployeeDetailPageProps {
  employeeId: string;
  onBack: () => void;
}

interface EmployeeData {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  employee_id: string | null;
  pre_assessment_score: number | null;
  post_assessment_score: number | null;
  pre_assessment_date: string | null;
  post_assessment_date: string | null;
  departments: { name: string }[];
}

interface CourseProgress {
  course_id: string;
  course_name: string;
  progress_percentage: number;
  status: string;
  assigned_at: string;
  completed_at: string | null;
  completed_sections: number;
  total_sections: number;
}

interface ExamAttempt {
  exam_name: string;
  attempt_number: number;
  score: number;
  passed: boolean;
  completed_at: string;
}

interface Certificate {
  id: string;
  course_name: string | null;
  certificate_number: string;
  issue_date: string;
}

export const EmployeeDetailPage: React.FC<EmployeeDetailPageProps> = ({ employeeId, onBack }) => {
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [courses, setCourses] = useState<CourseProgress[]>([]);
  const [exams, setExams] = useState<ExamAttempt[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, [employeeId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadEmployeeData(),
        loadCourseProgress(),
        loadExamHistory(),
        loadCertificates()
      ]);
    } catch (error) {
      console.error('Error loading employee data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeeData = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          employee_departments(
            departments(name)
          )
        `)
        .eq('id', employeeId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setEmployee({
          ...data,
          departments: data.employee_departments?.map((ed: any) => ed.departments).filter(Boolean) || []
        });
      }
    } catch (error) {
      console.error('Error loading employee:', error);
    }
  };

  const loadCourseProgress = async () => {
    try {
      const { data: employeeCourses, error } = await supabase
        .from('employee_courses')
        .select(`
          *,
          courses(title)
        `)
        .eq('employee_id', employeeId);

      if (error) throw error;

      if (employeeCourses && employeeCourses.length > 0) {
        const coursesWithProgress = await Promise.all(
          employeeCourses.map(async (ec: any) => {
            const progress = parseFloat(ec.progress_percentage) || 0;
            const completed = ec.completed_at !== null;

            const { data: sections } = await supabase
              .from('course_sections')
              .select('id')
              .eq('course_id', ec.course_id);

            const totalSections = sections?.length || 0;

            const { data: completedSections } = await supabase
              .from('employee_section_progress')
              .select('section_id')
              .eq('user_id', employeeId)
              .eq('course_id', ec.course_id)
              .eq('completed', true);

            const completedCount = completedSections?.length || 0;

            return {
              course_id: ec.course_id,
              course_name: ec.courses?.title || 'Unknown Course',
              progress_percentage: progress,
              status: progress >= 100 ? 'COMPLETED' : progress > 0 ? 'IN_PROGRESS' : 'NOT_STARTED',
              assigned_at: ec.assigned_at,
              completed_at: ec.completed_at,
              completed_sections: completedCount,
              total_sections: totalSections
            };
          })
        );

        setCourses(coursesWithProgress);
      }
    } catch (error) {
      console.error('Error loading course progress:', error);
    }
  };

  const loadExamHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_results')
        .select(`
          *,
          exams(title, passing_score)
        `)
        .eq('employee_id', employeeId)
        .order('completed_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const examCounts = new Map<string, number>();
        setExams(data.map((result: any) => {
          const examId = result.exam_id;
          const currentCount = examCounts.get(examId) || 0;
          examCounts.set(examId, currentCount + 1);

          return {
            exam_name: result.exams?.title || 'Unknown Exam',
            attempt_number: currentCount + 1,
            score: result.percentage || 0,
            passed: result.passed || false,
            completed_at: result.completed_at
          };
        }));
      }
    } catch (error) {
      console.error('Error loading exam history:', error);
    }
  };

  const loadCertificates = async () => {
    try {
      const { data, error } = await supabase
        .from('issued_certificates')
        .select(`
          *,
          courses(title)
        `)
        .eq('employee_id', employeeId)
        .order('issue_date', { ascending: false });

      if (error) throw error;

      if (data) {
        setCertificates(data.map((cert: any) => ({
          id: cert.id,
          course_name: cert.courses?.title || null,
          certificate_number: cert.certificate_number,
          issue_date: cert.issue_date
        })));
      }
    } catch (error) {
      console.error('Error loading certificates:', error);
    }
  };

  const generateReport = () => {
    if (!employee) return;

    const improvement = employee.pre_assessment_score && employee.post_assessment_score
      ? ((employee.post_assessment_score - employee.pre_assessment_score) / employee.pre_assessment_score * 100).toFixed(1)
      : 'N/A';

    const reportContent = `
=== Employee Progress Report ===
Name: ${employee.full_name}
Email: ${employee.email}
Phone: ${employee.phone || 'N/A'}
Employee ID: ${employee.employee_id || 'N/A'}

=== Assessments ===
Pre-Assessment: ${employee.pre_assessment_score?.toFixed(1) || 'Not completed'}% - ${employee.pre_assessment_date || ''}
Post-Assessment: ${employee.post_assessment_score?.toFixed(1) || 'Not completed'}% - ${employee.post_assessment_date || ''}
Improvement: ${improvement}%

=== Courses (${courses.length}) ===
${courses.map(c => `
- ${c.course_name}
  Progress: ${c.progress_percentage}%
  Status: ${c.status}
  Completed Sections: ${c.completed_sections}/${c.total_sections}
  ${c.completed_at ? `Completed: ${new Date(c.completed_at).toLocaleDateString()}` : ''}
`).join('\n')}

=== Exams (${exams.length}) ===
${exams.map(e => `
- ${e.exam_name} (Attempt #${e.attempt_number})
  Score: ${e.score.toFixed(1)}%
  Result: ${e.passed ? 'PASSED' : 'FAILED'}
  Date: ${new Date(e.completed_at).toLocaleDateString()}
`).join('\n')}

=== Certificates (${certificates.length}) ===
${certificates.map(c => `
- ${c.course_name || 'Certificate'}
  Number: ${c.certificate_number}
  Issued: ${new Date(c.issue_date).toLocaleDateString()}
`).join('\n')}
    `;

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `employee_report_${employee.full_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Employee not found</p>
        <button onClick={onBack} className="mt-4 text-blue-600 hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  const improvement = employee.pre_assessment_score && employee.post_assessment_score
    ? ((employee.post_assessment_score - employee.pre_assessment_score) / employee.pre_assessment_score * 100)
    : 0;

  const completedCourses = courses.filter(c => c.status === 'COMPLETED').length;
  const inProgressCourses = courses.filter(c => c.status === 'IN_PROGRESS').length;
  const avgProgress = courses.length > 0
    ? courses.reduce((sum, c) => sum + c.progress_percentage, 0) / courses.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <button
          onClick={generateReport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="h-5 w-5" />
          Download Report
        </button>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">{employee.full_name}</h1>
        <p className="text-blue-100 mb-1">{employee.email}</p>
        {employee.phone && <p className="text-blue-100 mb-1">{employee.phone}</p>}
        {employee.employee_id && <p className="text-blue-100 mb-4">ID: {employee.employee_id}</p>}
        {employee.departments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {employee.departments.map((dept, idx) => (
              <span key={idx} className="px-3 py-1 bg-white/20 rounded-full text-sm">
                {dept.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Improvement</p>
              <p className="text-2xl font-bold text-slate-900">
                {improvement > 0 ? '+' : ''}{improvement.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Courses</p>
              <p className="text-2xl font-bold text-slate-900">
                {completedCourses}/{courses.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Exams</p>
              <p className="text-2xl font-bold text-slate-900">{exams.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <Award className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Certificates</p>
              <p className="text-2xl font-bold text-slate-900">{certificates.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Assessments</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm text-slate-600">Pre-Assessment</p>
                <p className="text-2xl font-bold text-slate-900">
                  {employee.pre_assessment_score?.toFixed(1) || 'Not completed'}%
                </p>
                {employee.pre_assessment_date && (
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(employee.pre_assessment_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm text-slate-600">Post-Assessment</p>
                <p className="text-2xl font-bold text-slate-900">
                  {employee.post_assessment_score?.toFixed(1) || 'Not completed'}%
                </p>
                {employee.post_assessment_date && (
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(employee.post_assessment_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Progress Summary</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Average Progress</span>
                <span className="font-medium text-slate-900">{avgProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${avgProgress}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{completedCourses}</p>
                <p className="text-xs text-slate-600">Completed</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-amber-600">{inProgressCourses}</p>
                <p className="text-xs text-slate-600">In Progress</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Training Courses</h2>
        {courses.length > 0 ? (
          <div className="space-y-3">
            {courses.map((course) => (
              <div key={course.course_id} className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-900">{course.course_name}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    course.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                    course.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {course.status === 'COMPLETED' ? 'Completed' :
                     course.status === 'IN_PROGRESS' ? 'In Progress' : 'Not Started'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                  <span>{course.completed_sections}/{course.total_sections} sections</span>
                  <span>•</span>
                  <span>{course.progress_percentage}% complete</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 h-2 rounded-full transition-all"
                    style={{ width: `${course.progress_percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-slate-500 py-8">No courses assigned yet</p>
        )}
      </div>

      {exams.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Exam History</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Exam</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Attempt</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Score</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Result</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-sm text-slate-900">{exam.exam_name}</td>
                    <td className="py-3 px-4 text-sm text-center text-slate-600">#{exam.attempt_number}</td>
                    <td className="py-3 px-4 text-sm text-center">
                      <span className="font-semibold text-slate-900">{exam.score.toFixed(1)}%</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        exam.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {exam.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-center text-slate-600">
                      {new Date(exam.completed_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {certificates.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Certificates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certificates.map((cert) => (
              <div key={cert.id} className="p-4 border-2 border-amber-200 bg-amber-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <Award className="h-8 w-8 text-amber-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 mb-1">{cert.course_name || 'Certificate'}</h3>
                    <p className="text-sm text-slate-600 mb-2">Certificate #: {cert.certificate_number}</p>
                    <p className="text-xs text-slate-500">
                      Issued: {new Date(cert.issue_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
