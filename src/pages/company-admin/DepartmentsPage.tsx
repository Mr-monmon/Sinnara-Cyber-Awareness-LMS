import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  FolderTree,
  UserPlus,
  Eye,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { DepartmentForm } from "./DepartmentForm";
import { DepartmentAssign } from "./DepartmentAssign";
import { Department, Employee } from "../../lib/types";

export const DepartmentsPage: React.FC = () => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [deletingDepartmentId, setDeletingDepartmentId] = useState<
    string | null
  >(null);
  const [removingEmployeeId, setRemovingEmployeeId] = useState<string | null>(
    null
  );
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEmployeesModal, setShowEmployeesModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] =
    useState<Department | null>(null);

  useEffect(() => {
    loadDepartments();
    loadEmployees();
  }, [user]);

  const loadDepartments = async () => {
    if (!user?.company_id) return;

    const { data } = await supabase
      .from("departments")
      .select(
        `
        *,
       users:users!users_department_id_fkey (
        id,
        full_name,
        email,
        department_id
        )
      `
      )
      .eq("company_id", user.company_id)
      .order("name");

    if (data) {
      const depsWithCount = data.map((dept) => ({
        ...dept,
        employee_count: dept.users?.length || 0,
      }));
      setDepartments(depsWithCount);
      setSelectedDepartment((prev) => {
        if (!prev) return null;
        return depsWithCount.find((dept) => dept.id === prev.id) ?? null;
      });
    }
  };

  const loadEmployees = async () => {
    if (!user?.company_id) return;

    const { data, error } = await supabase
      .from("users")
      .select(
        `
        id,
        full_name,
        email,
        department_id
      `
      )
      .eq("company_id", user.company_id)
      .eq("role", "EMPLOYEE")
      .order("full_name");

    if (error) {
      console.error("Error loading employees:", error);
      return;
    }

    if (data) {
      setEmployees(data as Employee[]);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this department?")) return;

    const previousDepartments = departments;
    setDeletingDepartmentId(id);
    setDepartments((prev) => prev.filter((dept) => dept.id !== id));

    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) {
      console.error("Error deleting department:", error);
      setDepartments(previousDepartments);
    }
    await loadDepartments();
    setDeletingDepartmentId(null);
  };

  const handleRemoveFromDepartment = async (empId: string) => {
    setRemovingEmployeeId(empId);
    await supabase
      .from("users")
      .update({ department_id: null })
      .eq("id", empId);
    await loadDepartments();
    await loadEmployees();
    setRemovingEmployeeId(null);
  };

  const getDepartmentTree = (parentId: string | null = null): Department[] => {
    return departments.filter((d) => d.parent_department_id === parentId);
  };

  const renderDepartmentTree = (
    parentId: string | null = null,
    level: number = 0
  ) => {
    const depts = getDepartmentTree(parentId);

    return depts.map((dept) => {
      return (
        <div key={dept.id} style={{ marginLeft: `${level * 2}rem` }}>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-lg flex items-center justify-center">
                  <FolderTree className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {dept.name}
                  </h3>
                  <p className="text-sm text-slate-600">{dept.description}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    <Users className="h-3 w-3 inline mr-1" />
                    {dept.employee_count} Employee
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedDepartment(dept);
                    setShowEmployeesModal(true);
                  }}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="View Employees"
                  aria-label="View Employees"
                >
                  <Eye className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    setSelectedDepartment(dept);
                    setShowAssignModal(true);
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Add Employees"
                >
                  <UserPlus className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    setSelectedDepartment(dept);
                    setShowDepartmentModal(true);
                  }}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Edit2 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDeleteDepartment(dept.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  disabled={deletingDepartmentId === dept.id}
                >
                  {deletingDepartmentId === dept.id ? (
                    <span className="h-5 w-5 inline-flex items-center justify-center">
                      <span className="h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    </span>
                  ) : (
                    <Trash2 className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {renderDepartmentTree(dept.id, level + 1)}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Departments and Groups
          </h1>
          <p className="text-slate-600 mt-2">
            Manage company departments and distribute employees
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedDepartment(null);
            setShowDepartmentModal(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          New Department
        </button>
      </div>

      <div className="bg-slate-50 rounded-lg p-6">
        {departments.length === 0 ? (
          <div className="text-center py-12">
            <FolderTree className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">No departments yet</p>
            <button
              onClick={() => {
                setSelectedDepartment(null);
                setShowDepartmentModal(true);
              }}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Create First Department
            </button>
          </div>
        ) : (
          renderDepartmentTree()
        )}
      </div>

      <DepartmentForm
        isOpen={showDepartmentModal}
        department={selectedDepartment}
        departments={departments}
        companyId={user?.company_id}
        userId={user?.id}
        onClose={() => {
          setShowDepartmentModal(false);
          setSelectedDepartment(null);
        }}
        onSaved={loadDepartments}
      />

      <DepartmentAssign
        isOpen={showAssignModal}
        department={selectedDepartment}
        employees={employees}
        onAssigned={async () => {
          await loadDepartments();
          await loadEmployees();
          setShowAssignModal(false);
          setSelectedDepartment(null);
        }}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedDepartment(null);
        }}
      />

      {showEmployeesModal && selectedDepartment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onClick={() => {
            setShowEmployeesModal(false);
            setSelectedDepartment(null);
          }}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">
                    Department Employees
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">
                    {selectedDepartment.name}
                  </h2>
                  <p className="mt-2 text-sm text-slate-200">
                    {selectedDepartment.employee_count || 0} assigned employee
                    {(selectedDepartment.employee_count || 0) === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowEmployeesModal(false);
                    setSelectedDepartment(null);
                  }}
                  className="rounded-full p-2 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Close employees modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[28rem] overflow-y-auto p-6">
              {selectedDepartment.users && selectedDepartment.users.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedDepartment.users.map((emp) => (
                    <span
                      key={emp.id}
                      className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700"
                    >
                      {emp.full_name}
                      <button
                        onClick={() => handleRemoveFromDepartment(emp.id)}
                        className="inline-flex items-center justify-center rounded-full text-blue-700 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                        disabled={removingEmployeeId === emp.id}
                        aria-label={`Remove ${emp.full_name} from department`}
                      >
                        {removingEmployeeId === emp.id ? (
                          <span className="inline-flex h-4 w-4 items-center justify-center">
                            <span className="h-3 w-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                          </span>
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                  <Users className="mx-auto h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">
                    No employees assigned
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Add employees to this department to see them here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
