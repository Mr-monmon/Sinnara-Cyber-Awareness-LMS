import React, { useState, useEffect } from "react";
import {
  Server, Plus, Edit2, Trash2, Lock, Eye, EyeOff,
  Send, X, Check, Loader2, AlertCircle, ChevronDown, ChevronUp
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../contexts/AuthContext";

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
} as const;

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  .aw-smtp-input {
    width: 100%; padding: 10px 14px; box-sizing: border-box;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 13px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .aw-smtp-input:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-smtp-input::placeholder { color: rgba(148,163,184,0.40); }
  .aw-smtp-input option { background: #1a1e0e; color: #fff; }
  .aw-smtp-cb { width: 16px; height: 16px; accent-color: #c8ff00; cursor: pointer; }
  @keyframes aw-spin { to { transform: rotate(360deg); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-smtp-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-smtp-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

interface SmtpProfile {
  id: string;
  company_id: string | null;
  name: string;
  host: string;
  port: number;
  username: string;
  // password is NEVER fetched from the DB — stored encrypted server-side only
  from_address: string;
  from_name: string;
  use_tls: boolean;
  use_starttls: boolean;
  ignore_cert_errors: boolean;
  custom_headers: { key: string; value: string }[];
  is_platform_profile: boolean;
  visibility?: string;
  is_active: boolean;
  password_encrypted?: boolean;
  created_at: string;
  isPushed?: boolean;
  pushed_at?: string;
}

const EMPTY_FORM = {
  company_id: null as string | null,
  name: '',
  host: '',
  port: 587,
  username: '',
  password: '',          // plaintext — only kept in memory, never sent to DB directly
  from_address: '',
  from_name: '',
  use_tls: true,
  use_starttls: false,
  ignore_cert_errors: false,
  custom_headers: [] as { key: string; value: string }[],
  is_active: true,
};

const PORTS = [25, 465, 587, 2525];

const InputField: React.FC<{
  label: string; value: string | number; type?: string;
  onChange: (v: string) => void; placeholder?: string; required?: boolean;
  suffix?: React.ReactNode;
}> = ({ label, value, type = 'text', onChange, placeholder, required, suffix }) => (
  <div>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
      {label}{required && <span style={{ color: T.red }}> *</span>}
    </label>
    <div style={{ position: 'relative' }}>
      <input
        className="aw-smtp-input"
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={suffix ? { paddingRight: 44 } : {}}
      />
      {suffix && (
        <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>{suffix}</div>
      )}
    </div>
  </div>
);

export const PhishingSmtpPage: React.FC = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<SmtpProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProfile, setEditProfile] = useState<SmtpProfile | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testModal, setTestModal] = useState<{ open: boolean; profileId: string }>({ open: false, profileId: '' });
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { if (user?.company_id) loadProfiles(); }, [user]);

  const loadProfiles = async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      // Load company profiles — password column intentionally excluded
      const SAFE_COLS = 'id, company_id, name, host, port, username, from_address, from_name, use_tls, use_starttls, ignore_cert_errors, custom_headers, is_platform_profile, visibility, is_active, password_encrypted, created_at';
      const { data: companyProfiles } = await supabase
        .from('smtp_profiles')
        .select(SAFE_COLS)
        .eq('company_id', user.company_id)
        .eq('is_platform_profile', false)
        .order('created_at', { ascending: false });

      // Load SHARED platform profiles (pushed to this company via access rows)
      const { data: accessRows } = await supabase
        .from('smtp_profile_company_access')
        .select('smtp_profile_id, pushed_at')
        .eq('company_id', user.company_id);

      // Load GLOBAL platform profiles (open to every company — no access row needed)
      const { data: globalPP } = await supabase
        .from('smtp_profiles')
        .select(SAFE_COLS)
        .eq('is_platform_profile', true)
        .eq('visibility', 'GLOBAL');

      const profileMap = new Map<string, SmtpProfile>();

      // Add GLOBAL profiles first
      (globalPP || []).forEach(p => {
        profileMap.set(p.id, { ...p, custom_headers: p.custom_headers || [], isPushed: true });
      });

      // Add SHARED profiles (may overlap with GLOBAL if visibility changed — Map deduplicates)
      if (accessRows && accessRows.length > 0) {
        const ids = accessRows.map(r => r.smtp_profile_id);
        const { data: sharedPP } = await supabase
          .from('smtp_profiles')
          .select(SAFE_COLS)
          .in('id', ids)
          .eq('is_platform_profile', true);
        (sharedPP || []).forEach(p => {
          if (!profileMap.has(p.id)) {
            profileMap.set(p.id, {
              ...p,
              custom_headers: p.custom_headers || [],
              isPushed: true,
              pushed_at: accessRows.find(r => r.smtp_profile_id === p.id)?.pushed_at,
            });
          }
        });
      }

      const all: SmtpProfile[] = [
        ...(companyProfiles || []).map(p => ({ ...p, custom_headers: p.custom_headers || [], isPushed: false })),
        ...Array.from(profileMap.values()),
      ];
      setProfiles(all);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditProfile(null);
    setForm({ ...EMPTY_FORM, company_id: user?.company_id || null });
    setShowPassword(false);
    setShowModal(true);
  };

  const openEdit = (p: SmtpProfile) => {
    setEditProfile(p);
    setForm({
      company_id: p.company_id,
      name: p.name, host: p.host, port: p.port,
      username: p.username,
      password: '',   // never pre-fill; leave blank to keep existing encrypted password
      from_address: p.from_address, from_name: p.from_name,
      use_tls: p.use_tls, use_starttls: p.use_starttls,
      ignore_cert_errors: p.ignore_cert_errors,
      custom_headers: p.custom_headers || [],
      is_active: p.is_active,
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.host.trim() || !form.from_address.trim()) {
      alert('Name, Host, and From Address are required.');
      return;
    }
    if (!editProfile && !form.password.trim()) {
      alert('Password is required when creating a new SMTP profile.');
      return;
    }
    setSaving(true);
    try {
      // Password is encrypted server-side by the Edge Function.
      // We never write directly to smtp_profiles from the frontend.
      const { data, error } = await supabase.functions.invoke('save-smtp-profile', {
        body: {
          profile_id:         editProfile?.id,
          name:               form.name,
          host:               form.host,
          port:               form.port,
          username:           form.username,
          password:           form.password,   // plaintext — encrypted by Edge Function
          from_address:       form.from_address,
          from_name:          form.from_name,
          use_tls:            form.use_tls,
          use_starttls:       form.use_starttls,
          ignore_cert_errors: form.ignore_cert_errors,
          custom_headers:     form.custom_headers,
          is_active:          form.is_active,
          is_platform_profile: false,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setShowModal(false);
      loadProfiles();
    } catch (err: unknown) {
      console.error('[Smtp] save', err);
      alert('Failed to save SMTP profile: ' + getErrorMessage(err));
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('smtp_profiles').delete().eq('id', deleteId);
      if (error) throw error;
      setDeleteId(null);
      loadProfiles();
    } catch (err) { console.error('[Smtp] delete', err); alert('Failed to delete SMTP profile: ' + getErrorMessage(err)); }
    finally { setDeleting(false); }
  };

  const handleSendTest = async () => {
    if (!testEmail.trim()) { alert('Please enter a test email address'); return; }
    setTestSending(true);
    setTestResult(null);
    try {
      // process-campaign worker handles send; invoke it with a one-off test payload
      const { data, error } = await supabase.functions.invoke('process-campaign', {
        body: { test_smtp_profile_id: testModal.profileId, test_to: testEmail.trim() },
      });
      if (error) throw error;
      if (data?.success === false || data?.error) throw new Error(data?.error || 'Send failed');
      setTestResult({ ok: true, msg: `Test email sent to ${testEmail}${data?.from_used ? ` (sender: ${data.from_used})` : ''}.` });
    } catch (err: unknown) {
      setTestResult({ ok: false, msg: getErrorMessage(err) });
    } finally { setTestSending(false); }
  };

  const addHeader = () => setForm(f => ({ ...f, custom_headers: [...f.custom_headers, { key: '', value: '' }] }));
  const removeHeader = (i: number) => setForm(f => ({ ...f, custom_headers: f.custom_headers.filter((_, idx) => idx !== i) }));
  const updateHeader = (i: number, field: 'key' | 'value', val: string) =>
    setForm(f => ({ ...f, custom_headers: f.custom_headers.map((h, idx) => idx === i ? { ...h, [field]: val } : h) }));


  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Server size={18} style={{ color: T.blue }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>SMTP Profiles</h1>
            <p style={{ fontSize: 13, color: T.textBody, margin: 0 }}>Configure sending server profiles for phishing campaigns.</p>
          </div>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.accent, color: T.accentDark, fontWeight: 700, borderRadius: 10, padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 13 }}>
          <Plus size={15} /> Add Profile
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
        </div>
      ) : profiles.length === 0 ? (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '60px 20px', textAlign: 'center' }}>
          <Server size={36} style={{ color: 'rgba(255,255,255,0.08)', marginBottom: 12 }} />
          <p style={{ color: T.textMuted, fontSize: 14, margin: 0 }}>No SMTP profiles yet. Add one to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profiles.map(p => (
            <div key={p.id} className="aw-fade-up" style={{ background: T.bgCard, border: `1px solid ${p.isPushed ? 'rgba(96,165,250,0.25)' : T.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: p.isPushed ? T.blueBg : 'rgba(200,255,0,0.08)', border: `1px solid ${p.isPushed ? T.blueBorder : 'rgba(200,255,0,0.22)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {p.isPushed ? <Lock size={16} style={{ color: T.blue }} /> : <Server size={16} style={{ color: T.accent }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: T.white }}>{p.name}</span>
                    {p.isPushed && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 9999, background: T.blueBg, border: `1px solid ${T.blue}`, color: T.blue, letterSpacing: '0.3px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Lock size={9} style={{ flexShrink: 0 }} /> Platform Profile — Read Only
                      </span>
                    )}
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: p.is_active ? T.greenBg : 'rgba(255,255,255,0.04)', border: `1px solid ${p.is_active ? T.greenBorder : T.borderFaint}`, color: p.is_active ? T.green : T.textMuted }}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>{p.host}:{p.port} · {p.from_name} &lt;{p.from_address}&gt;</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {!p.isPushed && (
                    <>
                      <button
                        onClick={e => { e.stopPropagation(); setTestModal({ open: true, profileId: p.id }); setTestEmail(''); setTestResult(null); }}
                        title="Send Test Email"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, borderRadius: 8, color: T.purple, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        <Send size={12} /> Test
                      </button>
                      <button onClick={e => { e.stopPropagation(); openEdit(p); }} title="Edit" style={{ width: 30, height: 30, borderRadius: 7, background: T.blueBg, border: `1px solid ${T.blueBorder}`, color: T.blue, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Edit2 size={13} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteId(p.id); }} title="Delete" style={{ width: 30, height: 30, borderRadius: 7, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                  {expandedId === p.id ? <ChevronUp size={14} style={{ color: T.textMuted }} /> : <ChevronDown size={14} style={{ color: T.textMuted }} />}
                </div>
              </div>

              {expandedId === p.id && (
                <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${T.borderFaint}`, paddingTop: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {[
                      { label: 'Host', value: p.host },
                      { label: 'Port', value: String(p.port) },
                      { label: 'Username', value: p.username },
                      { label: 'From Name', value: p.from_name },
                      { label: 'From Address', value: p.from_address },
                    ].map(row => (
                      <div key={row.label} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderFaint}`, borderRadius: 8 }}>
                        <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{row.label}</div>
                        <div style={{ fontSize: 13, color: T.textBody, wordBreak: 'break-all' }}>{row.value}</div>
                      </div>
                    ))}
                    <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderFaint}`, borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Settings</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {p.use_tls && <span style={{ fontSize: 11, color: T.green }}>TLS</span>}
                        {p.use_starttls && <span style={{ fontSize: 11, color: T.green }}>STARTTLS</span>}
                        {p.ignore_cert_errors && <span style={{ fontSize: 11, color: T.orange }}>Ignore Cert</span>}
                        {!p.use_tls && !p.use_starttls && <span style={{ fontSize: 11, color: T.textMuted }}>Plain</span>}
                      </div>
                    </div>
                  </div>
                  {p.isPushed && p.pushed_at && (
                    <div style={{ marginTop: 10, fontSize: 11, color: T.textMuted }}>
                      Pushed by platform on {new Date(p.pushed_at).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowModal(false)}>
          <div className="aw-modal-in"
            style={{ width: '100%', maxWidth: 620, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.blue}, ${T.blue}40)` }} />

            {/* Modal Header */}
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Server size={14} style={{ color: T.blue }} />
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: T.white, margin: 0 }}>{editProfile ? 'Edit SMTP Profile' : 'New SMTP Profile'}</h2>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              <InputField label="Profile Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Corporate Mail Server" required />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <InputField label="Host" value={form.host} onChange={v => setForm(f => ({ ...f, host: v }))} placeholder="smtp.example.com" required />
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Port</label>
                  <select className="aw-smtp-input" value={form.port} onChange={e => setForm(f => ({ ...f, port: Number(e.target.value) }))} style={{ width: 100 }}>
                    {PORTS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <InputField label="From Name" value={form.from_name} onChange={v => setForm(f => ({ ...f, from_name: v }))} placeholder="IT Security Team" required />
                <InputField label="From Address" value={form.from_address} onChange={v => setForm(f => ({ ...f, from_address: v }))} placeholder="security@company.com" required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <InputField label="Username" value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} placeholder="SMTP username" />
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="aw-smtp-input"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder={editProfile ? 'Leave blank to keep existing' : 'SMTP password'}
                      style={{ paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 0 }}>
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Security options */}
              <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Security Options</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {([
                    { key: 'use_tls', label: 'Use TLS', desc: 'Enable TLS encryption' },
                    { key: 'use_starttls', label: 'Use STARTTLS', desc: 'Upgrade to TLS via STARTTLS' },
                    { key: 'ignore_cert_errors', label: 'Ignore Certificate Errors', desc: 'Skip SSL cert validation (not recommended for production)' },
                  ] as const).map(opt => (
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        className="aw-smtp-cb"
                        checked={form[opt.key] as boolean}
                        onChange={e => setForm(f => ({ ...f, [opt.key]: e.target.checked }))}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <div style={{ fontSize: 13, color: T.textBody, fontWeight: 600 }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Custom Headers */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Custom Headers</label>
                  <button onClick={addHeader} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <Plus size={12} /> Add Header
                  </button>
                </div>
                {form.custom_headers.length === 0 ? (
                  <div style={{ fontSize: 12, color: T.textMuted, padding: '10px 0' }}>No custom headers. Click "Add Header" to add one.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {form.custom_headers.map((h, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                        <input className="aw-smtp-input" value={h.key} onChange={e => updateHeader(i, 'key', e.target.value)} placeholder="Header name" />
                        <input className="aw-smtp-input" value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)} placeholder="Header value" />
                        <button onClick={() => removeHeader(i)} style={{ width: 30, height: 30, borderRadius: 7, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10 }}>
              <button onClick={() => setShowModal(false)} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textBody, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 10, background: T.accent, color: T.accentDark, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</> : <><Check size={14} /> Save Profile</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setDeleteId(null)}>
          <div className="aw-modal-in" style={{ width: '100%', maxWidth: 400, background: T.bgCard, border: `1px solid ${T.redBorder}`, borderRadius: 16, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.red}, ${T.red}40)` }} />
            <div style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={14} style={{ color: T.red }} />
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: T.white, margin: 0 }}>Delete Profile</h2>
              </div>
              <p style={{ fontSize: 13, color: T.textBody, margin: '0 0 20px' }}>Are you sure you want to delete this SMTP profile? This action cannot be undone.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textBody, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
                <button onClick={confirmDelete} disabled={deleting} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 10, background: T.red, color: T.white, border: 'none', cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                  {deleting ? <Loader2 size={13} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> : <Trash2 size={13} />} Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {testModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => { setTestModal({ open: false, profileId: '' }); setTestResult(null); }}>
          <div className="aw-modal-in" style={{ width: '100%', maxWidth: 420, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.purple}, ${T.purple}40)` }} />
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Send size={14} style={{ color: T.purple }} />
                  </div>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>Send Test Email</h2>
                </div>
                <button onClick={() => { setTestModal({ open: false, profileId: '' }); setTestResult(null); }} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Recipient Email *</label>
                <input className="aw-smtp-input" type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@example.com" />
              </div>

              {testResult && (
                <div style={{ padding: '10px 14px', background: testResult.ok ? T.greenBg : T.redBg, border: `1px solid ${testResult.ok ? T.greenBorder : T.redBorder}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {testResult.ok ? <Check size={13} style={{ color: T.green }} /> : <AlertCircle size={13} style={{ color: T.red }} />}
                  <span style={{ fontSize: 12, color: testResult.ok ? T.green : T.red }}>{testResult.msg}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setTestModal({ open: false, profileId: '' }); setTestResult(null); }} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textBody, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Close</button>
                <button onClick={handleSendTest} disabled={testSending} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 10, background: T.purple, color: T.white, border: 'none', cursor: testSending ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, opacity: testSending ? 0.7 : 1 }}>
                  {testSending ? <><Loader2 size={13} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Sending…</> : <><Send size={13} /> Send Test</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
