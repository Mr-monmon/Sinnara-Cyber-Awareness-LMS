import React, { useState, useEffect } from "react";
import { Shield, Eye, CheckCircle, X, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { RequestWithCompany } from "../../lib/types";
import RequestPreview from "./RequestPreview";

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bg:          '#12140a',
  bgCard:      '#1a1e0e',
  accent:      '#c8ff00',
  accentDark:  '#12140a',
  white:       '#ffffff',
  textBody:    '#cbd5e1',
  textMuted:   '#64748b',
  border:      'rgba(255,255,255,0.09)',
  borderFaint: 'rgba(255,255,255,0.05)',
  green:       '#34d399',
  greenBg:     'rgba(52,211,153,0.08)',
  greenBorder: 'rgba(52,211,153,0.22)',
  blue:        '#60a5fa',
  blueBg:      'rgba(96,165,250,0.08)',
  blueBorder:  'rgba(96,165,250,0.22)',
  orange:      '#fb923c',
  orangeBg:    'rgba(251,146,60,0.08)',
  orangeBorder:'rgba(251,146,60,0.22)',
  red:         '#f87171',
  redBg:       'rgba(248,113,113,0.08)',
  redBorder:   'rgba(248,113,113,0.22)',
  purple:      '#a78bfa',
  purpleBg:    'rgba(167,139,250,0.08)',
  purpleBorder:'rgba(167,139,250,0.22)',
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
  goldBorder:  'rgba(251,191,36,0.22)',
} as const;

/* ─────────────────────────────────────────
   STATUS CONFIG
───────────────────────────────────────── */
const STATUS_CFG: Record<string, { color: string; bg: string; border: string }> = {
  DRAFT:     { color: T.textMuted, bg: 'rgba(255,255,255,0.04)', border: T.borderFaint },
  SUBMITTED: { color: T.blue,     bg: T.blueBg,    border: T.blueBorder    },
  APPROVED:  { color: T.green,    bg: T.greenBg,   border: T.greenBorder   },
  RUNNING:   { color: T.orange,   bg: T.orangeBg,  border: T.orangeBorder  },
  COMPLETED: { color: T.purple,   bg: T.purpleBg,  border: T.purpleBorder  },
  REJECTED:  { color: T.red,      bg: T.redBg,     border: T.redBorder     },
};
const getStatusCfg = (s: string) => STATUS_CFG[s] ?? STATUS_CFG['DRAFT'];

