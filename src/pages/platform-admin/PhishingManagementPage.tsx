import React, { useState, useEffect, useCallback } from "react";
import { Shield, Eye, CheckCircle, X, Loader2, AlertCircle, BarChart2, Edit2, Check, Activity, RefreshCw, Pause, Play } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
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

const fmt = (d: string | Date) => new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' });

const FILTER_TABS = ['ALL', 'SUBMITTED', 'APPROVED', 'RUNNING', 'COMPLETED', 'REJECTED'] as const;
type FilterTab = typeof FILTER_TABS[number];

/* ─────────────────────────────────────────
   QUOTA TAB
───────────────────────────────────────── */
interface CompanyQuota {
  id: string;
  name: string;
  annual_quota: number;
  used_campaigns: number;
}

/* ═══════════════════════════════════════════
   MONITORING TAB — all active campaigns
═══════════════════════════════════════════ */
interface LiveCampaign {
  id: string;
  name: string;
  status: string;
  company_id: string;
  company_name: string;
  total_queue_size: number;
  emails_sent: number;
  emails_opened: number;
  links_clicked: number;
  data_submitted: number;
  created_at: string;
  completion_date: string | null;
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  RUNNING:   { color: T.orange, bg: 'rgba(251,146,60,0.12)' },
  PAUSED:    { color: T.blue,   bg: 'rgba(96,165,250,0.12)' },
  COMPLETED: { color: T.green,  bg: 'rgba(52,211,153,0.12)' },
  DRAFT:     { color: T.textMuted, bg: 'rgba(255,255,255,0.05)' },
};

