import React, { useState, useEffect } from 'react';
import {
  Shield, Target, TrendingUp, AlertCircle, Plus, Download,
  Calendar, Users, MousePointerClick, Flag, KeyRound,
  BarChart3, Building2, ArrowUpRight, ArrowDownRight, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { PhishingCampaignQuota, PhishingCampaign, PhishingCampaignRequest } from '../../lib/types';

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
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-ph-card {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    overflow: hidden;
    font-family: 'Inter', sans-serif;
  }
  .aw-ph-card-header {
    padding: 14px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 700; color: #ffffff;
  }

  /* ── Stat card ── */
  .aw-ph-stat {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; padding: 18px 20px;
    position: relative; overflow: hidden;
    font-family: 'Inter', sans-serif;
    transition: border-color 0.2s, transform 0.2s;
  }
  .aw-ph-stat:hover { border-color: rgba(255,255,255,0.14); transform: translateY(-1px); }

  /* ── Campaign row ── */
  .aw-ph-camp-row {
    padding: 14px 16px; border-radius: 10px;
    background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
    transition: background 0.18s, border-color 0.18s;
    font-family: 'Inter', sans-serif;
  }
  .aw-ph-camp-row:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.09); }

  /* ── Select ── */
  .aw-ph-select {
    padding: 8px 32px 8px 12px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 9px; font-size: 13px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none; cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
    transition: border-color 0.2s;
  }
  .aw-ph-select:focus { border-color: rgba(200,255,0,0.45); }
  .aw-ph-select option { background: #1a1e0e; }

  /* ── Vuln badge ── */
  .aw-vuln-badge {
    display: inline-flex; padding: 3px 10px; border-radius: 9999px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
  }

  /* ── Download btn ── */
  .aw-ph-dl-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 16px; border-radius: 9px; cursor: pointer;
    font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-ph-dl-btn:hover { background: rgba(255,255,255,0.09); color: #ffffff; }

  /* ── Primary btn ── */
  .aw-ph-primary-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 16px rgba(200,255,0,0.20);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-ph-primary-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .aw-ph-primary-btn:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-bar-in  { from { width:0%; } to { width:var(--w); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-ph-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-ph-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   VULNERABILITY CONFIG
───────────────────────────────────────── */
const vulnConfig = (score: number) => {
  if (score >= 76) return { color: T.red,    bg: T.redBg,    border: T.redBorder,    label: 'Critical'  };
  if (score >= 51) return { color: T.orange, bg: T.orangeBg, border: T.orangeBorder, label: 'High Risk' };
  if (score >= 26) return { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.22)', label: 'Moderate' };
  return { color: T.green, bg: T.greenBg, border: T.greenBorder, label: 'Low Risk' };
};

const statusConfig = (s: string) => {
  const m: Record<string, { color: string; bg: string; border: string }> = {
    DRAFT:     { color: T.textMuted, bg: 'rgba(255,255,255,0.04)', border: T.borderFaint },
    SUBMITTED: { color: T.blue,   bg: T.blueBg,   border: T.blueBorder  },
    APPROVED:  { color: T.green,  bg: T.greenBg,  border: T.greenBorder },
    RUNNING:   { color: T.orange, bg: T.orangeBg, border: T.orangeBorder},
    COMPLETED: { color: T.purple, bg: T.purpleBg, border: 'rgba(167,139,250,0.22)' },
    REJECTED:  { color: T.red,    bg: T.redBg,    border: T.redBorder   },
  };
  return m[s] ?? m.DRAFT;
};

/* ─────────────────────────────────────────
   RADAR CHART — Vulnerability by dept
───────────────────────────────────────── */
const RadarChart: React.FC<{ data: { label: string; score: number }[] }> = ({ data }) => {
  if (!data.length) return null;
  const N  = data.length;
  const cx = 110; const cy = 110; const R = 80;
  const levels = [20, 40, 60, 80, 100];
  const angleStep = (2 * Math.PI) / N;
  const toXY = (i: number, r: number) => ({
    x: cx + r * Math.sin(i * angleStep),
    y: cy - r * Math.cos(i * angleStep),
  });

  const dataPoints = data.map((d, i) => toXY(i, (d.score / 100) * R));
  const polyline   = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={220} height={220} viewBox="0 0 220 220" style={{ overflow: 'visible' }}>
      {/* Grid circles */}
      {levels.map(l => (
        <polygon key={l}
          points={Array.from({ length: N }, (_, i) => { const p = toXY(i, (l / 100) * R); return `${p.x},${p.y}`; }).join(' ')}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1}
        />
      ))}
      {/* Axes */}
      {data.map((_, i) => {
        const outer = toXY(i, R);
        return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />;
      })}
      {/* Data polygon */}
      <polygon points={polyline} fill="rgba(248,113,113,0.18)" stroke={T.red} strokeWidth={2} strokeLinejoin="round" />
      {/* Dots */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill={vulnConfig(data[i].score).color} stroke={T.bgCard} strokeWidth={2} />
      ))}
      {/* Labels */}
      {data.map((d, i) => {
        const label = toXY(i, R + 18);
        return (
          <text key={i} x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fontFamily="Inter" fill={T.textMuted} fontWeight="600">
            {d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label}
          </text>
        );
      })}
      {/* Center label */}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill={T.textMuted} fontFamily="Inter">Risk</text>
    </svg>
  );
};

