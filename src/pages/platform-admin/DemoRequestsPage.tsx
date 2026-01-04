import React, { useState, useEffect } from 'react';
import { Users, Mail, Phone, Building, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DemoRequest {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  employee_count: number | null;
  message: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export const DemoRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'CONTACTED' | 'COMPLETED'>('ALL');

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('demo_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setRequests(data);
    } catch (error) {
      console.error('Error loading demo requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('demo_requests')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      loadRequests();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const filteredRequests = requests.filter(req =>
    filter === 'ALL' ? true : req.status === filter
  );

  const statusCounts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'PENDING').length,
    contacted: requests.filter(r => r.status === 'CONTACTED').length,
    completed: requests.filter(r => r.status === 'COMPLETED').length,
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
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Demo Requests</h1>
        <p className="text-slate-600">Manage incoming demo requests from potential customers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => setFilter('ALL')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filter === 'ALL'
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="text-2xl font-bold text-slate-900">{statusCounts.all}</div>
          <div className="text-sm text-slate-600">All Requests</div>
        </button>

        <button
          onClick={() => setFilter('PENDING')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filter === 'PENDING'
              ? 'border-orange-500 bg-orange-50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="text-2xl font-bold text-orange-600">{statusCounts.pending}</div>
          <div className="text-sm text-slate-600">Pending</div>
        </button>

        <button
          onClick={() => setFilter('CONTACTED')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filter === 'CONTACTED'
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="text-2xl font-bold text-blue-600">{statusCounts.contacted}</div>
          <div className="text-sm text-slate-600">Contacted</div>
        </button>

        <button
          onClick={() => setFilter('COMPLETED')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filter === 'COMPLETED'
              ? 'border-green-500 bg-green-50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="text-2xl font-bold text-green-600">{statusCounts.completed}</div>
          <div className="text-sm text-slate-600">Completed</div>
        </button>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
          <Users className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">No demo requests found</p>
          <p className="text-sm text-slate-500 mt-2">
            {filter !== 'ALL' ? `No ${filter.toLowerCase()} requests` : 'Demo requests will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-slate-900">{request.full_name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      request.status === 'PENDING'
                        ? 'bg-orange-100 text-orange-800'
                        : request.status === 'CONTACTED'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {request.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-600 mb-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <span>{request.email}</span>
                    </div>

                    {request.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span>{request.phone}</span>
                      </div>
                    )}

                    {request.company_name && (
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-slate-400" />
                        <span>{request.company_name}</span>
                      </div>
                    )}

                    {request.employee_count && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-400" />
                        <span>{request.employee_count} employees</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span>{new Date(request.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {request.message && (
                    <div className="p-3 bg-slate-50 rounded-lg mb-3">
                      <p className="text-sm text-slate-700">{request.message}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
                <button
                  onClick={() => updateStatus(request.id, 'PENDING')}
                  disabled={request.status === 'PENDING'}
                  className="px-4 py-2 text-sm rounded-lg border-2 border-orange-200 text-orange-700 hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Clock className="h-4 w-4" />
                  Pending
                </button>

                <button
                  onClick={() => updateStatus(request.id, 'CONTACTED')}
                  disabled={request.status === 'CONTACTED'}
                  className="px-4 py-2 text-sm rounded-lg border-2 border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Contacted
                </button>

                <button
                  onClick={() => updateStatus(request.id, 'COMPLETED')}
                  disabled={request.status === 'COMPLETED'}
                  className="px-4 py-2 text-sm rounded-lg border-2 border-green-200 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Completed
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
