import React, { useState, useEffect } from 'react';
import { Shield, ArrowLeft, Calendar, Users, FileText, Send, Eye, Mail, Globe, Lock, Activity } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { PhishingTemplate, PhishingCampaignQuota } from '../../types';

export const PhishingRequestPage: React.FC = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<PhishingTemplate[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [quota, setQuota] = useState<PhishingCampaignQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<PhishingTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'email' | 'landing' | 'tracking'>('basic');

  const [formData, setFormData] = useState({
    campaign_name: '',
    template_id: '',
    target_departments: [] as string[],
    scheduled_date: '',
    notes: '',
    priority: 'NORMAL',
    email_subject: '',
    email_html_body: '',
    email_text_body: '',
    landing_page_html: '',
    redirect_url: '',
    from_address: '',
    from_name: '',
    track_opens: true,
    track_clicks: true,
    capture_credentials: true,
    capture_passwords: false
  });

  useEffect(() => {
    loadFormData();
  }, [user]);

  const loadFormData = async () => {
    if (!user?.company_id) return;

    try {
      const currentYear = new Date().getFullYear();

      const [templatesRes, deptRes, quotaRes] = await Promise.all([
        supabase
          .from('phishing_templates')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('departments')
          .select('*')
          .eq('company_id', user.company_id)
          .order('name'),
        supabase
          .from('phishing_campaign_quotas')
          .select('*')
          .eq('company_id', user.company_id)
          .eq('quota_year', currentYear)
          .maybeSingle()
      ]);

      if (templatesRes.data) setTemplates(templatesRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
      if (quotaRes.data) setQuota(quotaRes.data);
    } catch (error) {
      console.error('Error loading form data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        template_id: templateId,
        email_subject: template.subject,
        email_html_body: template.html_content
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company_id || !user?.id) return;

    const remainingQuota = (quota?.annual_quota || 0) - (quota?.used_campaigns || 0);
    if (remainingQuota <= 0) {
      alert('No remaining quota. Please contact support.');
      return;
    }

    setSubmitting(true);

    try {
      const ticketNumber = await generateTicketNumber();
      const employeeCount = await calculateEmployeeCount(formData.target_departments);

      const { error } = await supabase
        .from('phishing_campaign_requests')
        .insert([{
          ticket_number: ticketNumber,
          company_id: user.company_id,
          requested_by: user.id,
          campaign_name: formData.campaign_name,
          template_id: formData.template_id || null,
          target_departments: formData.target_departments,
          target_employee_count: employeeCount,
          scheduled_date: formData.scheduled_date || null,
          status: 'SUBMITTED',
          priority: formData.priority,
          notes: formData.notes || null,
          email_subject: formData.email_subject || null,
          email_html_body: formData.email_html_body || null,
          email_text_body: formData.email_text_body || null,
          landing_page_html: formData.landing_page_html || null,
          redirect_url: formData.redirect_url || null,
          from_address: formData.from_address || null,
          from_name: formData.from_name || null,
          track_opens: formData.track_opens,
          track_clicks: formData.track_clicks,
          capture_credentials: formData.capture_credentials,
          capture_passwords: formData.capture_passwords
        }]);

      if (error) throw error;

      alert(`Campaign request submitted successfully! Ticket: ${ticketNumber}`);
      window.location.href = '/company/phishing-dashboard';
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const generateTicketNumber = async () => {
    const { data, error } = await supabase.rpc('generate_ticket_number');
    if (error || !data) {
      const timestamp = Date.now().toString().slice(-6);
      return `PHC-${timestamp}`;
    }
    return data;
  };

  const calculateEmployeeCount = async (deptIds: string[]) => {
    if (!user?.company_id) return 0;
    if (deptIds.length === 0) return 0;

    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', user.company_id)
      .eq('role', 'EMPLOYEE')
      .in('department_id', deptIds);

    return count || 0;
  };

  const toggleDepartment = (deptId: string) => {
    setFormData(prev => ({
      ...prev,
      target_departments: prev.target_departments.includes(deptId)
        ? prev.target_departments.filter(id => id !== deptId)
        : [...prev.target_departments, deptId]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const remainingQuota = (quota?.annual_quota || 0) - (quota?.used_campaigns || 0);
  const selectedTemplate = templates.find(t => t.id === formData.template_id);

  return (
    <div>
      <button
        onClick={() => window.location.href = '/company/phishing-dashboard'}
        className="mb-6 flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Create Phishing Campaign Request</h1>
        <p className="text-slate-600">Configure all elements of your phishing simulation campaign</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-blue-900">Campaign Quota</h3>
                  <p className="text-sm text-blue-700">
                    Remaining: {remainingQuota} of {quota?.annual_quota || 0} campaigns
                  </p>
                </div>
                <Shield className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            <div className="border-b border-slate-200 mb-6">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('basic')}
                  className={`px-4 py-2 font-medium transition-colors ${
                    activeTab === 'basic'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="inline h-4 w-4 mr-2" />
                  Basic Info
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('email')}
                  className={`px-4 py-2 font-medium transition-colors ${
                    activeTab === 'email'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mail className="inline h-4 w-4 mr-2" />
                  Email Template
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('landing')}
                  className={`px-4 py-2 font-medium transition-colors ${
                    activeTab === 'landing'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Globe className="inline h-4 w-4 mr-2" />
                  Landing Page
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('tracking')}
                  className={`px-4 py-2 font-medium transition-colors ${
                    activeTab === 'tracking'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Activity className="inline h-4 w-4 mr-2" />
                  Tracking
                </button>
              </div>
            </div>

            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.campaign_name}
                    onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Q4 2025 Security Awareness Test"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Phishing Template
                  </label>
                  <select
                    value={formData.template_id}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a template (or create custom below)...</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.difficulty_level})
                      </option>
                    ))}
                  </select>
                  {selectedTemplate && (
                    <button
                      type="button"
                      onClick={() => setPreviewTemplate(selectedTemplate)}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Eye className="h-4 w-4" />
                      Preview Template
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Target Departments * (Select Recipient Groups)
                  </label>
                  <div className="border border-slate-300 rounded-lg p-4 max-h-48 overflow-y-auto">
                    {departments.length > 0 ? (
                      departments.map((dept) => (
                        <label key={dept.id} className="flex items-center gap-2 py-2 hover:bg-slate-50 px-2 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.target_departments.includes(dept.id)}
                            onChange={() => toggleDepartment(dept.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-slate-700">{dept.name}</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No departments available</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Scheduled Launch Date (ISO8601)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                  <p className="text-xs text-slate-500 mt-1">Leave empty to launch immediately upon approval</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Any specific requirements or instructions..."
                  />
                </div>
              </div>
            )}

            {activeTab === 'email' && (
              <div className="space-y-6">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <p className="text-amber-800">
                    <strong>Template Variables:</strong> Use <code className="bg-amber-100 px-1 rounded">{'{{.FirstName}}'}</code>, <code className="bg-amber-100 px-1 rounded">{'{{.LastName}}'}</code>, <code className="bg-amber-100 px-1 rounded">{'{{.Email}}'}</code>, <code className="bg-amber-100 px-1 rounded">{'{{.URL}}'}</code> to personalize emails.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    From Name (SMTP Profile)
                  </label>
                  <input
                    type="text"
                    value={formData.from_name}
                    onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="IT Support Team"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    From Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.from_address}
                    onChange={(e) => setFormData({ ...formData, from_address: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="support@company.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Subject *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.email_subject}
                    onChange={(e) => setFormData({ ...formData, email_subject: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Urgent: Password Reset Required"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    HTML Body *
                  </label>
                  <textarea
                    required
                    value={formData.email_html_body}
                    onChange={(e) => setFormData({ ...formData, email_html_body: e.target.value })}
                    rows={10}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="<html><body><p>Hello {{.FirstName}},</p><p>Click here: <a href='{{.URL}}'>Reset Password</a></p></body></html>"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Plain Text Body (Optional)
                  </label>
                  <textarea
                    value={formData.email_text_body}
                    onChange={(e) => setFormData({ ...formData, email_text_body: e.target.value })}
                    rows={6}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="Hello {{.FirstName}}, Click here to reset: {{.URL}}"
                  />
                </div>
              </div>
            )}

            {activeTab === 'landing' && (
              <div className="space-y-6">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <p className="text-blue-800">
                    <strong>Landing Page:</strong> The page displayed when users click the phishing link. Can capture credentials or redirect to a real website.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Landing Page HTML
                  </label>
                  <textarea
                    value={formData.landing_page_html}
                    onChange={(e) => setFormData({ ...formData, landing_page_html: e.target.value })}
                    rows={12}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="<html><body><h2>Account Verification</h2><form><input name='username' placeholder='Email' /><input name='password' type='password' placeholder='Password' /><button>Submit</button></form></body></html>"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Redirect URL (After Landing Page)
                  </label>
                  <input
                    type="url"
                    value={formData.redirect_url}
                    onChange={(e) => setFormData({ ...formData, redirect_url: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://www.company.com/security-awareness"
                  />
                  <p className="text-xs text-slate-500 mt-1">Where to redirect users after they interact with the landing page</p>
                </div>
              </div>
            )}

            {activeTab === 'tracking' && (
              <div className="space-y-6">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm">
                  <p className="text-green-800">
                    <strong>Tracking Options:</strong> Configure what user actions to monitor during the campaign.
                  </p>
                </div>

                <div className="space-y-4">
                  <label className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.track_opens}
                      onChange={(e) => setFormData({ ...formData, track_opens: e.target.checked })}
                      className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">Track Email Opens</div>
                      <div className="text-sm text-slate-600">Monitor when recipients open the phishing email</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.track_clicks}
                      onChange={(e) => setFormData({ ...formData, track_clicks: e.target.checked })}
                      className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">Track Link Clicks</div>
                      <div className="text-sm text-slate-600">Monitor when recipients click links in the email</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.capture_credentials}
                      onChange={(e) => setFormData({ ...formData, capture_credentials: e.target.checked })}
                      className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">Capture Credential Submissions</div>
                      <div className="text-sm text-slate-600">Track when users enter credentials on the landing page</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.capture_passwords}
                      onChange={(e) => setFormData({ ...formData, capture_passwords: e.target.checked })}
                      className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900 flex items-center gap-2">
                        Capture Actual Passwords
                        <Lock className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="text-sm text-slate-600">Store actual passwords entered (use with caution - security risk)</div>
                    </div>
                  </label>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <p className="text-amber-800">
                    <strong>Note:</strong> All captured data is encrypted and only accessible to authorized administrators. Capturing actual passwords is not recommended for security reasons.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-slate-200">
              <button
                type="submit"
                disabled={submitting || remainingQuota <= 0 || formData.target_departments.length === 0 || !formData.campaign_name || !formData.email_subject || !formData.email_html_body}
                className={`w-full py-3 rounded-lg transition-all flex items-center justify-center gap-2 font-medium ${
                  submitting || remainingQuota <= 0 || formData.target_departments.length === 0 || !formData.campaign_name || !formData.email_subject || !formData.email_html_body
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-md hover:shadow-lg'
                }`}
              >
                <Send className="h-5 w-5" />
                {submitting ? 'Submitting Campaign Request...' : 'Submit Campaign Request'}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">style Campaign Elements</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${formData.campaign_name ? 'bg-green-500' : 'bg-slate-300'}`} />
                <div>
                  <div className="font-medium text-slate-900">Campaign Name</div>
                  <div className="text-slate-600">Appears in reports</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${formData.email_subject && formData.email_html_body ? 'bg-green-500' : 'bg-slate-300'}`} />
                <div>
                  <div className="font-medium text-slate-900">Email Template</div>
                  <div className="text-slate-600">Subject, HTML/Text body</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${formData.landing_page_html ? 'bg-green-500' : 'bg-slate-300'}`} />
                <div>
                  <div className="font-medium text-slate-900">Landing Page</div>
                  <div className="text-slate-600">Capture credentials</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${formData.target_departments.length > 0 ? 'bg-green-500' : 'bg-slate-300'}`} />
                <div>
                  <div className="font-medium text-slate-900">Target Group</div>
                  <div className="text-slate-600">Recipient departments</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${formData.from_address ? 'bg-green-500' : 'bg-slate-300'}`} />
                <div>
                  <div className="font-medium text-slate-900">Sending Profile</div>
                  <div className="text-slate-600">SMTP configuration</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${formData.scheduled_date ? 'bg-green-500' : 'bg-amber-500'}`} />
                <div>
                  <div className="font-medium text-slate-900">Scheduling</div>
                  <div className="text-slate-600">{formData.scheduled_date ? 'Scheduled' : 'Immediate launch'}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className={`w-2 h-2 rounded-full mt-1.5 bg-green-500`} />
                <div>
                  <div className="font-medium text-slate-900">Tracking Options</div>
                  <div className="text-slate-600">Opens, clicks, credentials</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">What Happens Next?</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">Request Submitted</h4>
                  <p className="text-sm text-slate-600">Your request is sent to platform team</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">Review & Setup</h4>
                  <p className="text-sm text-slate-600">Team configures campaign</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">Campaign Launched</h4>
                  <p className="text-sm text-slate-600">Phishing emails sent to targets</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">Results & Analytics</h4>
                  <p className="text-sm text-slate-600">View detailed metrics</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-3">Best Practices</h3>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Use template variables for personalization</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Test HTML rendering before submission</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Schedule during business hours</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Enable all tracking options for insights</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                <span>Review department vulnerability after completion</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Template Preview</h2>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <h3 className="font-bold text-slate-900">{previewTemplate.name}</h3>
                <p className="text-sm text-slate-600">{previewTemplate.description}</p>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    {previewTemplate.category}
                  </span>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                    {previewTemplate.difficulty_level}
                  </span>
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="mb-2">
                  <strong>Subject:</strong> {previewTemplate.subject}
                </div>
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewTemplate.html_content }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
