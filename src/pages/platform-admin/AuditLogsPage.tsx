import React, { useState, useEffect } from "react";
import {
  History, Search, Download, Eye, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { User } from "../../lib/types";

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
  red:         '#f87171',
  redBg:       'rgba(248,113,113,0.08)',
  redBorder:   'rgba(248,113,113,0.22)',
  orange:      '#fb923c',
  orangeBg:    'rgba(251,146,60,0.08)',
  orangeBorder:'rgba(251,146,60,0.22)',
  purple:      '#a78bfa',
  purpleBg:    'rgba(167,139,250,0.08)',
  purpleBorder:'rgba(167,139,250,0.22)',
  cyan:        '#22d3ee',
  cyanBg:      'rgba(34,211,238,0.08)',
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
} as const;

/* ─────────────────────────────────────────
   ACTION → color mapping
───────────────────────────────────────── */
const ACTION_CFG: Record<string, { color: string; bg: string; border: string }> = {
  CREATE:          { color: T.green,  bg: T.greenBg,   border: T.greenBorder   },
  CREATE_COMPANY:  { color: T.green,  bg: T.greenBg,   border: T.greenBorder   },
  CREATE_USER:     { color: T.green,  bg: T.greenBg,   border: T.greenBorder   },
  UPDATE:          { color: T.blue,   bg: T.blueBg,    border: T.blueBorder    },
  UPDATE_COMPANY:  { color: T.blue,   bg: T.blueBg,    border: T.blueBorder    },
  UPDATE_USER:     { color: T.blue,   bg: T.blueBg,    border: T.blueBorder    },
  ROLE_CHANGE:     { color: T.blue,   bg: T.blueBg,    border: T.blueBorder    },
  SEND_REMINDER:   { color: T.blue,   bg: T.blueBg,    border: T.blueBorder    },
  DELETE:          { color: T.red,    bg: T.redBg,     border: T.redBorder     },
  DELETE_COMPANY:  { color: T.red,    bg: T.redBg,     border: T.redBorder     },
  DELETE_USER:     { color: T.red,    bg: T.redBg,     border: T.redBorder     },
  RESET_PASSWORD:  { color: T.orange, bg: T.orangeBg,  border: T.orangeBorder  },
  LOGIN_FAILED:    { color: T.orange, bg: T.orangeBg,  border: T.orangeBorder  },
  LOGIN:           { color: T.purple, bg: T.purpleBg,  border: T.purpleBorder  },
  LOGOUT:          { color: T.textMuted, bg: 'rgba(255,255,255,0.04)', border: T.borderFaint },
  UPLOAD_EMPLOYEES:{ color: T.cyan,   bg: T.cyanBg,    border: 'rgba(34,211,238,0.22)'  },
  EXPORT_DATA:     { color: T.gold,   bg: T.goldBg,    border: 'rgba(251,191,36,0.22)'  },
  ASSIGN_COURSE:   { color: T.cyan,   bg: T.cyanBg,    border: 'rgba(34,211,238,0.22)'  },
  ASSIGN_EXAM:     { color: T.cyan,   bg: T.cyanBg,    border: 'rgba(34,211,238,0.22)'  },
  COMPLETE_COURSE: { color: T.green,  bg: T.greenBg,   border: T.greenBorder   },
  COMPLETE_EXAM:   { color: T.green,  bg: T.greenBg,   border: T.greenBorder   },
};
const getActionCfg = (a: string) => ACTION_CFG[a] ?? { color: T.textMuted, bg: 'rgba(255,255,255,0.04)', border: T.borderFaint };

const ACTION_LABEL: Record<string, string> = {
  CREATE:'Create', UPDATE:'Update', DELETE:'Delete',
  LOGIN:'Login', LOGOUT:'Logout', LOGIN_FAILED:'Login Failed',
  ROLE_CHANGE:'Role Change', ASSIGN_COURSE:'Assign Course', ASSIGN_EXAM:'Assign Exam',
  COMPLETE_COURSE:'Complete Course', COMPLETE_EXAM:'Complete Exam',
  CREATE_COMPANY:'Create Company', UPDATE_COMPANY:'Update Company', DELETE_COMPANY:'Delete Company',
  CREATE_USER:'Create User', UPDATE_USER:'Update User', DELETE_USER:'Delete User',
  UPLOAD_EMPLOYEES:'Upload Employees', EXPORT_DATA:'Export Data',
  RESET_PASSWORD:'Reset Password', SEND_REMINDER:'Send Reminder',
};

