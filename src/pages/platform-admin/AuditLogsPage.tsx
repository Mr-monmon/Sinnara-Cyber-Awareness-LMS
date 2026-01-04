import React, { useState, useEffect } from 'react';
import { History, Search, Filter, Download, Eye, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AuditLog {
  id: string;
  user_id?: string;
  user_email?: string;
  user_role?: string;
  action_type: string;
  entity_type?: string;
  entity_id?: string;
  entity_name?: string;
  old_value?: any;
  new_value?: any;
  ip_address?: string;
  user_agent?: string;
  description?: string;
  created_at: string;
}

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, selectedAction, selectedEntity, dateFrom, dateTo]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (data) setLogs(data);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entity_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedAction) {
      filtered = filtered.filter(log => log.action_type === selectedAction);
    }

    if (selectedEntity) {
      filtered = filtered.filter(log => log.entity_type === selectedEntity);
    }

    if (dateFrom) {
      filtered = filtered.filter(log => new Date(log.created_at) >= new Date(dateFrom));
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59);
      filtered = filtered.filter(log => new Date(log.created_at) <= endDate);
    }

    setFilteredLogs(filtered);
  };

  const getActionBadge = (action: string) => {
    const styles: Record<string, string> = {
      CREATE: 'bg-green-100 text-green-800 border-green-200',
      UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
      DELETE: 'bg-red-100 text-red-800 border-red-200',
      LOGIN: 'bg-purple-100 text-purple-800 border-purple-200',
      LOGOUT: 'bg-gray-100 text-gray-800 border-gray-200',
      LOGIN_FAILED: 'bg-orange-100 text-orange-800 border-orange-200',
      ROLE_CHANGE: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      ASSIGN_COURSE: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      ASSIGN_EXAM: 'bg-teal-100 text-teal-800 border-teal-200',
      COMPLETE_COURSE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      COMPLETE_EXAM: 'bg-lime-100 text-lime-800 border-lime-200',
      CREATE_COMPANY: 'bg-blue-100 text-blue-800 border-blue-200',
      UPDATE_COMPANY: 'bg-blue-100 text-blue-800 border-blue-200',
      DELETE_COMPANY: 'bg-red-100 text-red-800 border-red-200',
      CREATE_USER: 'bg-green-100 text-green-800 border-green-200',
      UPDATE_USER: 'bg-blue-100 text-blue-800 border-blue-200',
      DELETE_USER: 'bg-red-100 text-red-800 border-red-200',
      UPLOAD_EMPLOYEES: 'bg-purple-100 text-purple-800 border-purple-200',
      EXPORT_DATA: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };

    const labels: Record<string, string> = {
      CREATE: 'إنشاء',
      UPDATE: 'تحديث',
      DELETE: 'حذف',
      LOGIN: 'تسجيل دخول',
      LOGOUT: 'تسجيل خروج',
      LOGIN_FAILED: 'فشل تسجيل دخول',
      ROLE_CHANGE: 'تغيير صلاحيات',
      ASSIGN_COURSE: 'تعيين دورة',
      ASSIGN_EXAM: 'تعيين اختبار',
      COMPLETE_COURSE: 'إكمال دورة',
      COMPLETE_EXAM: 'إكمال اختبار',
      CREATE_COMPANY: 'إنشاء شركة',
      UPDATE_COMPANY: 'تحديث شركة',
      DELETE_COMPANY: 'حذف شركة',
      CREATE_USER: 'إنشاء مستخدم',
      UPDATE_USER: 'تحديث مستخدم',
      DELETE_USER: 'حذف مستخدم',
      UPLOAD_EMPLOYEES: 'رفع موظفين',
      EXPORT_DATA: 'تصدير بيانات'
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${styles[action] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
        {labels[action] || action}
      </span>
    );
  };

  const getRoleBadge = (role?: string) => {
    if (!role) return null;

    const styles: Record<string, string> = {
      PLATFORM_ADMIN: 'bg-red-100 text-red-800',
      COMPANY_ADMIN: 'bg-blue-100 text-blue-800',
      EMPLOYEE: 'bg-green-100 text-green-800'
    };

    const labels: Record<string, string> = {
      PLATFORM_ADMIN: 'مدير منصة',
      COMPANY_ADMIN: 'مدير شركة',
      EMPLOYEE: 'موظف'
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[role]}`}>
        {labels[role] || role}
      </span>
    );
  };

  const exportToCSV = () => {
    const csv = [
      'Date,User,Role,Action,Entity,Description',
      ...filteredLogs.map(log =>
        `${new Date(log.created_at).toLocaleString('ar-SA')},${log.user_email || 'System'},${log.user_role || '-'},${log.action_type},${log.entity_type || '-'},"${log.description || '-'}"`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const actionTypes = Array.from(new Set(logs.map(l => l.action_type))).sort();
  const entityTypes = Array.from(new Set(logs.map(l => l.entity_type).filter(Boolean))).sort();

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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">سجل الأنشطة</h1>
          <p className="text-slate-600">تتبع جميع الأنشطة والتغييرات في المنصة</p>
        </div>
        <button
          onClick={exportToCSV}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg transition-all flex items-center gap-2 font-medium"
        >
          <Download className="h-4 w-4" />
          تصدير CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث بالمستخدم أو الوصف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">جميع الإجراءات</option>
              {actionTypes.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">جميع الكيانات</option>
              {entityTypes.map(entity => (
                <option key={entity} value={entity}>{entity}</option>
              ))}
            </select>
          </div>

          <div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="من تاريخ"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <History className="h-4 w-4" />
            <span>النتائج: {filteredLogs.length} من {logs.length}</span>
          </div>

          {(searchTerm || selectedAction || selectedEntity || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedAction('');
                setSelectedEntity('');
                setDateFrom('');
                setDateTo('');
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase">التاريخ والوقت</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase">المستخدم</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase">الصلاحية</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase">الإجراء</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase">الكيان</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase">الوصف</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {new Date(log.created_at).toLocaleString('ar-SA', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">
                      {log.user_email || 'النظام'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getRoleBadge(log.user_role)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getActionBadge(log.action_type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {log.entity_type || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-600 max-w-md truncate">
                      {log.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="عرض التفاصيل"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No matching results
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">تفاصيل السجل</h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ والوقت</label>
                  <div className="text-slate-900">
                    {new Date(selectedLog.created_at).toLocaleString('ar-SA')}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">المستخدم</label>
                  <div className="text-slate-900">{selectedLog.user_email || 'النظام'}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">الصلاحية</label>
                  <div>{getRoleBadge(selectedLog.user_role) || '-'}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">الإجراء</label>
                  <div>{getActionBadge(selectedLog.action_type)}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">نوع الكيان</label>
                  <div className="text-slate-900">{selectedLog.entity_type || '-'}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">اسم الكيان</label>
                  <div className="text-slate-900">{selectedLog.entity_name || '-'}</div>
                </div>

                {selectedLog.ip_address && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">عنوان IP</label>
                    <div className="text-slate-900 font-mono text-sm">{selectedLog.ip_address}</div>
                  </div>
                )}
              </div>

              {selectedLog.description && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">الوصف</label>
                  <div className="text-slate-900 bg-slate-50 p-3 rounded-lg">
                    {selectedLog.description}
                  </div>
                </div>
              )}

              {selectedLog.old_value && Object.keys(selectedLog.old_value).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">القيمة القديمة</label>
                  <pre className="text-sm bg-slate-50 p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(selectedLog.old_value, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_value && Object.keys(selectedLog.new_value).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">القيمة الجديدة</label>
                  <pre className="text-sm bg-slate-50 p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(selectedLog.new_value, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.user_agent && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">المتصفح</label>
                  <div className="text-slate-600 text-sm bg-slate-50 p-3 rounded-lg break-all">
                    {selectedLog.user_agent}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setSelectedLog(null)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
