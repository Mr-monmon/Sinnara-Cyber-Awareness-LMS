import React, { useState, useEffect } from 'react';
import { Send, Calendar, Users, ClipboardList, History, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Exam {
  id: string;
  title: string;
  description: string;
  passing_score: number;
}

interface Employee {
  id: string;
  full_name: string;
  email: string;
}

interface Department {
  id: string;
  name: string;
}

interface AssignedExam {
  id: string;
  exams?: { title: string };
  assigned_to_employee: { full_name: string } | null;
  assigned_to_department: { name: string } | null;
  due_date: string | null;
  max_attempts: number;
  status: string;
  assigned_at: string;
}

export const ExamAssignmentPage: React.FC = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<AssignedExam[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    exam_id: '',
    assignment_type: 'employee',
    target_id: '',
    due_date: '',
    max_attempts: 1,
    is_mandatory: true
  });

  useEffect(() => {
    loadExams();
    loadEmployees();
    loadDepartments();
    loadAssignments();
  }, [user]);

  const loadExams = async () => {
    const { data } = await supabase
      .from('exams')
      .select('*')
      .order('title');
    if (data) setExams(data);
  };

  const loadEmployees = async () => {
    if (!user?.company_id) return;
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('company_id', user.company_id)
      .eq('role', 'EMPLOYEE')
      .order('full_name');
    if (data) setEmployees(data);
  };

  const loadDepartments = async () => {
    if (!user?.company_id) return;
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('company_id', user.company_id)
      .order('name');
    if (data) setDepartments(data);
  };

  const loadAssignments = async () => {
    if (!user?.company_id) {
      console.log('No company_id found:', user);
      return;
    }

    console.log('Loading assignments for company:', user.company_id);

    const { data: rawData, error } = await supabase
      .from('assigned_exams')
      .select('*')
      .eq('company_id', user.company_id)
      .not('status', 'in', '(withdrawn)')
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('Error loading assignments:', error);
      setError('Failed to load assignments: ' + error.message);
      return;
    }

    console.log('Loaded raw assignments:', rawData);

    if (!rawData || rawData.length === 0) {
      console.log('No assignments found');
      setAssignments([]);
      return;
    }

    const examIds = [...new Set(rawData.map(a => a.exam_id))];
    const employeeIds = [...new Set(rawData.map(a => a.assigned_to_employee).filter(Boolean))];
    const departmentIds = [...new Set(rawData.map(a => a.assigned_to_department).filter(Boolean))];

    const [examsRes, usersRes, deptsRes, resultsRes] = await Promise.all([
      supabase.from('exams').select('id, title').in('id', examIds),
      employeeIds.length > 0 ? supabase.from('users').select('id, full_name').in('id', employeeIds) : Promise.resolve({ data: [] }),
      departmentIds.length > 0 ? supabase.from('departments').select('id, name').in('id', departmentIds) : Promise.resolve({ data: [] }),
      supabase.from('exam_results').select('assignment_id, employee_id, passed').eq('passed', true)
    ]);

    const examsMap = new Map((examsRes.data || []).map(e => [e.id, e]));
    const usersMap = new Map((usersRes.data || []).map(u => [u.id, u]));
    const deptsMap = new Map((deptsRes.data || []).map(d => [d.id, d]));

    const passedAssignmentIds = new Set((resultsRes.data || []).map(r => r.assignment_id));

    const enrichedAssignments = await Promise.all(rawData.map(async assignment => {
      let actualStatus = assignment.status;

      const isCompleted = passedAssignmentIds.has(assignment.id);

      if (isCompleted && actualStatus === 'active') {
        actualStatus = 'completed';
        await supabase
          .from('assigned_exams')
          .update({ status: 'completed' })
          .eq('id', assignment.id);
      }

      return {
        ...assignment,
        status: actualStatus,
        exams: examsMap.get(assignment.exam_id) || null,
        assigned_to_employee: assignment.assigned_to_employee
          ? usersMap.get(assignment.assigned_to_employee) || null
          : null,
        assigned_to_department: assignment.assigned_to_department
          ? deptsMap.get(assignment.assigned_to_department) || null
          : null
      };
    }));

    console.log('Enriched assignments:', enrichedAssignments);
    setAssignments(enrichedAssignments as any);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const assignment: any = {
      exam_id: formData.exam_id,
      company_id: user?.company_id,
      assigned_by: user?.id,
      due_date: formData.due_date || null,
      max_attempts: formData.max_attempts,
      is_mandatory: formData.is_mandatory,
      status: 'active'
    };

    if (formData.assignment_type === 'employee') {
      assignment.assigned_to_employee = formData.target_id;
    } else {
      assignment.assigned_to_department = formData.target_id;
    }

    const { error: insertError } = await supabase.from('assigned_exams').insert(assignment);

    if (insertError) {
      console.error('Error assigning exam:', insertError);

      if (insertError.code === '23505') {
        setError('This exam is already assigned to the selected employee/department. Check existing assignments.');
      } else {
        setError('Failed to assign exam: ' + insertError.message);
      }
      return;
    }

    setShowModal(false);
    setError(null);
    setFormData({
      exam_id: '',
      assignment_type: 'employee',
      target_id: '',
      due_date: '',
      max_attempts: 1,
      is_mandatory: true
    });
    loadAssignments();
  };

  const handleWithdrawAssignment = async (assignmentId: string, examTitle: string, targetName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to withdraw "${examTitle}" from ${targetName}?\n\n` +
      'The exam will no longer be visible to the assigned employee(s), but all attempt history will be preserved.'
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from('assigned_exams')
      .update({
        status: 'withdrawn',
        withdrawn_at: new Date().toISOString(),
        withdrawn_by: user?.id
      })
      .eq('id', assignmentId);

    if (error) {
      setError('Error withdrawing assignment: ' + error.message);
      return;
    }

    loadAssignments();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Exam Assignment</h1>
          <p className="text-slate-600 mt-2">Assign exams to employees and departments</p>
        </div>
        <button
          onClick={() => {
            setShowModal(true);
            setError(null);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Send className="h-5 w-5" />
          Assign Exam
        </button>
      </div>

      {error && !showModal && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <ClipboardList className="h-8 w-8" />
            <div>
              <p className="text-blue-100 text-sm">Active Exams</p>
              <p className="text-3xl font-bold">
                {assignments.filter(a => a.status === 'active').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-8 w-8" />
            <div>
              <p className="text-green-100 text-sm">Completed</p>
              <p className="text-3xl font-bold">
                {assignments.filter(a => a.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="h-8 w-8" />
            <div>
              <p className="text-amber-100 text-sm">Expired</p>
              <p className="text-3xl font-bold">
                {assignments.filter(a => a.status === 'expired').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Assigned Exams</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-700">Exam</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-700">Assigned To</th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-slate-700">Attempts</th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-slate-700">Due Date</th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-slate-700">Status</th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-slate-700">Assigned At</th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {assignments.map((assignment) => (
                <tr key={assignment.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-slate-900">{assignment.exams?.title || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {assignment.assigned_to_employee && assignment.assigned_to_employee.full_name ? (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="text-slate-700">{assignment.assigned_to_employee.full_name}</span>
                      </div>
                    ) : assignment.assigned_to_department && assignment.assigned_to_department.name ? (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <Users className="h-4 w-4 text-purple-600" />
                        </div>
                        <span className="text-slate-700">Dept: {assignment.assigned_to_department.name}</span>
                      </div>
                    ) : (
                      <span className="text-slate-500">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                      {assignment.max_attempts} {assignment.max_attempts === 1 ? 'attempt' : 'attempts'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-slate-600">
                    {assignment.due_date
                      ? new Date(assignment.due_date).toLocaleDateString()
                      : 'Not set'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      assignment.status === 'active' ? 'bg-blue-100 text-blue-700' :
                      assignment.status === 'completed' ? 'bg-green-100 text-green-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {assignment.status === 'active' ? 'Active' :
                       assignment.status === 'completed' ? 'Completed' : 'Expired'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-slate-600">
                    {new Date(assignment.assigned_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {assignment.status === 'active' && (
                      <button
                        onClick={() => {
                          const targetName = assignment.assigned_to_employee?.full_name
                            ? assignment.assigned_to_employee.full_name
                            : `Dept: ${assignment.assigned_to_department?.name || 'Unknown'}`;
                          handleWithdrawAssignment(
                            assignment.id,
                            assignment.exams?.title || 'Unknown Exam',
                            targetName
                          );
                        }}
                        className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                      >
                        Withdraw
                      </button>
                    )}
                    {assignment.status !== 'active' && (
                      <span className="text-slate-400 text-sm">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {assignments.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              No exams assigned yet
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Assign New Exam</h2>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Exam
                </label>
                <select
                  value={formData.exam_id}
                  onChange={(e) => setFormData({ ...formData, exam_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select exam</option>
                  {exams.map(exam => (
                    <option key={exam.id} value={exam.id}>{exam.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Assignment Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="employee"
                      checked={formData.assignment_type === 'employee'}
                      onChange={(e) => setFormData({ ...formData, assignment_type: e.target.value, target_id: '' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-slate-700">Individual Employee</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="department"
                      checked={formData.assignment_type === 'department'}
                      onChange={(e) => setFormData({ ...formData, assignment_type: e.target.value, target_id: '' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-slate-700">Entire Department</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {formData.assignment_type === 'employee' ? 'Select Employee' : 'Select Department'}
                </label>
                <select
                  value={formData.target_id}
                  onChange={(e) => setFormData({ ...formData, target_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select...</option>
                  {formData.assignment_type === 'employee' ? (
                    employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.email})</option>
                    ))
                  ) : (
                    departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Max Attempts Allowed
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.max_attempts}
                  onChange={(e) => setFormData({ ...formData, max_attempts: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_mandatory}
                    onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Mandatory Exam</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Assign
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError(null);
                  }}
                  className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