/* ─────────────────────────────────────────
   BAR CHART — campaign comparison
───────────────────────────────────────── */
const CampaignBarChart: React.FC<{ campaigns: PhishingCampaign[] }> = ({ campaigns }) => {
  if (!campaigns.length) return (
    <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: T.textMuted }}>No completed campaigns</p>
    </div>
  );
  const data = [...campaigns].slice(0, 5).reverse();
  const maxVal = 100;
  const W = 300; const H = 120; const BAR_W = 28; const GAP = 12;
  const barX = (i: number) => (W - data.length * (BAR_W + GAP)) / 2 + i * (BAR_W + GAP);

  const metrics = [
    { key: 'click_rate',      color: T.red,    label: 'Click' },
    { key: 'reporting_rate',  color: T.green,  label: 'Report' },
    { key: 'credential_rate', color: T.orange, label: 'Cred' },
  ] as const;

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 40}`}>
        {/* Grid */}
        {[25, 50, 75, 100].map(v => {
          const y = H - (v / maxVal) * H;
          return <g key={v}>
            <line x1={0} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <text x={0} y={y + 4} fontSize={8} fill={T.textMuted} fontFamily="Inter">{v}%</text>
          </g>;
        })}
        {/* Bars */}
        {data.map((c, i) => {
          const x = barX(i);
          const miniW = BAR_W / 3;
          return (
            <g key={c.id}>
              {metrics.map((m, mi) => {
                const val = (c[m.key] || 0);
                const bh  = (val / maxVal) * H;
                return (
                  <rect key={mi} x={x + mi * miniW} y={H - bh} width={miniW - 2} height={bh}
                    fill={m.color} rx={2} opacity={0.85} />
                );
              })}
              {/* Campaign label */}
              <text x={x + BAR_W / 2} y={H + 14} textAnchor="middle" fontSize={8} fill={T.textMuted} fontFamily="Inter">
                {c.campaign_name.slice(0, 8)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 4 }}>
        {metrics.map(m => (
          <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.textMuted }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: m.color }} />
            {m.label} Rate
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   TREND LINE CHART — click rate over time
───────────────────────────────────────── */
const TrendLine: React.FC<{ campaigns: PhishingCampaign[] }> = ({ campaigns }) => {
  const data = [...campaigns].slice(0, 6).reverse();
  if (data.length < 2) return (
    <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 12, color: T.textMuted }}>Need 2+ campaigns for trend</p>
    </div>
  );

  const W = 300; const H = 80; const PAD = 16;
  const xStep = (W - PAD * 2) / (data.length - 1);
  const toXY = (i: number, val: number) => ({ x: PAD + i * xStep, y: PAD + ((100 - val) / 100) * (H - PAD * 2) });

  const clickPts  = data.map((c, i) => toXY(i, c.click_rate || 0));
  const reportPts = data.map((c, i) => toXY(i, c.reporting_rate || 0));

  const path = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 16}`}>
      <path d={path(clickPts)}  fill="none" stroke={T.red}   strokeWidth={2} strokeLinecap="round" />
      <path d={path(reportPts)} fill="none" stroke={T.green} strokeWidth={2} strokeLinecap="round" />
      {clickPts.map((p, i)  => <circle key={`c${i}`} cx={p.x} cy={p.y} r={3} fill={T.red}   stroke={T.bgCard} strokeWidth={1.5} />)}
      {reportPts.map((p, i) => <circle key={`r${i}`} cx={p.x} cy={p.y} r={3} fill={T.green} stroke={T.bgCard} strokeWidth={1.5} />)}
      {data.map((_, i) => (
        <text key={i} x={clickPts[i].x} y={H + 12} textAnchor="middle" fontSize={7} fill={T.textMuted} fontFamily="Inter">
          C{i + 1}
        </text>
      ))}
    </svg>
  );
};

