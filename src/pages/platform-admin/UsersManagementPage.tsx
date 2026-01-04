import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, Edit2, Trash2, Upload, Download, Shield, Building2, Plus, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  employee_id?: string;
  role: 'PLATFORM_ADMIN' | 'COMPANY_ADMIN' | 'EMPLOYEE';
  company_id?: string;
  department?: string;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
}

export const UsersManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [uploadCompanyId, setUploadCompanyId] = useState<string>('');
  const [newUserData, setNewUserData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'EMPLOYEE',
    company_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, companiesRes] = await Promise.all([
        supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('companies')
          .select('id, name')
          .order('name')
      ]);

      if (usersRes.data) setUsers(usersRes.data);
      if (companiesRes.data) setCompanies(companiesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCompanyName = (companyId?: string) => {
    if (!companyId) return '-';
    const company = companies.find(c => c.id === companyId);
    return company?.name || '-';
  };

  const getRoleBadge = (role: string) => {
    const styles = {
      PLATFORM_ADMIN: 'bg-red-100 text-red-800 border-red-200',
      COMPANY_ADMIN: 'bg-blue-100 text-blue-800 border-blue-200',
      EMPLOYEE: 'bg-green-100 text-green-800 border-green-200'
    };

    const labels = {
      PLATFORM_ADMIN: 'Platform Admin',
      COMPANY_ADMIN: 'Company Admin',
      EMPLOYEE: 'Employee'
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[role as keyof typeof styles]}`}>
        {labels[role as keyof typeof labels]}
      </span>
    );
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUserData.full_name || !newUserData.email || !newUserData.password) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .insert([{
          full_name: newUserData.full_name,
          email: newUserData.email.toLowerCase(),
          phone: newUserData.phone || null,
          password: newUserData.password,
          role: newUserData.role,
          company_id: newUserData.company_id || null
        }]);

      if (error) throw error;

      await supabase.from('audit_logs').insert([{
        action_type: 'CREATE_USER',
        entity_type: 'USER',
        description: `Created user: ${newUserData.email}`,
        new_value: { email: newUserData.email, role: newUserData.role }
      }]);

      setShowAddUserModal(false);
      setNewUserData({ full_name: '', email: '', phone: '', password: '', role: 'EMPLOYEE', company_id: '' });
      await loadData();
      alert('User added successfully!');
    } catch (error) {
      console.error('Error adding user:', error);
      alert('Failed to add user. Email might already exist.');
    }
  };

  const handleResetPassword = async (userId: string, userEmail: string) => {
    const newPassword = prompt('Enter new password for ' + userEmail + ':');

    if (!newPassword) return;

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    if (!confirm('Are you sure you want to reset the password for ' + userEmail + '?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('id', userId);

      if (error) throw error;

      await supabase.from('audit_logs').insert([{
        action_type: 'RESET_PASSWORD',
        entity_type: 'USER',
        entity_id: userId,
        description: `Password reset for ${userEmail}`
      }]);

      alert('Password reset successfully!');
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Failed to reset password');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm('Are you sure you want to change this user\'s role?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      await supabase.from('audit_logs').insert([{
        action_type: 'ROLE_CHANGE',
        entity_type: 'USER',
        entity_id: userId,
        description: `Changed user role to ${newRole}`,
        new_value: { role: newRole }
      }]);

      await loadData();
      alert('Role changed successfully');
    } catch (error) {
      console.error('Error changing role:', error);
      alert('Failed to change role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      await supabase.from('audit_logs').insert([{
        action_type: 'DELETE_USER',
        entity_type: 'USER',
        entity_id: userId,
        description: 'Deleted user'
      }]);

      await loadData();
      alert('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadCompanyId) {
      alert('Please select a company and file');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          alert('File is empty or incorrectly formatted');
          return;
        }

        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        const emailIndex = headers.findIndex(h => h.includes('email'));
        const nameIndex = headers.findIndex(h => h.includes('name'));
        const phoneIndex = headers.findIndex(h => h.includes('phone') || h.includes('mobile'));
        const deptIndex = headers.findIndex(h => h.includes('department'));

        if (emailIndex === -1 || nameIndex === -1) {
          alert('File must contain email and name columns');
          return;
        }

        const employees = [];
        const failedRows = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());

          if (values.length < 2) continue;

          const email = values[emailIndex]?.toLowerCase();
          const fullName = values[nameIndex];

          if (!email || !fullName) {
            failedRows.push(i + 1);
            continue;
          }

          employees.push({
            email,
            full_name: fullName,
            phone: phoneIndex !== -1 ? values[phoneIndex] : null,
            department: deptIndex !== -1 ? values[deptIndex] : null,
            password: 'Password123!',
            role: 'EMPLOYEE',
            company_id: uploadCompanyId
          });
        }

        if (employees.length === 0) {
          alert('No valid data in file');
          return;
        }

        const { error } = await supabase
          .from('users')
          .insert(employees);

        if (error) throw error;

        await supabase.from('audit_logs').insert([{
          action_type: 'UPLOAD_EMPLOYEES',
          entity_type: 'EMPLOYEE',
          description: `Uploaded ${employees.length} employees from Excel`,
          new_value: { count: employees.length, company_id: uploadCompanyId }
        }]);

        setShowUploadModal(false);
        setUploadCompanyId('');
        await loadData();

        const message = failedRows.length > 0
          ? `Added ${employees.length} employees successfully.\nFailed rows: ${failedRows.join(', ')}`
          : `Added ${employees.length} employees successfully!`;

        alert(message);
      } catch (error) {
        console.error('Error uploading employees:', error);
        alert('Failed to upload employees. Check data format.');
      }
    };

    reader.readAsText(file);
  };

  const exportToCSV = () => {
    const filteredUsers = getFilteredUsers();
    const csv = [
      'Name,Email,Phone,Role,Company,Department',
      ...filteredUsers.map(u =>
        `${u.full_name},${u.email},${u.phone || ''},${u.role},${getCompanyName(u.company_id)},${u.department || ''}`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getFilteredUsers = () => {
    return users.filter(user => {
      const matchesSearch =
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCompany = !selectedCompany || user.company_id === selectedCompany;
      const matchesRole = !selectedRole || user.role === selectedRole;

      return matchesSearch && matchesCompany && matchesRole;
    });
  };

  const filteredUsers = getFilteredUsers();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">User Management</h1>
          <p className="text-slate-600">Manage all users and permissions</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-2 font-medium"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowAddUserModal(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
          >
            <Plus className="h-4 w-4" />
            Add User
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg transition-all flex items-center gap-2 font-medium"
          >
            <Upload className="h-4 w-4" />
            Bulk Upload
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Companies</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Roles</option>
              <option value="PLATFORM_ADMIN">Platform Admin</option>
              <option value="COMPANY_ADMIN">Company Admin</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Results: {filteredUsers.length} of {users.length}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-slate-900">{user.full_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                    {user.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getRoleBadge(user.role)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Building2 className="h-4 w-4" />
                      {getCompanyName(user.company_id)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResetPassword(user.id, user.email)}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title="Reset Password"
                      >
                        <Key className="h-4 w-4" />
                      </button>
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="PLATFORM_ADMIN">Platform Admin</option>
                        <option value="COMPANY_ADMIN">Company Admin</option>
                        <option value="EMPLOYEE">Employee</option>
                      </select>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No matching results
          </div>
        )}
      </div>

      {/* Add Single User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Add New User</h2>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={newUserData.full_name}
                  onChange={(e) => setNewUserData({ ...newUserData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={newUserData.phone}
                  onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Role *
                </label>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="COMPANY_ADMIN">Company Admin</option>
                  <option value="PLATFORM_ADMIN">Platform Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Company
                </label>
                <select
                  value={newUserData.company_id}
                  onChange={(e) => setNewUserData({ ...newUserData, company_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Select Company --</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUserModal(false);
                    setNewUserData({ full_name: '', email: '', phone: '', password: '', role: 'EMPLOYEE', company_id: '' });
                  }}
                  className="flex-1 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Bulk Upload Employees</h2>

            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Required File Format (CSV):</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• First row: Column headers (name, email, phone, department)</li>
                <li>• Email and name are required</li>
                <li>• Phone and department are optional</li>
                <li>• Default password: Password123!</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Company *
              </label>
              <select
                value={uploadCompanyId}
                onChange={(e) => setUploadCompanyId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">-- Select Company --</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadCompanyId('');
                }}
                className="flex-1 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
