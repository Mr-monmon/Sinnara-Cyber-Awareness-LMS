import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, Clock, Play, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PhishingCampaignRequest } from '../../types';

interface RequestWithCompany extends PhishingCampaignRequest {
  companies?: { name: string };
  users?: { full_name: string };
  phishing_templates?: { name: string };
}

export const PhishingManagementPage: React.FC = () => {
  const [requests, setRequests] = useState<RequestWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');
  const [selectedRequest, setSelectedRequest] = useState<RequestWithCompany | null>(null);
  const [actionModal, setActionModal] = useState<{ type: 'approve' | 'reject' | null; request: RequestWithCompany | null }>({ type: null, request: null });
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('phishing_campaign_requests')
        .select(`
          *,
          companies(name),
          users!phishing_campaign_requests_requested_by_fkey(full_name),
          phishing_templates(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setRequests(data as RequestWithCompany[]);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!actionModal.request) return;

    try {
      const { error } = await supabase
        .from('phishing_campaign_requests')
        .update({
          status: 'APPROVED',
          admin_notes: adminNotes,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', actionModal.request.id);

      if (error) throw error;

      alert('Request approved successfully!');
      setActionModal({ type: null, request: null });
      setAdminNotes('');
      loadRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Failed to approve request');
    }
  };

  const handleReject = async () => {
    if (!actionModal.request || !adminNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('phishing_campaign_requests')
        .update({
          status: 'REJECTED',
          rejected_reason: adminNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', actionModal.request.id);

      if (updateError) throw updateError;

      const { error: quotaError } = await supabase
        .from('phishing_campaign_quotas')
        .update({
          used_campaigns: supabase.rpc('greatest', { a: 0, b: supabase.sql`used_campaigns - 1` }),
          updated_at: new Date().toISOString()
        })
        .eq('company_id', actionModal.request.company_id)
        .eq('quota_year', new Date().getFullYear());

      if (quotaError) console.error('Error refunding quota:', quotaError);

      alert('Request rejected and quota refunded');
      setActionModal({ type: null, request: null });
      setAdminNotes('');
      loadRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Failed to reject request');
    }
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

  const filteredRequests = filter === 'ALL'
    ? requests
    : requests.filter(r => r.status === filter);

  const stats = {
    total: requests.length,
    submitted: requests.filter(r => r.status === 'SUBMITTED').length,
    approved: requests.filter(r => r.status === 'APPROVED').length,
    running: requests.filter(r => r.status === 'RUNNING').length,
    completed: requests.filter(r => r.status === 'COMPLETED').length
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
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Phishing Campaign Management</h1>
        <p className="text-slate-600">Review and manage company phishing campaign requests</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-sm text-slate-600">Total Requests</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.submitted}</div>
          <div className="text-sm text-slate-600">Pending Review</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          <div className="text-sm text-slate-600">Approved</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-2xl font-bold text-orange-600">{stats.running}</div>
          <div className="text-sm text-slate-600">Running</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-2xl font-bold text-purple-600">{stats.completed}</div>
          <div className="text-sm text-slate-600">Completed</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="flex gap-2">
            {['ALL', 'SUBMITTED', 'APPROVED', 'RUNNING', 'COMPLETED', 'REJECTED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Ticket</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Campaign Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Template</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Targets</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono text-slate-900">{request.ticket_number}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{request.companies?.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{request.campaign_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{request.phishing_templates?.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{request.target_employee_count}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(request.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedRequest(request)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {request.status === 'SUBMITTED' && (
                          <>
                            <button
                              onClick={() => setActionModal({ type: 'approve', request })}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Approve"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setActionModal({ type: 'reject', request })}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Reject"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <Shield className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                    <p>No requests found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Request Details</h2>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-600">Ticket Number</div>
                  <div className="font-mono font-semibold">{selectedRequest.ticket_number}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">Status</div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedRequest.status)}`}>
                    {selectedRequest.status}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-slate-600">Company</div>
                  <div className="font-semibold">{selectedRequest.companies?.name}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">Requested By</div>
                  <div className="font-semibold">{selectedRequest.users?.full_name}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">Campaign Name</div>
                  <div className="font-semibold">{selectedRequest.campaign_name}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">Target Count</div>
                  <div className="font-semibold">{selectedRequest.target_employee_count} employees</div>
                </div>
              </div>
              {selectedRequest.notes && (
                <div>
                  <div className="text-sm text-slate-600 mb-1">Notes</div>
                  <div className="p-3 bg-slate-50 rounded-lg text-sm">{selectedRequest.notes}</div>
                </div>
              )}
              {selectedRequest.admin_notes && (
                <div>
                  <div className="text-sm text-slate-600 mb-1">Admin Notes</div>
                  <div className="p-3 bg-blue-50 rounded-lg text-sm">{selectedRequest.admin_notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {actionModal.type && actionModal.request && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                {actionModal.type === 'approve' ? 'Approve Request' : 'Reject Request'}
              </h2>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-4">
                {actionModal.type === 'approve'
                  ? 'Approve this phishing campaign request?'
                  : 'Provide a reason for rejection:'}
              </p>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder={actionModal.type === 'approve' ? 'Optional notes...' : 'Rejection reason (required)...'}
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setActionModal({ type: null, request: null });
                    setAdminNotes('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={actionModal.type === 'approve' ? handleApprove : handleReject}
                  className={`flex-1 px-4 py-2 rounded-lg text-white ${
                    actionModal.type === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionModal.type === 'approve' ? 'Approve' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
