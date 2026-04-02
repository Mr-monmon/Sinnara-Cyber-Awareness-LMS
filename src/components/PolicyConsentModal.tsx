import React, { useState } from 'react';
import { Shield, FileText, CheckSquare, Square, ExternalLink } from 'lucide-react';

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bg:          '#12140a',
  bgCard:      '#1a1e0e',
  accent:      '#c8ff00',
  accentDark:  '#12140a',
  white:       '#ffffff',
  textBody:    '#94a3b8',
  textMuted:   '#64748b',
  textLabel:   '#cbd5e1',
  border:      'rgba(255,255,255,0.10)',
  borderFaint: 'rgba(255,255,255,0.05)',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  @keyframes aw-modal-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes aw-modal-slide {
    from { opacity: 0; transform: translateY(20px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .aw-consent-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(10, 12, 6, 0.85);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    animation: aw-modal-fade 0.25s ease both;
  }

  .aw-consent-card {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 18px;
    width: 100%;
    max-width: 500px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.60), 0 0 0 1px rgba(200,255,0,0.06);
    animation: aw-modal-slide 0.30s ease both;
    overflow: hidden;
  }

  /* ── Checkbox row ── */
  .aw-check-row {
    display: flex; align-items: flex-start; gap: 14px;
    padding: 16px 18px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
    cursor: pointer;
    transition: background 0.18s, border-color 0.18s;
    user-select: none;
  }
  .aw-check-row:hover { background: rgba(255,255,255,0.04); }
  .aw-check-row.checked {
    background: rgba(200,255,0,0.05);
    border-color: rgba(200,255,0,0.22);
  }

  /* ── Accept button ── */
  .aw-accept-btn {
    width: 100%; padding: 14px;
    background: #c8ff00; color: #12140a;
    font-size: 15px; font-weight: 700;
    border: none; border-radius: 10px; cursor: pointer;
    font-family: 'Inter', sans-serif;
    box-shadow: 0 0 24px rgba(200,255,0,0.25);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-accept-btn:disabled {
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.25);
    cursor: not-allowed;
    box-shadow: none;
  }
  .aw-accept-btn:not(:disabled):hover {
    opacity: 0.88;
    transform: translateY(-1px);
  }

  /* ── Policy link ── */
  .aw-policy-link {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 12px; font-weight: 600; color: #c8ff00;
    background: none; border: none; cursor: pointer;
    padding: 0; font-family: 'Inter', sans-serif;
    text-decoration: none; opacity: 0.75;
    transition: opacity 0.18s;
  }
  .aw-policy-link:hover { opacity: 1; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-consent-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-consent-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   PROPS
───────────────────────────────────────── */
interface PolicyConsentModalProps {
  onAccept:    () => void;   // called when user accepts — mark in DB + close
  onNavigate?: (page: string) => void; // optional: open legal page
}

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const PolicyConsentModal: React.FC<PolicyConsentModalProps> = ({ onAccept, onNavigate }) => {
  const [checkedPrivacy, setCheckedPrivacy] = useState(false);
  const [checkedUse,     setCheckedUse]     = useState(false);

  const allChecked = checkedPrivacy && checkedUse;

  return (
    <div className="aw-consent-overlay">
      <div className="aw-consent-card">

        {/* ── Top accent bar ── */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, rgba(200,255,0,0.80), rgba(200,255,0,0.20))', borderRadius: '18px 18px 0 0' }} />

        {/* ── Header ── */}
        <div style={{ padding: '28px 28px 0', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 11, flexShrink: 0,
            background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={22} style={{ color: T.accent }} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: T.white, letterSpacing: '-0.2px', marginBottom: 4, fontFamily: 'Inter, sans-serif' }}>
              Before You Get Started
            </h2>
            <p style={{ fontSize: 13, color: T.textBody, lineHeight: '20px', fontFamily: 'Inter, sans-serif' }}>
              Please review and accept our policies to continue using the platform.
            </p>
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ margin: '20px 28px', height: 1, background: T.borderFaint }} />

        {/* ── Checkboxes ── */}
        <div style={{ padding: '0 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Privacy Policy */}
          <div
            className={`aw-check-row ${checkedPrivacy ? 'checked' : ''}`}
            onClick={() => setCheckedPrivacy(v => !v)}
          >
            <div style={{ marginTop: 1, flexShrink: 0 }}>
              {checkedPrivacy
                ? <CheckSquare size={20} style={{ color: T.accent }} />
                : <Square      size={20} style={{ color: T.textMuted }} />
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <FileText size={14} style={{ color: '#818cf8', flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: T.white, fontFamily: 'Inter, sans-serif' }}>
                  Privacy Policy
                </span>
              </div>
              <p style={{ fontSize: 12, color: T.textBody, lineHeight: '18px', margin: '0 0 6px', fontFamily: 'Inter, sans-serif' }}>
                I have read and agree to the collection and processing of my personal data as described in the Privacy Policy.
              </p>
              {onNavigate && (
                <button className="aw-policy-link" onClick={e => { e.stopPropagation(); onNavigate('legal'); }}>
                  Read Privacy Policy <ExternalLink size={10} />
                </button>
              )}
            </div>
          </div>

          {/* Acceptable Use Policy */}
          <div
            className={`aw-check-row ${checkedUse ? 'checked' : ''}`}
            onClick={() => setCheckedUse(v => !v)}
          >
            <div style={{ marginTop: 1, flexShrink: 0 }}>
              {checkedUse
                ? <CheckSquare size={20} style={{ color: T.accent }} />
                : <Square      size={20} style={{ color: T.textMuted }} />
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Shield size={14} style={{ color: '#fbbf24', flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: T.white, fontFamily: 'Inter, sans-serif' }}>
                  Acceptable Use Policy
                </span>
              </div>
              <p style={{ fontSize: 12, color: T.textBody, lineHeight: '18px', margin: '0 0 6px', fontFamily: 'Inter, sans-serif' }}>
                I agree to use the platform responsibly and in accordance with the Acceptable Use Policy.
              </p>
              {onNavigate && (
                <button className="aw-policy-link" onClick={e => { e.stopPropagation(); onNavigate('legal'); }}>
                  Read Acceptable Use Policy <ExternalLink size={10} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '20px 28px 28px' }}>
          {/* Helper text */}
          {!allChecked && (
            <p style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', marginBottom: 14, fontFamily: 'Inter, sans-serif' }}>
              Please check both boxes to continue
            </p>
          )}

          {/* Accept button */}
          <button
            className="aw-accept-btn"
            disabled={!allChecked}
            onClick={onAccept}
          >
            I Accept & Continue
          </button>

          <p style={{ fontSize: 11, color: T.textMuted, textAlign: 'center', marginTop: 12, lineHeight: '17px', fontFamily: 'Inter, sans-serif' }}>
            By continuing, you confirm that you understand and agree to these policies. This consent is recorded for compliance purposes.
          </p>
        </div>

      </div>
    </div>
  );
};