/* ─────────────────────────────────────────
   METRIC MINI CARD
───────────────────────────────────────── */
const MetricCard: React.FC<{ icon: React.ElementType; color: string; bg: string; border: string; label: string; sub: string; value: string }> = ({
  icon: Icon, color, bg, border, label, sub, value,
}) => (
  <div style={{ padding: '16px 18px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, ${color}40)` }} />
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ width: 38, height: 38, borderRadius: 9, background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={17} style={{ color }} />
      </div>
      <span style={{ fontSize: 26, fontWeight: 900, color: T.white }}>{value}</span>
    </div>
    <div style={{ fontSize: 13, fontWeight: 700, color: T.white, marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 11, color: T.textMuted }}>{sub}</div>
  </div>
);

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const PhishingDashboardPage: React.FC = () => {
  const { user }    = useAuth();
  const [quota, setQuota]           = useState<PhishingCampaignQuota | null>(null);
  const [campaigns, setCampaigns]   = useState<PhishingCampaign[]>([]);
  const [requests, setRequests]     = useState<PhishingCampaignRequest[]>([]);
  const [deptStats, setDeptStats]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    if (!user?.company_id) return;
    try {
      const year = new Date().getFullYear();
      const [quotaRes, campRes, reqRes] = await Promise.all([
        supabase.from('phishing_campaign_quotas').select('*').eq('company_id', user.company_id).eq('quota_year', year).maybeSingle(),
        supabase.from('phishing_campaigns').select('*').eq('company_id', user.company_id).order('created_at', { ascending: false }),
        supabase.from('phishing_campaign_requests').select('*').eq('company_id', user.company_id).order('created_at', { ascending: false }),
      ]);
      if (quotaRes.data) setQuota(quotaRes.data);
      if (campRes.data)  setCampaigns(campRes.data);
      if (reqRes.data)   setRequests(reqRes.data);
      const latest = campRes.data?.find(c => c.status === 'COMPLETED');
      if (latest) { setSelectedCampaign(latest.id); await loadDeptStats(latest.id); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadDeptStats = async (campaignId: string) => {
    const { data } = await supabase.from('department_vulnerability_stats')
      .select('*, department:departments(name)').eq('campaign_id', campaignId)
      .order('vulnerability_score', { ascending: false });
    if (data) setDeptStats(data);
  };

  const handleSelectCampaign = async (id: string) => { setSelectedCampaign(id); await loadDeptStats(id); };

  const exportCSV = () => {
    const rows = campaigns.map(c => ({
      'Campaign': c.campaign_name, 'Status': c.status,
      'Launch Date': c.launch_date ? new Date(c.launch_date).toLocaleDateString() : 'N/A',
      'Targets': c.total_targets, 'Sent': c.emails_sent,
      'Open %': c.open_rate || 0, 'Click %': c.click_rate || 0,
      'Cred %': c.credential_rate || 0, 'Report %': c.reporting_rate || 0,
    }));
    const csv = [Object.keys(rows[0] || {}).join(','), ...rows.map(r => Object.values(r).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `phishing-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 14, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
    </div>
  );

  const completedCampaigns  = campaigns.filter(c => c.status === 'COMPLETED');
  const remainingQuota      = (quota?.annual_quota || 0) - (quota?.used_campaigns || 0);
  const avgClickRate        = completedCampaigns.length > 0 ? (completedCampaigns.reduce((s, c) => s + (c.click_rate || 0), 0) / completedCampaigns.length).toFixed(1) : '0';
  const avgReportRate       = completedCampaigns.length > 0 ? (completedCampaigns.reduce((s, c) => s + (c.reporting_rate || 0), 0) / completedCampaigns.length).toFixed(1) : '0';
  const avgCredRate         = completedCampaigns.length > 0 ? (completedCampaigns.reduce((s, c) => s + (c.credential_rate || 0), 0) / completedCampaigns.length).toFixed(1) : '0';
  const selectedData        = campaigns.find(c => c.id === selectedCampaign);
  const radarData           = deptStats.map(d => ({ label: d.department?.name || 'Dept', score: d.vulnerability_score }));

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: T.redBg, border: `1px solid ${T.redBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={18} style={{ color: T.red }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>
              Phishing Campaigns
            </h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
            Analytics and department vulnerability analysis.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="aw-ph-dl-btn" onClick={exportCSV}>
            <Download size={14} /> Export Analytics
          </button>
          <button className="aw-ph-primary-btn" disabled={remainingQuota <= 0}>
            <Plus size={14} /> Create Campaign
          </button>
        </div>
      </div>

      {/* ── Quota exhausted warning ── */}
      {remainingQuota <= 0 && (
        <div style={{ padding: '14px 18px', background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <AlertCircle size={16} style={{ color: T.red, flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.red, margin: '0 0 3px' }}>Quota Exhausted</p>
            <p style={{ fontSize: 13, color: T.textBody, margin: 0 }}>You have used all {quota?.annual_quota || 0} campaigns for this year. Contact support to increase your quota.</p>
          </div>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        <MetricCard icon={Shield}           color={remainingQuota > 0 ? T.accent : T.red} bg={remainingQuota > 0 ? 'rgba(200,255,0,0.08)' : T.redBg} border={remainingQuota > 0 ? 'rgba(200,255,0,0.20)' : T.redBorder} label="Campaigns Remaining" sub={`of ${quota?.annual_quota || 0} annual quota`} value={`${remainingQuota}`} />
        <MetricCard icon={MousePointerClick} color={T.red}    bg={T.redBg}    border={T.redBorder}    label="Avg Click Rate"      sub="employees clicked links"    value={`${avgClickRate}%`} />
        <MetricCard icon={Flag}              color={T.green}  bg={T.greenBg}  border={T.greenBorder}  label="Avg Reporting Rate"  sub="employees reported phishing" value={`${avgReportRate}%`} />
        <MetricCard icon={KeyRound}          color={T.orange} bg={T.orangeBg} border={T.orangeBorder} label="Avg Credential Rate" sub="entered credentials"         value={`${avgCredRate}%`} />
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>

        {/* Bar chart */}
        <div className="aw-ph-card aw-fade-up" style={{ animationDelay: '0.10s' }}>
          <div className="aw-ph-card-header">
            <BarChart3 size={14} style={{ color: T.accent }} /> Campaign Comparison
            <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted, fontWeight: 400 }}>Last 5</span>
          </div>
          <div style={{ padding: '16px 20px 20px' }}>
            <CampaignBarChart campaigns={completedCampaigns} />
          </div>
        </div>

        {/* Trend line */}
        <div className="aw-ph-card aw-fade-up" style={{ animationDelay: '0.14s' }}>
          <div className="aw-ph-card-header">
            <TrendingUp size={14} style={{ color: T.accent }} /> Click vs. Report Trend
          </div>
          <div style={{ padding: '16px 20px 20px' }}>
            <TrendLine campaigns={completedCampaigns} />
            <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
              {[{ color: T.red, label: 'Click Rate' }, { color: T.green, label: 'Report Rate' }].map(m => (
                <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.textMuted }}>
                  <div style={{ width: 20, height: 2, background: m.color, borderRadius: 1 }} /> {m.label}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: T.textMuted, marginTop: 8, lineHeight: '17px' }}>
              Click rate going ↓ and Report rate going ↑ indicates improving security awareness.
            </p>
          </div>
        </div>

        {/* Radar chart */}
        <div className="aw-ph-card aw-fade-up" style={{ animationDelay: '0.18s' }}>
          <div className="aw-ph-card-header">
            <Target size={14} style={{ color: T.red }} /> Dept. Vulnerability Radar
          </div>
          <div style={{ padding: '12px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {radarData.length >= 3
              ? <RadarChart data={radarData} />
              : <p style={{ fontSize: 13, color: T.textMuted, padding: '28px 0' }}>Need 3+ departments for radar chart</p>
            }
          </div>
        </div>
      </div>

      {/* ── Campaign analytics detail ── */}
      {selectedData && completedCampaigns.length > 0 && (
        <div className="aw-ph-card aw-fade-up" style={{ animationDelay: '0.20s' }}>
          <div className="aw-ph-card-header">
            <Shield size={14} style={{ color: T.accent }} /> Campaign Analytics
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 400 }}>Select campaign</span>
              <select className="aw-ph-select" value={selectedCampaign || ''} onChange={e => handleSelectCampaign(e.target.value)}>
                {completedCampaigns.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.campaign_name} — {c.completion_date ? new Date(c.completion_date).toLocaleDateString('en-SA', { month: 'short', year: 'numeric' }) : 'N/A'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Campaign metric mini cards */}
          <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {[
              { icon: TrendingUp,      color: T.blue,   bg: T.blueBg,   border: T.blueBorder,   label: 'Open Rate',       sub: `${selectedData.emails_opened} opened`,                     value: `${selectedData.open_rate || 0}%` },
              { icon: MousePointerClick, color: T.red,  bg: T.redBg,    border: T.redBorder,    label: 'Click Rate',      sub: `${selectedData.links_clicked} clicked`,                    value: `${selectedData.click_rate || 0}%` },
              { icon: KeyRound,        color: T.orange, bg: T.orangeBg, border: T.orangeBorder, label: 'Credential Rate', sub: `${selectedData.credentials_entered || 0} entered creds`,   value: `${selectedData.credential_rate || 0}%` },
              { icon: Flag,            color: T.green,  bg: T.greenBg,  border: T.greenBorder,  label: 'Reporting Rate',  sub: `${selectedData.emails_reported} reported`,                 value: `${selectedData.reporting_rate || 0}%` },
            ].map(({ icon: Icon, color, bg, border, label, sub, value }) => (
              <div key={label} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={13} style={{ color }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>{label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color, marginBottom: 3 }}>{value}</div>
                <div style={{ fontSize: 11, color: T.textMuted }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Department vulnerability */}
          {deptStats.length > 0 && (
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingTop: 12, borderTop: `1px solid ${T.borderFaint}` }}>
                <Building2 size={14} style={{ color: T.accent }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Department Vulnerability Analysis</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {deptStats.map((stat: any) => {
                  const vc     = vulnConfig(stat.vulnerability_score);
                  const score  = stat.vulnerability_score.toFixed(0);
                  const click  = stat.total_targets > 0 ? ((stat.links_clicked / stat.total_targets) * 100).toFixed(1) : '0';
                  const report = stat.total_targets > 0 ? ((stat.emails_reported / stat.total_targets) * 100).toFixed(1) : '0';
                  const cred   = stat.total_targets > 0 ? ((stat.credentials_entered / stat.total_targets) * 100).toFixed(1) : '0';
                  const barPct = stat.vulnerability_score;

                  return (
                    <div key={stat.id} style={{ padding: '14px 16px', background: vc.bg, border: `1px solid ${vc.border}`, borderRadius: 11 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                        <div>
                          <h4 style={{ fontSize: 14, fontWeight: 700, color: T.white, margin: '0 0 3px' }}>{stat.department?.name || 'Unknown Department'}</h4>
                          <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>{stat.total_targets} employees targeted</p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 24, fontWeight: 900, color: vc.color, lineHeight: 1 }}>{score}</div>
                          <span className="aw-vuln-badge" style={{ background: vc.bg, border: `1px solid ${vc.border}`, color: vc.color, marginTop: 4, display: 'inline-flex' }}>
                            {vc.label}
                          </span>
                        </div>
                      </div>

                      {/* Vulnerability bar */}
                      <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden', marginBottom: 12 }}>
                        <div style={{ height: '100%', width: `${barPct}%`, background: vc.color, borderRadius: 9999 }} />
                      </div>

                      {/* Mini stats */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        {[
                          { label: 'Opened',     value: stat.emails_opened,       color: T.textBody  },
                          { label: `Clicked (${click}%)`,   value: stat.links_clicked,         color: T.red    },
                          { label: `Creds (${cred}%)`,   value: stat.credentials_entered,   color: T.orange  },
                          { label: `Reported (${report}%)`, value: stat.emails_reported,       color: T.green  },
                        ].map(m => (
                          <div key={m.label} style={{ textAlign: 'center', padding: '8px 6px', background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: m.color, marginBottom: 2 }}>{m.value}</div>
                            <div style={{ fontSize: 9, color: T.textMuted, lineHeight: '13px' }}>{m.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Vuln score guide */}
              <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(200,255,0,0.04)', border: '1px solid rgba(200,255,0,0.14)', borderRadius: 10, fontSize: 12, color: T.textBody, lineHeight: '20px' }}>
                <strong style={{ color: T.accent }}>Vulnerability Score Guide:</strong>{' '}
                <span style={{ color: T.green }}>0–25 Low Risk</span> · <span style={{ color: '#fbbf24' }}>26–50 Moderate</span> · <span style={{ color: T.orange }}>51–75 High Risk</span> · <span style={{ color: T.red }}>76–100 Critical</span>
                {' '}— Higher scores indicate departments needing immediate security training.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Recent requests ── */}
      {requests.length > 0 && (
        <div className="aw-ph-card aw-fade-up" style={{ animationDelay: '0.24s' }}>
          <div className="aw-ph-card-header">
            <Calendar size={14} style={{ color: T.accent }} /> Recent Campaign Requests
            <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted, fontWeight: 400 }}>Last {Math.min(5, requests.length)}</span>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requests.slice(0, 5).map(req => {
              const sc = statusConfig(req.status);
              return (
                <div key={req.id} className="aw-ph-camp-row">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: T.white, margin: '0 0 3px' }}>{req.campaign_name}</h4>
                      <p style={{ fontSize: 11, color: T.textMuted, margin: 0, fontFamily: 'monospace' }}>{req.ticket_number}</p>
                    </div>
                    <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, flexShrink: 0 }}>
                      {req.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: T.textMuted }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={10} /> {new Date(req.created_at).toLocaleDateString('en-SA', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={10} /> {req.target_employee_count} targets
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Analytics guide ── */}
      <div className="aw-ph-card aw-fade-up" style={{ animationDelay: '0.28s', borderColor: 'rgba(200,255,0,0.14)' }}>
        <div className="aw-ph-card-header" style={{ background: 'rgba(200,255,0,0.03)' }}>
          <Target size={14} style={{ color: T.accent }} /> Understanding Your Analytics
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {[
            { icon: MousePointerClick, color: T.red,    title: 'Click Rate',            desc: 'Percentage of employees who clicked phishing links. Lower is better.' },
            { icon: Flag,              color: T.green,  title: 'Reporting Rate',         desc: 'Percentage who reported the phishing attempt. Higher is better!' },
            { icon: KeyRound,          color: T.orange, title: 'Credential Rate',        desc: 'Percentage who entered credentials on a fake page. Lower is better.' },
            { icon: Building2,         color: T.purple, title: 'Department Vulnerability', desc: 'Identifies departments needing additional security training.' },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: `${color}12`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={14} style={{ color }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.white, marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 12, color: T.textBody, lineHeight: '18px' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
