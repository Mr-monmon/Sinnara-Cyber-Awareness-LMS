import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity, RefreshCw, Play, Pause, CheckCircle, XCircle,
  Clock, Mail, Eye, MousePointer, KeyRound, Flag, AlertTriangle,
  Building2, Info, Loader2, Inbox, Send as SendIcon,
  BarChart3, Zap, Target, Download,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { generateCampaignPdf } from "../../lib/campaignReport";

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bg:          '#12140a',
  bgCard:      '#1a1e0e',
  accent:      '#c8ff00',
  white:       '#ffffff',
  textBody:    '#cbd5e1',
  textMuted:   '#64748b',
  border:      'rgba(255,255,255,0.09)',
  borderFaint: 'rgba(255,255,255,0.05)',
  green:       '#34d399', greenBg: 'rgba(52,211,153,0.08)',  greenBorder: 'rgba(52,211,153,0.22)',
  blue:        '#60a5fa', blueBg:  'rgba(96,165,250,0.08)',  blueBorder:  'rgba(96,165,250,0.22)',
  orange:      '#fb923c', orangeBg:'rgba(251,146,60,0.08)',  orangeBorder:'rgba(251,146,60,0.22)',
  red:         '#f87171', redBg:   'rgba(248,113,113,0.08)', redBorder:   'rgba(248,113,113,0.22)',
  purple:      '#a78bfa', purpleBg:'rgba(167,139,250,0.08)', purpleBorder:'rgba(167,139,250,0.22)',
  cyan:        '#22d3ee', cyanBg:  'rgba(34,211,238,0.08)',  cyanBorder:  'rgba(34,211,238,0.22)',
  gold:        '#fbbf24', goldBg:  'rgba(251,191,36,0.08)',  goldBorder:  'rgba(251,191,36,0.22)',
} as const;

