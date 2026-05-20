import React, { useState, useEffect, useCallback } from "react";
import {
  Mail, RefreshCw, Play, AlertCircle, CheckCircle, Clock, XCircle,
  Loader2, ChevronDown, ChevronUp, RotateCcw, Database,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

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

type QueueStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'retrying';

interface EmailQueueRow {
  id:           string;
  to_email:     string;
  subject:      string;
  status:       QueueStatus;
  attempts:     number;
  max_attempts: number;
  scheduled_at: string;
  sent_at:      string | null;
  last_error:   string | null;
  created_at:   string;
}

interface QueueStats {
  pending:  number;
  sending:  number;
  retrying: number;
  sent:     number;
  failed:   number;
}

const STATUS_CFG: Record<QueueStatus, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  pending:  { label: 'Pending',  color: T.blue,   bg: T.blueBg,   border: T.blueBorder,   Icon: Clock        },
  sending:  { label: 'Sending',  color: T.orange, bg: T.orangeBg, border: T.orangeBorder, Icon: Loader2      },
  sent:     { label: 'Sent',     color: T.green,  bg: T.greenBg,  border: T.greenBorder,  Icon: CheckCircle  },
  failed:   { label: 'Failed',   color: T.red,    bg: T.redBg,    border: T.redBorder,    Icon: XCircle      },
  retrying: { label: 'Retrying', color: T.gold,   bg: T.goldBg,   border: T.goldBorder,   Icon: RotateCcw    },
};

const SETUP_SQL = `-- Run this once in your Supabase SQL Editor to enable the cron job:
INSERT INTO email_queue_config (key, value) VALUES
  ('supabase_url',     'https://YOUR_PROJECT_REF.supabase.co'),
  ('service_role_key', 'YOUR_SERVICE_ROLE_KEY')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`;

