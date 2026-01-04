import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface FraudAlert {
  id: string;
  title: string;
  fraud_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  public_summary: string;
  internal_content: string;
  video_url?: string;
  safety_tips: string[];
  internal_steps: string[];
  is_published: boolean;
  created_at: string;
}

export const FraudAlertsManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    fraud_type: '',
    severity: 'MEDIUM' as const,
    public_summary: '',
    internal_content: '',
    video_url: '',
    safety_tips: [''],
    internal_steps: [''],
    is_published: false,
  });

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    const { data, error } = await supabase
      .from('fraud_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAlerts(data);
    }
    setLoading(false);
  };

  const handleAddTip = () => {
    setFormData((prev) => ({
      ...prev,
      safety_tips: [...prev.safety_tips, ''],
    }));
  };

  const handleRemoveTip = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      safety_tips: prev.safety_tips.filter((_, i) => i !== index),
    }));
  };

  const handleAddStep = () => {
    setFormData((prev) => ({
      ...prev,
      internal_steps: [...prev.internal_steps, ''],
    }));
  };

  const handleRemoveStep = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      internal_steps: prev.internal_steps.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    const dataToSave = {
      ...formData,
      safety_tips: formData.safety_tips.filter((t) => t.trim()),
      internal_steps: formData.internal_steps.filter((s) => s.trim()),
      created_by: user.id,
    };

    try {
      if (editingId) {
        await supabase
          .from('fraud_alerts')
          .update(dataToSave)
          .eq('id', editingId);
      } else {
        await supabase.from('fraud_alerts').insert(dataToSave);
      }

      await fetchAlerts();
      setShowForm(false);
      setEditingId(null);
      setFormData({
        title: '',
        fraud_type: '',
        severity: 'MEDIUM',
        public_summary: '',
        internal_content: '',
        video_url: '',
        safety_tips: [''],
        internal_steps: [''],
        is_published: false,
      });
    } catch (error) {
      console.error('Error saving alert:', error);
    }
  };

  const handleEdit = (alert: FraudAlert) => {
    setFormData({
      title: alert.title,
      fraud_type: alert.fraud_type,
      severity: alert.severity,
      public_summary: alert.public_summary,
      internal_content: alert.internal_content,
      video_url: alert.video_url || '',
      safety_tips: alert.safety_tips || [''],
      internal_steps: alert.internal_steps || [''],
      is_published: alert.is_published,
    });
    setEditingId(alert.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) return;

    try {
      await supabase.from('fraud_alerts').delete().eq('id', id);
      await fetchAlerts();
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'text-red-700 bg-red-50';
      case 'MEDIUM':
        return 'text-yellow-700 bg-yellow-50';
      case 'LOW':
        return 'text-blue-700 bg-blue-50';
      default:
        return 'text-gray-700 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fraud Alerts Management</h1>
          <p className="text-gray-600 mt-2">Create and manage fraud alerts for the platform</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({
              title: '',
              fraud_type: '',
              severity: 'MEDIUM',
              public_summary: '',
              internal_content: '',
              video_url: '',
              safety_tips: [''],
              internal_steps: [''],
              is_published: false,
            });
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Alert
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Alert' : 'Create New Alert'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Alert Title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                required
                className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <input
                type="text"
                placeholder="Fraud Type (SMS, WhatsApp, Banking, etc.)"
                value={formData.fraud_type}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, fraud_type: e.target.value }))
                }
                required
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <select
                value={formData.severity}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    severity: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH',
                  }))
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="LOW">Low Severity</option>
                <option value="MEDIUM">Medium Severity</option>
                <option value="HIGH">High Severity</option>
              </select>
            </div>

            <textarea
              placeholder="Public Summary (shown to everyone)"
              value={formData.public_summary}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  public_summary: e.target.value,
                }))
              }
              required
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <textarea
              placeholder="Internal Content (full details for employees)"
              value={formData.internal_content}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  internal_content: e.target.value,
                }))
              }
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <input
              type="url"
              placeholder="Video URL (YouTube or direct video link)"
              value={formData.video_url}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, video_url: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Safety Tips
              </label>
              <div className="space-y-2">
                {formData.safety_tips.map((tip, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={`Safety tip ${idx + 1}`}
                      value={tip}
                      onChange={(e) => {
                        const newTips = [...formData.safety_tips];
                        newTips[idx] = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          safety_tips: newTips,
                        }));
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {formData.safety_tips.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTip(idx)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddTip}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add Safety Tip
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Internal Action Steps
              </label>
              <div className="space-y-2">
                {formData.internal_steps.map((step, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={`Action step ${idx + 1}`}
                      value={step}
                      onChange={(e) => {
                        const newSteps = [...formData.internal_steps];
                        newSteps[idx] = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          internal_steps: newSteps,
                        }));
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {formData.internal_steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(idx)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add Action Step
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_published}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    is_published: e.target.checked,
                  }))
                }
                className="w-4 h-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Publish Alert (make visible to users)
              </span>
            </label>

            <div className="flex gap-2 pt-4 border-t border-gray-200">
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {editingId ? 'Update Alert' : 'Create Alert'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No alerts yet. Create your first fraud alert.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-white border border-gray-200 rounded-lg p-4 flex items-start justify-between hover:border-gray-300 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${getSeverityColor(
                      alert.severity
                    )}`}
                  >
                    {alert.severity}
                  </span>
                  {alert.is_published ? (
                    <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded font-medium">
                      <Eye className="w-3 h-3" />
                      Published
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded font-medium">
                      <EyeOff className="w-3 h-3" />
                      Draft
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  Type: {alert.fraud_type} • Created: {new Date(alert.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleEdit(alert)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(alert.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
