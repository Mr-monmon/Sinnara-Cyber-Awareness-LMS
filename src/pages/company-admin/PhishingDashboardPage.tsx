import React, { useState, useEffect } from 'react';
import { Shield, Target, TrendingUp, AlertCircle, Plus, Download, Calendar, Users, MousePointerClick, Flag, KeyRound, BarChart3, Building2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { PhishingCampaignQuota, PhishingCampaign, PhishingCampaignRequest, DepartmentVulnerabilityStats } from '../../types';

export const PhishingDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [quota, setQuota] = useState<PhishingCampaignQuota | null>(null);
  const [campaigns, setCampaigns] = useState<PhishingCampaign[]>([]);
  const [requests, setRequests] = useState<PhishingCampaignRequest[]>([]);
  const [departmentStats, setDepartmentStats] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user?.company_id) return;

    try {
      const currentYear = new Date().getFullYear();

      const [quotaRes, campaignsRes, requestsRes, deptsRes] = await Promise.all([
        supabase
          .from('phishing_campaign_quotas')
          .select('*')
          .eq('company_id', user.company_id)
          .eq('quota_year', currentYear)
          .maybeSingle(),
        supabase
          .from('phishing_campaigns')
          .select('*')
          .eq('company_id', user.company_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('phishing_campaign_requests')
          .select('*')
          .eq('company_id', user.company_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('departments')
          .select('*')
          .eq('company_id', user.company_id)
          .order('name')
      ]);

      if (quotaRes.data) setQuota(quotaRes.data);
      if (campaignsRes.data) setCampaigns(campaignsRes.data);
      if (requestsRes.data) setRequests(requestsRes.data);
      if (deptsRes.data) setDepartments(deptsRes.data);

      if (campaignsRes.data && campaignsRes.data.length > 0) {
        const latestCompletedCampaign = campaignsRes.data.find(c => c.status === 'COMPLETED');
        if (latestCompletedCampaign) {
          setSelectedCampaign(latestCompletedCampaign.id);
          await loadDepartmentStats(latestCompletedCampaign.id);
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartmentStats = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from('department_vulnerability_stats')
        .select(`
          *,
          department:departments(name)
        `)
        .eq('campaign_id', campaignId)
        .order('vulnerability_score', { ascending: false });

      if (error) throw error;
      if (data) setDepartmentStats(data);
    } catch (error) {
      console.error('Error loading department stats:', error);
    }
  };

  const handleCampaignSelect = async (campaignId: string) => {
    setSelectedCampaign(campaignId);
    await loadDepartmentStats(campaignId);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-700',
      SUBMITTED: 'bg-blue-100 text-blue-700',
      APPROVED: 'bg-green-100 text-green-700',
      RUNNING: 'bg-orange-100 text-orange-700',
      COMPLETED: 'bg-purple-100 text-purple-700',
      REJECTED: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const getVulnerabilityColor = (score: number) => {
    if (score >= 76) return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'Critical' };
    if (score >= 51) return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', label: 'High Risk' };
    if (score >= 26) return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', label: 'Moderate' };
    return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', label: 'Low Risk' };
  };

  const exportToExcel = () => {
    const csvData = campaigns.map(c => ({
      'Campaign Name': c.campaign_name,
      'Status': c.status,
      'Launch Date': c.launch_date ? new Date(c.launch_date).toLocaleDateString() : 'N/A',
      'Total Targets': c.total_targets,
      'Emails Sent': c.emails_sent,
      'Open Rate %': c.open_rate || 0,
      'Click Rate %': c.click_rate || 0,
      'Credential Rate %': c.credential_rate || 0,
      'Reporting Rate %': c.reporting_rate || 0,
      'Opened': c.emails_opened,
      'Clicked': c.links_clicked,
      'Credentials Entered': c.credentials_entered || 0,
      'Reported': c.emails_reported
    }));

    const csv = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `phishing-campaigns-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const remainingQuota = (quota?.annual_quota || 0) - (quota?.used_campaigns || 0);
  const completedCampaigns = campaigns.filter(c => c.status === 'COMPLETED');

  const avgClickRate = completedCampaigns.length > 0
    ? (completedCampaigns.reduce((sum, c) => sum + (c.click_rate || 0), 0) / completedCampaigns.length).toFixed(1)
    : '0';

  const avgReportingRate = completedCampaigns.length > 0
    ? (completedCampaigns.reduce((sum, c) => sum + (c.reporting_rate || 0), 0) / completedCampaigns.length).toFixed(1)
    : '0';

  const avgCredentialRate = completedCampaigns.length > 0
    ? (completedCampaigns.reduce((sum, c) => sum + (c.credential_rate || 0), 0) / completedCampaigns.length).toFixed(1)
    : '0';

  const selectedCampaignData = campaigns.find(c => c.id === selectedCampaign);
  const previousCampaigns = completedCampaigns.slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Phishing Campaigns Dashboard</h1>
          <p className="text-slate-600">Comprehensive analytics and department vulnerability analysis</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Analytics
          </button>
          <button
            onClick={() => window.location.href = '/company/phishing-request'}
            disabled={remainingQuota <= 0}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              remainingQuota > 0
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Plus className="h-4 w-4" />
            Create Campaign
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <span className={`text-3xl font-bold ${remainingQuota > 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {remainingQuota}
            </span>
          </div>
          <div className="text-sm font-medium text-slate-600">Campaigns Remaining</div>
          <div className="text-xs text-slate-500 mt-1">of {quota?.annual_quota || 0} annual quota</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-red-50 rounded-lg">
              <MousePointerClick className="h-6 w-6 text-red-600" />
            </div>
            <span className="text-3xl font-bold text-red-600">{avgClickRate}%</span>
          </div>
          <div className="text-sm font-medium text-slate-600">Avg Click Rate</div>
          <div className="text-xs text-slate-500 mt-1">employees clicked links</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-green-50 rounded-lg">
              <Flag className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-3xl font-bold text-green-600">{avgReportingRate}%</span>
          </div>
          <div className="text-sm font-medium text-slate-600">Avg Reporting Rate</div>
          <div className="text-xs text-slate-500 mt-1">employees reported phishing</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-orange-50 rounded-lg">
              <KeyRound className="h-6 w-6 text-orange-600" />
            </div>
            <span className="text-3xl font-bold text-orange-600">{avgCredentialRate}%</span>
          </div>
          <div className="text-sm font-medium text-slate-600">Avg Credential Rate</div>
          <div className="text-xs text-slate-500 mt-1">entered credentials</div>
        </div>
      </div>

      {remainingQuota <= 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Quota Exhausted</h3>
            <p className="text-sm text-red-700">
              You have used all {quota?.annual_quota || 0} campaigns for this year. Contact support to increase your quota.
            </p>
          </div>
        </div>
      )}

      {selectedCampaignData && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Campaign Analytics</h2>
              <p className="text-sm text-slate-600">Detailed metrics for selected campaign</p>
            </div>
            <select
              value={selectedCampaign || ''}
              onChange={(e) => handleCampaignSelect(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {completedCampaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.campaign_name} - {campaign.completion_date ? new Date(campaign.completion_date).toLocaleDateString() : 'N/A'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-600">Open Rate</span>
                <TrendingUp className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{selectedCampaignData.open_rate || 0}%</div>
              <div className="text-xs text-slate-500 mt-1">
                {selectedCampaignData.emails_opened} of {selectedCampaignData.emails_sent} opened
              </div>
            </div>

            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-red-700">Click Rate</span>
                <MousePointerClick className="h-4 w-4 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-red-700">{selectedCampaignData.click_rate || 0}%</div>
              <div className="text-xs text-red-600 mt-1">
                {selectedCampaignData.links_clicked} of {selectedCampaignData.emails_sent} clicked
              </div>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-orange-700">Credential Rate</span>
                <KeyRound className="h-4 w-4 text-orange-600" />
              </div>
              <div className="text-2xl font-bold text-orange-700">{selectedCampaignData.credential_rate || 0}%</div>
              <div className="text-xs text-orange-600 mt-1">
                {selectedCampaignData.credentials_entered || 0} entered credentials
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-700">Reporting Rate</span>
                <Flag className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-700">{selectedCampaignData.reporting_rate || 0}%</div>
              <div className="text-xs text-green-600 mt-1">
                {selectedCampaignData.emails_reported} reported phishing
              </div>
            </div>
          </div>

          {departmentStats.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-slate-600" />
                <h3 className="text-lg font-bold text-slate-900">Department Vulnerability Analysis</h3>
              </div>
              <div className="space-y-3">
                {departmentStats.map((stat: any) => {
                  const vulnColor = getVulnerabilityColor(stat.vulnerability_score);
                  const clickRate = stat.total_targets > 0 ? ((stat.links_clicked / stat.total_targets) * 100).toFixed(1) : '0';
                  const reportRate = stat.total_targets > 0 ? ((stat.emails_reported / stat.total_targets) * 100).toFixed(1) : '0';
                  const credRate = stat.total_targets > 0 ? ((stat.credentials_entered / stat.total_targets) * 100).toFixed(1) : '0';

                  return (
                    <div key={stat.id} className={`p-4 rounded-lg border-2 ${vulnColor.border} ${vulnColor.bg}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-900">{stat.department?.name || 'Unknown Department'}</h4>
                          <p className="text-sm text-slate-600">{stat.total_targets} employees targeted</p>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${vulnColor.text}`}>
                            {stat.vulnerability_score.toFixed(0)}
                          </div>
                          <div className={`text-xs font-medium ${vulnColor.text}`}>
                            {vulnColor.label}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div className="text-center p-2 bg-white/50 rounded">
                          <div className="font-semibold text-slate-900">{stat.emails_opened}</div>
                          <div className="text-slate-600">Opened</div>
                        </div>
                        <div className="text-center p-2 bg-white/50 rounded">
                          <div className="font-semibold text-red-700">{stat.links_clicked}</div>
                          <div className="text-slate-600">Clicked ({clickRate}%)</div>
                        </div>
                        <div className="text-center p-2 bg-white/50 rounded">
                          <div className="font-semibold text-orange-700">{stat.credentials_entered}</div>
                          <div className="text-slate-600">Credentials ({credRate}%)</div>
                        </div>
                        <div className="text-center p-2 bg-white/50 rounded">
                          <div className="font-semibold text-green-700">{stat.emails_reported}</div>
                          <div className="text-slate-600">Reported ({reportRate}%)</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <strong>Vulnerability Score:</strong> 0-25 (Low Risk), 26-50 (Moderate), 51-75 (High Risk), 76-100 (Critical). Higher scores indicate departments needing immediate security training.
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-bold text-slate-900">Campaign Comparison</h2>
          </div>
          <div className="space-y-3">
            {previousCampaigns.length > 0 ? (
              previousCampaigns.map((campaign, index) => {
                const prevCampaign = previousCampaigns[index + 1];
                const clickTrend = prevCampaign ? (campaign.click_rate || 0) - (prevCampaign.click_rate || 0) : 0;
                const reportTrend = prevCampaign ? (campaign.reporting_rate || 0) - (prevCampaign.reporting_rate || 0) : 0;

                return (
                  <div key={campaign.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">{campaign.campaign_name}</h3>
                        <p className="text-sm text-slate-600">
                          {campaign.completion_date ? new Date(campaign.completion_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      {index === 0 && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs mt-3">
                      <div className="text-center">
                        <div className="font-semibold text-slate-900">{campaign.open_rate || 0}%</div>
                        <div className="text-slate-600">Opens</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-red-700 flex items-center justify-center gap-1">
                          {campaign.click_rate || 0}%
                          {prevCampaign && clickTrend !== 0 && (
                            clickTrend < 0 ?
                              <ArrowDownRight className="h-3 w-3 text-green-600" /> :
                              <ArrowUpRight className="h-3 w-3 text-red-600" />
                          )}
                        </div>
                        <div className="text-slate-600">Clicks</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-orange-700">{campaign.credential_rate || 0}%</div>
                        <div className="text-slate-600">Creds</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-green-700 flex items-center justify-center gap-1">
                          {campaign.reporting_rate || 0}%
                          {prevCampaign && reportTrend !== 0 && (
                            reportTrend > 0 ?
                              <ArrowUpRight className="h-3 w-3 text-green-600" /> :
                              <ArrowDownRight className="h-3 w-3 text-red-600" />
                          )}
                        </div>
                        <div className="text-slate-600">Reports</div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-500">
                <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p>No completed campaigns to compare</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Campaign Requests</h2>
          <div className="space-y-3">
            {requests.length > 0 ? (
              requests.slice(0, 5).map((request) => (
                <div key={request.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900">{request.campaign_name}</h3>
                      <p className="text-sm text-slate-600">{request.ticket_number}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(request.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {request.target_employee_count} targets
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Shield className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p>No campaign requests yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Target className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 mb-2">Understanding Your Analytics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MousePointerClick className="h-4 w-4 text-red-600" />
                  <strong className="text-slate-900">Click Rate:</strong>
                </div>
                <p className="text-slate-600">Percentage of employees who clicked phishing links. Lower is better.</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Flag className="h-4 w-4 text-green-600" />
                  <strong className="text-slate-900">Reporting Rate:</strong>
                </div>
                <p className="text-slate-600">Percentage who reported the phishing attempt. Higher is better!</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound className="h-4 w-4 text-orange-600" />
                  <strong className="text-slate-900">Credential Rate:</strong>
                </div>
                <p className="text-slate-600">Percentage who entered credentials on fake page. Lower is better.</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-purple-600" />
                  <strong className="text-slate-900">Department Vulnerability:</strong>
                </div>
                <p className="text-slate-600">Identifies departments needing additional security training.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