const ROLE_CFG: Record<string, { color: string; bg: string }> = {
  PLATFORM_ADMIN: { color: T.red,    bg: T.redBg    },
  COMPANY_ADMIN:  { color: T.blue,   bg: T.blueBg   },
  EMPLOYEE:       { color: T.green,  bg: T.greenBg  },
};

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-al-table { width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; }
  .aw-al-table th {
    padding: 10px 14px; text-align: left;
    font-size: 10px; font-weight: 700; color: #64748b;
    letter-spacing: 0.9px; text-transform: uppercase;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
  }
  .aw-al-table td {
    padding: 11px 14px; font-size: 12px; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: background 0.14s;
  }
  .aw-al-table tr:last-child td { border-bottom: none; }
  .aw-al-table tr:hover td { background: rgba(255,255,255,0.025); }

  /* ── Filter inputs ── */
  .aw-al-input, .aw-al-select {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 9px; font-size: 13px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, background 0.2s;
  }
  .aw-al-input  { padding: 9px 14px; }
  .aw-al-select {
    padding: 9px 32px 9px 12px; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
  }
  .aw-al-input:focus, .aw-al-select:focus {
    border-color: rgba(200,255,0,0.45);
    background: rgba(255,255,255,0.06);
  }
  .aw-al-input::placeholder { color: rgba(148,163,184,0.35); }
  .aw-al-select option { background: #1a1e0e; color: #ffffff; }
  input[type="date"].aw-al-input::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.4); cursor: pointer; }

  /* ── Eye btn ── */
  .aw-al-eye-btn {
    width: 28px; height: 28px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.22);
    color: #60a5fa; cursor: pointer; transition: all 0.18s;
  }
  .aw-al-eye-btn:hover { background: rgba(96,165,250,0.18); }

  /* ── Pagination btn ── */
  .aw-al-page-btn {
    min-width: 30px; height: 30px; padding: 0 8px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; cursor: pointer; font-size: 12px; font-weight: 600;
    font-family: 'Inter', sans-serif; transition: all 0.18s;
  }
  .aw-al-page-btn:hover:not(:disabled) { background: rgba(255,255,255,0.09); color: #ffffff; }
  .aw-al-page-btn.active { background: rgba(200,255,0,0.12); border-color: rgba(200,255,0,0.30); color: #c8ff00; }
  .aw-al-page-btn:disabled { opacity: 0.30; cursor: not-allowed; }

  /* ── Detail label/value ── */
  .aw-al-detail-label { font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 5px; text-transform: uppercase; letter-spacing: '0.6px'; }
  .aw-al-detail-value { font-size: 13px; color: #cbd5e1; }

  /* ── Scrollbar ── */
  .aw-al-scroll::-webkit-scrollbar { width: 3px; }
  .aw-al-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-al-scroll::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-fade-up  { animation: aw-fade-up  0.4s ease both; }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-al-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-al-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPE
───────────────────────────────────────── */
interface AuditLog {
  id: string; user_id?: string; action_type: string;
  entity_type?: string; entity_id?: string; entity_name?: string;
  old_value?: any; new_value?: any; ip_address?: string;
  user_agent?: string; description?: string; created_at: string;
  users: User;
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

/* ─────────────────────────────────────────
   BADGE COMPONENTS
───────────────────────────────────────── */
const ActionBadge: React.FC<{ action: string }> = ({ action }) => {
  const cfg = getActionCfg(action);
  return (
    <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, whiteSpace: 'nowrap' }}>
      {ACTION_LABEL[action] || action}
    </span>
  );
};

const RoleBadge: React.FC<{ role?: string }> = ({ role }) => {
  if (!role) return null;
  const cfg = ROLE_CFG[role] ?? { color: T.textMuted, bg: 'rgba(255,255,255,0.04)' };
  const labels: Record<string, string> = { PLATFORM_ADMIN: 'Platform', COMPANY_ADMIN: 'Company', EMPLOYEE: 'Employee' };
  return (
    <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.color }}>
      {labels[role] || role}
    </span>
  );
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs]                   = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs]   = useState<AuditLog[]>([]);
  const [loading, setLoading]             = useState(true);
  const [searchTerm, setSearchTerm]       = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [dateFrom, setDateFrom]           = useState('');
  const [selectedLog, setSelectedLog]     = useState<AuditLog | null>(null);
  const [currentPage, setCurrentPage]     = useState(1);
  const pageSize = 20;

  useEffect(() => { loadLogs(); }, []);
  useEffect(() => { filterLogs(); }, [logs, searchTerm, selectedAction, selectedEntity, dateFrom]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("audit_logs")
        .select("*, users(email, role, full_name)")
        .order("created_at", { ascending: false }).limit(500);
      if (data) setLogs(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const filterLogs = () => {
    let f = [...logs];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      f = f.filter(l => l?.users?.full_name?.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q) || l.entity_name?.toLowerCase().includes(q));
    }
    if (selectedAction) f = f.filter(l => l.action_type === selectedAction);
    if (selectedEntity) f = f.filter(l => l.entity_type === selectedEntity);
    if (dateFrom)       f = f.filter(l => new Date(l.created_at) >= new Date(dateFrom));
    setFilteredLogs(f);
    setCurrentPage(1);
  };

  const clearFilters = () => { setSearchTerm(''); setSelectedAction(''); setSelectedEntity(''); setDateFrom(''); };
  const hasFilters   = searchTerm || selectedAction || selectedEntity || dateFrom;

  const exportCSV = () => {
    const csv = ['Date,User,Email,Role,Action,Entity,Description',
      ...filteredLogs.map(l => `${new Date(l.created_at).toLocaleString('en-US')},${l?.users?.full_name || 'System'},${l?.users?.email || 'System'},${l?.users?.role || '-'},${l.action_type},${l.entity_type || '-'},"${l.description || '-'}"`),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const actionTypes = Array.from(new Set(logs.map(l => l.action_type))).sort();
  const entityTypes = Array.from(new Set(logs.map(l => l.entity_type).filter(Boolean))).sort() as string[];
  const totalPages  = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safePage    = Math.min(currentPage, totalPages);
  const startIndex  = (safePage - 1) * pageSize;
  const pagedLogs   = filteredLogs.slice(startIndex, startIndex + pageSize);

  /* Page numbers with ellipsis */
  const pageNums: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNums.push(i);
  } else {
    pageNums.push(1);
    if (safePage > 3) pageNums.push('…');
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pageNums.push(i);
    if (safePage < totalPages - 2) pageNums.push('…');
    pageNums.push(totalPages);
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 14, flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <History size={18} style={{ color: T.purple }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Activity Log</h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>Track all activities and changes in the platform.</p>
        </div>
        <button onClick={exportCSV}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, color: T.purple, transition: 'background 0.18s' }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.05s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr)) auto', gap: 10, alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', gridColumn: 'span 2' }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, pointerEvents: 'none' }} />
          <input className="aw-al-input" style={{ width: '100%', paddingLeft: 34, boxSizing: 'border-box' }} placeholder="Search user, description…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          {searchTerm && <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 0 }}><X size={12} /></button>}
        </div>

        {/* Action filter */}
        <select className="aw-al-select" style={{ width: '100%' }} value={selectedAction} onChange={e => setSelectedAction(e.target.value)}>
          <option value="">All Actions</option>
          {actionTypes.map(a => <option key={a} value={a}>{ACTION_LABEL[a] || a}</option>)}
        </select>

        {/* Entity filter */}
        <select className="aw-al-select" style={{ width: '100%' }} value={selectedEntity} onChange={e => setSelectedEntity(e.target.value)}>
          <option value="">All Entities</option>
          {entityTypes.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        {/* Date from */}
        <input className="aw-al-input" type="date" style={{ width: '100%' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />

        {/* Clear + count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {hasFilters && (
            <button onClick={clearFilters} style={{ fontSize: 12, fontWeight: 600, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, whiteSpace: 'nowrap' }}>
              Clear
            </button>
          )}
          <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>
            <strong style={{ color: T.textBody }}>{filteredLogs.length}</strong> / {logs.length}
          </span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.08s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }} className="aw-al-scroll">
          <table className="aw-al-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Description</th>
                <th style={{ textAlign: 'center' }}>Info</th>
              </tr>
            </thead>
            <tbody>
              {pagedLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{fmt(log.created_at)}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: T.textBody, whiteSpace: 'nowrap' }}>{log?.users?.full_name || 'System'}</div>
                    {log?.users?.email && <div style={{ fontSize: 11, color: T.textMuted }}>{log.users.email}</div>}
                  </td>
                  <td><RoleBadge role={log?.users?.role} /></td>
                  <td><ActionBadge action={log.action_type} /></td>
                  <td style={{ color: T.textMuted, whiteSpace: 'nowrap' }}>{log.entity_type || '—'}</td>
                  <td>
                    <div style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.textBody, fontSize: 12 }}>
                      {log.description || '—'}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="aw-al-eye-btn" onClick={() => setSelectedLog(log)} title="View Details">
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.textMuted, fontSize: 13 }}>No matching audit logs found.</div>
        )}
      </div>

      {/* ── Pagination ── */}
      {filteredLogs.length > pageSize && (
        <div className="aw-fade-up" style={{ animationDelay: '0.10s', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: T.textMuted }}>
            Showing <strong style={{ color: T.textBody }}>{startIndex + 1}–{Math.min(startIndex + pageSize, filteredLogs.length)}</strong> of <strong style={{ color: T.textBody }}>{filteredLogs.length}</strong>
          </span>
          <div style={{ display: 'flex', gap: 5 }}>
            <button className="aw-al-page-btn" disabled={safePage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft size={13} />
            </button>
            {pageNums.map((p, i) =>
              p === '…' ? (
                <div key={`ell-${i}`} style={{ display: 'flex', alignItems: 'center', padding: '0 4px', color: T.textMuted, fontSize: 12 }}>…</div>
              ) : (
                <button key={p} className={`aw-al-page-btn ${safePage === p ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>
                  {p}
                </button>
              )
            )}
            <button className="aw-al-page-btn" disabled={safePage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => setSelectedLog(null)}>
          <div className="aw-modal-in aw-al-scroll" style={{ width: '100%', maxWidth: 620, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', overflowY: 'auto', maxHeight: '88vh', boxShadow: '0 32px 80px rgba(0,0,0,0.55)', fontFamily: "'Inter', sans-serif" }}
            onClick={e => e.stopPropagation()}>

            <div style={{ height: 3, background: 'linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))' }} />

            {/* Header */}
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: T.bgCard, zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <History size={15} style={{ color: T.purple }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>Log Details</h2>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0, fontFamily: 'monospace' }}>{fmt(selectedLog.created_at)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer' }}>
                <X size={13} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Grid fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { label: 'User',        value: selectedLog?.users?.full_name || 'System' },
                  { label: 'Email',       value: selectedLog?.users?.email || 'System'     },
                  { label: 'Entity Type', value: selectedLog.entity_type || '—'            },
                  { label: 'Entity Name', value: selectedLog.entity_name || '—'            },
                  ...(selectedLog.ip_address ? [{ label: 'IP Address', value: selectedLog.ip_address }] : []),
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="aw-al-detail-label">{label}</div>
                    <div className="aw-al-detail-value" style={{ fontFamily: label === 'IP Address' ? 'monospace' : 'inherit' }}>{value}</div>
                  </div>
                ))}
                <div>
                  <div className="aw-al-detail-label">Action</div>
                  <div style={{ marginTop: 3 }}><ActionBadge action={selectedLog.action_type} /></div>
                </div>
                <div>
                  <div className="aw-al-detail-label">Role</div>
                  <div style={{ marginTop: 3 }}><RoleBadge role={selectedLog?.users?.role} /></div>
                </div>
              </div>

              {/* Description */}
              {selectedLog.description && (
                <div>
                  <div className="aw-al-detail-label" style={{ marginBottom: 7 }}>Description</div>
                  <div style={{ padding: '11px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 9, fontSize: 13, color: T.textBody, lineHeight: '20px' }}>
                    {selectedLog.description}
                  </div>
                </div>
              )}

              {/* Old / New value */}
              {[
                { label: 'Old Value', val: selectedLog.old_value },
                { label: 'New Value', val: selectedLog.new_value },
              ].map(({ label, val }) =>
                val && Object.keys(val).length > 0 ? (
                  <div key={label}>
                    <div className="aw-al-detail-label" style={{ marginBottom: 7 }}>{label}</div>
                    <pre style={{ padding: '11px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 9, fontSize: 12, color: T.textBody, overflowX: 'auto', margin: 0, fontFamily: 'monospace', lineHeight: '18px' }}>
                      {JSON.stringify(val, null, 2)}
                    </pre>
                  </div>
                ) : null
              )}

              {/* User agent */}
              {selectedLog.user_agent && (
                <div>
                  <div className="aw-al-detail-label" style={{ marginBottom: 7 }}>Browser / Agent</div>
                  <div style={{ padding: '10px 13px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 9, fontSize: 11, color: T.textMuted, wordBreak: 'break-all', lineHeight: '17px' }}>
                    {selectedLog.user_agent}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 22px', borderTop: `1px solid ${T.borderFaint}` }}>
              <button onClick={() => setSelectedLog(null)} style={{ width: '100%', padding: '10px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.18s' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
