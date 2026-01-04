import React, { useState, useEffect } from 'react';
import { Award, Plus, Edit2, Trash2, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CertificateTemplate {
  id: string;
  name: string;
  course_id: string | null;
  courses?: { title: string };
  template_html: string;
  background_image_url: string | null;
  logo_url: string | null;
  signature_image_url: string | null;
  created_at: string;
}

interface Course {
  id: string;
  title: string;
}

const DEFAULT_TEMPLATE = `
<div style="width: 800px; height: 600px; padding: 60px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-family: 'Arial', sans-serif; position: relative; border: 10px solid gold;">
  <div style="background: rgba(255,255,255,0.1); padding: 40px; border-radius: 20px; height: 100%;">
    <h1 style="font-size: 48px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 3px;">شهادة إتمام</h1>
    <div style="width: 100px; height: 4px; background: gold; margin: 0 auto 30px;"></div>

    <p style="font-size: 18px; margin-bottom: 40px;">هذه الشهادة تمنح لـ</p>

    <h2 style="font-size: 42px; margin-bottom: 40px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">{{employee_name}}</h2>

    <p style="font-size: 18px; margin-bottom: 20px;">لإتمامه بنجاح دورة</p>

    <h3 style="font-size: 32px; margin-bottom: 40px; color: gold;">{{course_name}}</h3>

    <p style="font-size: 16px; margin-bottom: 10px;">بدرجة: <strong>{{score}}%</strong></p>

    <p style="font-size: 16px; margin-top: 60px;">تاريخ الإصدار: {{completion_date}}</p>
  </div>
</div>
`;

export const CertificateTemplatesPage: React.FC = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CertificateTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    course_id: '',
    template_html: DEFAULT_TEMPLATE,
    background_image_url: '',
    logo_url: '',
    signature_image_url: ''
  });

  useEffect(() => {
    loadTemplates();
    loadCourses();
  }, []);

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('certificate_templates')
      .select('*, courses(title)')
      .order('created_at', { ascending: false });

    if (data) setTemplates(data);
  };

  const loadCourses = async () => {
    const { data } = await supabase
      .from('courses')
      .select('id, title')
      .order('title');

    if (data) setCourses(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const templateData = {
        ...formData,
        course_id: formData.course_id || null,
        created_by: user?.id
      };

      if (selectedTemplate) {
        await supabase
          .from('certificate_templates')
          .update(templateData)
          .eq('id', selectedTemplate.id);
      } else {
        await supabase
          .from('certificate_templates')
          .insert(templateData);
      }

      setShowModal(false);
      setSelectedTemplate(null);
      resetForm();
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('فشل حفظ القالب');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا القالب؟')) return;

    await supabase.from('certificate_templates').delete().eq('id', id);
    loadTemplates();
  };

  const handleEdit = (template: CertificateTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      course_id: template.course_id || '',
      template_html: template.template_html,
      background_image_url: template.background_image_url || '',
      logo_url: template.logo_url || '',
      signature_image_url: template.signature_image_url || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      course_id: '',
      template_html: DEFAULT_TEMPLATE,
      background_image_url: '',
      logo_url: '',
      signature_image_url: ''
    });
  };

  const getPreviewHtml = () => {
    return formData.template_html
      .replace(/\{\{employee_name\}\}/g, 'أحمد محمد')
      .replace(/\{\{course_name\}\}/g, 'الأمن السيبراني المتقدم')
      .replace(/\{\{completion_date\}\}/g, new Date().toLocaleDateString('ar'))
      .replace(/\{\{score\}\}/g, '95');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">قوالب الشهادات</h1>
          <p className="text-slate-600 mt-2">تخصيص تصميم الشهادات الصادرة</p>
        </div>
        <button
          onClick={() => {
            setSelectedTemplate(null);
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          قالب جديد
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div key={template.id} className="bg-white rounded-xl shadow-sm border-2 border-amber-200 overflow-hidden hover:shadow-lg transition-shadow">
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4 text-white">
              <div className="flex items-center gap-3">
                <Award className="h-8 w-8" />
                <div>
                  <h3 className="font-bold text-lg">{template.name}</h3>
                  {template.courses && (
                    <p className="text-amber-100 text-sm">{template.courses.title}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="mb-4 bg-slate-50 rounded-lg p-3 text-center text-sm text-slate-600">
                <div
                  dangerouslySetInnerHTML={{
                    __html: template.template_html
                      .replace(/\{\{employee_name\}\}/g, 'اسم الموظف')
                      .replace(/\{\{course_name\}\}/g, template.courses?.title || 'اسم الدورة')
                      .replace(/\{\{completion_date\}\}/g, 'التاريخ')
                      .replace(/\{\{score\}\}/g, '95')
                  }}
                  style={{ transform: 'scale(0.2)', transformOrigin: 'top left', height: '120px', overflow: 'hidden' }}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedTemplate(template);
                    setFormData({
                      name: template.name,
                      course_id: template.course_id || '',
                      template_html: template.template_html,
                      background_image_url: template.background_image_url || '',
                      logo_url: template.logo_url || '',
                      signature_image_url: template.signature_image_url || ''
                    });
                    setShowPreview(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Eye className="h-4 w-4" />
                  معاينة
                </button>
                <button
                  onClick={() => handleEdit(template)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl">
          <Award className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">No templates yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Create First Template
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 my-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              {selectedTemplate ? 'تعديل القالب' : 'قالب شهادة جديد'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    اسم القالب *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    الدورة (اختياري)
                  </label>
                  <select
                    value={formData.course_id}
                    onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">عام لجميع الدورات</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>{course.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  تصميم الشهادة (HTML) *
                </label>
                <textarea
                  value={formData.template_html}
                  onChange={(e) => setFormData({ ...formData, template_html: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={10}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  المتغيرات المتاحة: {'{'}{'employee_name}'}, {'{'}{'course_name}'}, {'{'}{'completion_date}'}, {'{'}{'score}'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    رابط صورة الخلفية
                  </label>
                  <input
                    type="url"
                    value={formData.background_image_url}
                    onChange={(e) => setFormData({ ...formData, background_image_url: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    رابط الشعار
                  </label>
                  <input
                    type="url"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    رابط التوقيع
                  </label>
                  <input
                    type="url"
                    value={formData.signature_image_url}
                    onChange={(e) => setFormData({ ...formData, signature_image_url: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">معاينة:</h3>
                <div
                  dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                  className="bg-white rounded-lg overflow-hidden"
                  style={{ transform: 'scale(0.5)', transformOrigin: 'top left', height: '300px' }}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  حفظ القالب
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedTemplate(null);
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

      {showPreview && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900">معاينة الشهادة</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-slate-500 hover:text-slate-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div
              dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
              className="flex items-center justify-center"
            />
          </div>
        </div>
      )}
    </div>
  );
};
