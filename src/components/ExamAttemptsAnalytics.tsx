import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, TrendingDown, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ExamAttempt {
  result_id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  department_name: string;
  exam_id: string;
  exam_title: string;
  assignment_id: string;
  score: number;
  total_questions: number;
  percentage: number;
  passed: boolean;
  started_at: string;
  completed_at: string;
  attempt_number: number;
  max_attempts: number;
  due_date: string | null;
  company_id: string;
}

interface Props {
  companyId: string;
}

export const ExamAttemptsAnalytics: React.FC<Props> = ({ companyId }) => {
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    loadEmployees();
    loadAttempts();
  }, [companyId, selectedEmployee]);

  const loadEmployees = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('company_id', companyId)
      .eq('role', 'EMPLOYEE')
      .order('full_name');

    if (data) {
      setEmployees(data.map(e => ({ id: e.id, name: e.full_name })));
    }
  };

  const loadAttempts = async () => {
    setLoading(true);

    let query = supabase
      .from('exam_attempts_detail')
      .select('*')
      .eq('company_id', companyId)
      .order('completed_at', { ascending: false });

    if (selectedEmployee !== 'all') {
      query = query.eq('employee_id', selectedEmployee);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading attempts:', error);
    } else {
      setAttempts(data || []);
    }

    setLoading(false);
  };

  const calculateImprovement = (employeeId: string, examId: string) => {
    const employeeAttempts = attempts
      .filter(a => a.employee_id === employeeId && a.exam_id === examId)
      .sort((a, b) => a.attempt_number - b.attempt_number);

    if (employeeAttempts.length < 2) return null;

    const firstAttempt = employeeAttempts[0];
    const lastAttempt = employeeAttempts[employeeAttempts.length - 1];

    return lastAttempt.percentage - firstAttempt.percentage;
  };

  const totalAttempts = attempts.length;
  const passedAttempts = attempts.filter(a => a.passed).length;
  const failedAttempts = attempts.filter(a => !a.passed).length;
  const avgScore = totalAttempts > 0
    ? Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / totalAttempts)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Assessment Progress Tracking</h2>

        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Employees</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Trophy className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{totalAttempts}</span>
          </div>
          <p className="text-sm text-slate-600">Total Attempts</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-3xl font-bold text-green-600">{passedAttempts}</span>
          </div>
          <p className="text-sm text-slate-600">Passed</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-red-50 rounded-lg">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <span className="text-3xl font-bold text-red-600">{failedAttempts}</span>
          </div>
          <p className="text-sm text-slate-600">Failed</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-50 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{avgScore}%</span>
          </div>
          <p className="text-sm text-slate-600">Average Score</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Employee</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Assessment</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Attempt</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Score</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Result</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Improvement</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {attempts.map(attempt => {
                const improvement = calculateImprovement(attempt.employee_id, attempt.exam_id);
                return (
                  <tr key={attempt.result_id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-900">{attempt.employee_name}</p>
                        <p className="text-xs text-slate-500">{attempt.department_name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-900">{attempt.exam_title}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                        {attempt.attempt_number}/{attempt.max_attempts}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="font-bold text-slate-900">{attempt.percentage.toFixed(1)}%</p>
                      <p className="text-xs text-slate-500">{attempt.score}/{attempt.total_questions}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        attempt.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {attempt.passed ? 'Passed' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {improvement !== null ? (
                        <span className={`flex items-center justify-center gap-1 ${
                          improvement > 0 ? 'text-green-600' : improvement < 0 ? 'text-red-600' : 'text-slate-600'
                        }`}>
                          {improvement > 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : improvement < 0 ? (
                            <TrendingDown className="h-4 w-4" />
                          ) : null}
                          {improvement > 0 ? '+' : ''}{improvement.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">First attempt</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(attempt.completed_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {attempts.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              No assessment attempts found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