/* ─────────────────────────────────────────
   CSS — id = "aw-pmp-styles" (unique)
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Table ── */
  .aw-pmp-table { width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; }
  .aw-pmp-table th {
    padding: 10px 14px; text-align: left;
    font-size: 10px; font-weight: 700; color: #64748b;
    letter-spacing: 0.9px; text-transform: uppercase;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
  }
  .aw-pmp-table td {
    padding: 12px 14px; font-size: 13px; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: background 0.14s;
  }
  .aw-pmp-table tr:last-child td { border-bottom: none; }
  .aw-pmp-table tr:hover td { background: rgba(255,255,255,0.025); }

  /* ── Filter tab ── */
  .aw-pmp-tab {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 7px 12px; border-radius: 8px; border: none; cursor: pointer;
    font-size: 11px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    color: #64748b; transition: all 0.18s;
  }
  .aw-pmp-tab:hover { background: rgba(255,255,255,0.07); color: #cbd5e1; }
  .aw-pmp-tab.active { background: rgba(200,255,0,0.10); border-color: rgba(200,255,0,0.28); color: #c8ff00; }

  /* ── Status select ── */
  .aw-pmp-status-select {
    padding: 6px 28px 6px 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 8px; font-size: 11px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    appearance: none; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 8px center;
    transition: border-color 0.2s;
  }
  .aw-pmp-status-select:focus { border-color: rgba(200,255,0,0.40); }
  .aw-pmp-status-select:disabled { opacity: 0.35; cursor: not-allowed; }
  .aw-pmp-status-select option { background: #1a1e0e; color: #ffffff; }

  /* ── Eye btn ── */
  .aw-pmp-eye-btn {
    width: 28px; height: 28px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.22);
    color: #60a5fa; cursor: pointer; transition: all 0.18s;
  }
  .aw-pmp-eye-btn:hover { background: rgba(96,165,250,0.18); }

  /* ── Modal ── */
  .aw-pmp-textarea {
    width: 100%; padding: 11px 14px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 13px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none; resize: vertical;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .aw-pmp-textarea:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-pmp-textarea::placeholder { color: rgba(148,163,184,0.35); }

  /* ── Scrollbar ── */
  .aw-pmp-scroll::-webkit-scrollbar { width: 3px; }
  .aw-pmp-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-pmp-scroll::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-fade-up  { animation: aw-fade-up  0.4s ease both; }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-pmp-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-pmp-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' });

const FILTER_TABS = ['ALL', 'SUBMITTED', 'APPROVED', 'RUNNING', 'COMPLETED', 'REJECTED'] as const;
type FilterTab = typeof FILTER_TABS[number];

/* ─────────────────────────────────────────
   STAT CARD
───────────────────────────────────────── */
const StatCard: React.FC<{ color: string; label: string; value: number; onClick?: () => void; active?: boolean }> = ({
  color, label, value, onClick, active,
}) => (
  <button onClick={onClick}
    style={{ padding: '14px 16px', background: active ? `${color}12` : T.bgCard, border: `1px solid ${active ? `${color}35` : T.border}`, borderRadius: 11, cursor: onClick ? 'pointer' : 'default', textAlign: 'left', transition: 'all 0.18s', fontFamily: 'inherit' }}>
    <div style={{ fontSize: 22, fontWeight: 900, color, marginBottom: 4 }}>{value}</div>
    <div style={{ fontSize: 11, color: T.textMuted }}>{label}</div>
  </button>
);

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const PhishingManagementPage: React.FC = () => {
  const [requests, setRequests]           = useState<RequestWithCompany[]>([]);
  const [loading, setLoading]             = useState(true);
  const [filter, setFilter]               = useState<FilterTab>('ALL');
  const [selectedRequest, setSelectedRequest] = useState<RequestWithCompany | null>(null);
  const [actionModal, setActionModal]     = useState<{ type: 'approve' | 'reject' | null; request: RequestWithCompany | null }>({ type: null, request: null });
  const [adminNotes, setAdminNotes]       = useState('');
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { loadRequests(); }, []);

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('phishing_campaign_requests')
        .select(`*, companies(name), users!phishing_campaign_requests_requested_by_fkey(full_name), phishing_templates(name)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setRequests(data as RequestWithCompany[]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleApprove = async () => {
    if (!actionModal.request) return;
    const id = String(actionModal.request.id);
    setActionLoading(true); setStatusUpdating(p => ({ ...p, [id]: true }));
    try {
      const { error } = await supabase.from('phishing_campaign_requests').update({ status: 'APPROVED', admin_notes: adminNotes, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', actionModal.request.id);
      if (error) throw error;
      setActionModal({ type: null, request: null }); setAdminNotes('');
      loadRequests();
    } catch { alert('Failed to approve request'); }
    finally { setActionLoading(false); setStatusUpdating(p => ({ ...p, [id]: false })); }
  };

  const handleReject = async () => {
    if (!actionModal.request || !adminNotes.trim()) { alert('Please provide a reason for rejection'); return; }
    const id = String(actionModal.request.id);
    setActionLoading(true); setStatusUpdating(p => ({ ...p, [id]: true }));
    try {
      const { error: ue } = await supabase.from('phishing_campaign_requests').update({ status: 'REJECTED', rejected_reason: adminNotes, updated_at: new Date().toISOString() }).eq('id', actionModal.request.id);
      if (ue) throw ue;
      await supabase.rpc('refund_used_quotes', { p_company_id: actionModal.request.company_id, p_quota_year: new Date().getFullYear() });
      setActionModal({ type: null, request: null }); setAdminNotes('');
      loadRequests();
    } catch { alert('Failed to reject request'); }
    finally { setActionLoading(false); setStatusUpdating(p => ({ ...p, [id]: false })); }
  };

  const handleStatusUpdate = async (request: RequestWithCompany, nextStatus: string) => {
    const id = String(request.id);
    setStatusUpdating(p => ({ ...p, [id]: true }));
    try {
      await supabase.from('phishing_campaign_requests').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', request.id);
      setRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: nextStatus } : r));
    } catch { alert('Failed to update status'); }
    finally { setStatusUpdating(p => ({ ...p, [id]: false })); }
  };

  const handleStatusSelect = (request: RequestWithCompany, nextStatus: string) => {
    if (nextStatus === request.status) return;
    if (nextStatus === 'APPROVED' || nextStatus === 'REJECTED') {
      setAdminNotes(''); setActionModal({ type: nextStatus === 'APPROVED' ? 'approve' : 'reject', request }); return;
    }
    handleStatusUpdate(request, nextStatus);
  };

  const getStatusColor = (s: string) => {
    const map: Record<string, string> = { DRAFT: 'bg-slate-100 text-slate-700', SUBMITTED: 'bg-blue-100 text-blue-700', APPROVED: 'bg-green-100 text-green-700', RUNNING: 'bg-orange-100 text-orange-700', COMPLETED: 'bg-purple-100 text-purple-700', REJECTED: 'bg-red-100 text-red-700' };
    return map[s] || 'bg-slate-100 text-slate-700';
  };

  const filteredRequests = filter === 'ALL' ? requests : requests.filter(r => r.status === filter);

  const stats = {
    total:     requests.length,
    submitted: requests.filter(r => r.status === 'SUBMITTED').length,
    approved:  requests.filter(r => r.status === 'APPROVED').length,
    running:   requests.filter(r => r.status === 'RUNNING').length,
    completed: requests.filter(r => r.status === 'COMPLETED').length,
    rejected:  requests.filter(r => r.status === 'REJECTED').length,
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', flexDirection: 'column', gap: 14, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shield size={18} style={{ color: T.orange }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Phishing Campaign Management</h1>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>Review and manage company phishing campaign requests.</p>
        </div>
      </div>

      {/* ── Stat cards (clickable filters) ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.05s', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
        <StatCard color={T.accent}  label="Total Requests"  value={stats.total}     onClick={() => setFilter('ALL')}       active={filter === 'ALL'}       />
        <StatCard color={T.blue}    label="Pending Review"  value={stats.submitted} onClick={() => setFilter('SUBMITTED')} active={filter === 'SUBMITTED'} />
        <StatCard color={T.green}   label="Approved"        value={stats.approved}  onClick={() => setFilter('APPROVED')}  active={filter === 'APPROVED'}  />
        <StatCard color={T.orange}  label="Running"         value={stats.running}   onClick={() => setFilter('RUNNING')}   active={filter === 'RUNNING'}   />
        <StatCard color={T.purple}  label="Completed"       value={stats.completed} onClick={() => setFilter('COMPLETED')} active={filter === 'COMPLETED'} />
        <StatCard color={T.red}     label="Rejected"        value={stats.rejected}  onClick={() => setFilter('REJECTED')}  active={filter === 'REJECTED'}  />
      </div>

      {/* ── Main table card ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.08s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>

        {/* Filter tabs */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTER_TABS.map(tab => {
            const cfg = tab === 'ALL' ? null : getStatusCfg(tab);
            return (
              <button key={tab} className={`aw-pmp-tab ${filter === tab ? 'active' : ''}`} onClick={() => setFilter(tab)}>
                {cfg && filter !== tab && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
                )}
                {tab}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }} className="aw-pmp-scroll">
          <table className="aw-pmp-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Company</th>
                <th>Campaign Name</th>
                <th>Template</th>
                <th style={{ textAlign: 'center' }}>Targets</th>
                <th>Status</th>
                <th>Date</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length > 0 ? (
                filteredRequests.map(req => {
                  const cfg  = getStatusCfg(req.status);
                  const busy = statusUpdating[String(req.id)];
                  return (
                    <tr key={req.id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: T.accent }}>{req.ticket_number}</span>
                      </td>
                      <td style={{ fontWeight: 600, color: T.white }}>{req.companies?.name || 'N/A'}</td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.campaign_name}</td>
                      <td style={{ color: T.textMuted }}>{req.phishing_templates?.name || 'N/A'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 700, color: T.white }}>{req.target_employee_count}</span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                          {req.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: T.textMuted }}>{fmt(req.created_at)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 7, justifyContent: 'center', alignItems: 'center' }}>
                          <button className="aw-pmp-eye-btn" title="View Details" onClick={() => setSelectedRequest(req)}>
                            <Eye size={13} />
                          </button>
                          {busy ? (
                            <Loader2 size={14} style={{ color: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
                          ) : (
                            <select
                              className="aw-pmp-status-select"
                              value={req.status}
                              disabled={busy || req.status === 'REJECTED'}
                              onChange={e => handleStatusSelect(req, e.target.value)}>
                              {['SUBMITTED','RUNNING','COMPLETED','APPROVED','REJECTED'].map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: '48px 0', textAlign: 'center', color: T.textMuted }}>
                    <Shield size={30} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 10px', display: 'block' }} />
                    No requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Request preview (external component) ── */}
      {selectedRequest && (
        <RequestPreview
          selectedRequest={selectedRequest}
          updateSelectedRequest={r => setSelectedRequest(r)}
          getStatusColor={getStatusColor}
        />
      )}

      {/* ═══════════ APPROVE / REJECT MODAL ═══════════ */}
      {actionModal.type && actionModal.request && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.86)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => { setActionModal({ type: null, request: null }); setAdminNotes(''); }}>
          <div className="aw-modal-in"
            style={{ width: '100%', maxWidth: 460, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.60)', fontFamily: "'Inter', sans-serif" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: actionModal.type === 'approve' ? `linear-gradient(90deg, ${T.green}, ${T.green}40)` : `linear-gradient(90deg, ${T.red}, ${T.red}40)` }} />

            {/* Header */}
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: actionModal.type === 'approve' ? T.greenBg : T.redBg, border: `1px solid ${actionModal.type === 'approve' ? T.greenBorder : T.redBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {actionModal.type === 'approve' ? <CheckCircle size={15} style={{ color: T.green }} /> : <AlertCircle size={15} style={{ color: T.red }} />}
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>
                  {actionModal.type === 'approve' ? 'Approve Request' : 'Reject Request'}
                </h2>
                <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{actionModal.request.campaign_name}</p>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 13, color: T.textBody, margin: 0 }}>
                {actionModal.type === 'approve'
                  ? 'Are you sure you want to approve this phishing campaign request?'
                  : 'Please provide a reason for rejecting this request.'}
              </p>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 7 }}>
                  {actionModal.type === 'approve' ? 'Notes (optional)' : 'Rejection Reason *'}
                </label>
                <textarea
                  className="aw-pmp-textarea" rows={4}
                  placeholder={actionModal.type === 'approve' ? 'Optional notes for the company admin…' : 'Reason for rejection (required)…'}
                  value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setActionModal({ type: null, request: null }); setAdminNotes(''); }}
                disabled={actionLoading}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: '#94a3b8', transition: 'all 0.18s' }}>
                Cancel
              </button>
              <button
                onClick={actionModal.type === 'approve' ? handleApprove : handleReject}
                disabled={actionLoading}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 10, border: 'none', cursor: actionLoading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', background: actionModal.type === 'approve' ? T.green : T.red, color: actionModal.type === 'approve' ? '#0a1a10' : T.white, opacity: actionLoading ? 0.6 : 1, transition: 'all 0.18s' }}>
                {actionLoading
                  ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Processing…</>
                  : actionModal.type === 'approve' ? <><CheckCircle size={14} /> Approve</> : <><X size={14} /> Reject</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
