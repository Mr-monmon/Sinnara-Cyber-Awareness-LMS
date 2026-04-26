import React, { useState, useEffect } from "react";
import {
  Users, Mail, Phone, Building, Calendar,
  CheckCircle, Clock, Download, Bell, ChevronDown,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

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
} as const;

/* ─────────────────────────────────────────
   STATUS CONFIG
───────────────────────────────────────── */
type DemoStatus = 'PENDING' | 'CONTACTED' | 'COMPLETED';

const STATUS_CFG: Record<DemoStatus, { color: string; bg: string; border: string; label: string; icon: typeof Clock }> = {
  PENDING:   { color: T.orange, bg: T.orangeBg, border: T.orangeBorder, label: 'Pending',   icon: Clock        },
  CONTACTED: { color: T.blue,   bg: T.blueBg,   border: T.blueBorder,   label: 'Contacted', icon: Mail         },
  COMPLETED: { color: T.green,  bg: T.greenBg,  border: T.greenBorder,  label: 'Completed', icon: CheckCircle  },
};

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Request card ── */
  .aw-dr-card {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; overflow: hidden;
    font-family: 'Inter', sans-serif;
    transition: border-color 0.2s;
  }
  .aw-dr-card:hover { border-color: rgba(255,255,255,0.14); }

  /* ── Filter stat card ── */
  .aw-dr-filter-card {
    padding: 14px 18px; border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.07);
    background: #1a1e0e; cursor: pointer;
    font-family: 'Inter', sans-serif;
    transition: all 0.18s;
    text-align: left;
  }
  .aw-dr-filter-card:hover { border-color: rgba(255,255,255,0.14); }
  .aw-dr-filter-card.active-all    { border-color: rgba(200,255,0,0.30); background: rgba(200,255,0,0.05); }
  .aw-dr-filter-card.active-PENDING   { border-color: rgba(251,146,60,0.30); background: rgba(251,146,60,0.06); }
  .aw-dr-filter-card.active-CONTACTED { border-color: rgba(96,165,250,0.30); background: rgba(96,165,250,0.06); }
  .aw-dr-filter-card.active-COMPLETED { border-color: rgba(52,211,153,0.30); background: rgba(52,211,153,0.06); }

  /* ── Status change buttons ── */
  .aw-dr-status-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 8px; cursor: pointer;
    font-size: 12px; font-weight: 700; font-family: 'Inter', sans-serif;
    border: 1px solid transparent; transition: all 0.18s;
  }
  .aw-dr-status-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .aw-dr-status-btn.pending   { color: #fb923c; border-color: rgba(251,146,60,0.28); background: rgba(251,146,60,0.08); }
  .aw-dr-status-btn.pending:hover:not(:disabled)   { background: rgba(251,146,60,0.18); }
  .aw-dr-status-btn.contacted { color: #60a5fa; border-color: rgba(96,165,250,0.28);  background: rgba(96,165,250,0.08);  }
  .aw-dr-status-btn.contacted:hover:not(:disabled) { background: rgba(96,165,250,0.18); }
  .aw-dr-status-btn.completed { color: #34d399; border-color: rgba(52,211,153,0.28); background: rgba(52,211,153,0.08); }
  .aw-dr-status-btn.completed:hover:not(:disabled) { background: rgba(52,211,153,0.18); }

  /* ── Export btn ── */
  .aw-dr-dl-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: 9px; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: rgba(52,211,153,0.10); border: 1px solid rgba(52,211,153,0.28);
    color: #34d399; transition: background 0.18s, transform 0.15s;
  }
  .aw-dr-dl-btn:hover { background: rgba(52,211,153,0.18); transform: translateY(-1px); }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-dr-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-dr-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPE
───────────────────────────────────────── */
interface DemoRequest {
  id: string; full_name: string; email: string; phone: string | null;
  company_name: string | null; employee_count: number | null;
  message: string | null; status: string; admin_notes: string | null;
  created_at: string;
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' });

/* ─────────────────────────────────────────
   INFO ROW
───────────────────────────────────────── */
const InfoRow: React.FC<{ icon: React.ElementType; label: string }> = ({ icon: Icon, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: T.textBody }}>
    <Icon size={13} style={{ color: T.textMuted, flexShrink: 0 }} />
    {label}
  </div>
);

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const DemoRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<'ALL' | DemoStatus>('ALL');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => { loadRequests(); }, []);

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase.from("demo_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      if (data) setRequests(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await supabase.from("demo_requests").update({ status }).eq("id", id);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch { alert("Failed to update status"); }
  };

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filtered = requests.filter(r => filter === 'ALL' ? true : r.status === filter);

  const counts = {
    all:       requests.length,
    PENDING:   requests.filter(r => r.status === 'PENDING').length,
    CONTACTED: requests.filter(r => r.status === 'CONTACTED').length,
    COMPLETED: requests.filter(r => r.status === 'COMPLETED').length,
  };

  const exportCSV = () => {
    const headers = ['full_name','status','email','phone','company_name','employee_count','created_at','message'];
    const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const sep = (1.1).toLocaleString().includes(',') ? ';' : ',';
    const rows = filtered.map(r => headers.map(h => esc((r as any)[h] ?? '')).join(sep));
    const csv = [headers.join(sep), ...rows].join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `demo_requests_${filter}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 14, flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={18} style={{ color: T.orange }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Demo Requests</h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>Manage incoming demo requests from potential customers.</p>
        </div>
        <button className="aw-dr-dl-btn" onClick={exportCSV}><Download size={14} /> Export CSV</button>
      </div>

      {/* ── Filter stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {[
          { key: 'ALL', label: 'All Requests', count: counts.all, color: T.accent },
          { key: 'PENDING',   label: 'Pending',   count: counts.PENDING,   color: T.orange },
          { key: 'CONTACTED', label: 'Contacted', count: counts.CONTACTED, color: T.blue   },
          { key: 'COMPLETED', label: 'Completed', count: counts.COMPLETED, color: T.green  },
        ].map(({ key, label, count, color }) => (
          <button
            key={key}
            className={`aw-dr-filter-card ${filter === key ? `active-${key}` : ''}`}
            onClick={() => setFilter(key as any)}
          >
            <div style={{ fontSize: 24, fontWeight: 900, color, marginBottom: 4 }}>{count}</div>
            <div style={{ fontSize: 12, color: filter === key ? T.textBody : T.textMuted }}>{label}</div>
          </button>
        ))}
      </div>

      {/* ── Requests list ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Users size={22} style={{ color: T.orange }} />
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
            {filter !== 'ALL' ? `No ${filter.toLowerCase()} demo requests` : 'Demo requests will appear here'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((req, idx) => {
            const cfg      = STATUS_CFG[req.status as DemoStatus] ?? STATUS_CFG.PENDING;
            const Icon     = cfg.icon;
            const isExpand = expanded.has(req.id);

            return (
              <div key={req.id} className={`aw-dr-card aw-fade-up`} style={{ animationDelay: `${idx * 0.04}s` }}>

                {/* Status color bar */}
                <div style={{ height: 2, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}30)` }} />

                {/* Card header — always visible */}
                <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>

                  {/* Status icon */}
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Icon size={17} style={{ color: cfg.color }} />
                  </div>

                  {/* Main info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: T.white, margin: 0 }}>{req.full_name}</h3>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Grid of info */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                      <InfoRow icon={Mail}     label={req.email} />
                      {req.phone        && <InfoRow icon={Phone}    label={req.phone} />}
                      {req.company_name && <InfoRow icon={Building} label={req.company_name} />}
                      {req.employee_count != null && <InfoRow icon={Users}   label={`${req.employee_count} employees`} />}
                      <InfoRow icon={Calendar} label={fmt(req.created_at)} />
                    </div>
                  </div>

                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleExpand(req.id)}
                    style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isExpand ? 'rgba(200,255,0,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isExpand ? 'rgba(200,255,0,0.22)' : T.borderFaint}`, color: isExpand ? T.accent : T.textMuted, cursor: 'pointer', flexShrink: 0, transition: 'all 0.18s' }}
                  >
                    <ChevronDown size={14} style={{ transform: isExpand ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                </div>

                {/* Expanded: message + status actions */}
                {isExpand && (
                  <div style={{ paddingBottom: 16 }}>
                    {/* Message */}
                    {req.message && (
                      <div style={{ margin: '0 18px 14px', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 9 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Message</div>
                        <p style={{ fontSize: 13, color: T.textBody, margin: 0, lineHeight: '20px' }}>{req.message}</p>
                      </div>
                    )}

                    {/* Status actions */}
                    <div style={{ padding: '12px 18px 0', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Set Status:</span>
                      <button className="aw-dr-status-btn pending" disabled={req.status === 'PENDING'} onClick={() => updateStatus(req.id, 'PENDING')}>
                        <Clock size={12} /> Pending
                      </button>
                      <button className="aw-dr-status-btn contacted" disabled={req.status === 'CONTACTED'} onClick={() => updateStatus(req.id, 'CONTACTED')}>
                        <Mail size={12} /> Contacted
                      </button>
                      <button className="aw-dr-status-btn completed" disabled={req.status === 'COMPLETED'} onClick={() => updateStatus(req.id, 'COMPLETED')}>
                        <CheckCircle size={12} /> Completed
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
