import React, { useState, useEffect } from 'react';
import { Sliders, Edit2, Check, X, RotateCcw, ShieldOff, Shield, RefreshCw } from 'lucide-react';
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
  .aw-cl-input { width:100%; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09);
    border-radius:9px; font-size:14px; color:#fff; font-family:'Inter',sans-serif; outline:none;
    padding:9px 12px; transition: border-color .2s, box-shadow .2s; }
  .aw-cl-input:focus { border-color:rgba(200,255,0,.45); box-shadow:0 0 0 3px rgba(200,255,0,.07); background:rgba(255,255,255,.06); }
  .aw-cl-btn { border:none; border-radius:8px; cursor:pointer; font-family:'Inter',sans-serif; font-weight:600; transition:all .15s; }
  .aw-cl-row:hover { background:rgba(255,255,255,.025); }
  .aw-cl-toggle { width:36px; height:20px; border-radius:10px; border:none; cursor:pointer; transition:background .2s; position:relative; }
  .aw-cl-toggle::after { content:''; position:absolute; top:3px; width:14px; height:14px; border-radius:50%; background:#fff; transition:left .2s; }
  .aw-cl-toggle.on { background:#c8ff00; }
  .aw-cl-toggle.on::after { left:19px; }
  .aw-cl-toggle.off { background:rgba(255,255,255,.15); }
  .aw-cl-toggle.off::after { left:3px; }
`;

type PhishingMode = 'TICKET' | 'CUSTOM';

interface CompanyLimit {
  id: string;
  company_id: string;
  phishing_mode: PhishingMode;
  max_campaigns_per_year: number;
  max_emails_per_month: number;
  max_targets_per_campaign: number;
  can_use_custom_smtp: boolean;
  can_use_landing_pages: boolean;
  can_use_credential_capture: boolean;
  can_use_attachment_simulation: boolean;
  can_use_scenarios: boolean;
  emails_sent_this_month: number;
  month_reset_date: string;
  updated_at: string;
  companies: { name: string } | null;
  license_quota?: number; // joined from phishing_campaign_quotas
}

interface EditForm {
  phishing_mode: PhishingMode;
  max_campaigns_per_year: number;
  max_emails_per_month: number;
  max_targets_per_campaign: number;
  can_use_custom_smtp: boolean;
  can_use_landing_pages: boolean;
  can_use_credential_capture: boolean;
  can_use_attachment_simulation: boolean;
  can_use_scenarios: boolean;
}

export const PhishingCompanyLimitsPage: React.FC = () => {
  const [limits, setLimits] = useState<CompanyLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<CompanyLimit | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchLimits(); }, []);

  const fetchLimits = async () => {
    setLoading(true);
    const year = new Date().getFullYear();
    const [limitsRes, quotasRes] = await Promise.all([
      supabase.from('company_phishing_limits').select('*, companies(name)').order('companies(name)'),
      supabase.from('phishing_campaign_quotas').select('company_id, annual_quota').eq('quota_year', year),
    ]);
    const quotaMap: Record<string, number> = {};
    (quotasRes.data || []).forEach(q => { quotaMap[q.company_id] = q.annual_quota; });
    const merged = (limitsRes.data || []).map(l => ({
      ...l,
      license_quota: quotaMap[l.company_id] ?? null,
    }));
    setLimits(merged);
    setLoading(false);
  };

  const syncFromLicenseQuota = async (l: CompanyLimit) => {
    if (l.license_quota == null) { alert('No license quota set for this company.'); return; }
    if (!confirm(`Set max campaigns/year to ${l.license_quota} (matching the license quota)?`)) return;
    await supabase.from('company_phishing_limits')
      .update({ max_campaigns_per_year: l.license_quota, updated_at: new Date().toISOString() })
      .eq('id', l.id);
    await fetchLimits();
  };

  const openEdit = (l: CompanyLimit) => {
    setEditTarget(l);
    setForm({
      phishing_mode: l.phishing_mode ?? 'CUSTOM',
      max_campaigns_per_year: l.max_campaigns_per_year,
      max_emails_per_month: l.max_emails_per_month,
      max_targets_per_campaign: l.max_targets_per_campaign,
      can_use_custom_smtp: l.can_use_custom_smtp,
      can_use_landing_pages: l.can_use_landing_pages,
      can_use_credential_capture: l.can_use_credential_capture,
      can_use_attachment_simulation: l.can_use_attachment_simulation,
      can_use_scenarios: l.can_use_scenarios,
    });
  };

  const save = async () => {
    if (!editTarget || !form) return;
    setSaving(true);
    await supabase.from('company_phishing_limits').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editTarget.id);
    await fetchLimits();
    setSaving(false);
    setEditTarget(null);
    setForm(null);
  };

  const resetMonthlyEmails = async () => {
    setResetting(true);
    await supabase.from('company_phishing_limits').update({
      emails_sent_this_month: 0,
      month_reset_date: new Date().toISOString().split('T')[0],
    }).neq('id', '00000000-0000-0000-0000-000000000000');
    await fetchLimits();
    setResetting(false);
  };

  const filtered = limits.filter(l => (l.companies?.name || '').toLowerCase().includes(search.toLowerCase()));

  const card = (s?: React.CSSProperties): React.CSSProperties => ({ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, ...s });

  const usagePct = (used: number, max: number) => Math.min(Math.round((used / Math.max(max, 1)) * 100), 100);
  const usageColor = (pct: number) => pct >= 90 ? T.red : pct >= 70 ? T.orange : T.green;

  const ToggleBtn: React.FC<{ val: boolean; onChange: (v: boolean) => void }> = ({ val, onChange }) => (
    <button className={`aw-cl-toggle ${val ? 'on' : 'off'}`} onClick={() => onChange(!val)} />
  );

  const FeatureDot: React.FC<{ on: boolean; label: string }> = ({ on, label }) => (
    <span title={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, fontSize: 11, fontWeight: 600,
      background: on ? T.greenBg : T.redBg, color: on ? T.green : T.red, border: `1px solid ${on ? T.greenBorder : T.redBorder}` }}>
      {on ? <Check size={9} /> : <X size={9} />} {label}
    </span>
  );

  return (
    <div style={{ fontFamily: "'Inter',sans-serif" }}>
      <style>{STYLES}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Sliders size={20} color={T.accent} />
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.white }}>Company Phishing Limits</h2>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>Control campaign quotas and feature access per company.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="aw-cl-input" style={{ width: 220 }} placeholder="Search companies…" value={search} onChange={e => setSearch(e.target.value)} />
          <button className="aw-cl-btn" onClick={resetMonthlyEmails} disabled={resetting}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 13,
              background: T.orangeBg, color: T.orange, border: `1px solid ${T.orangeBorder}` }}>
            <RotateCcw size={13} /> {resetting ? 'Resetting…' : 'Reset Monthly Counts'}
          </button>
        </div>
      </div>

      <div style={card()}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.textMuted }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.textMuted }}>No companies found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.02)' }}>
                {['Company','Mode','Campaigns/Year','Emails/Month','Targets/Campaign','Features',''].map(h => (
                  <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => {
                const emailPct = usagePct(l.emails_sent_this_month, l.max_emails_per_month);
                return (
                  <tr key={l.id} className="aw-cl-row" style={{ borderTop: i > 0 ? `1px solid ${T.borderFaint}` : 'none' }}>
                    <td style={{ padding: '14px 18px', fontSize: 14, fontWeight: 600, color: T.white }}>{l.companies?.name || 'Unknown'}</td>
                    <td style={{ padding: '14px 18px' }}>
                      {(l.phishing_mode ?? 'CUSTOM') === 'TICKET' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: T.purpleBg, color: T.purple, border: `1px solid ${T.purpleBorder}` }}>
                          Ticket
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: T.blueBg, color: T.blue, border: `1px solid ${T.blueBorder}` }}>
                          Custom
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ fontSize: 14, color: T.white }}>{l.max_campaigns_per_year}</span>
                      <span style={{ fontSize: 12, color: T.textMuted }}>/year</span>
                      {l.license_quota != null && l.license_quota !== l.max_campaigns_per_year && (
                        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 11, color: T.orange }}>License: {l.license_quota}</span>
                          <button
                            title="Sync max_campaigns_per_year from license quota"
                            onClick={() => syncFromLicenseQuota(l)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 6, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, color: T.orange, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            <RefreshCw size={9} /> Sync
                          </button>
                        </div>
                      )}
                      {l.license_quota != null && l.license_quota === l.max_campaigns_per_year && (
                        <div style={{ marginTop: 3, fontSize: 10, color: T.green }}>✓ In sync with license</div>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontSize: 13, color: T.white, marginBottom: 4 }}>
                        <span style={{ color: usageColor(emailPct) }}>{l.emails_sent_this_month}</span>
                        <span style={{ color: T.textMuted }}>/{l.max_emails_per_month}</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${emailPct}%`, background: usageColor(emailPct), borderRadius: 2, transition: 'width .3s' }} />
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: 14, color: T.white }}>
                      {l.max_targets_per_campaign.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        <FeatureDot on={l.can_use_custom_smtp} label="Custom SMTP" />
                        <FeatureDot on={l.can_use_landing_pages} label="Landing Pages" />
                        <FeatureDot on={l.can_use_credential_capture} label="Credential Capture" />
                        <FeatureDot on={l.can_use_scenarios} label="Scenarios" />
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <button className="aw-cl-btn" onClick={() => openEdit(l)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', fontSize: 12, background: T.blueBg, color: T.blue, border: `1px solid ${T.blueBorder}` }}>
                        <Edit2 size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit modal */}
      {editTarget && form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ ...card(), padding: 28, width: '100%', maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.white }}>
                Edit Limits — {editTarget.companies?.name}
              </h3>
              <button className="aw-cl-btn" onClick={() => { setEditTarget(null); setForm(null); }}
                style={{ padding: 6, background: 'rgba(255,255,255,.06)', color: T.textMuted }}><X size={16} /></button>
            </div>

            {/* Phishing mode */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 8 }}>Phishing Mode</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {([
                  { value: 'CUSTOM' as PhishingMode, label: 'Custom (Self-Service)', desc: 'Company builds & launches campaigns in-platform', color: T.blue, bg: T.blueBg, border: T.blueBorder },
                  { value: 'TICKET' as PhishingMode, label: 'Ticket (Request-Based)', desc: 'Company requests; platform runs via Gophish', color: T.purple, bg: T.purpleBg, border: T.purpleBorder },
                ]).map(opt => {
                  const active = form.phishing_mode === opt.value;
                  return (
                    <button key={opt.value} className="aw-cl-btn" onClick={() => setForm(f => f ? { ...f, phishing_mode: opt.value } : f)}
                      style={{ textAlign: 'left', padding: '12px 14px', background: active ? opt.bg : 'rgba(255,255,255,.03)', border: `1px solid ${active ? opt.border : T.border}`, color: active ? opt.color : T.textBody }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                        {active && <Check size={13} />} {opt.label}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted, lineHeight: '15px' }}>{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Numeric limits */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
              {([
                ['max_campaigns_per_year', 'Max Campaigns / Year'],
                ['max_emails_per_month', 'Max Emails / Month'],
                ['max_targets_per_campaign', 'Max Targets / Campaign'],
              ] as [keyof EditForm, string][]).map(([key, label]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>{label}</label>
                  <input className="aw-cl-input" type="number" min={1}
                    value={form[key] as number}
                    onChange={e => setForm(f => f ? { ...f, [key]: parseInt(e.target.value) || 1 } : f)} />
                </div>
              ))}
            </div>

            {/* Feature toggles */}
            <div style={{ borderTop: `1px solid ${T.borderFaint}`, paddingTop: 18, marginBottom: 22 }}>
              <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: T.textBody, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={14} color={T.accent} /> Feature Access
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {([
                  ['can_use_custom_smtp', 'Allow Custom SMTP Profiles'],
                  ['can_use_landing_pages', 'Allow Custom Landing Pages'],
                  ['can_use_credential_capture', 'Allow Credential Capture'],
                  ['can_use_attachment_simulation', 'Allow Attachment Simulation'],
                  ['can_use_scenarios', 'Allow Predefined Scenarios'],
                ] as [keyof EditForm, string][]).map(([key, label]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, color: T.textBody }}>{label}</span>
                    <ToggleBtn val={form[key] as boolean} onChange={v => setForm(f => f ? { ...f, [key]: v } : f)} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="aw-cl-btn" onClick={() => { setEditTarget(null); setForm(null); }}
                style={{ padding: '10px 18px', fontSize: 13, background: 'rgba(255,255,255,.06)', color: T.textBody, border: `1px solid ${T.border}` }}>Cancel</button>
              <button className="aw-cl-btn" onClick={save} disabled={saving}
                style={{ padding: '10px 18px', fontSize: 13, background: T.accent, color: T.accentDark, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