export const EmailQueuePage: React.FC = () => {
  const [rows, setRows] = useState<EmailQueueRow[]>([]);
  const [stats, setStats] = useState<QueueStats>({ pending: 0, sending: 0, retrying: 0, sent: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<QueueStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [configOk, setConfigOk] = useState<boolean | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Stats (all time)
      const [pend, send, retr, sent, fail, configRow] = await Promise.all([
        supabase.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "sending"),
        supabase.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "retrying"),
        supabase.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "sent"),
        supabase.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("email_queue_config").select("key").limit(1),
      ]);
      setStats({
        pending:  pend.count  ?? 0,
        sending:  send.count  ?? 0,
        retrying: retr.count  ?? 0,
        sent:     sent.count  ?? 0,
        failed:   fail.count  ?? 0,
      });
      setConfigOk((configRow.data?.length ?? 0) > 0);

      // Recent 100 rows
      let q = supabase
        .from("email_queue")
        .select("id, to_email, subject, status, attempts, max_attempts, scheduled_at, sent_at, last_error, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (statusFilter !== 'all') q = q.eq("status", statusFilter);
      const { data } = await q;
      setRows((data ?? []) as EmailQueueRow[]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const triggerNow = async () => {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("process-email-queue", { body: {} });
      if (error) throw new Error(error.message);
      setTriggerResult({ ok: true, msg: `Processed ${data?.processed ?? 0} — sent ${data?.sent ?? 0}, retrying ${data?.retrying ?? 0}, failed ${data?.failed ?? 0}` });
      load();
    } catch (err) {
      setTriggerResult({ ok: false, msg: err instanceof Error ? err.message : "Trigger failed" });
    } finally { setTriggering(false); }
  };

  const statsCards = [
    { key: 'pending',  label: 'Pending',  color: T.blue,   bg: T.blueBg   },
    { key: 'sending',  label: 'Sending',  color: T.orange, bg: T.orangeBg },
    { key: 'retrying', label: 'Retrying', color: T.gold,   bg: T.goldBg   },
    { key: 'sent',     label: 'Sent',     color: T.green,  bg: T.greenBg  },
    { key: 'failed',   label: 'Failed',   color: T.red,    bg: T.redBg    },
  ] as const;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={18} style={{ color: T.purple }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, margin: 0 }}>Email Queue</h1>
            <p style={{ fontSize: 13, color: T.textBody, margin: 0 }}>Monitor and manage outbound email delivery. Auto-refreshes every 30s.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowSetup(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: T.goldBg, border: `1px solid ${T.goldBorder}`, borderRadius: 9, color: T.gold, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            <Database size={13} /> Setup Cron
          </button>
          <button onClick={load} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`, borderRadius: 9, color: T.textBody, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'aw-spin 0.8s linear infinite' : undefined }} /> Refresh
          </button>
          <button onClick={triggerNow} disabled={triggering}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: T.accent, border: 'none', borderRadius: 9, color: T.accentDark, cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: triggering ? 0.7 : 1 }}>
            {triggering ? <Loader2 size={13} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> : <Play size={13} />} Run Now
          </button>
        </div>
      </div>

      {/* Trigger Result */}
      {triggerResult && (
        <div style={{ padding: '10px 14px', background: triggerResult.ok ? T.greenBg : T.redBg, border: `1px solid ${triggerResult.ok ? T.greenBorder : T.redBorder}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          {triggerResult.ok ? <CheckCircle size={13} style={{ color: T.green }} /> : <AlertCircle size={13} style={{ color: T.red }} />}
          <span style={{ fontSize: 12, color: triggerResult.ok ? T.green : T.red }}>{triggerResult.msg}</span>
        </div>
      )}

      {/* Cron Config Status */}
      {configOk === false && (
        <div style={{ padding: '12px 16px', background: T.goldBg, border: `1px solid ${T.goldBorder}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={15} style={{ color: T.gold, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: T.gold }}>Cron config not set — the queue won't process automatically. Click <strong>Setup Cron</strong> to configure.</span>
        </div>
      )}

      {/* Setup Panel */}
      {showSetup && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.goldBorder}`, borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, marginBottom: 10 }}>Cron Job Setup</div>
          <p style={{ fontSize: 12, color: T.textBody, margin: '0 0 12px' }}>
            Run this SQL once in your <strong style={{ color: T.white }}>Supabase SQL Editor</strong> to allow the pg_cron job to call the edge function every minute.
            Replace the placeholder values with your real project URL and service role key.
          </p>
          <pre style={{ margin: 0, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderFaint}`, borderRadius: 8, fontSize: 11, color: '#a5b4fc', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {SETUP_SQL}
          </pre>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
        {statsCards.map(({ key, label, color, bg }) => (
          <div key={key} onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
            style={{ background: T.bgCard, border: `1px solid ${statusFilter === key ? color : T.border}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.2s', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, ${color}40)` }} />
            <div style={{ fontSize: 24, fontWeight: 900, color: T.white, marginBottom: 4 }}>
              {stats[key as keyof QueueStats].toLocaleString()}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['all', 'pending', 'sending', 'retrying', 'sent', 'failed'] as const).map(s => {
          const cfg = s === 'all' ? null : STATUS_CFG[s];
          const active = statusFilter === s;
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '5px 12px', borderRadius: 9999, border: `1px solid ${active ? (cfg?.color ?? T.accent) : T.borderFaint}`, background: active ? (cfg?.bg ?? 'rgba(200,255,0,0.08)') : 'transparent', color: active ? (cfg?.color ?? T.accent) : T.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
              {s === 'all' ? 'All' : s}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Recent Emails ({rows.length})
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
            No emails found.
          </div>
        ) : (
          <div>
            {rows.map(row => {
              const cfg = STATUS_CFG[row.status];
              const StatusIcon = cfg.Icon;
              const expanded = expandedId === row.id;
              return (
                <div key={row.id} style={{ borderBottom: `1px solid ${T.borderFaint}` }}>
                  <div onClick={() => setExpandedId(expanded ? null : row.id)}
                    style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                    {/* Status badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 9999, background: cfg.bg, border: `1px solid ${cfg.border}`, flexShrink: 0, minWidth: 88 }}>
                      <StatusIcon size={10} style={{ color: cfg.color, animation: row.status === 'sending' ? 'aw-spin 0.8s linear infinite' : undefined }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{cfg.label}</span>
                    </div>

                    {/* To + subject */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.to_email}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{row.subject}</div>
                    </div>

                    {/* Attempts */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: row.attempts > 0 ? T.orange : T.textMuted }}>{row.attempts}/{row.max_attempts} attempts</div>
                      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
                        {row.sent_at
                          ? `sent ${new Date(row.sent_at).toLocaleString()}`
                          : new Date(row.created_at).toLocaleString()}
                      </div>
                    </div>

                    {expanded ? <ChevronUp size={14} style={{ color: T.textMuted, flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: T.textMuted, flexShrink: 0 }} />}
                  </div>

                  {expanded && (
                    <div style={{ padding: '10px 18px 16px', background: 'rgba(255,255,255,0.015)', borderTop: `1px solid ${T.borderFaint}` }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                        {[
                          { label: 'ID',           value: row.id },
                          { label: 'Scheduled At', value: new Date(row.scheduled_at).toLocaleString() },
                          { label: 'Created At',   value: new Date(row.created_at).toLocaleString() },
                          ...(row.sent_at ? [{ label: 'Sent At', value: new Date(row.sent_at).toLocaleString() }] : []),
                        ].map(({ label, value }) => (
                          <div key={label} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 7 }}>
                            <div style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
                            <div style={{ fontSize: 11, color: T.textBody, wordBreak: 'break-all' }}>{value}</div>
                          </div>
                        ))}
                      </div>
                      {row.last_error && (
                        <div style={{ marginTop: 10, padding: '8px 12px', background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 7 }}>
                          <div style={{ fontSize: 9, color: T.red, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Last Error</div>
                          <div style={{ fontSize: 12, color: T.red, wordBreak: 'break-all' }}>{row.last_error}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes aw-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
