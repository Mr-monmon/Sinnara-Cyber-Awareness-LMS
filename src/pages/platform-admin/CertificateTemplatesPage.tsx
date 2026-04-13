import React, { useState, useEffect } from 'react';
import { Award, Plus, Edit2, Trash2, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CertificateTemplate } from '../../lib/types';


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

const buildPreviewDocument = (content: string) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
        overflow: hidden;
      }

      body {
        display: inline-block;
      }
    </style>
  </head>
  <body>${content}</body>
</html>
`;

export const CertificateTemplatesPage: React.FC = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CertificateTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    template_html: DEFAULT_TEMPLATE,
    background_image_url: '',
    logo_url: '',
    signature_image_url: ''
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('certificate_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setTemplates(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const templateData = {
        ...formData,
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
      template_html: DEFAULT_TEMPLATE,
      background_image_url: '',
      logo_url: '',
      signature_image_url: ''
    });
  };

  const getPreviewHtml = (templateHtml: string) => {
    return templateHtml
      .replace(/\{\{employee_name\}\}/g, 'أحمد محمد')
      .replace(/\{\{course_name\}\}/g, 'اسم الدورة')
      .replace(/\{\{completion_date\}\}/g, new Date().toLocaleDateString('ar'))
      .replace(/\{\{score\}\}/g, '95');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Certificate Templates</h1>
          <p className="text-slate-600 mt-2">Customize the design of the certificates issued</p>
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
          New Template
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
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="mb-4 bg-slate-50 rounded-lg p-3 text-center text-sm text-slate-600 overflow-hidden">
                <div style={{ height: '120px', overflow: 'hidden' }}>
                  <iframe
                    title={`${template.name} preview`}
                    srcDoc={buildPreviewDocument(
                      template.template_html
                        .replace(/\{\{employee_name\}\}/g, 'اسم الموظف')
                        .replace(/\{\{course_name\}\}/g, 'اسم الدورة')
                        .replace(/\{\{completion_date\}\}/g, 'التاريخ')
                        .replace(/\{\{score\}\}/g, '95')
                    )}
                    sandbox=""
                    style={{
                      width: '800px',
                      height: '600px',
                      border: '0',
                      display: 'block',
                      pointerEvents: 'none',
                      transform: 'scale(0.2)',
                      transformOrigin: 'top left'
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedTemplate(template);
                    setFormData({
                      name: template.name,
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
                  Preview
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-slate-200 bg-white">
              <h2 className="text-2xl font-bold text-slate-900">
                {selectedTemplate ? 'Edit Template' : 'Certificate Template'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Certificate Design (HTML) *
                </label>
                <textarea
                  value={formData.template_html}
                  onChange={(e) => setFormData({ ...formData, template_html: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={10}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Available Variables: {'{'}{'employee_name}'}, {'{'}{'course_name}'}, {'{'}{'completion_date}'}, {'{'}{'score}'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Background Image URL
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
                    Logo URL
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
                    Signature Image URL
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
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Preview:</h3>
                <div className="bg-white rounded-lg overflow-hidden" style={{ height: '300px' }}>
                  <iframe
                    title="Certificate editor preview"
                    srcDoc={buildPreviewDocument(getPreviewHtml(formData.template_html))}
                    sandbox=""
                    style={{
                      width: '800px',
                      height: '600px',
                      border: '0',
                      display: 'block',
                      pointerEvents: 'none',
                      transform: 'scale(0.5)',
                      transformOrigin: 'top left'
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Save Template
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedTemplate(null);
                  }}
                  className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
                >
                  Cancel
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
              <h2 className="text-2xl font-bold text-slate-900">Certificate Preview</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-slate-500 hover:text-slate-700 text-2xl"
              >
                Close
              </button>
            </div>
            <div className="bg-slate-50 rounded-lg overflow-auto p-4">
              <iframe
                title="Certificate full preview"
                srcDoc={buildPreviewDocument(getPreviewHtml(formData.template_html))}
                sandbox=""
                className="mx-auto block bg-white"
                style={{ width: '800px', height: '600px', border: '0' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
