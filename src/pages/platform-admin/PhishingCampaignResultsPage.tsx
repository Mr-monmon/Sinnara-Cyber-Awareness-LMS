import React, { useState, useEffect } from 'react';
import { Upload, AlertCircle, CheckCircle, Loader, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { parseCSV, calculateCampaignStats, getStatusFromRecord } from '../../lib/gophishCsvParser';

interface Campaign {
  id: string;
  campaign_name: string;
  company_id: string;
  companies?: { name: string };
  status: string;
}

interface TargetData {
  campaign_id: string;
  email: string;
  first_name: string;
  last_name: string;
  position: string;
  status: string;
}

interface CampaignDetails extends Campaign {
  targets?: Array<{
    id: string;
    employee_id: string;
    employee?: {
      full_name: string;
      email: string;
      department?: { name: string };
    };
    clicked: boolean;
    reported: boolean;
    submitted_data: boolean;
    clicked_at: string | null;
  }>;
  created_by?: {
    full_name: string;
    email: string;
  };
}

export const PhishingCampaignResultsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [csvData, setCsvData] = useState<any>(null);
  const [targetData, setTargetData] = useState<TargetData[]>([]);
  const [viewDetailsModal, setViewDetailsModal] = useState(false);
  const [campaignDetails, setCampaignDetails] = useState<CampaignDetails | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      console.log('Loading campaigns for results upload...');

      const { data, error: err } = await supabase
        .from('phishing_campaigns')
        .select(`
          id,
          campaign_name,
          status,
          start_date,
          end_date,
          company_id,
          companies(name)
        `)
        .in('status', ['RUNNING', 'COMPLETED', 'APPROVED'])
        .order('created_at', { ascending: false });

      if (err) {
        console.error('Error loading campaigns:', err);
        throw err;
      }

      console.log('Loaded campaigns:', data);

      if (data) setCampaigns(data as Campaign[]);
    } catch (err) {
      console.error('Error loading campaigns:', err);
      setError('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');

    try {
      const content = await file.text();
      const parsed = parseCSV(content);
      setCsvData(parsed);

      const targets: TargetData[] = parsed.records.map(record => ({
        campaign_id: selectedCampaign!.id,
        email: record.email,
        first_name: record.first_name,
        last_name: record.last_name,
        position: record.position,
        status: getStatusFromRecord(record)
      }));

      setTargetData(targets);
      setSuccess(`Parsed ${parsed.records.length} records from CSV`);
    } catch (err: any) {
      setError(err.message || 'Failed to parse CSV file');
    }
  };

  const handleViewDetails = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from('phishing_campaigns')
        .select(`
          *,
          company:companies(id, name),
          created_by:users!phishing_campaigns_created_by_fkey(full_name, email),
          targets:phishing_campaign_targets(
            id,
            employee_id,
            employee:users(full_name, email, department:departments(name)),
            clicked,
            reported,
            submitted_data,
            clicked_at
          )
        `)
        .eq('id', campaignId)
        .single();

      if (error) throw error;

      setCampaignDetails(data as CampaignDetails);
      setViewDetailsModal(true);
    } catch (err: any) {
      console.error('Error loading campaign details:', err);
      setError('Failed to load campaign details: ' + err.message);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCampaign || !csvData) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const stats = calculateCampaignStats(csvData.records);

      await supabase
        .from('phishing_campaigns')
        .update({
          total_targets: stats.total_targets,
          emails_sent: stats.emails_sent,
          emails_opened: stats.emails_opened,
          links_clicked: stats.links_clicked,
          data_submitted: stats.data_submitted,
          emails_reported: stats.emails_reported,
          status: 'COMPLETED',
          completion_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedCampaign.id);

      for (const target of targetData) {
        const gophishRecord = csvData.records.find(r => r.email === target.email);
        if (!gophishRecord) continue;

        const { data: existingTarget } = await supabase
          .from('phishing_campaign_targets')
          .select('id')
          .eq('campaign_id', selectedCampaign.id)
          .eq('email', target.email)
          .maybeSingle();

        const updateData: any = {
          status: target.status,
          sent_at: gophishRecord.send_date ? new Date(gophishRecord.send_date).toISOString() : null
        };

        if (target.status === 'OPENED') {
          updateData.opened_at = new Date(gophishRecord.modified_date).toISOString();
        } else if (target.status === 'CLICKED') {
          updateData.clicked_at = new Date(gophishRecord.modified_date).toISOString();
        } else if (target.status === 'SUBMITTED') {
          updateData.submitted_at = new Date(gophishRecord.modified_date).toISOString();
        } else if (target.status === 'REPORTED') {
          updateData.reported_at = new Date(gophishRecord.modified_date).toISOString();
        }

        if (existingTarget) {
          await supabase
            .from('phishing_campaign_targets')
            .update(updateData)
            .eq('id', existingTarget.id);
        } else {
          await supabase
            .from('phishing_campaign_targets')
            .insert([{
              campaign_id: selectedCampaign.id,
              employee_id: '00000000-0000-0000-0000-000000000000',
              email: target.email,
              first_name: target.first_name,
              last_name: target.last_name,
              position: target.position,
              ...updateData
            }]);
        }
      }

      setSuccess('Campaign results uploaded successfully!');
      setCsvData(null);
      setTargetData([]);
      setSelectedCampaign(null);
      loadCampaigns();
    } catch (err: any) {
      console.error('Error uploading results:', err);
      setError(err.message || 'Failed to upload campaign results');
    } finally {
      setUploading(false);
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Phishing Campaign Results</h1>
        <p className="text-slate-600">Upload Gophish campaign statistics to update campaign records</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Select Campaign</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {campaigns.length > 0 ? (
                campaigns.map(campaign => (
                  <button
                    key={campaign.id}
                    onClick={() => {
                      setSelectedCampaign(campaign);
                      setCsvData(null);
                      setTargetData([]);
                      setError('');
                      setSuccess('');
                    }}
                    className={`w-full text-left rounded-lg border-2 transition-all ${
                      selectedCampaign?.id === campaign.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="p-3">
                      <div className="font-medium text-slate-900">{campaign.campaign_name}</div>
                      <div className="text-xs text-slate-600">{campaign.companies?.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Status: <span className={`font-medium ${
                          campaign.status === 'COMPLETED' ? 'text-green-600' : 'text-orange-600'
                        }`}>{campaign.status}</span>
                      </div>
                    </div>
                    <div className="px-3 pb-3 pt-1 border-t border-slate-200 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(campaign.id);
                        }}
                        className="w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        View Details
                      </button>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p>No campaigns found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedCampaign ? (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Upload CSV Results</h2>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <p className="text-sm text-green-700">{success}</p>
                  </div>
                )}

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Gophish CSV File
                  </label>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    disabled={csvData !== null}
                    className="block w-full text-sm text-slate-600
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-medium
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Accepts CSV or TSV format from Gophish export
                  </p>
                </div>

                {csvData && (
                  <>
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-slate-600">Total Records</div>
                          <div className="text-2xl font-bold text-blue-600">{csvData.stats.totalRecords}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-600">Emails Sent</div>
                          <div className="text-2xl font-bold text-blue-600">{csvData.stats.emailsSent}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-600">Links Clicked</div>
                          <div className="text-2xl font-bold text-blue-600">{csvData.stats.linksClicked}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-600">Data Submitted</div>
                          <div className="text-2xl font-bold text-blue-600">{csvData.stats.dataSubmitted}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-600">Reported</div>
                          <div className="text-2xl font-bold text-blue-600">{csvData.stats.emailsReported}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-700">Email</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-700">Name</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-700">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {targetData.slice(0, 10).map((target, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-4 py-2 text-xs text-slate-900 truncate">{target.email}</td>
                                <td className="px-4 py-2 text-xs text-slate-700">{target.first_name} {target.last_name}</td>
                                <td className="px-4 py-2">
                                  <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    {target.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {targetData.length > 10 && (
                        <p className="text-xs text-slate-500 mt-2">
                          Showing 10 of {targetData.length} records
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setCsvData(null);
                          setTargetData([]);
                          setError('');
                          setSuccess('');
                        }}
                        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        Clear
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={uploading}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {uploading ? (
                          <>
                            <Loader className="h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4" />
                            Upload Results
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <Upload className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">Select a campaign to upload results</p>
            </div>
          )}
        </div>
      </div>

      {viewDetailsModal && campaignDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-slate-900">{campaignDetails.campaign_name}</h2>
              <button
                onClick={() => setViewDetailsModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Company</p>
                  <p className="font-medium text-slate-900">{campaignDetails.company?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                    campaignDetails.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                    campaignDetails.status === 'RUNNING' ? 'bg-orange-100 text-orange-700' :
                    campaignDetails.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {campaignDetails.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Start Date</p>
                  <p className="font-medium text-slate-900">
                    {campaignDetails.start_date ? new Date(campaignDetails.start_date).toLocaleDateString() : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">End Date</p>
                  <p className="font-medium text-slate-900">
                    {campaignDetails.end_date ? new Date(campaignDetails.end_date).toLocaleDateString() : 'Not set'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600">Total Targets</p>
                  <p className="text-3xl font-bold text-blue-900">{campaignDetails.targets?.length || 0}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-red-600">Clicked Link</p>
                  <p className="text-3xl font-bold text-red-900">
                    {campaignDetails.targets?.filter(t => t.clicked).length || 0}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600">Reported</p>
                  <p className="text-3xl font-bold text-green-900">
                    {campaignDetails.targets?.filter(t => t.reported).length || 0}
                  </p>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg">
                  <p className="text-sm text-amber-600">Submitted Data</p>
                  <p className="text-3xl font-bold text-amber-900">
                    {campaignDetails.targets?.filter(t => t.submitted_data).length || 0}
                  </p>
                </div>
              </div>

              {campaignDetails.targets && campaignDetails.targets.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">Targeted Employees</h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Employee</th>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Department</th>
                          <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Clicked</th>
                          <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Reported</th>
                          <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Submitted Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {campaignDetails.targets.map(target => (
                          <tr key={target.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-slate-900">{target.employee?.full_name || 'N/A'}</p>
                                <p className="text-xs text-slate-500">{target.employee?.email || 'N/A'}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {target.employee?.department?.name || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {target.clicked ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                  ✓ Yes
                                </span>
                              ) : (
                                <span className="text-slate-400">No</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {target.reported ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  ✓ Yes
                                </span>
                              ) : (
                                <span className="text-slate-400">No</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {target.submitted_data ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                  ✓ Yes
                                </span>
                              ) : (
                                <span className="text-slate-400">No</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setViewDetailsModal(false)}
                className="w-full px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
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
