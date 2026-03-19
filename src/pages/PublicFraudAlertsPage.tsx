import React, { useEffect, useState } from 'react';
import { AlertTriangle, Shield, ChevronRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

/* ─────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────── */
const T = {
  bg:          '#12140a',
  bgCard:      '#1a1e0e',
  accent:      '#c8ff00',
  accentDark:  '#12140a',
  white:       '#ffffff',
  textBody:    '#94a3b8',
  textLabel:   '#cbd5e1',
  textMuted:   '#64748b',
  border:      'rgba(255,255,255,0.10)',
  borderFaint: 'rgba(255,255,255,0.05)',
  cardBg:      'rgba(255,255,255,0.03)',
} as const;

/* ── Severity config ── */
const SEVERITY = {
  HIGH:   { color: '#f87171', bg: 'rgba(248,113,113,0.08)',  border: 'rgba(248,113,113,0.30)', label: 'HIGH',   dot: '#ef4444' },
  MEDIUM: { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',   border: 'rgba(251,191,36,0.30)',  label: 'MEDIUM', dot: '#f59e0b' },
  LOW:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',   border: 'rgba(96,165,250,0.30)',  label: 'LOW',    dot: '#3b82f6' },
} as const;

type SeverityKey = keyof typeof SEVERITY;

/* ─────────────────────────────────────────
   GLOBAL CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .aw-alert-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    padding: 24px;
    transition: background 0.2s, border-color 0.2s, transform 0.2s;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .aw-alert-card:hover {
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.14);
    transform: translateY(-2px);
  }

  .aw-tip-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 14px;
    line-height: 22px;
    color: #94a3b8;
  }

  .aw-alerts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }
  @media (max-width: 768px) {
    .aw-alerts-grid { grid-template-columns: 1fr; }
  }

  @keyframes aw-spin { to { transform: rotate(360deg); } }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-fraud-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-fraud-styles';
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
  public_summary: string;
  safety_tips: string[];
  video_url?: string;
}

interface PublicFraudAlertsPageProps {
  onNavigate: (page: string) => void;
}

/* ─────────────────────────────────────────
   SHARED ATOMS
───────────────────────────────────────── */
const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: T.bg,
  fontFamily: "'Inter', sans-serif",
  padding: '48px 16px',
};

const SeverityBadge: React.FC<{ severity: SeverityKey }> = ({ severity }) => {
  const s = SEVERITY[severity] ?? SEVERITY.LOW;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 9999, flexShrink: 0,
      background: s.bg, border: `1px solid ${s.border}`,
      fontSize: 11, fontWeight: 700, color: s.color,
      letterSpacing: '0.6px', textTransform: 'uppercase',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
};

const BackBtn: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: T.textBody, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 28px', transition: 'color 0.2s', fontFamily: 'inherit' }}
    onMouseEnter={e => (e.currentTarget.style.color = T.white)}
    onMouseLeave={e => (e.currentTarget.style.color = T.textBody)}
  >
    <ArrowLeft size={16} /> {label}
  </button>
);

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const PublicFraudAlertsPage: React.FC<PublicFraudAlertsPageProps> = ({ onNavigate }) => {
  const [alerts, setAlerts]             = useState<FraudAlert[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('fraud_alerts')
        .select('id, title, fraud_type, severity, public_summary, safety_tips, video_url')
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      if (!error && data) setAlerts(data);
      setLoading(false);
    })();
  }, []);

  /* ══════════
     DETAIL VIEW
  ══════════ */
  if (selectedAlert) {
    const s = SEVERITY[selectedAlert.severity] ?? SEVERITY.LOW;
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <BackBtn label="Back to All Alerts" onClick={() => setSelectedAlert(null)} />

          {/* Card */}
          <div style={{
            background: T.bgCard,
            border: `1px solid ${s.border}`,
            borderRadius: 16,
            padding: '36px 40px',
            boxShadow: `0 0 40px ${s.bg}, 0 25px 60px rgba(0,0,0,0.40)`,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: T.white, lineHeight: '34px', letterSpacing: '-0.3px', flex: 1 }}>
                {selectedAlert.title}
              </h1>
              <SeverityBadge severity={selectedAlert.severity} />
            </div>

            {/* Channel tag */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, borderRadius: 9999, marginBottom: 24 }}>
              <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>Channel:</span>
              <span style={{ fontSize: 12, color: T.textLabel, fontWeight: 600 }}>{selectedAlert.fraud_type}</span>
            </div>

            {/* Summary */}
            <p style={{ fontSize: 15, color: T.textBody, lineHeight: '26px', marginBottom: 28 }}>
              {selectedAlert.public_summary}
            </p>

            {/* Video */}
            {selectedAlert.video_url && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, marginBottom: 12 }}>Awareness Video</h3>
                <div style={{ position: 'relative', paddingTop: '56.25%', background: 'rgba(0,0,0,0.40)', borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.border}` }}>
                  <iframe
                    src={selectedAlert.video_url}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {/* Safety tips */}
            {selectedAlert.safety_tips?.length > 0 && (
              <div style={{
                background: 'rgba(200,255,0,0.04)',
                border: `1px solid rgba(200,255,0,0.18)`,
                borderRadius: 12,
                padding: '20px 24px',
                marginBottom: 28,
              }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: T.white, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Shield size={18} style={{ color: T.accent }} />
                  Safety Tips
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selectedAlert.safety_tips.map((tip, i) => (
                    <li key={i} className="aw-tip-item">
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, marginTop: 8, flexShrink: 0, boxShadow: '0 0 6px rgba(200,255,0,0.50)' }} />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTA */}
            <div style={{ paddingTop: 20, borderTop: `1px solid ${T.borderFaint}` }}>
              <button
                onClick={() => onNavigate('login')}
                style={{
                  width: '100%', padding: '14px 24px', fontSize: 15, fontWeight: 700,
                  background: T.accent, color: T.accentDark, borderRadius: 10, border: 'none',
                  cursor: 'pointer', boxShadow: '0 0 20px rgba(200,255,0,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'opacity 0.2s, transform 0.15s', fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
              >
                Login to See Employee Guidelines
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════
     LIST VIEW
  ══════════ */
  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <BackBtn label="Back to Home" onClick={() => onNavigate('landing')} />

        {/* Page header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          {/* Icon */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(248,113,113,0.10)',
            border: '1px solid rgba(248,113,113,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 0 32px rgba(248,113,113,0.12)',
          }}>
            <AlertTriangle size={32} style={{ color: '#f87171' }} />
          </div>

          <h1 style={{ fontSize: 40, fontWeight: 900, color: T.white, letterSpacing: '-0.5px', margin: '0 0 12px' }}>
            Live Fraud Alerts
          </h1>
          <p style={{ fontSize: 16, color: T.textBody, lineHeight: '26px', maxWidth: 560, margin: '0 auto' }}>
            Stay informed about active scams and fraud schemes in Saudi Arabia. Learn how to protect yourself and your business.
          </p>

          {/* Stats bar */}
          {!loading && alerts.length > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 24, marginTop: 24, padding: '10px 24px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderFaint}`, borderRadius: 9999 }}>
              {(['HIGH', 'MEDIUM', 'LOW'] as SeverityKey[]).map(sev => {
                const count = alerts.filter(a => a.severity === sev).length;
                if (!count) return null;
                const s = SEVERITY[sev];
                return (
                  <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{count} {sev}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${T.borderFaint}`, borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
            <p style={{ fontSize: 14, color: T.textBody }}>Loading alerts…</p>
          </div>
        ) : alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Shield size={32} style={{ color: T.accent }} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: T.white, marginBottom: 8 }}>All Clear</h3>
            <p style={{ fontSize: 15, color: T.textBody }}>No active fraud alerts at this time.</p>
          </div>
        ) : (
          <div className="aw-alerts-grid">
            {alerts.map(alert => {
              const s = SEVERITY[alert.severity] ?? SEVERITY.LOW;
              return (
                <article
                  key={alert.id}
                  className="aw-alert-card"
                  onClick={() => setSelectedAlert(alert)}
                  style={{ borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: s.dot }}
                >
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, lineHeight: '24px', flex: 1 }}>
                      {alert.title}
                    </h3>
                    <SeverityBadge severity={alert.severity} />
                  </div>

                  {/* Channel */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, borderRadius: 9999, width: 'fit-content' }}>
                    <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>Channel:</span>
                    <span style={{ fontSize: 11, color: T.textLabel, fontWeight: 600 }}>{alert.fraud_type}</span>
                  </div>

                  {/* Summary */}
                  <p style={{ fontSize: 14, color: T.textBody, lineHeight: '22px' }}>
                    {alert.public_summary.length > 160
                      ? alert.public_summary.slice(0, 160) + '…'
                      : alert.public_summary}
                  </p>

                  {/* Tips preview */}
                  {alert.safety_tips?.length > 0 && (
                    <div style={{ background: 'rgba(200,255,0,0.03)', border: `1px solid rgba(200,255,0,0.10)`, borderRadius: 8, padding: '12px 14px' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 8 }}>
                        Safety Tips
                      </p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {alert.safety_tips.slice(0, 2).map((tip, i) => (
                          <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: T.textBody, lineHeight: '20px' }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent, marginTop: 7.5, flexShrink: 0 }} />
                            {tip}
                          </li>
                        ))}
                        {alert.safety_tips.length > 2 && (
                          <li style={{ fontSize: 12, color: T.textMuted, paddingLeft: 13 }}>+{alert.safety_tips.length - 2} more tips…</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* CTA */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: s.color, transition: 'gap 0.2s' }}>
                      View Full Alert <ChevronRight size={14} />
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Bottom CTA */}
        {!loading && alerts.length > 0 && (
          <div style={{ marginTop: 56, textAlign: 'center', padding: '36px 24px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 14 }}>
            <AlertCircle size={24} style={{ color: T.textMuted, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 15, color: T.textBody, marginBottom: 20 }}>
              Want full threat intelligence, employee guidelines, and incident reporting tools?
            </p>
            <button
              onClick={() => onNavigate('login')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: T.accent, color: T.accentDark, fontSize: 14, fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer', boxShadow: '0 0 20px rgba(200,255,0,0.20)', transition: 'opacity 0.2s, transform 0.15s', fontFamily: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
            >
              Login to Dashboard <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
