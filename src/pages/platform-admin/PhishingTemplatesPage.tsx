import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Mail, Eye, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface PhishingTemplate {
  id: string;
  name: string;
  description: string | null;
  subject: string;
  html_content: string;
  category: string;
  difficulty_level: string;
  language: string;
  is_active: boolean;
  created_at: string;
}

export const PhishingTemplatesPage: React.FC = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<PhishingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PhishingTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<PhishingTemplate | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subject: '',
    html_content: '',
    category: 'GENERAL',
    difficulty_level: 'MEDIUM',
    language: 'en',
    is_active: true
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('phishing_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('phishing_templates')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
        alert('Template updated successfully!');
      } else {
        const { error } = await supabase
          .from('phishing_templates')
          .insert([{
            ...formData,
            created_by: user?.id
          }]);

        if (error) throw error;
        alert('Template created successfully!');
      }

      setShowModal(false);
      resetForm();
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template: ' + (error as any).message);
    }
  };

  const handleEdit = (template: PhishingTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      subject: template.subject,
      html_content: template.html_content,
      category: template.category,
      difficulty_level: template.difficulty_level,
      language: template.language,
      is_active: template.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('phishing_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Template deleted successfully!');
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  };

  const toggleActive = async (template: PhishingTemplate) => {
    try {
      const { error } = await supabase
        .from('phishing_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);

      if (error) throw error;
      loadTemplates();
    } catch (error) {
      console.error('Error toggling template status:', error);
      alert('Failed to update template status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      subject: '',
      html_content: '',
      category: 'GENERAL',
      difficulty_level: 'MEDIUM',
      language: 'en',
      is_active: true
    });
    setEditingTemplate(null);
  };

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'EASY': return 'bg-green-100 text-green-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'HARD': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'GENERAL': return 'bg-blue-100 text-blue-800';
      case 'SPEAR_PHISHING': return 'bg-purple-100 text-purple-800';
      case 'CREDENTIAL_HARVEST': return 'bg-orange-100 text-orange-800';
      case 'MALWARE': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Phishing Templates</h1>
          <p className="text-slate-600">Manage email templates for phishing campaigns</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg transition-all font-medium"
        >
          <Plus className="h-5 w-5" />
          Add Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div key={template.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Mail className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{template.name}</h3>
                    <p className="text-xs text-slate-500">{template.language.toUpperCase()}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(template)}
                  className="p-1 hover:bg-slate-100 rounded transition-colors"
                >
                  {template.is_active ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </button>
              </div>

              <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                {template.description || 'No description'}
              </p>

              <div className="mb-4">
                <div className="text-xs font-medium text-slate-500 mb-1">Subject:</div>
                <div className="text-sm text-slate-900 font-medium line-clamp-1">{template.subject}</div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(template.category)}`}>
                  {template.category.replace('_', ' ')}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(template.difficulty_level)}`}>
                  {template.difficulty_level}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewTemplate(template)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium"
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </button>
                <button
                  onClick={() => handleEdit(template)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
          <Mail className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-lg font-medium">No templates yet.</p>
          <p className="text-sm">Click "Add Template" to create your first phishing template!</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., IT Security Update"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="GENERAL">General</option>
                    <option value="SPEAR_PHISHING">Spear Phishing</option>
                    <option value="CREDENTIAL_HARVEST">Credential Harvest</option>
                    <option value="MALWARE">Malware</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Difficulty Level *
                  </label>
                  <select
                    value={formData.difficulty_level}
                    onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Language *
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Brief description of this template..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email Subject *
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Urgent: Security Update Required"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  HTML Content *
                </label>
                <textarea
                  value={formData.html_content}
                  onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  rows={10}
                  placeholder="<html>&#10;  <body>&#10;    Your email content here...&#10;  </body>&#10;</html>"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use HTML to create your email template. You can include variables like {'{'}username{'}'} for personalization.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
                  Template is active and available for use
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg transition-all font-medium"
              >
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Template Preview</h2>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XCircle className="h-6 w-6 text-slate-600" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                <div className="text-sm text-slate-600 mb-1">Subject:</div>
                <div className="font-semibold text-slate-900">{previewTemplate.subject}</div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                  <span className="text-sm font-medium text-slate-700">Email Content</span>
                </div>
                <div className="p-6 bg-white">
                  <div dangerouslySetInnerHTML={{ __html: previewTemplate.html_content }} />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
