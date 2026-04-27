import React, { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Loader2, MessageSquare, Plus, Trash2,
  AlertCircle, CheckCircle, Clock, X,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
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
  red:         '#f87171',
  redBg:       'rgba(248,113,113,0.08)',
  redBorder:   'rgba(248,113,113,0.22)',
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
  goldBorder:  'rgba(251,191,36,0.22)',
} as const;

type TicketStatus = "open" | "pending" | "closed";

const STATUS_CFG: Record<TicketStatus, { color: string; bg: string; border: string; icon: typeof Clock; label: string }> = {
  open:    { color: T.blue,  bg: T.blueBg,  border: T.blueBorder,  icon: AlertCircle,  label: 'Open'    },
  pending: { color: T.gold,  bg: T.goldBg,  border: T.goldBorder,  icon: Clock,        label: 'Pending' },
  closed:  { color: T.green, bg: T.greenBg, border: T.greenBorder, icon: CheckCircle,  label: 'Closed'  },
};

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Table ── */
  .aw-sp-table { width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; }
  .aw-sp-table th {
    padding: 10px 16px; text-align: left;
    font-size: 10px; font-weight: 700; color: #64748b;
    letter-spacing: 0.9px; text-transform: uppercase;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
  }
  .aw-sp-table td {
    padding: 14px 16px; font-size: 13px; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: background 0.14s;
  }
  .aw-sp-table tr:last-child td { border-bottom: none; }
  .aw-sp-table tr:hover td { background: rgba(255,255,255,0.025); }

  /* ── Subject input ── */
  .aw-sp-input {
    flex: 1; padding: 12px 16px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-sp-input:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-sp-input::placeholder { color: rgba(148,163,184,0.35); }
  .aw-sp-input:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── Create button ── */
  .aw-sp-create-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 22px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 18px rgba(200,255,0,0.20);
    transition: opacity 0.2s, transform 0.15s;
    white-space: nowrap;
  }
  .aw-sp-create-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .aw-sp-create-btn:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }

  /* ── Delete button ── */
  .aw-sp-del-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 6px 12px; border-radius: 8px; cursor: pointer;
    font-size: 12px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.22);
    color: #f87171; transition: all 0.18s;
  }
  .aw-sp-del-btn:hover:not(:disabled) { background: rgba(248,113,113,0.18); }
  .aw-sp-del-btn:disabled { opacity: 0.40; cursor: not-allowed; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-sp-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-sp-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPE & UTILS
───────────────────────────────────────── */
interface SupportTicket {
  id: string; user_id: string; subject: string;
  status: TicketStatus; created_at: string; updated_at: string;
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const SupportRequestsPage: React.FC = () => {
  const { user }    = useAuth();
  const [tickets, setTickets]       = useState<SupportTicket[]>([]);
  const [newSubject, setNewSubject]  = useState('');
  const [error, setError]           = useState('');
  const [isLoading, setIsLoading]   = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sorted = useMemo(() =>
    [...tickets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [tickets]
  );

  useEffect(() => { loadTickets(); }, [user?.id]);

  const loadTickets = async () => {
    if (!user?.id) { setTickets([]); setIsLoading(false); return; }
    setIsLoading(true); setError('');
    try {
      const { data, error: e } = await supabase
        .from("support_ticket")
        .select("id, user_id, subject, status, created_at, updated_at")
        .eq("user_id", user.id);
      if (e) throw e;
      setTickets((data || []) as SupportTicket[]);
    } catch { setError("Failed to load support requests. Please refresh and try again."); }
    finally { setIsLoading(false); }
  };

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user?.id) { setError("Unable to identify current user. Please sign in again."); return; }
    const subject = newSubject.trim();
    if (!subject)       { setError("Please enter a subject for your request."); return; }
    if (subject.length < 5) { setError("Subject should be at least 5 characters."); return; }
    setIsCreating(true); setError('');
    try {
      const { data, error: e } = await supabase
        .from("support_ticket").insert([{ user_id: user.id, subject }])
        .select("id, user_id, subject, status, created_at, updated_at").single();
      if (e) throw e;
      if (data) setTickets(prev => [data as SupportTicket, ...prev]);
      setNewSubject('');
    } catch { setError("Failed to create support request. Please try again."); }
    finally { setIsCreating(false); }
  };

  const handleDelete = async (id: string) => {
    if (!user?.id) { setError("Unable to identify current user."); return; }
    if (!window.confirm("Delete this support request?")) return;
    setDeletingId(id); setError('');
    try {
      const { error: e } = await supabase.from("support_ticket").delete().eq("id", id).eq("user_id", user.id);
      if (e) throw e;
      setTickets(prev => prev.filter(t => t.id !== id));
    } catch { setError("Failed to delete support request. Please try again."); }
    finally { setDeletingId(null); }
  };

  /* Stats */
  const counts = {
    open:    tickets.filter(t => t.status === 'open').length,
    pending: tickets.filter(t => t.status === 'pending').length,
    closed:  tickets.filter(t => t.status === 'closed').length,
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ background: T.bgCard, border: `1px solid rgba(200,255,0,0.14)`, borderRadius: 14, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,255,0,0.06), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MessageSquare size={20} style={{ color: T.accent }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: T.white, margin: 0, letterSpacing: '-0.2px' }}>Support Requests</h1>
            <p style={{ fontSize: 13, color: T.textBody, margin: 0, marginTop: 3 }}>
              Submit a new request, track your tickets, or delete ones you no longer need.
            </p>
          </div>
          {/* Mini stats */}
          {tickets.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexShrink: 0 }}>
              {(['open', 'pending', 'closed'] as TicketStatus[]).map(s => {
                const cfg = STATUS_CFG[s];
                const n = counts[s];
                if (!n) return null;
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 9 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: cfg.color }}>{n}</span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── New request form ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.05s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={14} style={{ color: T.accent }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>New Request</span>
        </div>
        <form onSubmit={handleCreate} style={{ padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <input
            className="aw-sp-input"
            type="text"
            id="support-subject"
            placeholder="Describe what you need help with…"
            value={newSubject}
            onChange={e => setNewSubject(e.target.value)}
            maxLength={250}
            disabled={isCreating}
          />
          <button type="submit" className="aw-sp-create-btn" disabled={isCreating}>
            {isCreating
              ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Creating…</>
              : <><Plus size={14} /> Create Ticket</>
            }
          </button>
        </form>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ padding: '11px 16px', background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.red }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red, padding: 0 }}><X size={13} /></button>
        </div>
      )}

      {/* ── Tickets table ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.08s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="aw-sp-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last Updated</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: T.textMuted }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <Loader2 size={16} style={{ animation: 'aw-spin 0.8s linear infinite', color: T.accent }} />
                      Loading support requests…
                    </div>
                  </td>
                </tr>
              ) : sorted.length > 0 ? (
                sorted.map((ticket, idx) => {
                  const cfg  = STATUS_CFG[ticket.status] ?? STATUS_CFG.open;
                  const Icon = cfg.icon;
                  return (
                    <tr key={ticket.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={13} style={{ color: cfg.color }} />
                          </div>
                          <span style={{ fontWeight: 600, color: T.white }}>{ticket.subject}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ color: T.textMuted, fontSize: 12 }}>{fmt(ticket.created_at)}</td>
                      <td style={{ color: T.textMuted, fontSize: 12 }}>{fmt(ticket.updated_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="aw-sp-del-btn" onClick={() => handleDelete(ticket.id)} disabled={deletingId === ticket.id}>
                          {deletingId === ticket.id
                            ? <Loader2 size={12} style={{ animation: 'aw-spin 0.8s linear infinite' }} />
                            : <Trash2 size={12} />
                          }
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '48px 0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(200,255,0,0.06)', border: '1px solid rgba(200,255,0,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MessageSquare size={22} style={{ color: T.textMuted }} />
                      </div>
                      <p style={{ fontSize: 14, color: T.textMuted, margin: 0 }}>No support requests yet.</p>
                      <p style={{ fontSize: 12, color: T.textMuted, opacity: 0.7, margin: 0 }}>Create your first ticket using the form above.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Help hint ── */}
      {sorted.length > 0 && (
        <div className="aw-fade-up" style={{ animationDelay: '0.12s', padding: '12px 16px', background: T.bgCard, border: `1px solid ${T.borderFaint}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: T.textMuted }}>
          <CheckCircle size={13} style={{ color: T.green, flexShrink: 0 }} />
          Our support team will review your requests and reply to you by email. Please check your inbox regularly.
        </div>
      )}
    </div>
  );
};