const MonitoringTab: React.FC = () => {
  const [campaigns, setCampaigns] = useState<LiveCampaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [updating, setUpdating]   = useState<string | null>(null);
  const [filter, setFilter]       = useState<'ALL' | 'RUNNING' | 'PAUSED' | 'COMPLETED'>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: camps } = await supabase
        .from('phishing_campaigns')
        .select('*, companies(name)')
        .order('created_at', { ascending: false })
        .limit(200);

      setCampaigns((camps || []).map((c: any) => ({
        id:               c.id,
        name:             c.name,
        status:           c.status,
        company_id:       c.company_id,
        company_name:     c.companies?.name || 'Unknown',
        total_queue_size: c.total_queue_size || 0,
        emails_sent:      c.emails_sent || 0,
        emails_opened:    c.emails_opened || 0,
        links_clicked:    c.links_clicked || 0,
        data_submitted:   c.data_submitted || 0,
        created_at:       c.created_at,
        completion_date:  c.completion_date,
      })));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const togglePause = async (camp: LiveCampaign) => {
    setUpdating(camp.id);
    const newStatus = camp.status === 'RUNNING' ? 'PAUSED' : 'RUNNING';
    await supabase.from('phishing_campaigns')
      .update({ status: newStatus, ...(newStatus === 'PAUSED' ? { paused_at: new Date().toISOString() } : { paused_at: null }) })
      .eq('id', camp.id);
    setCampaigns(prev => prev.map(c => c.id === camp.id ? { ...c, status: newStatus } : c));
    setUpdating(null);
  };

  const filtered = filter === 'ALL' ? campaigns : campaigns.filter(c => c.status === filter);
  const counts = {
    ALL: campaigns.length,
    RUNNING: campaigns.filter(c => c.status === 'RUNNING').length,
    PAUSED: campaigns.filter(c => c.status === 'PAUSED').length,
    COMPLETED: campaigns.filter(c => c.status === 'COMPLETED').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['ALL', 'RUNNING', 'PAUSED', 'COMPLETED'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${filter === s ? 'rgba(200,255,0,0.3)' : T.border}`, background: filter === s ? 'rgba(200,255,0,0.08)' : 'transparent', color: filter === s ? T.accent : T.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {s} {counts[s] > 0 && <span style={{ marginLeft: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: '1px 5px' }}>{counts[s]}</span>}
            </button>
          ))}
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.textMuted }}><Loader2 size={20} style={{ animation: 'aw-spin 0.8s linear infinite' }} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 14 }}>No campaigns found.</div>
        ) : (
          <table className="aw-pmp-table">
            <thead>
              <tr>
                {['Company', 'Campaign', 'Status', 'Progress', 'Opened', 'Clicked', 'Submitted', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const pct = c.total_queue_size > 0 ? Math.round((c.emails_sent / c.total_queue_size) * 100) : 0;
                const st = STATUS_STYLE[c.status] || STATUS_STYLE.DRAFT;
                return (
                  <tr key={c.id}>
                    <td style={{ color: T.textBody, fontSize: 12 }}>{c.company_name}</td>
                    <td style={{ color: T.white, fontWeight: 600, maxWidth: 180 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{new Date(c.created_at).toLocaleDateString()}</div>
                    </td>
                    <td>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: st.color, background: st.bg }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>{c.emails_sent} / {c.total_queue_size} ({pct}%)</div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: T.accent, borderRadius: 2, transition: 'width 0.3s' }} />
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', color: c.emails_opened > 0 ? T.orange : T.textMuted, fontWeight: 600 }}>{c.emails_opened}</td>
                    <td style={{ textAlign: 'center', color: c.links_clicked > 0 ? T.red : T.textMuted, fontWeight: 600 }}>{c.links_clicked}</td>
                    <td style={{ textAlign: 'center', color: c.data_submitted > 0 ? '#f43f5e' : T.textMuted, fontWeight: 700 }}>{c.data_submitted}</td>
                    <td>
                      {(c.status === 'RUNNING' || c.status === 'PAUSED') && (
                        <button
                          onClick={() => togglePause(c)}
                          disabled={updating === c.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', color: c.status === 'RUNNING' ? T.orange : T.green, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {updating === c.id ? <Loader2 size={12} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> : c.status === 'RUNNING' ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Resume</>}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const QuotaTab: React.FC = () => {
  const [quotas, setQuotas] = useState<CompanyQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadQuotas(); }, []);

  const loadQuotas = async () => {
    setLoading(true);
    try {
      const { data: companies } = await supabase.from('companies').select('id, name').order('name');
      // Scope to the current year. Without this filter, a company with quota rows
      // for multiple years would have its display value overwritten arbitrarily by
      // quotaMap.set (last row wins), showing a stale year's numbers.
      const { data: quotaData } = await supabase
        .from('phishing_campaign_quotas')
        .select('company_id, annual_quota, used_campaigns')
        .eq('quota_year', new Date().getFullYear());

      const quotaMap = new Map<string, { annual_quota: number; used_campaigns: number }>();
      (quotaData || []).forEach((q: any) => quotaMap.set(q.company_id, { annual_quota: q.annual_quota, used_campaigns: q.used_campaigns }));

      const result: CompanyQuota[] = (companies || []).map(c => ({
        id: c.id,
        name: c.name,
        annual_quota: quotaMap.get(c.id)?.annual_quota ?? 0,
        used_campaigns: quotaMap.get(c.id)?.used_campaigns ?? 0,
      }));
      setQuotas(result);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const saveQuota = async (companyId: string) => {
    const val = parseInt(editValue, 10);
    if (isNaN(val) || val < 0) { alert('Please enter a valid number'); return; }
    setSaving(true);
    try {
      const { error: quotaErr } = await supabase.from('phishing_campaign_quotas').upsert(
        { company_id: companyId, annual_quota: val, quota_year: new Date().getFullYear(), updated_at: new Date().toISOString() },
        { onConflict: 'company_id,quota_year' }
      );
      if (quotaErr) throw quotaErr;
      // Keep the per-company limit in sync — both represent "campaigns / year",
      // so editing the annual quota here also updates Company Phishing Limits.
      const { error: limitErr } = await supabase.from('company_phishing_limits')
        .update({ max_campaigns_per_year: val, updated_at: new Date().toISOString() })
        .eq('company_id', companyId);
      if (limitErr) throw limitErr;
      setEditId(null);
      loadQuotas();
    } catch (err) { console.error('[PhishingMgmt] saveQuota', err); alert('Failed to save quota: ' + getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <BarChart2 size={14} style={{ color: T.accent }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Company Phishing Quotas</span>
        <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 4 }}>{new Date().getFullYear()} Annual Quota</span>
      </div>

      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="aw-pmp-table">
            <thead>
              <tr>
                <th>Company</th>
                <th style={{ textAlign: 'center' }}>Annual Quota</th>
                <th style={{ textAlign: 'center' }}>Used</th>
                <th style={{ textAlign: 'center' }}>Remaining</th>
                <th style={{ textAlign: 'center' }}>Usage</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {quotas.length > 0 ? quotas.map(q => {
                const remaining = Math.max(0, q.annual_quota - q.used_campaigns);
                const pct = q.annual_quota > 0 ? Math.min(100, Math.round((q.used_campaigns / q.annual_quota) * 100)) : 0;
                const usageColor = pct >= 90 ? T.red : pct >= 70 ? T.orange : T.green;
                return (
                  <tr key={q.id}>
                    <td style={{ fontWeight: 600, color: T.white }}>{q.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      {editId === q.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                          <input
                            type="number"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            style={{ width: 70, padding: '5px 8px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 7, color: T.white, fontSize: 13, textAlign: 'center', outline: 'none' }}
                            min="0"
                            autoFocus
                          />
                          <button onClick={() => saveQuota(q.id)} disabled={saving} style={{ width: 26, height: 26, borderRadius: 6, background: T.greenBg, border: `1px solid ${T.greenBorder}`, color: T.green, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {saving ? <Loader2 size={11} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> : <Check size={11} />}
                          </button>
                          <button onClick={() => setEditId(null)} style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontWeight: 700, color: T.white }}>{q.annual_quota}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: q.used_campaigns > 0 ? T.orange : T.textMuted }}>{q.used_campaigns}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: remaining === 0 ? T.red : T.green }}>{remaining}</td>
                    <td style={{ textAlign: 'center', minWidth: 100 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden', minWidth: 60 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: usageColor, borderRadius: 9999, transition: 'width 0.5s ease' }} />
                        </div>
                        <span style={{ fontSize: 11, color: usageColor, fontWeight: 700, minWidth: 30 }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {editId !== q.id && (
                        <button onClick={() => { setEditId(q.id); setEditValue(String(q.annual_quota)); }}
                          style={{ width: 28, height: 28, borderRadius: 7, background: T.blueBg, border: `1px solid ${T.blueBorder}`, color: T.blue, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                          <Edit2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 0', textAlign: 'center', color: T.textMuted }}>No companies found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

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
type MainTab = 'campaigns' | 'monitoring' | 'quota';

export const PhishingManagementPage: React.FC = () => {
  const [mainTab, setMainTab] = useState<MainTab>('campaigns');
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

      {/* ── Main tabs ── */}
      <div style={{ display: 'flex', gap: 6 }}>
        {([
          { key: 'campaigns' as MainTab, icon: Shield, label: 'Requests' },
          { key: 'monitoring' as MainTab, icon: Activity, label: 'Live Monitor' },
          { key: 'quota' as MainTab, icon: BarChart2, label: 'Quota Management' },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setMainTab(tab.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: `1px solid ${mainTab === tab.key ? 'rgba(200,255,0,0.28)' : 'rgba(255,255,255,0.07)'}`, background: mainTab === tab.key ? 'rgba(200,255,0,0.10)' : 'rgba(255,255,255,0.03)', color: mainTab === tab.key ? T.accent : T.textMuted, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, transition: 'all 0.18s' }}>
            <tab.icon size={13} /> {tab.label}
          </button>
        ))}
      </div>

      {mainTab === 'quota' && <QuotaTab />}
      {mainTab === 'monitoring' && <MonitoringTab />}
      {mainTab === 'campaigns' && <>

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
      </>}
    </div>
  );
};
