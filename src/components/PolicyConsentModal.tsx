import React, { useState } from 'react';
import {
  Shield, FileText, CheckSquare, Square,
  ChevronDown, BookOpen,
} from 'lucide-react';

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
  indigo:      '#818cf8',
  gold:        '#fbbf24',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  @keyframes aw-modal-fade  { from { opacity:0 } to { opacity:1 } }
  @keyframes aw-modal-slide { from { opacity:0; transform:translateY(20px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
  @keyframes aw-drawer-in   { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }

  .aw-consent-overlay {
    position:fixed; inset:0; z-index:9999;
    background:rgba(10,12,6,0.85);
    backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);
    display:flex; align-items:center; justify-content:center;
    padding:24px;
    animation:aw-modal-fade 0.25s ease both;
  }

  .aw-consent-card {
    background:#1a1e0e;
    border:1px solid rgba(255,255,255,0.10);
    border-radius:18px;
    width:100%; max-width:520px;
    max-height:90vh;
    display:flex; flex-direction:column;
    box-shadow:0 32px 80px rgba(0,0,0,0.60), 0 0 0 1px rgba(200,255,0,0.06);
    animation:aw-modal-slide 0.30s ease both;
    overflow:hidden;
  }

  /* ── Checkbox row ── */
  .aw-check-row {
    display:flex; align-items:flex-start; gap:14px;
    border-radius:10px;
    border:1px solid rgba(255,255,255,0.06);
    background:rgba(255,255,255,0.02);
    overflow:hidden;
    transition:border-color 0.18s;
  }
  .aw-check-row.checked { border-color:rgba(200,255,0,0.22); }

  /* top part of the row (clickable checkbox area) */
  .aw-check-top {
    display:flex; align-items:flex-start; gap:14px;
    padding:16px 18px;
    cursor:pointer;
    transition:background 0.18s;
    user-select:none; width:100%;
  }
  .aw-check-top:hover { background:rgba(255,255,255,0.03); }
  .aw-check-row.checked .aw-check-top { background:rgba(200,255,0,0.04); }

  /* ── Read policy button ── */
  .aw-read-btn {
    display:inline-flex; align-items:center; gap:5px;
    padding:5px 10px; border-radius:6px;
    font-size:11px; font-weight:700;
    font-family:'Inter',sans-serif;
    border:none; cursor:pointer;
    transition:all 0.18s;
    background:rgba(255,255,255,0.05);
    color:#94a3b8;
  }
  .aw-read-btn:hover { background:rgba(255,255,255,0.09); color:#ffffff; }
  .aw-read-btn.open  { background:rgba(200,255,0,0.08); color:#c8ff00; }

  .aw-read-chevron { transition:transform 0.25s ease; }
  .aw-read-btn.open .aw-read-chevron { transform:rotate(180deg); }

  /* ── Inline policy drawer ── */
  .aw-policy-drawer {
    border-top:1px solid rgba(255,255,255,0.05);
    background:rgba(0,0,0,0.20);
    overflow:hidden;
    max-height:0;
    transition:max-height 0.4s ease;
  }
  .aw-policy-drawer.open { max-height:340px; }

  .aw-policy-drawer-inner {
    padding:16px 18px;
    max-height:340px;
    overflow-y:auto;
    animation:aw-drawer-in 0.25s ease both;
  }
  .aw-policy-drawer-inner::-webkit-scrollbar { width:3px; }
  .aw-policy-drawer-inner::-webkit-scrollbar-track { background:transparent; }
  .aw-policy-drawer-inner::-webkit-scrollbar-thumb { background:rgba(200,255,0,0.20); border-radius:9999px; }

  /* prose inside drawer */
  .aw-dprose h3     { font-size:12px; font-weight:700; color:#c8ff00; margin:14px 0 5px; font-family:'Inter',sans-serif; }
  .aw-dprose h3:first-child { margin-top:0; }
  .aw-dprose p      { font-size:13px; color:#94a3b8; line-height:22px; margin-bottom:8px; font-family:'Inter',sans-serif; }
  .aw-dprose ul     { list-style:none; padding:0; margin-bottom:10px; display:flex; flex-direction:column; gap:5px; }
  .aw-dprose li     { font-size:13px; color:#94a3b8; line-height:20px; display:flex; gap:9px; align-items:flex-start; font-family:'Inter',sans-serif; }
  .aw-dprose li::before { content:''; display:block; width:4px; height:4px; border-radius:50%; background:rgba(200,255,0,0.40); flex-shrink:0; margin-top:8px; }
  .aw-dprose strong { color:#ffffff; font-weight:700; }

  .aw-dsec { margin-bottom:12px; }
  .aw-dsec-title { font-size:12px; font-weight:800; color:#ffffff; margin-bottom:7px; font-family:'Inter',sans-serif; display:flex; align-items:center; gap:6px; }
  .aw-dsec-num   { display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:4px; background:rgba(200,255,0,0.09); border:1px solid rgba(200,255,0,0.18); font-size:9px; font-weight:800; color:#c8ff00; flex-shrink:0; }

  /* ── Accept button ── */
  .aw-accept-btn {
    width:100%; padding:14px;
    background:#c8ff00; color:#12140a;
    font-size:15px; font-weight:700;
    border:none; border-radius:10px; cursor:pointer;
    font-family:'Inter',sans-serif;
    box-shadow:0 0 24px rgba(200,255,0,0.25);
    transition:opacity 0.2s, transform 0.15s;
  }
  .aw-accept-btn:disabled {
    background:rgba(255,255,255,0.08);
    color:rgba(255,255,255,0.25);
    cursor:not-allowed; box-shadow:none;
  }
  .aw-accept-btn:not(:disabled):hover { opacity:0.88; transform:translateY(-1px); }

  /* scrollable body area */
  .aw-consent-body {
    overflow-y:auto; flex:1;
    padding:0 28px;
  }
  .aw-consent-body::-webkit-scrollbar { width:3px; }
  .aw-consent-body::-webkit-scrollbar-track { background:transparent; }
  .aw-consent-body::-webkit-scrollbar-thumb { background:rgba(200,255,0,0.15); border-radius:9999px; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-consent-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-consent-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   INLINE POLICY CONTENT
   (مستخرج من LegalPage — يمكن استيراده
    من ملف مشترك لاحقاً)
───────────────────────────────────────── */
const PrivacyContent: React.FC = () => (
  <div className="aw-dprose">
    <div className="aw-dsec">
      <div className="aw-dsec-title"><span className="aw-dsec-num">1</span>About AwareOne</div>
      <p>AwareOne is a cybersecurity awareness SaaS platform helping organizations improve security through training, phishing simulations, assessments, and analytics.</p>
    </div>
    <div className="aw-dsec">
      <div className="aw-dsec-title"><span className="aw-dsec-num">2</span>Information We Collect</div>
      <h3>Account Information</h3>
      <ul><li>Name and email address</li><li>Organization name</li><li>Job title or department</li><li>Login credentials</li></ul>
      <h3>Usage Data</h3>
      <ul><li>IP address and browser type</li><li>Device information</li><li>Login timestamps</li><li>Platform usage activity</li></ul>
      <h3>Training & Awareness Data</h3>
      <ul><li>Training participation records</li><li>Phishing simulation results</li><li>Assessment scores</li><li>Awareness performance metrics</li></ul>
    </div>
    <div className="aw-dsec">
      <div className="aw-dsec-title"><span className="aw-dsec-num">3</span>How We Use Information</div>
      <ul><li>Providing and operating the platform</li><li>Managing user authentication</li><li>Delivering cybersecurity awareness training</li><li>Generating analytics and reports</li><li>Maintaining platform security</li></ul>
    </div>
    <div className="aw-dsec">
      <div className="aw-dsec-title"><span className="aw-dsec-num">4</span>Data Security</div>
      <ul><li>Encrypted connections (HTTPS / TLS)</li><li>Access control mechanisms</li><li>Activity logging and monitoring</li><li>Infrastructure security protections</li></ul>
    </div>
    <div className="aw-dsec">
      <div className="aw-dsec-title"><span className="aw-dsec-num">5</span>Data Sharing</div>
      <p>AwareOne does <strong>not sell or rent personal data</strong>. Information is shared only with trusted service providers, when required by law, or to protect rights and safety.</p>
    </div>
    <div className="aw-dsec">
      <div className="aw-dsec-title"><span className="aw-dsec-num">6</span>User Rights</div>
      <ul><li>Request access to personal data</li><li>Request correction of inaccurate data</li><li>Request deletion where applicable</li><li>Object to certain types of processing</li></ul>
    </div>
    <div className="aw-dsec">
      <div className="aw-dsec-title"><span className="aw-dsec-num">7</span>Contact</div>
      <p>Questions? <strong>support@awareone.net</strong></p>
    </div>
  </div>
);

const AUPContent: React.FC = () => (
  <div className="aw-dprose">
    <div className="aw-dsec">
      <div className="aw-dsec-title"><span className="aw-dsec-num">1</span>Authorized Use</div>
      <ul>
        <li>Training employees on cybersecurity awareness</li>
        <li>Conducting controlled phishing simulations within the organization</li>
        <li>Measuring employee security awareness levels</li>
        <li>Improving internal cybersecurity practices</li>
      </ul>
    </div>
    <div className="aw-dsec">
      <div className="aw-dsec-title"><span className="aw-dsec-num">2</span>Phishing Simulation Rules</div>
      <p>Simulations must be conducted <strong>only within the user's organization</strong>, used solely for awareness training, and must not cause harm, panic, or disruption.</p>
    </div>
    <div className="aw-dsec">
      <div className="aw-dsec-title"><span className="aw-dsec-num">3</span>Prohibited Activities</div>
      <ul>
        <li>Real phishing attacks or cybercrime</li>
        <li>Distributing malware, ransomware, or harmful software</li>
        <li>Targeting individuals outside authorized testing</li>
        <li>Unauthorized access to systems or networks</li>
        <li>Reverse engineering or copying the platform</li>
      </ul>
    </div>
    <div className="aw-dsec">
      <div className="aw-dsec-title"><span className="aw-dsec-num">4</span>Organization Responsibilities</div>
      <ul>
        <li>Managing user access within accounts</li>
        <li>Ensuring employees are informed of awareness initiatives</li>
        <li>Ensuring compliance with applicable laws and internal policies</li>
      </ul>
    </div>
    <div className="aw-dsec">
      <div className="aw-dsec-title"><span className="aw-dsec-num">5</span>Consequences of Violations</div>
      <ul>
        <li>Immediate suspension of services</li>
        <li>Permanent termination of accounts</li>
        <li>Legal action where applicable</li>
      </ul>
    </div>
    <div className="aw-dsec">
      <div className="aw-dsec-title"><span className="aw-dsec-num">6</span>Contact</div>
      <p>Questions? <strong>support@awareone.net</strong></p>
    </div>
  </div>
);

/* ─────────────────────────────────────────
   PROPS
───────────────────────────────────────── */
interface PolicyConsentModalProps {
  onAccept:    () => void;
  onNavigate?: (page: string) => void;
}

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const PolicyConsentModal: React.FC<PolicyConsentModalProps> = ({ onAccept, onNavigate }) => {
  const [checkedPrivacy, setCheckedPrivacy] = useState(false);
  const [checkedUse,     setCheckedUse]     = useState(false);
  const [openDrawer, setOpenDrawer]         = useState<'privacy' | 'aup' | null>(null);

  const allChecked = checkedPrivacy && checkedUse;

  const toggleDrawer = (key: 'privacy' | 'aup') =>
    setOpenDrawer(prev => prev === key ? null : key);

  return (
    <div className="aw-consent-overlay">
      <div className="aw-consent-card">

        {/* ── Accent bar ── */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, rgba(200,255,0,0.80), rgba(200,255,0,0.20))', flexShrink: 0 }} />

        {/* ── Header ── */}
        <div style={{ padding: '24px 28px 0', display: 'flex', alignItems: 'flex-start', gap: 14, flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, flexShrink: 0, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        <div style={{ margin: '18px 28px 0', height: 1, background: T.borderFaint, flexShrink: 0 }} />

        {/* ── Scrollable body ── */}
        <div className="aw-consent-body" style={{ padding: '16px 28px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* ── Privacy Policy row ── */}
            <div className={`aw-check-row ${checkedPrivacy ? 'checked' : ''}`}>
              {/* Checkbox area */}
              <div className="aw-check-top" onClick={() => setCheckedPrivacy(v => !v)}>
                <div style={{ marginTop: 1, flexShrink: 0 }}>
                  {checkedPrivacy
                    ? <CheckSquare size={20} style={{ color: T.accent }} />
                    : <Square      size={20} style={{ color: T.textMuted }} />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <FileText size={14} style={{ color: T.indigo, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.white, fontFamily: 'Inter, sans-serif' }}>
                        Privacy Policy
                      </span>
                    </div>
                    {/* Read button — stops propagation so it doesn't toggle checkbox */}
                    <button
                      className={`aw-read-btn ${openDrawer === 'privacy' ? 'open' : ''}`}
                      onClick={e => { e.stopPropagation(); toggleDrawer('privacy'); }}
                    >
                      <BookOpen size={11} />
                      {openDrawer === 'privacy' ? 'Close' : 'Read'}
                      <ChevronDown size={11} className="aw-read-chevron" />
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: T.textBody, lineHeight: '18px', margin: 0, fontFamily: 'Inter, sans-serif' }}>
                    I have read and agree to the collection and processing of my personal data as described in the Privacy Policy.
                  </p>
                </div>
              </div>

              {/* Inline drawer */}
              <div className={`aw-policy-drawer ${openDrawer === 'privacy' ? 'open' : ''}`} style={{ width: '100%' }}>
                <div className="aw-policy-drawer-inner">
                  {/* Drawer header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <FileText size={13} style={{ color: T.indigo }} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: T.white, fontFamily: 'Inter, sans-serif' }}>Privacy Policy</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10, color: T.textMuted, fontFamily: 'Inter, sans-serif' }}>Last updated: 2026</span>
                      {/* Accept after reading shortcut */}
                      {!checkedPrivacy && (
                        <button
                          onClick={() => { setCheckedPrivacy(true); setOpenDrawer(null); }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(200,255,0,0.10)', border: '1px solid rgba(200,255,0,0.25)', color: T.accent, cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'background 0.15s' }}
                        >
                          <CheckSquare size={11} /> I've read this
                        </button>
                      )}
                      {checkedPrivacy && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(200,255,0,0.06)', border: '1px solid rgba(200,255,0,0.18)', color: T.accent, fontFamily: 'Inter, sans-serif' }}>
                          <CheckSquare size={11} /> Accepted
                        </span>
                      )}
                    </div>
                  </div>
                  <PrivacyContent />
                </div>
              </div>
            </div>

            {/* ── Acceptable Use Policy row ── */}
            <div className={`aw-check-row ${checkedUse ? 'checked' : ''}`}>
              {/* Checkbox area */}
              <div className="aw-check-top" onClick={() => setCheckedUse(v => !v)}>
                <div style={{ marginTop: 1, flexShrink: 0 }}>
                  {checkedUse
                    ? <CheckSquare size={20} style={{ color: T.accent }} />
                    : <Square      size={20} style={{ color: T.textMuted }} />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Shield size={14} style={{ color: T.gold, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.white, fontFamily: 'Inter, sans-serif' }}>
                        Acceptable Use Policy
                      </span>
                    </div>
                    <button
                      className={`aw-read-btn ${openDrawer === 'aup' ? 'open' : ''}`}
                      onClick={e => { e.stopPropagation(); toggleDrawer('aup'); }}
                    >
                      <BookOpen size={11} />
                      {openDrawer === 'aup' ? 'Close' : 'Read'}
                      <ChevronDown size={11} className="aw-read-chevron" />
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: T.textBody, lineHeight: '18px', margin: 0, fontFamily: 'Inter, sans-serif' }}>
                    I agree to use the platform responsibly and in accordance with the Acceptable Use Policy.
                  </p>
                </div>
              </div>

              {/* Inline drawer */}
              <div className={`aw-policy-drawer ${openDrawer === 'aup' ? 'open' : ''}`} style={{ width: '100%' }}>
                <div className="aw-policy-drawer-inner">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Shield size={13} style={{ color: T.gold }} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: T.white, fontFamily: 'Inter, sans-serif' }}>Acceptable Use Policy</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10, color: T.textMuted, fontFamily: 'Inter, sans-serif' }}>Last updated: 2026</span>
                      {!checkedUse && (
                        <button
                          onClick={() => { setCheckedUse(true); setOpenDrawer(null); }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(200,255,0,0.10)', border: '1px solid rgba(200,255,0,0.25)', color: T.accent, cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'background 0.15s' }}
                        >
                          <CheckSquare size={11} /> I've read this
                        </button>
                      )}
                      {checkedUse && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(200,255,0,0.06)', border: '1px solid rgba(200,255,0,0.18)', color: T.accent, fontFamily: 'Inter, sans-serif' }}>
                          <CheckSquare size={11} /> Accepted
                        </span>
                      )}
                    </div>
                  </div>
                  <AUPContent />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '16px 28px 24px', flexShrink: 0, borderTop: `1px solid ${T.borderFaint}` }}>
          {!allChecked && (
            <p style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', marginBottom: 12, fontFamily: 'Inter, sans-serif' }}>
              Please check both boxes to continue
            </p>
          )}
          <button className="aw-accept-btn" disabled={!allChecked} onClick={onAccept}>
            I Accept & Continue
          </button>
          <p style={{ fontSize: 11, color: T.textMuted, textAlign: 'center', marginTop: 10, lineHeight: '17px', fontFamily: 'Inter, sans-serif' }}>
            By continuing, you confirm that you understand and agree to these policies.
            {onNavigate && (
              <> You can also view the full{' '}
                <button onClick={() => onNavigate('legal')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, fontSize: 11, fontFamily: 'Inter, sans-serif', padding: 0, opacity: 0.8 }}>
                  Legal Page
                </button>.
              </>
            )}
          </p>
        </div>

      </div>
    </div>
  );
};
