import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Department } from "../../lib/types";

interface DepartmentFormProps {
  isOpen: boolean;
  department: Department | null;
  departments: Department[];
  companyId?: string;
  userId?: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export const DepartmentForm: React.FC<DepartmentFormProps> = ({
  isOpen,
  department,
  departments,
  companyId,
  userId,
  onClose,
  onSaved,
}) => {
  const [isSavingDepartment, setIsSavingDepartment] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    parent_department_id: "",
  });

  useEffect(() => {
    if (!isOpen) return;
    setFormData({
      name: department?.name ?? "",
      description: department?.description ?? "",
      parent_department_id: department?.parent_department_id ?? "",
    });
  }, [department, isOpen]);

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    setIsSavingDepartment(true);
    if (department) {
      await supabase
        .from("departments")
        .update({
          name: formData.name,
          description: formData.description,
          parent_department_id: formData.parent_department_id || null,
        })
        .eq("id", department.id);
    } else {
      await supabase.from("departments").insert({
        company_id: companyId,
        name: formData.name,
        description: formData.description,
        parent_department_id: formData.parent_department_id || null,
        created_by: userId,
      });
    }

    await onSaved();
    setIsSavingDepartment(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          {department ? "Edit Department" : "New Department"}
        </h2>
        <form onSubmit={handleSaveDepartment} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Department Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Parent Department (Optional)
            </label>
            <select
              value={formData.parent_department_id}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  parent_department_id: e.target.value,
                })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">None (Main Department)</option>
              {departments
                .filter((dept) => dept.id !== department?.id)
                .map((dept) => (
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
              disabled={isSavingDepartment}
            >
              {isSavingDepartment ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
              disabled={isSavingDepartment}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
