import React, { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import { Company } from '../../types';

interface CompanyFormModalProps {
  company: Company | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export const CompanyFormModal: React.FC<CompanyFormModalProps> = ({ company, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    admin_name: '',
    admin_email: '',
    admin_phone: '',
    package_type: 'TYPE_A' as 'TYPE_A' | 'TYPE_B',
    license_limit: 10,
    subscription_type: 'POC_3M',
    subscription_start: new Date().toISOString().split('T')[0],
    subscription_end: '',
    is_active: true,
    status: 'ACTIVE'
  });

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        admin_name: (company as any).admin_name || '',
        admin_email: (company as any).admin_email || '',
        admin_phone: (company as any).admin_phone || '',
        package_type: company.package_type || 'TYPE_A',
        license_limit: company.license_limit || 10,
        subscription_type: (company as any).subscription_type || 'POC_3M',
        subscription_start: (company as any).subscription_start?.split('T')[0] || new Date().toISOString().split('T')[0],
        subscription_end: (company as any).subscription_end?.split('T')[0] || '',
        is_active: (company as any).is_active !== false,
        status: (company as any).status || 'ACTIVE'
      });
    }
  }, [company]);

  useEffect(() => {
    const start = new Date(formData.subscription_start);
    let months = 3;

    switch (formData.subscription_type) {
      case 'POC_3M':
        months = 3;
        break;
      case 'MONTHLY_6':
        months = 6;
        break;
      case 'YEARLY_1':
        months = 12;
        break;
      case 'YEARLY_2':
        months = 24;
        break;
      default:
        return;
    }

    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    setFormData(prev => ({
      ...prev,
      subscription_end: end.toISOString().split('T')[0]
    }));
  }, [formData.subscription_type, formData.subscription_start]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">
            {company ? 'تعديل شركة' : 'إضافة شركة جديدة'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3">معلومات الشركة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  اسم الشركة *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="مثال: شركة التقنية المتقدمة"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  نوع الباقة *
                </label>
                <select
                  required
                  value={formData.package_type}
                  onChange={(e) => setFormData({ ...formData, package_type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="TYPE_A">باقة A - أساسية</option>
                  <option value="TYPE_B">باقة B - متقدمة</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  عدد الرخص *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.license_limit}
                  onChange={(e) => setFormData({ ...formData, license_limit: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  الحالة *
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ACTIVE">نشطة</option>
                  <option value="SUSPENDED">معلقة</option>
                  <option value="EXPIRED">منتهية</option>
                  <option value="CANCELLED">ملغاة</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-3">معلومات مدير الشركة</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  اسم المدير *
                </label>
                <input
                  type="text"
                  required
                  value={formData.admin_name}
                  onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="محمد أحمد"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  البريد الإلكتروني *
                </label>
                <input
                  type="email"
                  required
                  value={formData.admin_email}
                  onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="admin@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  رقم الجوال *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.admin_phone}
                  onChange={(e) => setFormData({ ...formData, admin_phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="05xxxxxxxx"
                />
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 mb-3">معلومات الاشتراك</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  نوع الاشتراك *
                </label>
                <select
                  required
                  value={formData.subscription_type}
                  onChange={(e) => setFormData({ ...formData, subscription_type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="POC_3M">تجريبي 3 أشهر (POC)</option>
                  <option value="MONTHLY_6">6 أشهر</option>
                  <option value="YEARLY_1">سنة واحدة</option>
                  <option value="YEARLY_2">سنتين</option>
                  <option value="CUSTOM">مخصص</option>
                </select>
              </div>

              <div className="flex items-center gap-4 pt-8">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">الاشتراك نشط</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  تاريخ البداية *
                </label>
                <input
                  type="date"
                  required
                  value={formData.subscription_start}
                  onChange={(e) => setFormData({ ...formData, subscription_start: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  تاريخ النهاية *
                </label>
                <input
                  type="date"
                  required
                  value={formData.subscription_end}
                  onChange={(e) => setFormData({ ...formData, subscription_end: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={formData.subscription_type !== 'CUSTOM'}
                />
              </div>
            </div>

            {formData.subscription_end && (
              <div className="mt-4 p-3 bg-white rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 text-sm text-purple-900">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">
                    المدة: {Math.ceil((new Date(formData.subscription_end).getTime() - new Date(formData.subscription_start).getTime()) / (1000 * 60 * 60 * 24))} يوم
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-lg transition-all duration-300"
            >
              {company ? 'حفظ التعديلات' : 'إضافة الشركة'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors font-medium"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
