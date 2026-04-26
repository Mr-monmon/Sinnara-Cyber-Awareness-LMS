import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Loader2, Mail, MessageSquare, CheckCircle,
  AlertCircle, Clock, X, Send, ChevronDown, User,
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
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
  goldBorder:  'rgba(251,191,36,0.22)',
} as const;

/* ─────────────────────────────────────────
   STATUS CONFIG
───────────────────────────────────────── */
type TicketStatus = "open" | "pending" | "closed";

const STATUS_CFG: Record<TicketStatus, { color: string; bg: string; border: string; icon: typeof Clock; label: string }> = {
  open:    { color: T.blue,   bg: T.blueBg,   border: T.blueBorder,   icon: AlertCircle,   label: 'Open'    },
  pending: { color: T.gold,   bg: T.goldBg,   border: T.goldBorder,   icon: Clock,         label: 'Pending' },
  closed:  { color: T.green,  bg: T.greenBg,  border: T.greenBorder,  icon: CheckCircle,   label: 'Closed'  },
};

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Ticket card ── */
  .aw-sr-card {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; overflow: hidden;
    font-family: 'Inter', sans-serif;
    transition: border-color 0.2s;
  }
  .aw-sr-card:hover { border-color: rgba(255,255,255,0.14); }

  /* ── Textarea ── */
  .aw-sr-textarea {
    width: 100%; padding: 12px 14px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 13px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    resize: vertical; min-height: 90px;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-sr-textarea:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-sr-textarea::placeholder { color: rgba(148,163,184,0.35); }

  /* ── Status select ── */
  .aw-sr-select {
    padding: 7px 32px 7px 12px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 8px; font-size: 12px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    appearance: none; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 9px center;
    transition: border-color 0.2s;
  }
  .aw-sr-select:focus { border-color: rgba(200,255,0,0.40); }
  .aw-sr-select:disabled { opacity: 0.45; cursor: not-allowed; }
  .aw-sr-select option { background: #1a1e0e; color: #ffffff; }

  /* ── Reply button ── */
  .aw-sr-reply-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 20px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 16px rgba(200,255,0,0.18);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-sr-reply-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .aw-sr-reply-btn:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }

  /* ── Filter tab ── */
  .aw-sr-tab {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 8px; border: none; cursor: pointer;
    font-size: 12px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: none; color: #64748b; transition: all 0.18s;
  }
  .aw-sr-tab:hover { background: rgba(255,255,255,0.05); color: #cbd5e1; }
  .aw-sr-tab.active {
    background: rgba(200,255,0,0.10); border: 1px solid rgba(200,255,0,0.22); color: #c8ff00;
  }

  /* ── Scrollbar ── */
  .aw-sr-scroll::-webkit-scrollbar { width: 3px; }
  .aw-sr-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-sr-scroll::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-sr-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-sr-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface SupportTicketRow {
  id: string; user_id: string; subject: string;
  status: TicketStatus; created_at: string; updated_at: string;
  users: { email: string; full_name: string } | null;
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

/* ─────────────────────────────────────────
   EMAIL BUILDER (unchanged logic)
───────────────────────────────────────── */
const buildReplyHtml = (fullName: string, subject: string, reply: string) =>
  `<div style="margin:0;padding:32px 16px;background:#12140a;font-family:Arial,sans-serif;color:#fff;"><div style="max-width:600px;margin:0 auto;background:rgba(200,255,0,0.03);border:1px solid rgba(255,255,255,0.10);border-radius:18px;overflow:hidden;"><div style="padding:32px;background:linear-gradient(135deg,#12140a 0%,#1f2610 100%);border-bottom:1px solid rgba(255,255,255,0.10);"><p style="margin:0 0 10px;font-size:13px;letter-spacing:1.6px;text-transform:uppercase;color:#c8ff00;">Awareone Support</p><h1 style="margin:0;font-size:24px;line-height:1.3;">Reply to your support request, ${fullName}</h1></div><div style="padding:32px;"><p style="font-size:15px;line-height:1.8;color:#94a3b8;">We reviewed your request: <strong style="color:#fff;">${subject}</strong></p><p style="font-size:15px;line-height:1.8;color:#94a3b8;">${reply}</p><p style="font-size:15px;line-height:1.8;color:#94a3b8;margin-top:24px;">If you need more help, reply to this email or create another support request.</p></div></div></div>`;

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
const SupportRequestsPage = () => {
  const [tickets, setTickets]         = useState<SupportTicketRow[]>([]);
  const [error, setError]             = useState('');
  const [isLoading, setIsLoading]     = useState(true);
  const [updatingId, setUpdatingId]   = useState<string | null>(null);
  const [replyMap, setReplyMap]       = useState<Record<string, string>>({});
  const [sendingId, setSendingId]     = useState<string | null>(null);
  const [sentIds, setSentIds]         = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<TicketStatus | 'all'>('all');
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());

  const sorted = useMemo(() =>
    [...tickets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [tickets]
  );

  const filtered = useMemo(() =>
    filterStatus === 'all' ? sorted : sorted.filter(t => t.status === filterStatus),
    [sorted, filterStatus]
  );

  useEffect(() => { loadTickets(); }, []);

  const loadTickets = async () => {
    setIsLoading(true); setError('');
    try {
      const { data, error: e } = await supabase.from("support_ticket")
        .select("id, user_id, subject, status, created_at, updated_at, users!support_ticket_user_id_fkey(email, full_name)");
      if (e) throw e;
      const normalized: SupportTicketRow[] = ((data || []) as any[]).map(t => ({
        ...t, users: Array.isArray(t.users) ? t.users[0] || null : t.users,
      }));
      setTickets(normalized);
    } catch { setError("Failed to load support requests. Please refresh and try again."); }
    finally { setIsLoading(false); }
  };

  const handleStatusChange = async (id: string, status: TicketStatus) => {
    setUpdatingId(id);
    try {
      await supabase.from("support_ticket").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status, updated_at: new Date().toISOString() } : t));
    } catch { setError("Failed to update status. Please try again."); }
    finally { setUpdatingId(null); }
  };

  const handleSendReply = async (e: FormEvent<HTMLFormElement>, ticket: SupportTicketRow) => {
    e.preventDefault();
    const reply = (replyMap[ticket.id] || '').trim();
    const email = ticket.users?.email;
    if (!reply) { setError("Please enter a reply message."); return; }
    if (!email) { setError("This ticket has no valid email."); return; }
    setSendingId(ticket.id); setError('');
    try {
      const { error: fnErr } = await supabase.functions.invoke("send-email", {
        body: { to: email, subject: `Support Reply: ${ticket.subject}`, html: buildReplyHtml(ticket.users?.full_name || 'User', ticket.subject, reply) },
      });
      if (fnErr) throw fnErr;
      setReplyMap(prev => ({ ...prev, [ticket.id]: '' }));
      setSentIds(prev => new Set([...prev, ticket.id]));
      setTimeout(() => setSentIds(prev => { const n = new Set(prev); n.delete(ticket.id); return n; }), 3000);
    } catch { setError("Failed to send reply. Please try again."); }
    finally { setSendingId(null); }
  };

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  /* Stats */
  const counts = { all: tickets.length, open: tickets.filter(t => t.status === 'open').length, pending: tickets.filter(t => t.status === 'pending').length, closed: tickets.filter(t => t.status === 'closed').length };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: T.purpleBg || 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MessageSquare size={18} style={{ color: '#a78bfa' }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Support Requests</h1>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>Review tickets, update statuses, and reply to users.</p>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ padding: '11px 16px', background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.red }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red, padding: 0 }}><X size={13} /></button>
        </div>
      )}

      {/* ── Stats + Filter tabs ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.05s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 5 }}>
          {[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'open', label: 'Open', count: counts.open },
            { key: 'pending', label: 'Pending', count: counts.pending },
            { key: 'closed', label: 'Closed', count: counts.closed },
          ].map(({ key, label, count }) => (
            <button key={key} className={`aw-sr-tab ${filterStatus === key ? 'active' : ''}`} onClick={() => setFilterStatus(key as any)}>
              {label}
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, borderRadius: 9999, background: filterStatus === key ? 'rgba(200,255,0,0.20)' : 'rgba(255,255,255,0.08)', fontSize: 10, fontWeight: 800, color: filterStatus === key ? T.accent : T.textMuted, padding: '0 5px' }}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Status legend */}
        <div style={{ display: 'flex', gap: 12 }}>
          {(Object.entries(STATUS_CFG) as [TicketStatus, typeof STATUS_CFG['open']][]).map(([s, cfg]) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.textMuted }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color }} />
              {cfg.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Tickets list ── */}
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '60px 0', color: T.textMuted, fontSize: 14 }}>
          <Loader2 size={18} style={{ animation: 'aw-spin 0.8s linear infinite', color: T.accent }} />
          Loading support requests…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <MessageSquare size={22} style={{ color: T.textMuted }} />
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>No {filterStatus !== 'all' ? filterStatus : ''} support requests found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((ticket, idx) => {
            const cfg      = STATUS_CFG[ticket.status];
            const Icon     = cfg.icon;
            const isExpand = expanded.has(ticket.id);
            const isSent   = sentIds.has(ticket.id);

            return (
              <div key={ticket.id} className={`aw-sr-card aw-fade-up`} style={{ animationDelay: `${idx * 0.04}s` }}>

                {/* Status bar */}
                <div style={{ height: 2, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}30)` }} />

                {/* Card header — always visible */}
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>

                  {/* Status icon */}
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Icon size={16} style={{ color: cfg.color }} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: T.white, margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ticket.subject}
                    </h3>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: T.textMuted }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <User size={11} />
                        <strong style={{ color: T.textBody }}>{ticket.users?.full_name || 'Unknown'}</strong>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Mail size={11} />
                        {ticket.users?.email || '—'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
                      Created: {fmt(ticket.created_at)}
                      {ticket.updated_at !== ticket.created_at && ` · Updated: ${fmt(ticket.updated_at)}`}
                    </div>
                  </div>

                  {/* Right: status + expand */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                    {/* Status badge */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                      {cfg.label}
                    </span>

                    {/* Status change select */}
                    <select
                      className="aw-sr-select"
                      value={ticket.status}
                      disabled={updatingId === ticket.id}
                      onChange={e => handleStatusChange(ticket.id, e.target.value as TicketStatus)}
                    >
                      <option value="open">→ Open</option>
                      <option value="pending">→ Pending</option>
                      <option value="closed">→ Closed</option>
                    </select>

                    {updatingId === ticket.id && <Loader2 size={13} style={{ color: T.accent, animation: 'aw-spin 0.8s linear infinite', flexShrink: 0 }} />}

                    {/* Expand toggle */}
                    <button
                      onClick={() => toggleExpand(ticket.id)}
                      style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isExpand ? 'rgba(200,255,0,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isExpand ? 'rgba(200,255,0,0.22)' : T.borderFaint}`, color: isExpand ? T.accent : T.textMuted, cursor: 'pointer', transition: 'all 0.18s' }}
                    >
                      <ChevronDown size={14} style={{ transform: isExpand ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                  </div>
                </div>

                {/* Expanded reply area */}
                {isExpand && (
                  <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${T.borderFaint}`, paddingTop: 16 }}>
                    <form onSubmit={e => handleSendReply(e, ticket)}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 8 }}>Reply Message</label>
                      <textarea
                        className="aw-sr-textarea"
                        placeholder="Write your support reply here…"
                        rows={4}
                        value={replyMap[ticket.id] || ''}
                        onChange={e => setReplyMap(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 12 }}>
                        {isSent && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.green }}>
                            <CheckCircle size={13} /> Reply sent successfully!
                          </div>
                        )}
                        <div style={{ marginLeft: 'auto' }}>
                          <button type="submit" className="aw-sr-reply-btn" disabled={sendingId === ticket.id}>
                            {sendingId === ticket.id
                              ? <><Loader2 size={13} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Sending…</>
                              : <><Send size={13} /> Send Reply via Email</>
                            }
                          </button>
                        </div>
                      </div>
                    </form>
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

export default SupportRequestsPage;
