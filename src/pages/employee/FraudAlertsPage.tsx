import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Shield, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bg:          '#0f200a',
  bgCard:      '#1a1e0e',
  accent:      '#c8ff00',
  accentDark:  '#12140a',
  white:       '#ffffff',
  textBody:    '#94a3b8',
  textLabel:   '#cbd5e1',
  textMuted:   '#64748b',
  border:      'rgba(255,255,255,0.08)',
  borderFaint: 'rgba(255,255,255,0.05)',
} as const;

const SEV = {
  HIGH:   { color: '#f87171', bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.25)', dot: '#ef4444', label: 'HIGH'   },
  MEDIUM: { color: '#fbbf24', bg: 'rgba(251,191,36,0.07)',  border: 'rgba(251,191,36,0.25)',  dot: '#f59e0b', label: 'MEDIUM' },
  LOW:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.07)',  border: 'rgba(96,165,250,0.25)',  dot: '#3b82f6', label: 'LOW'    },
} as const;

type SeverityKey = keyof typeof SEV;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-fa-card {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    overflow: hidden;
    transition: border-color 0.2s;
    font-family: 'Inter', sans-serif;
  }
  .aw-fa-card:hover { border-color: rgba(255,255,255,0.11); }

  .aw-fa-step {
    display: flex; gap: 12px; align-items: flex-start;
    font-size: 14px; color: #94a3b8; line-height: 22px;
  }
  .aw-fa-step-num {
    width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800;
    background: rgba(200,255,0,0.10); border: 1px solid rgba(200,255,0,0.20);
    color: #c8ff00; margin-top: 1px;
  }

  .aw-ack-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 22px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 16px rgba(200,255,0,0.20);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-ack-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .aw-ack-btn:disabled { opacity: 0.55; cursor: not-allowed; }

  .aw-sev-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 9999px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.6px;
    text-transform: uppercase; border: 1px solid;
  }

  .aw-channel-tag {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 9999px;
    font-size: 11px; font-weight: 500;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.12);
    color: #64748b;
  }

  @keyframes aw-spin { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-fa-dash-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-fa-dash-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface FraudAlert {
  id: string;
  title: string;
  fraud_type: string;
  severity: SeverityKey;
  internal_content: string;
  video_url?: string;
  internal_steps: string[];
  is_published: boolean;
  acknowledged?: boolean;
}

/* ─────────────────────────────────────────
   SEVERITY BADGE
───────────────────────────────────────── */
const SevBadge: React.FC<{ sev: SeverityKey }> = ({ sev }) => {
  const s = SEV[sev] ?? SEV.LOW;
  return (
    <span className="aw-sev-badge" style={{ color: s.color, borderColor: s.border, background: s.bg }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {s.label}
    </span>
  );
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const FraudAlertsPage: React.FC = () => {
  const { user }        = useAuth();
  const { t, i18n }     = useTranslation(['common', 'employee']);
  const [alerts, setAlerts]           = useState<FraudAlert[]>([]);
  const [loading, setLoading]         = useState(true);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  useEffect(() => { if (user) fetchAlerts(); }, [user]);

  const fetchAlerts = async () => {
    const { data: alertData, error } = await supabase
      .from('fraud_alerts')
      .select('id, title, fraud_type, severity, internal_content, video_url, internal_steps, is_published')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (!error && alertData && user) {
      const { data: ackData } = await supabase
        .from('fraud_alert_acknowledgments')
        .select('alert_id')
        .eq('user_id', user.id);

      const ackSet = new Set(ackData?.map(a => a.alert_id) || []);
      setAlerts(alertData.map(a => ({ ...a, acknowledged: ackSet.has(a.id) })));
    }
    setLoading(false);
  };

  const handleAcknowledge = async (alertId: string) => {
    if (!user) return;
    setAcknowledging(alertId);
    try {
      await supabase.from('fraud_alert_acknowledgments').insert({ alert_id: alertId, user_id: user.id });
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a));
    } finally {
      setAcknowledging(null);
    }
  };

  const toggleSteps = (id: string) => setExpandedSteps(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  /* ── Stats ── */
  const total   = alerts.length;
  const acked   = alerts.filter(a => a.acknowledged).length;
  const highCnt = alerts.filter(a => a.severity === 'HIGH').length;

  /* ── Loading ── */
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 14, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
      <p style={{ fontSize: 14, color: T.textBody }}>Loading alerts…</p>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={18} style={{ color: '#f87171' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>
              {t('fraudAlerts.title', { ns: 'employee' })}
            </h1>
          </div>
        </div>
        <p style={{ fontSize: 14, color: T.textBody, margin: '0 0 24px' }}>
          {t('fraudAlerts.subtitle', { ns: 'employee' })}
        </p>

        {/* Stats row */}
        {total > 0 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Alerts',     value: total,              color: T.textLabel },
              { label: 'Acknowledged',     value: `${acked} / ${total}`, color: T.accent   },
              { label: 'High Severity',    value: highCnt,            color: '#f87171'   },
            ].map(stat => (
              <div key={stat.label} style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderFaint}`, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.value}</span>
                <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>{stat.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {alerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Shield size={26} style={{ color: T.accent }} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, marginBottom: 6 }}>All Clear</h3>
          <p style={{ fontSize: 14, color: T.textBody }}>
            {t('fraudAlerts.empty', { ns: 'employee' })}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {alerts.map((alert, idx) => {
            const s            = SEV[alert.severity] ?? SEV.LOW;
            const isAcked      = alert.acknowledged;
            const stepsOpen    = expandedSteps.has(alert.id);
            const isAcknowledging = acknowledging === alert.id;

            return (
              <div
                key={alert.id}
                className={`aw-fa-card aw-fade-up`}
                style={{ animationDelay: `${idx * 0.05}s`, borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: s.dot, opacity: isAcked ? 0.75 : 1 }}
              >
                {/* ── Card header ── */}
                <div style={{ padding: '20px 22px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                      <AlertTriangle size={16} style={{ color: s.color, flexShrink: 0 }} />
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, margin: 0 }}>{alert.title}</h3>
                      {isAcked && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.22)', borderRadius: 9999, fontSize: 10, fontWeight: 700, color: T.accent, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                          <CheckCircle size={11} /> Acknowledged
                        </span>
                      )}
                    </div>
                    {/* Meta */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <SevBadge sev={alert.severity} />
                      <span className="aw-channel-tag">
                        {t('labels.channel', { ns: 'common' })}: <strong style={{ color: T.textLabel }}>{alert.fraud_type}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Content ── */}
                <div style={{ padding: '0 22px 18px' }}>
                  <p style={{ fontSize: 14, color: T.textBody, lineHeight: '24px', marginBottom: 0 }}>
                    {alert.internal_content}
                  </p>
                </div>

                {/* ── Video ── */}
                {alert.video_url && (
                  <div style={{ margin: '0 22px 18px', background: 'rgba(0,0,0,0.30)', border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.borderFaint}` }}>
                      <Play size={14} style={{ color: T.accent }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.textLabel }}>
                        {t('fraudAlerts.awarenessVideo', { ns: 'employee' })}
                      </span>
                    </div>
                    <div style={{ position: 'relative', paddingTop: '56.25%' }}>
                      {alert.video_url.includes('youtube') || alert.video_url.includes('youtu.be') ? (
                        <iframe
                          src={alert.video_url} title={alert.title}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                          allowFullScreen
                        />
                      ) : (
                        <video controls style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                          <source src={alert.video_url} type="video/mp4" />
                        </video>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Action Steps (collapsible) ── */}
                {alert.internal_steps?.length > 0 && (
                  <div style={{ margin: '0 22px 18px' }}>
                    <button
                      onClick={() => toggleSteps(alert.id)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(200,255,0,0.04)', border: '1px solid rgba(200,255,0,0.14)', borderRadius: stepsOpen ? '10px 10px 0 0' : 10, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.18s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,255,0,0.07)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(200,255,0,0.04)')}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: T.accent }}>
                        <Shield size={14} />
                        {t('fraudAlerts.actionSteps', { ns: 'employee' })}
                        <span style={{ padding: '1px 8px', background: 'rgba(200,255,0,0.12)', borderRadius: 9999, fontSize: 11 }}>
                          {alert.internal_steps.length}
                        </span>
                      </span>
                      {stepsOpen
                        ? <ChevronUp size={15} style={{ color: T.accent }} />
                        : <ChevronDown size={15} style={{ color: T.textMuted }} />
                      }
                    </button>

                    {stepsOpen && (
                      <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(200,255,0,0.12)', borderTop: 'none', borderRadius: '0 0 10px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {alert.internal_steps.map((step, i) => (
                          <div key={i} className="aw-fa-step">
                            <span className="aw-fa-step-num">{i + 1}</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Footer: acknowledge ── */}
                <div style={{ padding: '14px 22px 18px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {isAcked ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: T.textMuted }}>
                      <CheckCircle size={15} style={{ color: T.accent }} />
                      You acknowledged this alert
                    </span>
                  ) : (
                    <button
                      className="aw-ack-btn"
                      disabled={!!isAcknowledging}
                      onClick={() => handleAcknowledge(alert.id)}
                    >
                      {isAcknowledging ? (
                        <>
                          <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(18,20,10,0.30)', borderTopColor: T.accentDark, animation: 'aw-spin 0.7s linear infinite' }} />
                          {t('fraudAlerts.acknowledging', { ns: 'employee' })}
                        </>
                      ) : (
                        <>
                          <CheckCircle size={14} />
                          {t('fraudAlerts.understandAlert', { ns: 'employee' })}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
