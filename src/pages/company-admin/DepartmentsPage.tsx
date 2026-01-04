import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, FolderTree, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Department {
  id: string;
  name: string;
  description: string;
  parent_department_id: string | null;
  employee_count?: number;
}

interface Employee {
  id: string;
  full_name: string;
  email: string;
  departments?: string[];
}

export const DepartmentsPage: React.FC = () => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parent_department_id: ''
  });
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  useEffect(() => {
    loadDepartments();
    loadEmployees();
  }, [user]);

  const loadDepartments = async () => {
    if (!user?.company_id) return;

    const { data } = await supabase
      .from('departments')
      .select(`
        *,
        employee_departments(count)
      `)
      .eq('company_id', user.company_id)
      .order('name');

    if (data) {
      const depsWithCount = data.map(dept => ({
        ...dept,
        employee_count: dept.employee_departments?.[0]?.count || 0
      }));
      setDepartments(depsWithCount);
    }
  };

  const loadEmployees = async () => {
    if (!user?.company_id) return;

    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email
      `)
      .eq('company_id', user.company_id)
      .eq('role', 'EMPLOYEE')
      .order('full_name');

    if (error) {
      console.error('Error loading employees:', error);
      return;
    }

    if (data) {
      const { data: deptAssignments } = await supabase
        .from('employee_departments')
        .select('employee_id, department_id');

      const empsWithDepts = data.map(emp => ({
        ...emp,
        employee_departments: deptAssignments?.filter(ed => ed.employee_id === emp.id) || []
      }));
      setEmployees(empsWithDepts as any);
    }
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedDepartment) {
      await supabase
        .from('departments')
        .update({
          name: formData.name,
          description: formData.description,
          parent_department_id: formData.parent_department_id || null
        })
        .eq('id', selectedDepartment.id);
    } else {
      await supabase
        .from('departments')
        .insert({
          company_id: user?.company_id,
          name: formData.name,
          description: formData.description,
          parent_department_id: formData.parent_department_id || null,
          created_by: user?.id
        });
    }

    setShowDepartmentModal(false);
    setSelectedDepartment(null);
    setFormData({ name: '', description: '', parent_department_id: '' });
    loadDepartments();
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا القسم؟')) return;

    await supabase.from('departments').delete().eq('id', id);
    loadDepartments();
  };

  const handleAssignEmployees = async () => {
    if (!selectedDepartment) return;

    const assignments = selectedEmployees.map(empId => ({
      employee_id: empId,
      department_id: selectedDepartment.id,
      assigned_by: user?.id
    }));

    await supabase.from('employee_departments').insert(assignments);

    setShowAssignModal(false);
    setSelectedEmployees([]);
    setSelectedDepartment(null);
    loadDepartments();
    loadEmployees();
  };

  const handleRemoveFromDepartment = async (empId: string, deptId: string) => {
    await supabase
      .from('employee_departments')
      .delete()
      .eq('employee_id', empId)
      .eq('department_id', deptId);

    loadEmployees();
    loadDepartments();
  };

  const getDepartmentTree = (parentId: string | null = null): Department[] => {
    return departments.filter(d => d.parent_department_id === parentId);
  };

  const renderDepartmentTree = (parentId: string | null = null, level: number = 0) => {
    const depts = getDepartmentTree(parentId);

    return depts.map(dept => (
      <div key={dept.id} style={{ marginLeft: `${level * 2}rem` }}>
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-lg flex items-center justify-center">
                <FolderTree className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{dept.name}</h3>
                <p className="text-sm text-slate-600">{dept.description}</p>
                <p className="text-xs text-slate-500 mt-1">
                  <Users className="h-3 w-3 inline mr-1" />
                  {dept.employee_count} موظف
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedDepartment(dept);
                  setShowAssignModal(true);
                }}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="إضافة موظفين"
              >
                <UserPlus className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  setSelectedDepartment(dept);
                  setFormData({
                    name: dept.name,
                    description: dept.description || '',
                    parent_department_id: dept.parent_department_id || ''
                  });
                  setShowDepartmentModal(true);
                }}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Edit2 className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleDeleteDepartment(dept.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">الموظفين:</h4>
            <div className="flex flex-wrap gap-2">
              {employees
                .filter(emp => emp.employee_departments?.some((ed: any) => ed.department_id === dept.id))
                .map(emp => (
                  <span
                    key={emp.id}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                  >
                    {emp.full_name}
                    <button
                      onClick={() => handleRemoveFromDepartment(emp.id, dept.id)}
                      className="hover:text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
            </div>
          </div>
        </div>

        {renderDepartmentTree(dept.id, level + 1)}
      </div>
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">الأقسام والمجموعات</h1>
          <p className="text-slate-600 mt-2">إدارة أقسام الشركة وتوزيع الموظفين</p>
        </div>
        <button
          onClick={() => {
            setSelectedDepartment(null);
            setFormData({ name: '', description: '', parent_department_id: '' });
            setShowDepartmentModal(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          قسم جديد
        </button>
      </div>

      <div className="bg-slate-50 rounded-lg p-6">
        {departments.length === 0 ? (
          <div className="text-center py-12">
            <FolderTree className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">No departments yet</p>
            <button
              onClick={() => setShowDepartmentModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Create First Department
            </button>
          </div>
        ) : (
          renderDepartmentTree()
        )}
      </div>

      {showDepartmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              {selectedDepartment ? 'تعديل القسم' : 'قسم جديد'}
            </h2>
            <form onSubmit={handleSaveDepartment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  اسم القسم
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  الوصف
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  القسم الأب (اختياري)
                </label>
                <select
                  value={formData.parent_department_id}
                  onChange={(e) => setFormData({ ...formData, parent_department_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">لا يوجد (قسم رئيسي)</option>
                  {departments
                    .filter(d => d.id !== selectedDepartment?.id)
                    .map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  حفظ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDepartmentModal(false);
                    setSelectedDepartment(null);
                  }}
                  className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && selectedDepartment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              إضافة موظفين إلى {selectedDepartment.name}
            </h2>

            <div className="space-y-2 max-h-96 overflow-y-auto mb-6">
              {employees.map(emp => (
                <label
                  key={emp.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedEmployees.includes(emp.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedEmployees([...selectedEmployees, emp.id]);
                      } else {
                        setSelectedEmployees(selectedEmployees.filter(id => id !== emp.id));
                      }
                    }}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <div>
                    <div className="font-medium text-slate-900">{emp.full_name}</div>
                    <div className="text-sm text-slate-600">{emp.email}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAssignEmployees}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                إضافة ({selectedEmployees.length})
              </button>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedEmployees([]);
                  setSelectedDepartment(null);
                }}
                className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
