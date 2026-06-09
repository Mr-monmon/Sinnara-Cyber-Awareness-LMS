import React, { useState, useEffect } from "react";
import {
  Server, Plus, Edit2, Trash2, Send, X, Check, Loader2,
  AlertCircle, Eye, EyeOff, ChevronDown, ChevronUp, Users
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";

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
  .aw-sadmin-input {
    width: 100%; padding: 10px 14px; box-sizing: border-box;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 13px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .aw-sadmin-input:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-sadmin-input::placeholder { color: rgba(148,163,184,0.40); }
  .aw-sadmin-input option { background: #1a1e0e; color: #fff; }
  .aw-sadmin-cb { width: 16px; height: 16px; accent-color: #c8ff00; cursor: pointer; }
  .aw-sadmin-co-cb { width: 15px; height: 15px; accent-color: #c8ff00; cursor: pointer; }
  @keyframes aw-spin { to { transform: rotate(360deg); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
  .aw-sadmin-corow {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px;
    border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02); cursor: pointer; transition: background 0.15s;
  }
  .aw-sadmin-corow:hover { background: rgba(255,255,255,0.05); }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-sadmin-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-sadmin-styles';
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
  // password is NEVER fetched — stored encrypted server-side only
  from_address: string;
  from_name: string;
  use_tls: boolean;
  use_starttls: boolean;
  ignore_cert_errors: boolean;
  custom_headers: { key: string; value: string }[];
  is_platform_profile: boolean;
  visibility?: 'GLOBAL' | 'SHARED' | 'PLATFORM_ONLY';
  is_active: boolean;
  password_encrypted?: boolean;
  created_at: string;
  pushed_companies?: { company_id: string; pushed_at: string }[];
}

interface Company {
  id: string;
  name: string;
  is_active: boolean;
}

const EMPTY_FORM = {
  name: '',
  host: '',
  port: 587,
  username: '',
  password: '',
  from_address: '',
  from_name: '',
  use_tls: true,
  use_starttls: false,
  ignore_cert_errors: false,
  custom_headers: [] as { key: string; value: string }[],
  is_active: true,
};

const PORTS = [25, 465, 587, 2525];

export const PhishingSmtpAdminPage: React.FC = () => {
  const [profiles, setProfiles] = useState<SmtpProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProfile, setEditProfile] = useState<SmtpProfile | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pushModal, setPushModal] = useState<{ open: boolean; profile: SmtpProfile | null }>({ open: false, profile: null });
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<Record<string, string>>({}); // company_id -> pushed_at
  const [testModal, setTestModal] = useState<{ open: boolean; profileId: string }>({ open: false, profileId: '' });
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSendTest = async () => {
    if (!testEmail.trim()) { alert('Please enter a test email address'); return; }
    setTestSending(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('process-campaign', {
        body: { test_smtp_profile_id: testModal.profileId, test_to: testEmail.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTestResult({ ok: true, msg: `Test email sent to ${testEmail}${data?.from_used ? ` (sender: ${data.from_used})` : ''}.` });
    } catch (err: unknown) {
      setTestResult({ ok: false, msg: getErrorMessage(err) });
    } finally { setTestSending(false); }
  };

  const revokeCompany = async (companyId: string) => {
    if (!pushModal.profile) return;
    if (!confirm('Revoke this profile from the company? They will lose access to it.')) return;
    try {
      const { error } = await supabase.from('smtp_profile_company_access')
        .delete()
        .eq('smtp_profile_id', pushModal.profile.id)
        .eq('company_id', companyId);
      if (error) throw error;
      const nextStatus = { ...pushStatus };
      delete nextStatus[companyId];
      setPushStatus(nextStatus);
      // If no more grants remain and profile was SHARED, fall back to PLATFORM_ONLY
      if (Object.keys(nextStatus).length === 0 && pushModal.profile.visibility === 'SHARED') {
        await supabase.from('smtp_profiles').update({ visibility: 'PLATFORM_ONLY' }).eq('id', pushModal.profile.id);
      }
      loadAll();
    } catch (err: unknown) {
      console.error('[SmtpAdmin] revoke', err);
      alert('Revoke failed: ' + getErrorMessage(err));
    }
  };

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const SAFE_COLS = 'id, company_id, name, host, port, username, from_address, from_name, use_tls, use_starttls, ignore_cert_errors, custom_headers, is_platform_profile, visibility, is_active, password_encrypted, created_at';
      const [profilesRes, companiesRes] = await Promise.all([
        supabase.from('smtp_profiles').select(SAFE_COLS).eq('is_platform_profile', true).order('created_at', { ascending: false }),
        supabase.from('companies').select('id, name, is_active').order('name'),
      ]);

      const rawProfiles = profilesRes.data || [];

      // Load push access for all profiles
      const ids = rawProfiles.map(p => p.id);
      const accessMap: Record<string, { company_id: string; pushed_at: string }[]> = {};
      if (ids.length > 0) {
        const { data: access } = await supabase.from('smtp_profile_company_access').select('smtp_profile_id, company_id, pushed_at').in('smtp_profile_id', ids);
        (access || []).forEach(row => {
          if (!accessMap[row.smtp_profile_id]) accessMap[row.smtp_profile_id] = [];
          accessMap[row.smtp_profile_id].push({ company_id: row.company_id, pushed_at: row.pushed_at });
        });
      }

      setProfiles(rawProfiles.map(p => ({
        ...p,
        custom_headers: p.custom_headers || [],
        pushed_companies: accessMap[p.id] || [],
      })));
      setCompanies(companiesRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditProfile(null);
    setForm({ ...EMPTY_FORM });
    setShowPassword(false);
    setShowModal(true);
  };

  const openEdit = (p: SmtpProfile) => {
    setEditProfile(p);
    setForm({
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
          profile_id:          editProfile?.id,
          name:                form.name,
          host:                form.host,
          port:                form.port,
          username:            form.username,
          password:            form.password,   // plaintext — encrypted by Edge Function
          from_address:        form.from_address,
          from_name:           form.from_name,
          use_tls:             form.use_tls,
          use_starttls:        form.use_starttls,
          ignore_cert_errors:  form.ignore_cert_errors,
          custom_headers:      form.custom_headers,
          is_active:           form.is_active,
          is_platform_profile: true,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setShowModal(false);
      loadAll();
    } catch (err: unknown) {
      console.error('[SmtpAdmin] save', err);
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
      loadAll();
    } catch (err) { console.error('[SmtpAdmin] delete', err); alert('Failed to delete SMTP profile: ' + getErrorMessage(err)); }
    finally { setDeleting(false); }
  };

  const openPushModal = (p: SmtpProfile) => {
    const status: Record<string, string> = {};
    (p.pushed_companies || []).forEach(pc => { status[pc.company_id] = pc.pushed_at; });
    setPushStatus(status);
    setSelectedCompanies(new Set());
    setPushModal({ open: true, profile: p });
  };

  const pushToSelected = async () => {
    if (!pushModal.profile || selectedCompanies.size === 0) return;
    setPushing(true);
    try {
      const rows = Array.from(selectedCompanies).map(company_id => ({
        smtp_profile_id: pushModal.profile!.id,
        company_id,
      }));
      const { error } = await supabase.from('smtp_profile_company_access').upsert(rows, { onConflict: 'smtp_profile_id,company_id' });
      if (error) throw error;
      // Set visibility to SHARED so company SMTP pages can see the access rows
      await supabase.from('smtp_profiles').update({ visibility: 'SHARED' }).eq('id', pushModal.profile!.id);
      loadAll();
      const { data: access } = await supabase.from('smtp_profile_company_access').select('company_id, pushed_at').eq('smtp_profile_id', pushModal.profile!.id);
      const status: Record<string, string> = {};
      (access || []).forEach(r => { status[r.company_id] = r.pushed_at; });
      setPushStatus(status);
      setSelectedCompanies(new Set());
    } catch (err) { console.error('[SmtpAdmin] push', err); alert('Push failed: ' + getErrorMessage(err)); }
    finally { setPushing(false); }
  };

  const pushToAll = async () => {
    if (!pushModal.profile) return;
    setSelectedCompanies(new Set(companies.map(c => c.id)));
    setPushing(true);
    try {
      const rows = companies.map(c => ({ smtp_profile_id: pushModal.profile!.id, company_id: c.id }));
      const { error } = await supabase.from('smtp_profile_company_access').upsert(rows, { onConflict: 'smtp_profile_id,company_id' });
      if (error) throw error;
      // GLOBAL: every company may use it — no per-company access rows needed from now on
      await supabase.from('smtp_profiles').update({ visibility: 'GLOBAL' }).eq('id', pushModal.profile!.id);
      loadAll();
      const { data: access } = await supabase.from('smtp_profile_company_access').select('company_id, pushed_at').eq('smtp_profile_id', pushModal.profile!.id);
      const status: Record<string, string> = {};
      (access || []).forEach(r => { status[r.company_id] = r.pushed_at; });
      setPushStatus(status);
    } catch (err) { console.error('[SmtpAdmin] pushAll', err); alert('Push failed: ' + getErrorMessage(err)); }
    finally { setPushing(false); }
  };

  const makePlatformOnly = async () => {
    if (!pushModal.profile) return;
    if (!confirm('Revoke all company access and make this profile Platform Only? All companies will lose access.')) return;
    setPushing(true);
    try {
      // Remove all access grants first, then set visibility
      await supabase.from('smtp_profile_company_access').delete().eq('smtp_profile_id', pushModal.profile.id);
      const { error } = await supabase.from('smtp_profiles').update({ visibility: 'PLATFORM_ONLY' }).eq('id', pushModal.profile.id);
      if (error) throw error;
      setPushStatus({});
      setSelectedCompanies(new Set());
      loadAll();
    } catch (err) { console.error('[SmtpAdmin] makePlatformOnly', err); alert('Failed: ' + getErrorMessage(err)); }
    finally { setPushing(false); }
  };

  const addHeader = () => setForm(f => ({ ...f, custom_headers: [...f.custom_headers, { key: '', value: '' }] }));
  const removeHeader = (i: number) => setForm(f => ({ ...f, custom_headers: f.custom_headers.filter((_, idx) => idx !== i) }));
  const updateHeader = (i: number, field: 'key' | 'value', val: string) =>
    setForm(f => ({ ...f, custom_headers: f.custom_headers.map((h, idx) => idx === i ? { ...h, [field]: val } : h) }));

  const toggleCompany = (id: string) => {
    setSelectedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Server size={18} style={{ color: T.blue }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Platform SMTP Profiles</h1>
            <p style={{ fontSize: 13, color: T.textBody, margin: 0 }}>Manage platform-level SMTP profiles and push them to client companies.</p>
          </div>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.accent, color: T.accentDark, fontWeight: 700, borderRadius: 10, padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 13 }}>
          <Plus size={15} /> Add Platform Profile
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {[
          { label: 'Total Profiles', value: profiles.length, color: T.blue },
          { label: 'Active Profiles', value: profiles.filter(p => p.is_active).length, color: T.green },
          { label: 'Companies Available', value: companies.length, color: T.accent },
        ].map(s => (
          <div key={s.label} style={{ padding: '14px 16px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 11 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Profiles list */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
        </div>
      ) : profiles.length === 0 ? (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '60px 20px', textAlign: 'center' }}>
          <Server size={36} style={{ color: 'rgba(255,255,255,0.08)', marginBottom: 12 }} />
          <p style={{ color: T.textMuted, fontSize: 14, margin: 0 }}>No platform SMTP profiles yet. Add one and push to companies.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profiles.map(p => (
            <div key={p.id} className="aw-fade-up" style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Server size={16} style={{ color: T.blue }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: T.white }}>{p.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: T.blueBg, border: `1px solid ${T.blueBorder}`, color: T.blue }}>PLATFORM</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: p.is_active ? T.greenBg : 'rgba(255,255,255,0.04)', border: `1px solid ${p.is_active ? T.greenBorder : T.borderFaint}`, color: p.is_active ? T.green : T.textMuted }}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>
                    {p.host}:{p.port} · {p.from_name} &lt;{p.from_address}&gt; · <span style={{ color: (p.pushed_companies?.length || 0) > 0 ? T.green : T.textMuted }}>{p.pushed_companies?.length || 0} companies</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={e => { e.stopPropagation(); setTestEmail(''); setTestResult(null); setTestModal({ open: true, profileId: p.id }); }}
                    title="Send test email"
                    style={{ width: 30, height: 30, borderRadius: 7, background: T.greenBg, border: `1px solid ${T.greenBorder}`, color: T.green, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Send size={13} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); openPushModal(p); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, borderRadius: 8, color: T.purple, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                    <Users size={12} /> Push to Companies
                  </button>
                  <button onClick={e => { e.stopPropagation(); openEdit(p); }} style={{ width: 30, height: 30, borderRadius: 7, background: T.blueBg, border: `1px solid ${T.blueBorder}`, color: T.blue, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Edit2 size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setDeleteId(p.id); }} style={{ width: 30, height: 30, borderRadius: 7, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={13} />
                  </button>
                  {expandedId === p.id ? <ChevronUp size={14} style={{ color: T.textMuted }} /> : <ChevronDown size={14} style={{ color: T.textMuted }} />}
                </div>
              </div>

              {expandedId === p.id && (
                <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${T.borderFaint}`, paddingTop: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: 'Host', value: p.host },
                      { label: 'Port', value: String(p.port) },
                      { label: 'Username', value: p.username },
                      { label: 'From Name', value: p.from_name },
                      { label: 'From Address', value: p.from_address },
                    ].map(row => (
                      <div key={row.label} style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderFaint}`, borderRadius: 8 }}>
                        <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{row.label}</div>
                        <div style={{ fontSize: 12, color: T.textBody }}>{row.value}</div>
                      </div>
                    ))}
                  </div>

                  {(p.pushed_companies?.length || 0) > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pushed to Companies</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {p.pushed_companies?.map(pc => {
                          const co = companies.find(c => c.id === pc.company_id);
                          return co ? (
                            <span key={pc.company_id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 9999, background: T.greenBg, border: `1px solid ${T.greenBorder}`, color: T.green }}>
                              {co.name}
                            </span>
                          ) : null;
                        })}
                      </div>
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
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Server size={13} style={{ color: T.blue }} />
                </div>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>{editProfile ? 'Edit Platform SMTP Profile' : 'New Platform SMTP Profile'}</h2>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 5 }}>Profile Name *</label>
                <input className="aw-sadmin-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Platform Mail Server" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 5 }}>Host *</label>
                  <input className="aw-sadmin-input" value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} placeholder="smtp.platform.com" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 5 }}>Port</label>
                  <select className="aw-sadmin-input" value={form.port} onChange={e => setForm(f => ({ ...f, port: Number(e.target.value) }))} style={{ width: 100 }}>
                    {PORTS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 5 }}>From Name *</label>
                  <input className="aw-sadmin-input" value={form.from_name} onChange={e => setForm(f => ({ ...f, from_name: e.target.value }))} placeholder="Security Team" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 5 }}>From Address *</label>
                  <input className="aw-sadmin-input" value={form.from_address} onChange={e => setForm(f => ({ ...f, from_address: e.target.value }))} placeholder="noreply@platform.com" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 5 }}>Username</label>
                  <input className="aw-sadmin-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="SMTP username" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 5 }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input className="aw-sadmin-input" type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editProfile ? 'Leave blank to keep existing' : 'SMTP password'} style={{ paddingRight: 44 }} />
                    <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 0 }}>
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Security Options</div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  {([
                    { key: 'use_tls', label: 'Use TLS' },
                    { key: 'use_starttls', label: 'Use STARTTLS' },
                    { key: 'ignore_cert_errors', label: 'Ignore Cert Errors' },
                  ] as const).map(opt => (
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: T.textBody }}>
                      <input type="checkbox" className="aw-sadmin-cb" checked={form[opt.key] as boolean} onChange={e => setForm(f => ({ ...f, [opt.key]: e.target.checked }))} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Custom Headers */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Custom Headers</label>
                  <button onClick={addHeader} style={{ fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={11} /> Add
                  </button>
                </div>
                {form.custom_headers.length === 0 ? (
                  <div style={{ fontSize: 12, color: T.textMuted }}>No custom headers.</div>
                ) : form.custom_headers.map((h, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <input className="aw-sadmin-input" value={h.key} onChange={e => updateHeader(i, 'key', e.target.value)} placeholder="Header name" />
                    <input className="aw-sadmin-input" value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)} placeholder="Header value" />
                    <button onClick={() => removeHeader(i)} style={{ width: 28, height: 28, borderRadius: 6, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10, flexShrink: 0 }}>
              <button onClick={() => setShowModal(false)} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textBody, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 10, background: T.accent, color: T.accentDark, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</> : <><Check size={14} /> Save Profile</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Push to Companies Modal */}
      {pushModal.open && pushModal.profile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setPushModal({ open: false, profile: null })}>
          <div className="aw-modal-in"
            style={{ width: '100%', maxWidth: 540, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.purple}, ${T.purple}40)` }} />
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>Push to Companies</h2>
                <p style={{ fontSize: 12, color: T.textMuted, margin: 0, marginTop: 2 }}>{pushModal.profile.name}</p>
              </div>
              <button onClick={() => setPushModal({ open: false, profile: null })} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ padding: '14px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => setSelectedCompanies(new Set(companies.map(c => c.id)))}
                style={{ padding: '7px 14px', background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.22)', borderRadius: 8, color: T.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
                Select All
              </button>
              <button onClick={() => setSelectedCompanies(new Set())}
                style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, borderRadius: 8, color: T.textMuted, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                Clear
              </button>
              <span style={{ fontSize: 12, color: T.textMuted, display: 'flex', alignItems: 'center', marginLeft: 4 }}>
                {selectedCompanies.size} selected
              </span>
            </div>

            <div style={{ padding: '12px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {companies.length === 0 ? (
                <p style={{ color: T.textMuted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No companies available</p>
              ) : companies.map(c => {
                const pushed = pushStatus[c.id];
                return (
                  <label key={c.id} className="aw-sadmin-corow" onClick={() => toggleCompany(c.id)}>
                    <input type="checkbox" className="aw-sadmin-co-cb" checked={selectedCompanies.has(c.id)} onChange={() => {}} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.white }}>{c.name}</div>
                      {pushed && <div style={{ fontSize: 11, color: T.green }}>Pushed {new Date(pushed).toLocaleDateString('en-SA', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {pushed && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, background: T.greenBg, border: `1px solid ${T.greenBorder}`, color: T.green }}>Pushed</span>}
                      {!c.is_active && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textMuted }}>Inactive</span>}
                      {pushed && (
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); void revokeCompany(c.id); }}
                          title="Revoke access"
                          style={{ padding: '3px 8px', borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Revoke
                        </button>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
              <button onClick={() => setPushModal({ open: false, profile: null })} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textBody, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Close</button>
              <button onClick={makePlatformOnly} disabled={pushing} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(148,163,184,0.10)', border: `1px solid rgba(148,163,184,0.25)`, color: T.textMuted, cursor: pushing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }}>Platform Only</button>
              <button onClick={pushToAll} disabled={pushing} style={{ padding: '10px 16px', borderRadius: 10, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, color: T.orange, cursor: pushing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13 }}>Push to All (Global)</button>
              <button onClick={pushToSelected} disabled={pushing || selectedCompanies.size === 0}
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 10, background: selectedCompanies.size > 0 ? T.purple : 'rgba(255,255,255,0.04)', color: selectedCompanies.size > 0 ? T.white : T.textMuted, border: 'none', cursor: (pushing || selectedCompanies.size === 0) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, opacity: pushing ? 0.7 : 1 }}>
                {pushing ? <><Loader2 size={13} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Pushing…</> : <><Send size={13} /> Push to Selected (Shared)</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setDeleteId(null)}>
          <div className="aw-modal-in" style={{ width: '100%', maxWidth: 380, background: T.bgCard, border: `1px solid ${T.redBorder}`, borderRadius: 14, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.red}, ${T.red}40)` }} />
            <div style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={13} style={{ color: T.red }} /></div>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>Delete Platform Profile</h2>
              </div>
              <p style={{ fontSize: 13, color: T.textBody, margin: '0 0 18px' }}>This will remove the profile and all company push access records.</p>
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

      {/* Test Send Modal */}
      {testModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setTestModal({ open: false, profileId: '' })}>
          <div className="aw-modal-in" style={{ width: '100%', maxWidth: 420, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.green}, ${T.green}40)` }} />
            <div style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>Send Test Email</h2>
                <button onClick={() => setTestModal({ open: false, profileId: '' })} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 12 }}>Verify the SMTP settings by sending a test email to a real inbox.</p>
              <label style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Send To</label>
              <input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                style={{ width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, borderRadius: 8, color: T.white, fontSize: 13, fontFamily: 'inherit' }}
              />
              {testResult && (
                <div style={{ padding: '10px 14px', marginBottom: 12, background: testResult.ok ? T.greenBg : T.redBg, border: `1px solid ${testResult.ok ? T.greenBorder : T.redBorder}`, borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {testResult.ok ? <Check size={13} style={{ color: T.green, flexShrink: 0, marginTop: 2 }} /> : <AlertCircle size={13} style={{ color: T.red, flexShrink: 0, marginTop: 2 }} />}
                  <span style={{ fontSize: 12, color: testResult.ok ? T.green : T.red, wordBreak: 'break-word' }}>{testResult.msg}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setTestModal({ open: false, profileId: '' })} disabled={testSending} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textBody, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Close</button>
                <button onClick={handleSendTest} disabled={testSending} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 10, background: T.green, color: T.accentDark, border: 'none', cursor: testSending ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, opacity: testSending ? 0.7 : 1 }}>
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
