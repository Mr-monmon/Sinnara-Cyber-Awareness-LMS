import React, { useState, useEffect } from 'react';
import { Download, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PublicAssessment } from '../../types';

export const PublicSubmissionsPage: React.FC = () => {
  const [submissions, setSubmissions] = useState<PublicAssessment[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    averageScore: 0,
    averagePercentage: 0
  });

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    const { data } = await supabase
      .from('public_assessments')
      .select('*')
      .order('completed_at', { ascending: false });

    if (data) {
      setSubmissions(data);

      const total = data.length;
      const totalScore = data.reduce((sum, s) => sum + s.score, 0);
      const totalQuestions = data.reduce((sum, s) => sum + s.total_questions, 0);

      setStats({
        total,
        averageScore: total > 0 ? Math.round(totalScore / total) : 0,
        averagePercentage: totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0
      });
    }
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Company', 'Job Title', 'Score', 'Total', 'Percentage', 'Date'];
    const rows = submissions.map(s => [
      s.full_name,
      s.email,
      s.phone || '',
      s.company_name || '',
      s.job_title || '',
      s.score,
      s.total_questions,
      `${Math.round((s.score / s.total_questions) * 100)}%`,
      new Date(s.completed_at).toLocaleDateString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `public-assessments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Public Assessment Submissions</h1>
          <p className="text-slate-600">View and analyze visitor test results</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          <Download className="h-5 w-5" />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-blue-50 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{stats.total}</span>
          </div>
          <div className="text-sm font-medium text-slate-600">Total Submissions</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-green-50 rounded-lg">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{stats.averageScore}</span>
          </div>
          <div className="text-sm font-medium text-slate-600">Avg Score (Questions)</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-purple-50 rounded-lg">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{stats.averagePercentage}%</span>
          </div>
          <div className="text-sm font-medium text-slate-600">Avg Percentage</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Job Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Percentage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {submissions.map((submission) => {
                const percentage = Math.round((submission.score / submission.total_questions) * 100);
                return (
                  <tr key={submission.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-slate-900 font-medium">
                      {submission.full_name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {submission.email}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {submission.phone || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {submission.company_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {submission.job_title || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-900">
                      {submission.score}/{submission.total_questions}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        percentage >= 90
                          ? 'bg-green-100 text-green-800'
                          : percentage >= 70
                          ? 'bg-blue-100 text-blue-800'
                          : percentage >= 50
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {percentage}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(submission.completed_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {submissions.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No public assessment submissions yet.
          </div>
        )}
      </div>
    </div>
  );
};
