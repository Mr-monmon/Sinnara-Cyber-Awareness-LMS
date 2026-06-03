import React, { useState, useEffect } from 'react';
import { Bell, Key, MousePointerClick, CheckCircle, Play, AlertTriangle, Filter, Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const T = {
  bg: '#12140a', bgCard: '#1a1e0e', accent: '#c8ff00', accentDark: '#12140a',
  white: '#ffffff', textBody: '#cbd5e1', textMuted: '#64748b',
  border: 'rgba(255,255,255,0.09)', borderFaint: 'rgba(255,255,255,0.05)',
  green: '#34d399', greenBg: 'rgba(52,211,153,0.08)', greenBorder: 'rgba(52,211,153,0.22)',
  blue: '#60a5fa', blueBg: 'rgba(96,165,250,0.08)', blueBorder: 'rgba(96,165,250,0.22)',
  orange: '#fb923c', orangeBg: 'rgba(251,146,60,0.08)', orangeBorder: 'rgba(251,146,60,0.22)',
  red: '#f87171', redBg: 'rgba(248,113,113,0.08)', redBorder: 'rgba(248,113,113,0.22)',
  purple: '#a78bfa', purpleBg: 'rgba(167,139,250,0.08)', purpleBorder: 'rgba(167,139,250,0.22)',
  gold: '#fbbf24', goldBg: 'rgba(251,191,36,0.08)', goldBorder: 'rgba(251,191,36,0.22)',
} as const;

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  .aw-al-btn { border: none; border-radius: 9px; cursor: pointer; font-family: 'Inter',sans-serif; font-weight: 600; transition: all .15s; }
  .aw-al-row { cursor: pointer; transition: background .15s; border-left: 3px solid transparent; }
  .aw-al-row:hover { background: rgba(255,255,255,.03); }
  .aw-al-row.unread { border-left-color: #c8ff00; background: rgba(200,255,0,.03); }
  .aw-al-tab { background: none; border: none; cursor: pointer; font-family: 'Inter',sans-serif; transition: all .15s; border-radius: 8px; }
`;

const PRIORITY_CFG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  CRITICAL: { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.30)', label: 'CRITICAL' },
  HIGH:     { color: '#fb923c', bg: 'rgba(251,146,60,0.10)', border: 'rgba(251,146,60,0.25)', label: 'HIGH' },
  MEDIUM:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.25)', label: 'MEDIUM' },
  LOW:      { color: '#64748b', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.10)', label: 'LOW' },
};

const TYPE_CFG: Record<string, { Icon: React.ComponentType<{ size?: number; color?: string }>; color: string }> = {
  CREDENTIALS_SUBMITTED: { Icon: Key, color: '#f87171' },
  LINK_CLICKED:          { Icon: MousePointerClick, color: '#fb923c' },
  CAMPAIGN_COMPLETE:     { Icon: CheckCircle, color: '#34d399' },
  CAMPAIGN_STARTED:      { Icon: Play, color: '#60a5fa' },
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface PhishingAlert {
  id: string;
  campaign_id: string;
  alert_type: string;
  priority: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  phishing_campaigns?: { name: string } | null;
}

type FilterTab = 'ALL' | 'UNREAD' | 'CRITICAL' | 'HIGH';

export const PhishingAlertsPage: React.FC = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<PhishingAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [selected, setSelected] = useState<PhishingAlert | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => { fetchAlerts(); }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('phishing_alerts')
      .select('*, phishing_campaigns(name)')
      .eq('company_id', user?.company_id)
      .order('created_at', { ascending: false })
      .limit(200);
    setAlerts(data || []);
    setLoading(false);
  };

  const markRead = async (id: string) => {
    await supabase.from('phishing_alerts').update({ is_read: true }).eq('id', id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    await supabase.from('phishing_alerts').update({ is_read: true })
      .eq('company_id', user?.company_id).eq('is_read', false);
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    setMarkingAll(false);
  };

  const filtered = alerts.filter(a => {
    if (activeTab === 'UNREAD') return !a.is_read;
    if (activeTab === 'CRITICAL') return a.priority === 'CRITICAL';
    if (activeTab === 'HIGH') return a.priority === 'HIGH' || a.priority === 'CRITICAL';
    return true;
  });

  const unreadCount = alerts.filter(a => !a.is_read).length;

  const card = (style?: React.CSSProperties): React.CSSProperties => ({
    background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, ...style,
  });

  const TABS: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'ALL', label: 'All', count: alerts.length },
    { key: 'UNREAD', label: 'Unread', count: unreadCount },
    { key: 'CRITICAL', label: 'Critical', count: alerts.filter(a => a.priority === 'CRITICAL').length },
    // The High tab lists HIGH and CRITICAL alerts (see filter above), so its
    // badge must count both — otherwise the count is lower than the rows shown.
    { key: 'HIGH', label: 'High', count: alerts.filter(a => a.priority === 'HIGH' || a.priority === 'CRITICAL').length },
  ];

  return (
    <div style={{ fontFamily: "'Inter',sans-serif" }}>
      <style>{STYLES}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Bell size={20} color={T.orange} />
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.white }}>Phishing Alerts</h2>
            {unreadCount > 0 && (
              <span style={{ padding: '2px 8px', background: T.red, color: T.white, borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                {unreadCount} new
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>Real-time alerts for click events, credential submissions, and campaign milestones.</p>
        </div>
        {unreadCount > 0 && (
          <button className="aw-al-btn" onClick={markAllRead} disabled={markingAll}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 13,
              background: 'rgba(255,255,255,.06)', color: T.textBody, border: `1px solid ${T.border}` }}>
            <Check size={13} /> {markingAll ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {TABS.map(tab => (
          <button key={tab.key} className="aw-al-tab" onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              color: activeTab === tab.key ? T.accent : T.textMuted,
              background: activeTab === tab.key ? 'rgba(200,255,0,0.10)' : 'none',
              border: activeTab === tab.key ? '1px solid rgba(200,255,0,0.25)' : '1px solid transparent',
            }}>
            {tab.label}
            {(tab.count ?? 0) > 0 && (
              <span style={{ marginLeft: 6, padding: '1px 6px', background: 'rgba(255,255,255,.08)', borderRadius: 10, fontSize: 11 }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div style={card()}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.textMuted }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center' }}>
            <Bell size={36} color={T.textMuted} style={{ display: 'block', margin: '0 auto 12px' }} />
            <p style={{ color: T.textMuted, fontSize: 14 }}>No alerts in this category.</p>
          </div>
        ) : (
          <div>
            {filtered.map((alert, i) => {
              const pCfg = PRIORITY_CFG[alert.priority] || PRIORITY_CFG.LOW;
              const tCfg = TYPE_CFG[alert.alert_type] || { Icon: AlertTriangle, color: T.orange };
              const IconComp = tCfg.Icon;
              return (
                <div key={alert.id} className={`aw-al-row${alert.is_read ? '' : ' unread'}`}
                  style={{ padding: '16px 20px', borderTop: i > 0 ? `1px solid ${T.borderFaint}` : 'none', display: 'flex', alignItems: 'flex-start', gap: 14 }}
                  onClick={() => { setSelected(alert); if (!alert.is_read) markRead(alert.id); }}>
                  {/* Icon */}
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${tCfg.color}18`, border: `1px solid ${tCfg.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconComp size={16} color={tCfg.color} />
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: alert.is_read ? 500 : 700, color: T.white }}>{alert.title}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: pCfg.color, background: pCfg.bg, border: `1px solid ${pCfg.border}`, letterSpacing: '0.5px' }}>
                        {pCfg.label}
                      </span>
                      {!alert.is_read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.accent, flexShrink: 0 }} />}
                    </div>
                    <p style={{ margin: '0 0 4px', fontSize: 13, color: T.textBody, lineHeight: 1.5 }}>{alert.message}</p>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: T.textMuted }}>
                      <span>{timeAgo(alert.created_at)}</span>
                      {alert.phishing_campaigns?.name && (
                        <span style={{ color: T.blue }}>Campaign: {alert.phishing_campaigns.name}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ ...card(), padding: 28, width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {(() => { const tCfg = TYPE_CFG[selected.alert_type] || { Icon: AlertTriangle, color: T.orange }; const I = tCfg.Icon; return <I size={16} color={tCfg.color} />; })()}
                  <span style={{ fontSize: 16, fontWeight: 700, color: T.white }}>{selected.title}</span>
                </div>
                {(() => { const p = PRIORITY_CFG[selected.priority] || PRIORITY_CFG.LOW; return (
                  <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: p.color, background: p.bg, border: `1px solid ${p.border}` }}>{p.label}</span>
                ); })()}
              </div>
              <button className="aw-al-btn" onClick={() => setSelected(null)}
                style={{ padding: 6, background: 'rgba(255,255,255,.06)', color: T.textMuted }}><X size={15} /></button>
            </div>
            <div style={{ fontSize: 14, color: T.textBody, lineHeight: 1.7, marginBottom: 16 }}>{selected.message}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selected.phishing_campaigns?.name && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 12, color: T.textMuted, width: 90 }}>Campaign</span>
                  <span style={{ fontSize: 12, color: T.blue }}>{selected.phishing_campaigns.name}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 12, color: T.textMuted, width: 90 }}>Type</span>
                <span style={{ fontSize: 12, color: T.textBody }}>{selected.alert_type.replace(/_/g, ' ')}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 12, color: T.textMuted, width: 90 }}>Time</span>
                <span style={{ fontSize: 12, color: T.textBody }}>{new Date(selected.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
