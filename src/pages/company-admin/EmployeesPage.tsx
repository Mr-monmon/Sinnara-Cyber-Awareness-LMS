import React, { useState, useEffect, useRef } from "react";
import { Plus, Edit2, Trash2, User, Eye, Key, Upload } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { User as UserType } from "../../lib/types";
import { buildSameHostRedirectUrl } from "../../lib/browserTenant";
import { sendNotificationEmail } from "../../lib/email";

interface EmployeesPageProps {
  onViewEmployee?: (employeeId: string) => void;
}

interface Department {
  id: string;
  name: string;
}

type BulkCreateResult = {
  email: string;
  success: boolean;
};

type BulkCreateResponse = {
  succeeded?: number;
  failed?: number;
  results?: BulkCreateResult[];
};

export const EmployeesPage: React.FC<EmployeesPageProps> = ({
  onViewEmployee,
}) => {
  const { user: currentUser } = useAuth();
  const loginUrl = buildSameHostRedirectUrl(window.location.href, "/login");
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<UserType | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadSummary, setUploadSummary] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    employee_id: "",
    password: "employee123",
    department_id: "",
  });

  useEffect(() => {
    loadEmployees();
    loadDepartments();
  }, [currentUser]);

  const loadEmployees = async () => {
    if (!currentUser?.company_id) return;

    const { data } = await supabase
      .from("users")
      .select("* , department:departments!users_department_id_fkey ( name )")
      .eq("company_id", currentUser.company_id)
      .eq("role", "EMPLOYEE")
      .order("created_at", { ascending: false });

    if (data) setEmployees(data);
  };

  const loadDepartments = async () => {
    if (!currentUser?.company_id) return;

    const { data } = await supabase
      .from("departments")
      .select("id, name")
      .eq("company_id", currentUser.company_id)
      .order("name");

    if (data) setDepartments(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingEmployee) {
        const profileData = {
          full_name: formData.full_name,
          phone: formData.phone,
          employee_id: formData.employee_id,
          department_id: formData.department_id,
        };
        await supabase
          .from("users")
          .update(profileData)
          .eq("id", editingEmployee.id);
      } else {
        const { data: createResult, error: createError } =
          await supabase.functions.invoke("user-admin", {
            body: {
              action: "createUser",
              email: formData.email,
              password: formData.password,
              full_name: formData.full_name,
              phone: formData.phone || null,
              employee_id: formData.employee_id || null,
              role: "EMPLOYEE",
              company_id: currentUser?.company_id,
              department_id: formData.department_id || null,
            },
          });

        if (createError || !createResult?.success)
          throw new Error(createResult?.error || "Failed to create employee");

        try {
          await sendNotificationEmail(
            formData.email,
            formData.full_name,
            "Welcome to Awareone",
            "Welcome aboard",
            "Your account has been created. Use the credentials below to sign in.",
            {
              loginUrl,
              credentials: {
                email: formData.email,
                password: formData.password,
                role: "Employee",
              },
              showSecurityNote: true,
            }
          );
        } catch (emailErr) {
          console.warn("Welcome email could not be sent:", emailErr);
        }
      }

      setShowModal(false);
      setEditingEmployee(null);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        employee_id: "",
        password: "employee123",
        department_id: "",
      });
      loadEmployees();
    } catch (error) {
      console.error("Error saving employee:", error);
      alert("Failed to save employee");
    }
  };

  const handleEdit = (employee: UserType) => {
    setEditingEmployee(employee);
    setFormData({
      full_name: employee.full_name,
      email: employee.email,
      phone: employee.phone || "",
      employee_id: employee.employee_id || "",
      password: "employee123",
      department_id: employee.department_id || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string, email: string, fullName: string) => {
    if (!confirm("Are you sure you want to delete this employee?")) return;

    try {
      const { data: delResult, error: delError } =
        await supabase.functions.invoke("user-admin", {
          body: { action: "deleteUser", userId: id },
        });
      if (delError || !delResult?.success)
        throw new Error(delResult?.error || "Failed to delete employee");

      try {
        await sendNotificationEmail(
          email,
          fullName,
          "Your account has been removed",
          "Account Removed",
          "Your account on Awareone has been removed. If you believe this was a mistake, please reach out to your organization's administrator."
        );
      } catch (emailErr) {
        console.warn("Account deletion email could not be sent:", emailErr);
      }
      loadEmployees();
    } catch (error) {
      console.error("Error deleting employee:", error);
      alert("Failed to delete employee");
    }
  };

  const handleResetPassword = async (employee: UserType) => {
    if (
      !confirm(
        `Reset password for ${employee.full_name} to default (employee123)?`
      )
    )
      return;

    try {
      const { data: resetResult, error: resetError } =
        await supabase.functions.invoke("user-admin", {
          body: {
            action: "resetPassword",
            userId: employee.id,
            password: "employee123",
          },
        });

      if (resetError || !resetResult?.success)
        throw new Error(resetResult?.error || "Failed to reset password");

      alert(
        `Password reset successfully!\nEmail: ${employee.email}\nNew Password: employee123`
      );

      try {
        await sendNotificationEmail(
          employee.email,
          employee.full_name,
          "Your password has been reset",
          "Password Reset",
          "Your password has been reset to the default password. Please sign in and change your password as soon as possible.",
          { loginUrl }
        );
      } catch (emailErr) {
        console.warn("Password reset email could not be sent:", emailErr);
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      alert("Failed to reset password");
    }
  };

  const parseCSVLine = (line: string) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
        continue;
      }

      current += char;
    }

    values.push(current);
    return values;
  };

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const uploadCSV = async (file?: File) => {
    if (!currentUser?.company_id) {
      setUploadError("Missing company context. Please refresh and try again.");
      setUploadSummary("");
      return;
    }

    if (!file) {
      setUploadError("Please select a CSV file to upload.");
      setUploadSummary("");
      return;
    }

    if (
      !file.name.toLowerCase().endsWith(".csv") &&
      !file.type.includes("csv")
    ) {
      setUploadError(
        "Selected file is not a CSV. Please upload a valid .csv file."
      );
      setUploadSummary("");
      return;
    }

    setUploadError("");
    setUploadSummary("");
    setIsUploading(true);

    try {
      const content = await file.text();
      const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");

      if (lines.length < 2) {
        setUploadError(
          "CSV file must include a header row and at least one data row."
        );
        return;
      }

      const requiredHeaders = [
        "full name",
        "email",
        "employee id",
        "phone",
        "department",
        "password",
      ];
      const headers = parseCSVLine(lines[0]).map((header) =>
        header.trim().toLowerCase()
      );
      const headersMatch =
        headers.length === requiredHeaders.length &&
        requiredHeaders.every(
          (requiredHeader, index) => headers[index] === requiredHeader
        );

      if (!headersMatch) {
        setUploadError(
          "CSV headers are invalid. Required columns: full name, email, employee id, phone, department, password."
        );
        return;
      }

      const departmentLookup = new Map(
        departments.map((dept) => [dept.name.trim().toLowerCase(), dept.id])
      );

      const validRows: Array<{
        full_name: string;
        email: string;
        employee_id: string;
        phone: string;
        department_id: string | null;
        password: string;
        role: string;
        company_id: string | undefined;
      }> = [];

      const rejectionCounts = {
        missingName: 0,
        missingEmail: 0,
        invalidEmail: 0,
        existingEmail: 0,
      };

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = requiredHeaders.reduce<Record<string, string>>(
          (acc, header, index) => {
            acc[header] = values[index]?.trim() || "";
            return acc;
          },
          {}
        );

        const fullName = row["full name"];
        const email = row.email;

        if (!fullName) {
          rejectionCounts.missingName += 1;
          continue;
        }

        if (!email) {
          rejectionCounts.missingEmail += 1;
          continue;
        }

        if (!isValidEmail(email)) {
          rejectionCounts.invalidEmail += 1;
          continue;
        }

        const employeeEmails = employees.map((employee) => employee.email);
        if (employeeEmails.includes(email)) {
          rejectionCounts.existingEmail += 1;
          continue;
        }

        const departmentValue = row.department;
        const departmentId = departmentValue
          ? departmentLookup.get(departmentValue.trim().toLowerCase()) || null
          : null;

        validRows.push({
          full_name: fullName,
          email,
          employee_id: row["employee id"],
          phone: row.phone,
          department_id: departmentId,
          password: row.password,
          role: "EMPLOYEE",
          company_id: currentUser.company_id,
        });
      }

      setUploadSummary(
        `Imported ${validRows.length} employees. Rejected ${
          rejectionCounts.missingName +
          rejectionCounts.missingEmail +
          rejectionCounts.invalidEmail +
          rejectionCounts.existingEmail
        } rows.\n` +
          `Reasons: missing name (${rejectionCounts.missingName}), missing email (${rejectionCounts.missingEmail}), invalid email (${rejectionCounts.invalidEmail}), existing email (${rejectionCounts.existingEmail}).`
      );

      if (validRows.length === 0) {
        return;
      }

      const bulkUsers = validRows.map((row) => ({
        email: row.email,
        password: row.password,
        full_name: row.full_name,
        phone: row.phone || null,
        employee_id: row.employee_id || null,
        role: "EMPLOYEE" as const,
        company_id: row.company_id,
        department_id: row.department_id || null,
      }));

      const { data: bulkResult, error: bulkError } =
        await supabase.functions.invoke<BulkCreateResponse>("user-admin", {
          body: { action: "bulkCreate", users: bulkUsers },
        });
      if (bulkError) throw bulkError;

      const clientRejected =
        rejectionCounts.missingName +
        rejectionCounts.missingEmail +
        rejectionCounts.invalidEmail +
        rejectionCounts.existingEmail;
      const serverFailed = bulkResult?.failed ?? 0;
      const succeededEmails = new Set(
        (bulkResult?.results ?? [])
          .filter((result) => result.success)
          .map((result) => result.email)
      );
      const createdRows = validRows.filter((row) =>
        succeededEmails.has(row.email)
      );
      const emailResults = await Promise.allSettled(
        createdRows.map((row) =>
          sendNotificationEmail(
            row.email,
            row.full_name,
            "Welcome to Awareone",
            "Welcome aboard",
            "Your account has been created. Use the credentials below to sign in.",
            {
              loginUrl,
              credentials: {
                email: row.email,
                password: row.password,
                role: "Employee",
              },
              showSecurityNote: true,
            }
          )
        )
      );
      const emailFailed = emailResults.filter(
        (result) => result.status === "rejected"
      ).length;
      const emailSent = createdRows.length - emailFailed;

      setUploadSummary(
        `Imported ${bulkResult?.succeeded ?? 0} employees. Rejected ${clientRejected + serverFailed} rows.\n` +
          `Client: missing name (${rejectionCounts.missingName}), missing email (${rejectionCounts.missingEmail}), invalid email (${rejectionCounts.invalidEmail}), existing email (${rejectionCounts.existingEmail}). Server failures: ${serverFailed}.\n` +
          `Welcome emails sent: ${emailSent}. Email failures: ${emailFailed}.`
      );

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      loadEmployees();
    } catch (error) {
      console.error("Error uploading CSV:", error);
      setUploadError(
        "Failed to parse or upload CSV. Please verify the file and try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Employees</h1>
          <p className="text-slate-600">Manage employee accounts and access</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setUploadError("");
              setUploadSummary("");
              uploadCSV(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Upload className="h-5 w-5" />
            {isUploading ? "Uploading..." : "Upload CSV"}
          </button>
          <button
            onClick={() => {
              setEditingEmployee(null);
              setFormData({
                full_name: "",
                email: "",
                phone: "",
                employee_id: "",
                password: "employee123",
                department_id: "",
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Employee
          </button>
        </div>
      </div>

      {(uploadError || uploadSummary) && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-line">
          {uploadError && <span className="text-red-600">{uploadError}</span>}
          {!uploadError && uploadSummary}
        </div>
      )}

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
                Department
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
                    <span className="font-medium text-slate-900">
                      {employee.full_name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600">{employee.email}</td>
                <td className="px-6 py-4 text-slate-600">
                  {employee.department?.name || "-"}
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {employee.employee_id || "-"}
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {employee.phone || "-"}
                </td>
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
                      onClick={() =>
                        handleDelete(
                          employee.id,
                          employee.email,
                          employee.full_name
                        )
                      }
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
              {editingEmployee ? "Edit Employee" : "Add New Employee"}
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
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
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
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  disabled={editingEmployee !== null}
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
                  onChange={(e) =>
                    setFormData({ ...formData, employee_id: e.target.value })
                  }
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
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Department
                </label>
                <select
                  value={formData.department_id}
                  onChange={(e) =>
                    setFormData({ ...formData, department_id: e.target.value })
                  }
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
                  Assign to department to automatically enroll in department
                  courses
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
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
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
                  {editingEmployee ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