/* ─────────────────────────────────────────
   STYLES
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-mon-camp-btn { width:100%; text-align:left; padding:10px 12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.07); border-radius:10px; cursor:pointer; font-family:'Inter',sans-serif; transition:all 0.18s; }
  .aw-mon-camp-btn:hover { background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.12); }
  .aw-mon-camp-btn.active { background:rgba(200,255,0,0.06); border-color:rgba(200,255,0,0.28); }

  .aw-mon-tab { padding:8px 14px; border:none; background:none; cursor:pointer; font-size:12px; font-weight:600; font-family:'Inter',sans-serif; color:#64748b; border-bottom:2px solid transparent; transition:all 0.18s; }
  .aw-mon-tab:hover { color:#cbd5e1; }
  .aw-mon-tab.active { color:#c8ff00; border-bottom-color:#c8ff00; }

  .aw-mon-table { width:100%; border-collapse:collapse; font-family:'Inter',sans-serif; }
  .aw-mon-table th { padding:8px 12px; text-align:left; font-size:10px; font-weight:700; color:#64748b; letter-spacing:0.9px; text-transform:uppercase; border-bottom:1px solid rgba(255,255,255,0.07); background:rgba(255,255,255,0.02); }
  .aw-mon-table td { padding:9px 12px; font-size:12px; color:#cbd5e1; border-bottom:1px solid rgba(255,255,255,0.04); }
  .aw-mon-table tr:last-child td { border-bottom:none; }
  .aw-mon-table tr:hover td { background:rgba(255,255,255,0.025); }

  .aw-mon-refresh-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; background:rgba(200,255,0,0.08); border:1px solid rgba(200,255,0,0.22); color:#c8ff00; font-size:12px; font-weight:700; font-family:'Inter',sans-serif; cursor:pointer; transition:all 0.18s; }
  .aw-mon-refresh-btn:hover { background:rgba(200,255,0,0.15); }
  .aw-mon-refresh-btn:disabled { opacity:0.5; cursor:not-allowed; }

  .aw-mon-scroll::-webkit-scrollbar { width:3px; }
  .aw-mon-scroll::-webkit-scrollbar-track { background:transparent; }
  .aw-mon-scroll::-webkit-scrollbar-thumb { background:rgba(200,255,0,0.20); border-radius:9999px; }

  @keyframes aw-spin    { to { transform:rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-pulse   { 0%,100%{opacity:1;} 50%{opacity:0.45;} }
  .aw-fade-up  { animation:aw-fade-up 0.4s ease both; }
  .aw-mon-spin { animation:aw-spin 0.8s linear infinite; }
  .aw-mon-pulse { animation:aw-pulse 2s ease infinite; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-mon-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-mon-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface Campaign {
  id: string;
  name: string;
  status: string;
  company_id: string;
  launched_at: string | null;
  total_queue_size: number;
  total_targets: number;
  emails_sent: number;
  emails_opened: number;
  links_clicked: number;
  credentials_entered: number;
  data_submitted: number;
  emails_reported: number;
  emails_per_minute: number | null;
  // PostgREST returns to-one joins as arrays in its TypeScript inference
  companies: { name: string }[] | { name: string } | null;
}

const getCompanyName = (companies: Campaign['companies']): string => {
  if (!companies) return '—';
  if (Array.isArray(companies)) return companies[0]?.name ?? '—';
  return companies.name;
};

interface QueueCount { status: string; count: number; }

interface Target {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  submitted_at: string | null;
  reported_at: string | null;
}

interface PhishingEvent {
  id: string;
  event_type: string;
  email: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface Alert {
  id: string;
  alert_type: string;
  priority: string;
  title: string;
  message: string;
  created_at: string;
}

interface OverviewStats {
  running: number;
  scheduled: number;
  completed: number;
  totalSent: number;
  totalFailed: number;
  totalOpened: number;
  totalClicked: number;
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const STATUS_CFG: Record<string, { color: string; bg: string; border: string }> = {
  RUNNING:   { color: T.orange, bg: T.orangeBg, border: T.orangeBorder },
  COMPLETED: { color: T.green,  bg: T.greenBg,  border: T.greenBorder  },
  SCHEDULED: { color: T.blue,   bg: T.blueBg,   border: T.blueBorder   },
  APPROVED:  { color: T.purple, bg: T.purpleBg, border: T.purpleBorder },
  PAUSED:    { color: T.gold,   bg: T.goldBg,   border: T.goldBorder   },
  DRAFT:     { color: T.textMuted, bg: 'rgba(255,255,255,0.03)', border: T.borderFaint },
};
const getStatusCfg = (s: string) => STATUS_CFG[s] ?? STATUS_CFG.DRAFT;

const QUEUE_CFG: Record<string, { color: string; bg: string; label: string }> = {
  PENDING:  { color: T.textMuted, bg: 'rgba(255,255,255,0.04)', label: 'Pending'  },
  SENDING:  { color: T.orange,   bg: T.orangeBg,               label: 'Sending'  },
  SENT:     { color: T.green,    bg: T.greenBg,                label: 'Sent'     },
  FAILED:   { color: T.red,      bg: T.redBg,                  label: 'Failed'   },
  SKIPPED:  { color: T.gold,     bg: T.goldBg,                 label: 'Skipped'  },
};

const EVENT_CFG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  EMAIL_SENT:     { color: T.blue,   icon: SendIcon,       label: 'Email Sent'        },
  EMAIL_OPENED:   { color: T.purple, icon: Eye,            label: 'Email Opened'      },
  LINK_CLICKED:   { color: T.orange, icon: MousePointer,   label: 'Link Clicked'      },
  FORM_SUBMITTED: { color: T.red,    icon: KeyRound,       label: 'Credentials Submitted' },
  EMAIL_REPORTED: { color: T.green,  icon: Flag,           label: 'Email Reported'    },
  EMAIL_FAILED:   { color: T.red,    icon: XCircle,        label: 'Delivery Failed'   },
};
const getEventCfg = (t: string) => EVENT_CFG[t] ?? { color: T.textMuted, icon: Info, label: t };

const fmtTime = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/* ─────────────────────────────────────────
   STAT MINI CARD
───────────────────────────────────────── */
const MiniStat: React.FC<{
  icon: React.ElementType; color: string; bg: string; border: string;
  label: string; value: string | number; sub?: string; pulse?: boolean;
}> = ({ icon: Icon, color, bg, border, label, value, sub, pulse }) => (
  <div style={{ padding: '14px 16px', background: T.bgCard, border: `1px solid ${border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},${color}40)` }} />
    <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={15} style={{ color }} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: T.white, lineHeight: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        {value}
        {pulse && <span className="aw-mon-pulse" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textBody, marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>{sub}</div>}
    </div>
  </div>
);

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const PhishingMonitoringPage: React.FC = () => {
  const [campaigns, setCampaigns]         = useState<Campaign[]>([]);
  const [selected, setSelected]           = useState<Campaign | null>(null);
  const [queueCounts, setQueueCounts]     = useState<QueueCount[]>([]);
  const [targets, setTargets]             = useState<Target[]>([]);
  const [events, setEvents]               = useState<PhishingEvent[]>([]);
  const [alerts, setAlerts]               = useState<Alert[]>([]);
  const [overview, setOverview]           = useState<OverviewStats>({ running: 0, scheduled: 0, completed: 0, totalSent: 0, totalFailed: 0, totalOpened: 0, totalClicked: 0 });
  const [loading, setLoading]             = useState(true);
  const [drillLoading, setDrillLoading]   = useState(false);
  const [activeTab, setActiveTab]         = useState<'overview' | 'targets' | 'events' | 'alerts'>('overview');
  const [autoRefresh, setAutoRefresh]     = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing]       = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Mirror of `selected` for use inside stable callbacks/intervals without
  // adding `selected` to their dependency arrays (which would re-create them
  // on every selection and re-trigger the initial-load effect).
  const selectedRef = useRef<Campaign | null>(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  /* ── Load overview campaign list ── */
  const loadCampaigns = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('phishing_campaigns')
        .select('id, name, status, company_id, launched_at, total_queue_size, total_targets, emails_sent, emails_opened, links_clicked, credentials_entered, data_submitted, emails_reported, emails_per_minute, companies(name)')
        .order('launched_at', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as Campaign[];
      setCampaigns(rows);

      const running   = rows.filter(c => c.status === 'RUNNING').length;
      const scheduled = rows.filter(c => c.status === 'SCHEDULED' || c.status === 'APPROVED').length;
      const completed = rows.filter(c => c.status === 'COMPLETED').length;
      const totalSent    = rows.reduce((s, c) => s + (c.emails_sent   || 0), 0);
      const totalOpened  = rows.reduce((s, c) => s + (c.emails_opened || 0), 0);
      const totalClicked = rows.reduce((s, c) => s + (c.links_clicked || 0), 0);

      // Count FAILED queue rows across all campaigns (not just running)
      let totalFailed = 0;
      {
        const { count: failedCount } = await supabase
          .from('campaign_email_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'FAILED');
        totalFailed = failedCount ?? 0;
      }

      setOverview({ running, scheduled, completed, totalSent, totalFailed, totalOpened, totalClicked });
      setLastRefreshed(new Date());

      // Refresh the selected campaign's header stats with the freshly-loaded row.
      // Functional update so this callback does NOT depend on `selected` — that
      // dependency previously re-created loadCampaigns on every selection, which
      // re-ran the initial-load effect and made the drill-down flash then vanish.
      setSelected(prev => (prev ? rows.find(r => r.id === prev.id) ?? prev : prev));
    } catch (err) { console.error('Failed to load campaigns', err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  /* ── Load drill-down data for selected campaign ── */
  const loadDrillDown = useCallback(async (campaignId: string) => {
    setDrillLoading(true);
    try {
      const [queueRes, targetsRes, eventsRes, alertsRes] = await Promise.all([
        supabase
          .from('campaign_email_queue')
          .select('status')
          .eq('campaign_id', campaignId),
        supabase
          .from('phishing_campaign_targets')
          .select('id, email, first_name, last_name, position, status, sent_at, opened_at, clicked_at, submitted_at, reported_at')
          .eq('campaign_id', campaignId)
          .order('sent_at', { ascending: false })
          .limit(200),
        supabase
          .from('phishing_events')
          .select('id, event_type, email, created_at, metadata')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('phishing_alerts')
          .select('id, alert_type, priority, title, message, created_at')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      // Aggregate queue counts
      const rows = queueRes.data ?? [];
      const countMap = new Map<string, number>();
      rows.forEach((r: { status: string }) => countMap.set(r.status, (countMap.get(r.status) ?? 0) + 1));
      setQueueCounts(Array.from(countMap.entries()).map(([status, count]) => ({ status, count })));

      setTargets((targetsRes.data ?? []) as Target[]);
      setEvents((eventsRes.data ?? []) as PhishingEvent[]);
      setAlerts((alertsRes.data ?? []) as Alert[]);
    } catch (err) { console.error('Failed to load drill-down', err); }
    finally { setDrillLoading(false); }
  }, []);

  /* ── Select campaign ── */
  const selectCampaign = (c: Campaign) => {
    setSelected(c);
    setActiveTab('overview');
    loadDrillDown(c.id);
  };

  /* ── Pause / resume a campaign ──
   * The campaign engine (process-campaign) leaves a PAUSED campaign's queue
   * rows PENDING and defers them, so flipping RUNNING⇄PAUSED here cleanly halts
   * and resumes sending on the next cron tick. */
  const handleTogglePause = async () => {
    const current = selected;
    if (!current || statusUpdating) return;
    const next = current.status === 'PAUSED' ? 'RUNNING' : 'PAUSED';
    setStatusUpdating(true);
    try {
      const { error } = await supabase
        .from('phishing_campaigns')
        .update({ status: next })
        .eq('id', current.id);
      if (error) throw error;
      // Reflect immediately, then reconcile from the server.
      setSelected(prev => (prev ? { ...prev, status: next } : prev));
      setCampaigns(prev => prev.map(c => (c.id === current.id ? { ...c, status: next } : c)));
      await loadCampaigns(true);
    } catch (err) {
      console.error('Failed to update campaign status', err);
      alert('Failed to update campaign status: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setStatusUpdating(false);
    }
  };

  /* ── Initial load + auto-refresh ── */
  useEffect(() => {
    loadCampaigns(false);
  }, [loadCampaigns]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefresh) {
      timerRef.current = setInterval(() => {
        loadCampaigns(true);
        const sel = selectedRef.current;
        if (sel) loadDrillDown(sel.id);
      }, 30_000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, loadCampaigns, loadDrillDown]);

  /* ── Manual refresh ── */
  const handleRefresh = async () => {
    await loadCampaigns(true);
    if (selected) await loadDrillDown(selected.id);
  };

  /* ── Export selected campaign to PDF (reuses already-loaded targets) ── */
  const handleExportPdf = () => {
    if (!selected) return;
    generateCampaignPdf({
      name: selected.name,
      companyName: getCompanyName(selected.companies),
      status: selected.status,
      launchedAt: selected.launched_at,
      totalTargets: selected.total_targets,
      emailsSent: selected.emails_sent,
      emailsOpened: selected.emails_opened,
      linksClicked: selected.links_clicked,
      credentialsSubmitted: selected.credentials_entered ?? selected.data_submitted ?? 0,
      emailsReported: selected.emails_reported,
      queue: {
        queued:  qTotal,
        sent:    qByStatus['SENT']    ?? selected.emails_sent,
        failed:  qByStatus['FAILED']  ?? 0,
        pending: qByStatus['PENDING'] ?? 0,
        skipped: qByStatus['SKIPPED'] ?? 0,
      },
      targets: targets.map(t => ({
        email: t.email,
        name: [t.first_name, t.last_name].filter(Boolean).join(' ') || undefined,
        status: t.status,
        opened_at: t.opened_at,
        clicked_at: t.clicked_at,
        submitted_at: t.submitted_at,
        reported_at: t.reported_at,
      })),
    });
  };

  /* ── Queue totals for selected campaign ── */
  const qTotal    = queueCounts.reduce((s, q) => s + q.count, 0);
  const qByStatus = Object.fromEntries(queueCounts.map(q => [q.status, q.count]));

  /* ── Loading state ── */
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', flexDirection: 'column', gap: 14, fontFamily: 'Inter,sans-serif' }}>
      <div className="aw-mon-spin" style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent }} />
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={18} style={{ color: T.orange }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Live Campaign Monitor</h1>
            <p style={{ fontSize: 13, color: T.textBody, margin: 0 }}>Real-time visibility into all phishing campaigns and email queues.</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastRefreshed && (
            <span style={{ fontSize: 11, color: T.textMuted }}>
              Updated {lastRefreshed.toLocaleTimeString('en-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => setAutoRefresh(v => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: autoRefresh ? T.greenBg : 'rgba(255,255,255,0.04)', border: `1px solid ${autoRefresh ? T.greenBorder : T.border}`, color: autoRefresh ? T.green : T.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {autoRefresh ? <><Play size={11} /> Auto-refresh ON</> : <><Pause size={11} /> Auto-refresh OFF</>}
          </button>
          <button className="aw-mon-refresh-btn" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={12} className={refreshing ? 'aw-mon-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Overview KPI strip ── */}
      <div className="aw-fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, animationDelay: '0.04s' }}>
        <MiniStat icon={Zap}          color={T.orange} bg={T.orangeBg} border={T.orangeBorder} label="Running"         value={overview.running}   sub="active campaigns" pulse={overview.running > 0} />
        <MiniStat icon={Clock}        color={T.blue}   bg={T.blueBg}   border={T.blueBorder}   label="Scheduled"       value={overview.scheduled} sub="awaiting launch" />
        <MiniStat icon={CheckCircle}  color={T.green}  bg={T.greenBg}  border={T.greenBorder}  label="Completed"       value={overview.completed} sub="all time" />
        <MiniStat icon={SendIcon}     color={T.cyan}   bg={T.cyanBg}   border={T.cyanBorder}   label="Total Emails Sent" value={overview.totalSent.toLocaleString()} />
        <MiniStat icon={Eye}          color={T.purple} bg={T.purpleBg} border={T.purpleBorder} label="Opened"          value={overview.totalOpened.toLocaleString()}  sub={`${pct(overview.totalOpened, overview.totalSent)}% open rate`} />
        <MiniStat icon={MousePointer} color={T.red}    bg={T.redBg}    border={T.redBorder}    label="Clicked"         value={overview.totalClicked.toLocaleString()} sub={`${pct(overview.totalClicked, overview.totalSent)}% click rate`} />
      </div>

      {/* ── Main layout: campaign list + drilldown ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'flex-start' }}>

        {/* ── LEFT: Campaign list ── */}
        <div className="aw-fade-up" style={{ animationDelay: '0.06s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={13} style={{ color: T.accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Campaigns</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted }}>{campaigns.length}</span>
          </div>
          <div className="aw-mon-scroll" style={{ maxHeight: 600, overflowY: 'auto', padding: '8px' }}>
            {campaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: T.textMuted, fontSize: 13 }}>
                <Inbox size={28} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 10px', display: 'block' }} />
                No campaigns yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {campaigns.map(c => {
                  const cfg    = getStatusCfg(c.status);
                  const isAct  = selected?.id === c.id;
                  const sentPct = pct(c.emails_sent, c.total_queue_size);
                  return (
                    <div key={c.id} className={`aw-mon-camp-btn ${isAct ? 'active' : ''}`} onClick={() => selectCampaign(c)}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.white, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                        <Building2 size={10} style={{ color: T.textMuted }} />
                        <span style={{ fontSize: 10, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCompanyName(c.companies)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 9999, fontSize: 10, fontWeight: 700, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                          {c.status === 'RUNNING' && <span className="aw-mon-pulse" style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: cfg.color }} />}
                          {c.status}
                        </span>
                        <span style={{ fontSize: 10, color: T.textMuted }}>{c.emails_sent} / {c.total_queue_size || '?'}</span>
                      </div>
                      {/* Progress bar */}
                      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${sentPct}%`, height: '100%', background: cfg.color, borderRadius: 2, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Drill-down ── */}
        <div className="aw-fade-up" style={{ animationDelay: '0.08s' }}>
          {!selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Target size={24} style={{ color: T.textMuted }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: T.textBody, margin: '0 0 6px' }}>No campaign selected</p>
              <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>Pick a campaign from the left to see live details.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Campaign header */}
              <div style={{ background: T.bgCard, border: `1px solid rgba(200,255,0,0.14)`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: T.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</span>
                    <span style={{ ...getStatusCfg(selected.status), display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                      {selected.status === 'RUNNING' && <span className="aw-mon-pulse" style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: getStatusCfg(selected.status).color }} />}
                      {selected.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: T.textMuted }}><Building2 size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{getCompanyName(selected.companies)}</span>
                    {selected.launched_at && <span style={{ fontSize: 11, color: T.textMuted }}>Launched {fmtTime(selected.launched_at)}</span>}
                    {selected.emails_per_minute && <span style={{ fontSize: 11, color: T.textMuted }}>{selected.emails_per_minute}/min</span>}
                  </div>
                </div>
                {drillLoading && <Loader2 size={14} style={{ color: T.textMuted }} className="aw-mon-spin" />}
                {(selected.status === 'RUNNING' || selected.status === 'PAUSED') && (
                  <button
                    onClick={handleTogglePause}
                    disabled={statusUpdating}
                    title={selected.status === 'PAUSED' ? 'Resume sending emails' : 'Temporarily pause sending'}
                    style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
                      background: selected.status === 'PAUSED' ? T.greenBg : T.goldBg,
                      border: `1px solid ${selected.status === 'PAUSED' ? T.greenBorder : T.goldBorder}`,
                      color: selected.status === 'PAUSED' ? T.green : T.gold,
                      fontSize: 12, fontWeight: 700, cursor: statusUpdating ? 'not-allowed' : 'pointer', opacity: statusUpdating ? 0.6 : 1, fontFamily: 'inherit' }}>
                    {statusUpdating
                      ? <Loader2 size={12} className="aw-mon-spin" />
                      : selected.status === 'PAUSED' ? <Play size={12} /> : <Pause size={12} />}
                    {selected.status === 'PAUSED' ? 'Resume' : 'Pause'}
                  </button>
                )}
                <button
                  onClick={handleExportPdf}
                  title="Export campaign results to PDF"
                  style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'rgba(200,255,0,0.08)', border: `1px solid rgba(200,255,0,0.22)`, color: T.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Download size={12} /> Export PDF
                </button>
              </div>

              {/* Metrics cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                {[
                  { icon: SendIcon,     color: T.blue,   bg: T.blueBg,   border: T.blueBorder,   label: 'Sent',        value: selected.emails_sent,          sub: `of ${selected.total_queue_size || '?'}` },
                  { icon: Eye,          color: T.purple, bg: T.purpleBg, border: T.purpleBorder, label: 'Opened',      value: selected.emails_opened,         sub: `${pct(selected.emails_opened, selected.emails_sent)}%` },
                  { icon: MousePointer, color: T.orange, bg: T.orangeBg, border: T.orangeBorder, label: 'Clicked',     value: selected.links_clicked,         sub: `${pct(selected.links_clicked, selected.emails_sent)}%` },
                  { icon: KeyRound,     color: T.red,    bg: T.redBg,    border: T.redBorder,    label: 'Credentials', value: selected.credentials_entered ?? selected.data_submitted ?? 0, sub: `${pct(selected.credentials_entered ?? selected.data_submitted ?? 0, selected.emails_sent)}%` },
                  { icon: Flag,         color: T.green,  bg: T.greenBg,  border: T.greenBorder,  label: 'Reported',    value: selected.emails_reported,       sub: `${pct(selected.emails_reported, selected.emails_sent)}%` },
                  { icon: Target,       color: T.accent, bg: 'rgba(200,255,0,0.08)', border: 'rgba(200,255,0,0.22)', label: 'Total Targets', value: selected.total_targets, sub: '' },
                ].map(({ icon: Icon, color, bg, border, label, value, sub }) => (
                  <div key={label} style={{ padding: '12px 14px', background: T.bgCard, border: `1px solid ${border}`, borderRadius: 10, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},${color}40)` }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 6, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={12} style={{ color }} />
                      </div>
                      <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}>{label}</span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: T.white }}>{(value || 0).toLocaleString()}</div>
                    {sub && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{sub}</div>}
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ display: 'flex', borderBottom: `1px solid ${T.borderFaint}`, paddingLeft: 8, paddingTop: 4 }}>
                  {(['overview', 'targets', 'events', 'alerts'] as const).map(tab => (
                    <button key={tab} className={`aw-mon-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      {tab === 'alerts' && alerts.length > 0 && (
                        <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: T.redBg, border: `1px solid ${T.redBorder}`, fontSize: 9, fontWeight: 800, color: T.red }}>{alerts.length}</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="aw-mon-scroll" style={{ maxHeight: 420, overflowY: 'auto' }}>

                  {/* ── TAB: Overview ── */}
                  {activeTab === 'overview' && (
                    <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                      {/* Delivery progress */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Mail size={12} /> Email Queue Breakdown
                        </div>
                        {queueCounts.length === 0 ? (
                          <div style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', padding: '16px 0' }}>No queue data yet</div>
                        ) : (
                          <>
                            {/* Stacked bar */}
                            <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', marginBottom: 12, background: 'rgba(255,255,255,0.04)' }}>
                              {(['SENT', 'SENDING', 'PENDING', 'FAILED', 'SKIPPED'] as const).map(s => {
                                const cnt = qByStatus[s] ?? 0;
                                const w   = pct(cnt, qTotal);
                                const cfg = QUEUE_CFG[s];
                                return w > 0 ? (
                                  <div key={s} style={{ width: `${w}%`, background: cfg.color, transition: 'width 0.4s' }} title={`${cfg.label}: ${cnt}`} />
                                ) : null;
                              })}
                            </div>
                            {/* Legend */}
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              {(['SENT', 'SENDING', 'PENDING', 'FAILED', 'SKIPPED'] as const).map(s => {
                                const cnt = qByStatus[s] ?? 0;
                                const cfg = QUEUE_CFG[s];
                                return (
                                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: cfg.bg, border: `1px solid ${cfg.color}33`, borderRadius: 8 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: 2, background: cfg.color }} />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                                    <span style={{ fontSize: 13, fontWeight: 900, color: T.white }}>{cnt.toLocaleString()}</span>
                                  </div>
                                );
                              })}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderFaint}`, borderRadius: 8, marginLeft: 'auto' }}>
                                <span style={{ fontSize: 11, color: T.textMuted }}>Total</span>
                                <span style={{ fontSize: 13, fontWeight: 900, color: T.white }}>{qTotal.toLocaleString()}</span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Funnel bars */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <BarChart3 size={12} /> Engagement Funnel
                        </div>
                        {[
                          { label: 'Sent',        value: selected.emails_sent,          color: T.blue   },
                          { label: 'Opened',       value: selected.emails_opened,        color: T.purple },
                          { label: 'Clicked',      value: selected.links_clicked,        color: T.orange },
                          { label: 'Credentials',  value: selected.credentials_entered ?? selected.data_submitted ?? 0, color: T.red },
                          { label: 'Reported',     value: selected.emails_reported,      color: T.green  },
                        ].map(({ label, value, color }) => {
                          const w = pct(value || 0, selected.total_targets || selected.total_queue_size || 1);
                          return (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                              <div style={{ width: 80, fontSize: 11, color: T.textBody, flexShrink: 0, textAlign: 'right' }}>{label}</div>
                              <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4, minWidth: value > 0 ? 8 : 0 }}>
                                  {w > 15 && <span style={{ fontSize: 9, fontWeight: 800, color: '#12140a' }}>{w}%</span>}
                                </div>
                              </div>
                              <div style={{ width: 44, fontSize: 11, fontWeight: 700, color: T.white, flexShrink: 0, textAlign: 'right' }}>{(value || 0).toLocaleString()}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── TAB: Targets ── */}
                  {activeTab === 'targets' && (
                    targets.length === 0 ? (
                      <div style={{ padding: '32px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No target data yet</div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="aw-mon-table">
                          <thead>
                            <tr>
                              <th>Email</th>
                              <th>Name</th>
                              <th>Status</th>
                              <th>Sent</th>
                              <th>Opened</th>
                              <th>Clicked</th>
                              <th>Submitted</th>
                              <th>Reported</th>
                            </tr>
                          </thead>
                          <tbody>
                            {targets.map(t => {
                              const stages = [
                                { key: 'sent_at',      val: t.sent_at,      color: T.blue   },
                                { key: 'opened_at',    val: t.opened_at,    color: T.purple },
                                { key: 'clicked_at',   val: t.clicked_at,   color: T.orange },
                                { key: 'submitted_at', val: t.submitted_at, color: T.red    },
                                { key: 'reported_at',  val: t.reported_at,  color: T.green  },
                              ];
                              const riskLevel = t.submitted_at ? T.red : t.clicked_at ? T.orange : t.opened_at ? T.purple : T.textMuted;
                              return (
                                <tr key={t.id}>
                                  <td style={{ fontFamily: 'monospace', fontSize: 11, color: riskLevel, fontWeight: t.submitted_at ? 700 : 400 }}>{t.email}</td>
                                  <td style={{ fontSize: 11 }}>{[t.first_name, t.last_name].filter(Boolean).join(' ') || '—'}</td>
                                  <td>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 9999, background: getStatusCfg(t.status).bg, border: `1px solid ${getStatusCfg(t.status).border}`, color: getStatusCfg(t.status).color }}>
                                      {t.status}
                                    </span>
                                  </td>
                                  {stages.map(({ key, val, color }) => (
                                    <td key={key} style={{ fontSize: 10, color: val ? color : T.textMuted }}>
                                      {val ? fmtTime(val) : '—'}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {targets.length === 200 && (
                          <div style={{ padding: '10px 14px', fontSize: 11, color: T.textMuted, textAlign: 'center', borderTop: `1px solid ${T.borderFaint}` }}>
                            Showing first 200 targets
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* ── TAB: Events ── */}
                  {activeTab === 'events' && (
                    events.length === 0 ? (
                      <div style={{ padding: '32px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No events recorded yet</div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="aw-mon-table">
                          <thead>
                            <tr><th>Time</th><th>Event</th><th>Email</th></tr>
                          </thead>
                          <tbody>
                            {events.map(ev => {
                              const cfg = getEventCfg(ev.event_type);
                              const Icon = cfg.icon;
                              return (
                                <tr key={ev.id}>
                                  <td style={{ fontSize: 10, color: T.textMuted, whiteSpace: 'nowrap' }}>{fmtTime(ev.created_at)}</td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                      <div style={{ width: 22, height: 22, borderRadius: 5, background: `${cfg.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Icon size={11} style={{ color: cfg.color }} />
                                      </div>
                                      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                                    </div>
                                  </td>
                                  <td style={{ fontFamily: 'monospace', fontSize: 11, color: T.textBody }}>{ev.email ?? '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {events.length === 100 && (
                          <div style={{ padding: '10px 14px', fontSize: 11, color: T.textMuted, textAlign: 'center', borderTop: `1px solid ${T.borderFaint}` }}>
                            Showing latest 100 events
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* ── TAB: Alerts ── */}
                  {activeTab === 'alerts' && (
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {alerts.length === 0 ? (
                        <div style={{ padding: '32px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                          <CheckCircle size={24} style={{ color: T.green, margin: '0 auto 8px', display: 'block' }} />
                          No alerts for this campaign
                        </div>
                      ) : alerts.map(a => {
                        const prioColor = a.priority === 'HIGH' || a.priority === 'CRITICAL' ? T.red
                          : a.priority === 'MEDIUM' ? T.orange : T.textMuted;
                        const prioBg    = a.priority === 'HIGH' || a.priority === 'CRITICAL' ? T.redBg
                          : a.priority === 'MEDIUM' ? T.orangeBg : 'rgba(255,255,255,0.03)';
                        return (
                          <div key={a.id} style={{ padding: '12px 14px', background: prioBg, border: `1px solid ${prioColor}33`, borderRadius: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <AlertTriangle size={13} style={{ color: prioColor }} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{a.title}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 9999, background: `${prioColor}18`, color: prioColor }}>{a.priority}</span>
                                <span style={{ fontSize: 10, color: T.textMuted }}>{fmtTime(a.created_at)}</span>
                              </div>
                            </div>
                            <p style={{ fontSize: 12, color: T.textBody, margin: 0 }}>{a.message}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
