import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Department, Employee } from "../../lib/types";

type DepartmentAssignProps = {
  isOpen: boolean;
  department: Department | null;
  employees: Employee[];
  onAssigned: () => Promise<void> | void;
  onClose: () => void;
};

export const DepartmentAssign: React.FC<DepartmentAssignProps> = ({
  isOpen,
  department,
  employees,
  onAssigned,
  onClose,
}) => {
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [isAssigningEmployees, setIsAssigningEmployees] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const unassignedEmployees = useMemo(
    () => employees.filter((emp) => emp.department_id === null),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return unassignedEmployees;

    return unassignedEmployees.filter((emp) => {
      const name = emp.full_name?.toLowerCase() ?? "";
      const email = emp.email?.toLowerCase() ?? "";
      return name.includes(normalizedQuery) || email.includes(normalizedQuery);
    });
  }, [searchQuery, unassignedEmployees]);

  useEffect(() => {
    if (isOpen) {
      setSelectedEmployees([]);
      setSearchQuery("");
    }
  }, [isOpen, department?.id]);

  if (!isOpen || !department) {
    return null;
  }

  const handleAssignEmployees = async () => {
    if (selectedEmployees.length === 0) return;

    setIsAssigningEmployees(true);
    await supabase
      .from("users")
      .update({ department_id: department.id })
      .in("id", selectedEmployees);
    setIsAssigningEmployees(false);
    setSelectedEmployees([]);
    await onAssigned();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          Add Employees to {department.name}
        </h2>

        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email"
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Search employees by name or email"
          />
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto mb-6">
          {unassignedEmployees.length === 0 && (
            <div className="text-sm text-slate-600 mb-2">
              No employees available to add to this department.
            </div>
          )}
          {unassignedEmployees.length > 0 && filteredEmployees.length === 0 && (
            <div className="text-sm text-slate-600 mb-2">
              No employees match your search.
            </div>
          )}
          {filteredEmployees.map((emp) => (
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
                    setSelectedEmployees(
                      selectedEmployees.filter((id) => id !== emp.id)
                    );
                  }
                }}
                className="w-5 h-5 text-blue-600 rounded"
              />
              <div>
                <div className="font-medium text-slate-900">
                  {emp.full_name}
                </div>
                <div className="text-sm text-slate-600">{emp.email}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleAssignEmployees}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            disabled={isAssigningEmployees || selectedEmployees.length === 0}
          >
            {isAssigningEmployees ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Adding...
              </span>
            ) : (
              `Add (${selectedEmployees.length})`
            )}
          </button>
          <button
            onClick={() => {
              setSelectedEmployees([]);
              onClose();
            }}
            className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
            disabled={isAssigningEmployees}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
