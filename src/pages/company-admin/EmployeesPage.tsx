import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, User, Eye, Key } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { User as UserType } from '../../types';

interface EmployeesPageProps {
  onViewEmployee?: (employeeId: string) => void;
}

interface Department {
  id: string;
  name: string;
}

export const EmployeesPage: React.FC<EmployeesPageProps> = ({ onViewEmployee }) => {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<UserType | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    employee_id: '',
    password: 'employee123',
    department_id: ''
  });

  useEffect(() => {
    loadEmployees();
    loadDepartments();
  }, [currentUser]);

  const loadEmployees = async () => {
    if (!currentUser?.company_id) return;

    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('company_id', currentUser.company_id)
      .eq('role', 'EMPLOYEE')
      .order('created_at', { ascending: false });

    if (data) setEmployees(data);
  };

  const loadDepartments = async () => {
    if (!currentUser?.company_id) return;

    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('company_id', currentUser.company_id)
      .order('name');

    if (data) setDepartments(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingEmployee) {
        await supabase
          .from('users')
          .update(formData)
          .eq('id', editingEmployee.id);
      } else {
        await supabase
          .from('users')
          .insert([{
            ...formData,
            role: 'EMPLOYEE',
            company_id: currentUser?.company_id
          }]);
      }

      setShowModal(false);
      setEditingEmployee(null);
      setFormData({ full_name: '', email: '', phone: '', employee_id: '', password: 'employee123', department_id: '' });
      loadEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
      alert('Failed to save employee');
    }
  };

  const handleEdit = (employee: UserType) => {
    setEditingEmployee(employee);
    setFormData({
      full_name: employee.full_name,
      email: employee.email,
      phone: employee.phone || '',
      employee_id: employee.employee_id || '',
      password: 'employee123',
      department_id: employee.department_id || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;

    try {
      await supabase.from('users').delete().eq('id', id);
      loadEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Failed to delete employee');
    }
  };

  const handleResetPassword = async (employee: UserType) => {
    if (!confirm(`Reset password for ${employee.full_name} to default (Employee123!)?`)) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ password: 'Employee123!' })
        .eq('id', employee.id);

      if (error) throw error;

      alert(`Password reset successfully!\nEmail: ${employee.email}\nNew Password: Employee123!`);
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Failed to reset password');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Employees</h1>
          <p className="text-slate-600">Manage employee accounts and access</p>
        </div>
        <button
          onClick={() => {
            setEditingEmployee(null);
            setFormData({ full_name: '', email: '', phone: '', employee_id: '', password: 'employee123', department_id: '' });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Employee
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Employee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Employee ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {employees.map((employee) => (
              <tr key={employee.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="font-medium text-slate-900">{employee.full_name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600">{employee.email}</td>
                <td className="px-6 py-4 text-slate-600">{employee.employee_id || '-'}</td>
                <td className="px-6 py-4 text-slate-600">{employee.phone || '-'}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {onViewEmployee && (
                      <button
                        onClick={() => onViewEmployee(employee.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleResetPassword(employee)}
                      className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                      title="Reset Password"
                    >
                      <Key className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(employee)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Employee"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(employee.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Employee"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {employees.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No employees yet. Click "Add Employee" to get started.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Employee ID
                </label>
                <input
                  type="text"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Department
                </label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Assign to department to automatically enroll in department courses
                </p>
              </div>

              {!editingEmployee && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Password *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingEmployee(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingEmployee ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
