import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, Settings, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Company, Course, Exam } from '../../types';
import { CompanyFormModal } from '../../components/platform-admin/CompanyFormModal';

interface CompanyWithQuota extends Company {
  annual_quota?: number;
  used_campaigns?: number;
}

export const CompaniesPage: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyWithQuota[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [assigningCompany, setAssigningCompany] = useState<Company | null>(null);
  const [editingQuota, setEditingQuota] = useState<string | null>(null);
  const [quotaValue, setQuotaValue] = useState<number>(4);

  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedExams, setSelectedExams] = useState<string[]>([]);

  useEffect(() => {
    loadCompanies();
    loadAllContent();
  }, []);

  const loadCompanies = async () => {
    const { data: companiesData } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (companiesData) {
      const currentYear = new Date().getFullYear();

      const companiesWithQuota = await Promise.all(
        companiesData.map(async (company) => {
          const { data: quota } = await supabase
            .from('phishing_campaign_quotas')
            .select('annual_quota, used_campaigns')
            .eq('company_id', company.id)
            .eq('quota_year', currentYear)
            .maybeSingle();

          return {
            ...company,
            annual_quota: quota?.annual_quota || 4,
            used_campaigns: quota?.used_campaigns || 0
          };
        })
      );

      setCompanies(companiesWithQuota);
    }
  };

  const handleUpdateQuota = async (companyId: string) => {
    try {
      const currentYear = new Date().getFullYear();

      const { data: existingQuota } = await supabase
        .from('phishing_campaign_quotas')
        .select('id')
        .eq('company_id', companyId)
        .eq('quota_year', currentYear)
        .maybeSingle();

      if (existingQuota) {
        await supabase
          .from('phishing_campaign_quotas')
          .update({ annual_quota: quotaValue })
          .eq('id', existingQuota.id);
      } else {
        await supabase
          .from('phishing_campaign_quotas')
          .insert({
            company_id: companyId,
            annual_quota: quotaValue,
            quota_year: currentYear,
            used_campaigns: 0
          });
      }

      setEditingQuota(null);
      await loadCompanies();
      alert('Campaign quota updated successfully!');
    } catch (error) {
      console.error('Error updating quota:', error);
      alert('Failed to update campaign quota');
    }
  };

  const loadAllContent = async () => {
    const [coursesRes, examsRes] = await Promise.all([
      supabase.from('courses').select('*').order('order_index'),
      supabase.from('exams').select('*').order('created_at')
    ]);

    if (coursesRes.data) setAllCourses(coursesRes.data);
    if (examsRes.data) setAllExams(examsRes.data);
  };

  const handleSaveCompany = async (formData: any) => {
    try {
      if (editingCompany) {
        const { error: companyError } = await supabase
          .from('companies')
          .update(formData)
          .eq('id', editingCompany.id);

        if (companyError) throw companyError;

        const { error: userError } = await supabase
          .from('users')
          .update({
            full_name: formData.admin_name,
            email: formData.admin_email,
            phone: formData.admin_phone
          })
          .eq('company_id', editingCompany.id)
          .eq('role', 'COMPANY_ADMIN');

        if (userError) throw userError;

        await supabase.from('audit_logs').insert([{
          action_type: 'UPDATE_COMPANY',
          entity_type: 'COMPANY',
          entity_id: editingCompany.id,
          entity_name: formData.name,
          description: `تحديث شركة: ${formData.name}`,
          new_value: formData
        }]);
      } else {
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert([formData])
          .select()
          .single();

        if (companyError) throw companyError;

        const { error: userError } = await supabase
          .from('users')
          .insert([{
            email: formData.admin_email,
            password: 'Admin123!',
            full_name: formData.admin_name,
            phone: formData.admin_phone,
            role: 'COMPANY_ADMIN',
            company_id: newCompany.id
          }]);

        if (userError) throw userError;

        await supabase.from('subscriptions').insert([{
          company_id: newCompany.id,
          subscription_type: formData.subscription_type,
          start_date: formData.subscription_start,
          end_date: formData.subscription_end,
          license_count: formData.license_limit,
          status: formData.is_active ? 'ACTIVE' : 'PENDING'
        }]);

        await supabase.from('audit_logs').insert([{
          action_type: 'CREATE_COMPANY',
          entity_type: 'COMPANY',
          entity_id: newCompany.id,
          entity_name: formData.name,
          description: `إنشاء شركة جديدة: ${formData.name}`,
          new_value: formData
        }]);
      }

      setShowModal(false);
      setEditingCompany(null);
      await loadCompanies();
      alert(editingCompany ? 'تم تحديث الشركة بنجاح' : 'تم إنشاء الشركة وحساب المدير بنجاح!\nالبريد: ' + formData.admin_email + '\nكلمة المرور: Admin123!');
    } catch (error) {
      console.error('Error saving company:', error);
      alert('فشل حفظ الشركة: ' + (error as any).message);
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الشركة؟ سيتم حذف جميع المستخدمين المرتبطين بها.')) {
      return;
    }

    try {
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;
      await loadCompanies();
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('فشل حذف الشركة');
    }
  };

  const handleAssignContent = async (company: Company) => {
    setAssigningCompany(company);

    const [coursesRes, examsRes] = await Promise.all([
      supabase.from('company_courses').select('course_id').eq('company_id', company.id),
      supabase.from('company_exams').select('exam_id').eq('company_id', company.id)
    ]);

    setSelectedCourses(coursesRes.data?.map(c => c.course_id) || []);
    setSelectedExams(examsRes.data?.map(e => e.exam_id) || []);
    setShowAssignModal(true);
  };

  const handleSaveAssignments = async () => {
    if (!assigningCompany) return;

    try {
      await supabase.from('company_courses').delete().eq('company_id', assigningCompany.id);
      await supabase.from('company_exams').delete().eq('company_id', assigningCompany.id);

      if (selectedCourses.length > 0) {
        await supabase.from('company_courses').insert(
          selectedCourses.map(courseId => ({
            company_id: assigningCompany.id,
            course_id: courseId
          }))
        );
      }

      if (selectedExams.length > 0) {
        await supabase.from('company_exams').insert(
          selectedExams.map(examId => ({
            company_id: assigningCompany.id,
            exam_id: examId
          }))
        );
      }

      setShowAssignModal(false);
      setAssigningCompany(null);
      alert('تم حفظ التخصيصات بنجاح');
    } catch (error) {
      console.error('Error saving assignments:', error);
      alert('فشل حفظ التخصيصات');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">الشركات</h1>
          <p className="text-slate-600">إدارة حسابات الشركات والباقات</p>
        </div>
        <button
          onClick={() => {
            setEditingCompany(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg transition-all font-medium"
        >
          <Plus className="h-5 w-5" />
          إضافة شركة جديدة
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Company Name
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Package
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                License Limit
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Campaign Quota
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {companies.map((company) => (
              <tr key={company.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="font-medium text-slate-900">{company.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    company.package_type === 'TYPE_A'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {company.package_type === 'TYPE_A' ? 'Full Courses' : 'Exams Only'}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-900">
                  {company.license_limit} employees
                </td>
                <td className="px-6 py-4">
                  {editingQuota === company.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={quotaValue}
                        onChange={(e) => setQuotaValue(parseInt(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
                        autoFocus
                      />
                      <button
                        onClick={() => handleUpdateQuota(company.id)}
                        className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingQuota(null)}
                        className="px-2 py-1 bg-slate-300 text-slate-700 text-xs rounded hover:bg-slate-400"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingQuota(company.id);
                        setQuotaValue(company.annual_quota || 4);
                      }}
                      className="flex items-center gap-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <Shield className="h-4 w-4 text-slate-600" />
                      <span className="text-sm font-medium text-slate-900">
                        {company.used_campaigns || 0} / {company.annual_quota || 4}
                      </span>
                    </button>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {new Date(company.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-left">
                  <div className="flex items-center justify-start gap-2">
                    <button
                      onClick={() => handleAssignContent(company)}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="تخصيص المحتوى"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(company)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(company.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {companies.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No companies yet. Click "Add Company" to get started.
          </div>
        )}
      </div>

      {showModal && (
        <CompanyFormModal
          company={editingCompany}
          onClose={() => {
            setShowModal(false);
            setEditingCompany(null);
          }}
          onSave={handleSaveCompany}
        />
      )}

      {showAssignModal && assigningCompany && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              تخصيص المحتوى - {assigningCompany.name}
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">الدورات التدريبية</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {allCourses.map(course => (
                    <label key={course.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCourses.includes(course.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCourses([...selectedCourses, course.id]);
                          } else {
                            setSelectedCourses(selectedCourses.filter(id => id !== course.id));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-slate-900">{course.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">الاختبارات</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {allExams.map(exam => (
                    <label key={exam.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedExams.includes(exam.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedExams([...selectedExams, exam.id]);
                          } else {
                            setSelectedExams(selectedExams.filter(id => id !== exam.id));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-slate-900">{exam.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setAssigningCompany(null);
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveAssignments}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                حفظ التخصيصات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
