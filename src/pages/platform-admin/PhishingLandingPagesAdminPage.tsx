import React, { useState, useEffect } from "react";
import {
  LayoutTemplate, Plus, Edit2, Trash2, X, Check, Loader2, AlertCircle,
  Copy, Eye, Code, Download, Link, Users, Globe, ChevronDown, ChevronUp, CopyPlus
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
  .aw-lpa-input {
    width: 100%; padding: 10px 14px; box-sizing: border-box;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 13px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .aw-lpa-input:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-lpa-input::placeholder { color: rgba(148,163,184,0.40); }
  .aw-lpa-code {
    width: 100%; height: 100%; padding: 14px; box-sizing: border-box;
    background: #0a0c06; border: none; outline: none; resize: none;
    font-size: 13px; color: #e2e8f0; font-family: 'JetBrains Mono', 'Fira Code', monospace;
    line-height: 1.6;
  }
  .aw-lpa-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px; border-radius: 6px;
    background: rgba(200,255,0,0.08); border: 1px solid rgba(200,255,0,0.20);
    color: #c8ff00; font-size: 11px; font-weight: 600; font-family: monospace;
    cursor: pointer; transition: background 0.18s;
  }
  .aw-lpa-chip:hover { background: rgba(200,255,0,0.16); }
  .aw-lpa-cb { width: 16px; height: 16px; accent-color: #c8ff00; cursor: pointer; }
  .aw-lpa-corow {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px;
    border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02); cursor: pointer; transition: background 0.15s;
  }
  .aw-lpa-corow:hover { background: rgba(255,255,255,0.05); }
  @keyframes aw-spin { to { transform: rotate(360deg); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-lpa-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-lpa-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

type Visibility = 'GLOBAL' | 'SHARED';

interface LandingPage {
  id: string;
  company_id: string | null;
  name: string;
  html_content: string;
  capture_credentials: boolean;
  capture_passwords: boolean;
  redirect_url: string;
  is_active: boolean;
  is_platform_page: boolean;
  visibility: string;
  created_at: string;
  updated_at: string | null;
  shared_companies?: { company_id: string; pushed_at: string }[];
}

interface Company {
  id: string;
  name: string;
  is_active: boolean;
}

const TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login Required</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 8px; box-shadow: 0 2px 16px rgba(0,0,0,0.12); padding: 40px; width: 360px; }
    h2 { font-size: 22px; color: #1a1a1a; margin-bottom: 8px; }
    p { color: #666; font-size: 14px; margin-bottom: 24px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #333; margin-bottom: 6px; }
    input { width: 100%; padding: 10px 14px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; margin-bottom: 16px; }
    button { width: 100%; padding: 12px; background: #0073e6; color: #fff; border: none; border-radius: 6px; font-size: 15px; font-weight: 700; cursor: pointer; }
    img.track { display: none; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Session Expired</h2>
    <p>Hello {{.FirstName}}, please sign in to continue.</p>
    <form method="POST">
      <label>Email</label>
      <input type="email" name="username" value="{{.Email}}" />
      <label>Password</label>
      <input type="password" name="password" placeholder="Enter your password" />
      <button type="submit">Sign In</button>
    </form>
    <img src="{{.TrackingPixel}}" class="track" />
  </div>
</body>
</html>`;

const VARIABLES = [
  '{{.FirstName}}', '{{.LastName}}', '{{.Email}}', '{{.Position}}',
  '{{.Department}}', '{{.Company}}', '{{.URL}}', '{{.TrackingURL}}',
  '{{.TrackingPixel}}', '{{.Date}}', '{{.RId}}',
];

const EMPTY_FORM = {
  name: '',
  html_content: TEMPLATE_HTML,
  capture_credentials: false,
  capture_passwords: false,
  redirect_url: '',
  is_active: true,
  visibility: 'SHARED' as Visibility,
};

export const PhishingLandingPagesAdminPage: React.FC = () => {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editPage, setEditPage] = useState<LandingPage | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Share modal state
  const [shareModal, setShareModal] = useState<{ open: boolean; page: LandingPage | null }>({ open: false, page: null });
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [shareStatus, setShareStatus] = useState<Record<string, string>>({});
  const [sharing, setSharing] = useState(false);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { setPreviewHtml(form.html_content); }, [form.html_content]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [pagesRes, companiesRes] = await Promise.all([
        supabase.from('phishing_company_landing_pages').select('*').eq('is_platform_page', true).order('created_at', { ascending: false }),
        supabase.from('companies').select('id, name, is_active').order('name'),
      ]);
      const rawPages = pagesRes.data || [];
      const ids = rawPages.map(p => p.id);
      const accessMap: Record<string, { company_id: string; pushed_at: string }[]> = {};
      if (ids.length > 0) {
        const { data: access } = await supabase.from('landing_page_company_access').select('landing_page_id, company_id, pushed_at').in('landing_page_id', ids);
        (access || []).forEach(row => {
          if (!accessMap[row.landing_page_id]) accessMap[row.landing_page_id] = [];
          accessMap[row.landing_page_id].push({ company_id: row.company_id, pushed_at: row.pushed_at });
        });
      }
      setPages(rawPages.map(p => ({ ...p, shared_companies: accessMap[p.id] || [] })));
      setCompanies(companiesRes.data || []);
    } catch (err) { console.error('[LandingPagesAdmin] load', err); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditPage(null);
    setForm({ ...EMPTY_FORM });
    setImportUrl('');
    setBuilderOpen(true);
  };

  const openEdit = (p: LandingPage) => {
    setEditPage(p);
    setForm({
      name: p.name, html_content: p.html_content,
      capture_credentials: p.capture_credentials, capture_passwords: p.capture_passwords,
      redirect_url: p.redirect_url || '', is_active: p.is_active,
      visibility: (p.visibility === 'GLOBAL' ? 'GLOBAL' : 'SHARED'),
    });
    setImportUrl('');
    setBuilderOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { alert('Page name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        html_content: form.html_content,
        capture_credentials: form.capture_credentials,
        capture_passwords: form.capture_passwords,
        redirect_url: form.redirect_url,
        is_active: form.is_active,
        visibility: form.visibility,
        is_platform_page: true,
        company_id: null,
        updated_at: new Date().toISOString(),
      };
      const { error } = editPage
        ? await supabase.from('phishing_company_landing_pages').update(payload).eq('id', editPage.id)
        : await supabase.from('phishing_company_landing_pages').insert(payload);
      if (error) throw error;
      setBuilderOpen(false);
      loadAll();
    } catch (err) { console.error('[LandingPagesAdmin] save', err); alert('Failed to save landing page: ' + getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const clonePage = async (p: LandingPage) => {
    try {
      const { error } = await supabase.from('phishing_company_landing_pages').insert({
        name: `${p.name} (Copy)`,
        html_content: p.html_content,
        capture_credentials: p.capture_credentials,
        capture_passwords: p.capture_passwords,
        redirect_url: p.redirect_url,
        is_active: p.is_active,
        visibility: p.visibility === 'GLOBAL' ? 'GLOBAL' : 'SHARED',
        is_platform_page: true,
        company_id: null,
      });
      if (error) throw error;
      loadAll();
    } catch (err) { console.error('[LandingPagesAdmin] clone', err); alert('Failed to clone landing page: ' + getErrorMessage(err)); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('phishing_company_landing_pages').delete().eq('id', deleteId);
      if (error) throw error;
      setDeleteId(null);
      loadAll();
    } catch (err) { console.error('[LandingPagesAdmin] delete', err); alert('Failed to delete landing page: ' + getErrorMessage(err)); }
    finally { setDeleting(false); }
  };

  const copyVar = (v: string) => {
    navigator.clipboard.writeText(v).catch(() => {});
    setCopiedVar(v);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  const handleImport = async () => {
    if (!importUrl.trim() || importing) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('clone-landing-page', { body: { url: importUrl.trim() } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.html) {
        setForm(f => ({ ...f, html_content: data.html, capture_credentials: data.form_detected ? true : f.capture_credentials }));
      }
    } catch (e) { console.error('[LandingPagesAdmin] clone-url', e); alert('Clone failed: ' + getErrorMessage(e)); }
    finally { setImporting(false); }
  };

  /* ── Sharing ── */
  const openShare = (p: LandingPage) => {
    const status: Record<string, string> = {};
    (p.shared_companies || []).forEach(sc => { status[sc.company_id] = sc.pushed_at; });
    setShareStatus(status);
    setSelectedCompanies(new Set());
    setShareModal({ open: true, page: p });
  };

  const toggleCompany = (id: string) => {
    setSelectedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const refreshShareStatus = async (pageId: string) => {
    const { data: access } = await supabase.from('landing_page_company_access').select('company_id, pushed_at').eq('landing_page_id', pageId);
    const status: Record<string, string> = {};
    (access || []).forEach(r => { status[r.company_id] = r.pushed_at; });
    setShareStatus(status);
  };

  const shareToSelected = async (all: boolean) => {
    if (!shareModal.page) return;
    const targets = all ? companies.map(c => c.id) : Array.from(selectedCompanies);
    if (targets.length === 0) return;
    setSharing(true);
    try {
      // Sharing to specific companies implies SHARED visibility.
      if (shareModal.page.visibility !== 'SHARED') {
        await supabase.from('phishing_company_landing_pages').update({ visibility: 'SHARED' }).eq('id', shareModal.page.id);
      }
      const rows = targets.map(company_id => ({ landing_page_id: shareModal.page!.id, company_id }));
      const { error } = await supabase.from('landing_page_company_access').upsert(rows, { onConflict: 'landing_page_id,company_id' });
      if (error) throw error;
      await refreshShareStatus(shareModal.page.id);
      setSelectedCompanies(new Set());
      loadAll();
    } catch (err) { console.error('[LandingPagesAdmin] share', err); alert('Share failed: ' + getErrorMessage(err)); }
    finally { setSharing(false); }
  };

  const revokeCompany = async (companyId: string) => {
    if (!shareModal.page) return;
    if (!confirm('Revoke this landing page from the company?')) return;
    try {
      const { error } = await supabase.from('landing_page_company_access').delete().eq('landing_page_id', shareModal.page.id).eq('company_id', companyId);
      if (error) throw error;
      setShareStatus(prev => { const next = { ...prev }; delete next[companyId]; return next; });
      loadAll();
    } catch (err) { console.error('[LandingPagesAdmin] revoke', err); alert('Revoke failed: ' + getErrorMessage(err)); }
  };

  const visBadge = (p: LandingPage) => {
    if (p.visibility === 'GLOBAL') return { label: 'Global · all companies', bg: T.greenBg, border: T.greenBorder, color: T.green };
    const n = p.shared_companies?.length || 0;
    return { label: `Shared · ${n} ${n === 1 ? 'company' : 'companies'}`, bg: T.purpleBg, border: T.purpleBorder, color: T.purple };
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LayoutTemplate size={18} style={{ color: T.orange }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Platform Landing Pages</h1>
            <p style={{ fontSize: 13, color: T.textBody, margin: 0 }}>Author landing pages once and share them globally or with selected companies.</p>
          </div>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.accent, color: T.accentDark, fontWeight: 700, borderRadius: 10, padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 13 }}>
          <Plus size={15} /> New Landing Page
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {[
          { label: 'Total Pages', value: pages.length, color: T.orange },
          { label: 'Global Pages', value: pages.filter(p => p.visibility === 'GLOBAL').length, color: T.green },
          { label: 'Companies Available', value: companies.length, color: T.accent },
        ].map(s => (
          <div key={s.label} style={{ padding: '14px 16px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 11 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
        </div>
      ) : pages.length === 0 ? (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '60px 20px', textAlign: 'center' }}>
          <LayoutTemplate size={36} style={{ color: 'rgba(255,255,255,0.08)', marginBottom: 12 }} />
          <p style={{ color: T.textMuted, fontSize: 14, margin: 0 }}>No platform landing pages yet. Create one and share it with companies.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pages.map(p => {
            const vb = visBadge(p);
            return (
              <div key={p.id} className="aw-fade-up" style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <LayoutTemplate size={16} style={{ color: T.orange }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: T.white }}>{p.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: vb.bg, border: `1px solid ${vb.border}`, color: vb.color }}>{vb.label}</span>
                      {p.capture_credentials && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, color: T.orange }}>Captures Creds</span>}
                      {p.capture_passwords && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red }}>Captures Passwords</span>}
                    </div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>
                      {Math.round(p.html_content.length / 1024 * 10) / 10} KB HTML · Updated {new Date(p.updated_at || p.created_at).toLocaleDateString('en-SA', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); openShare(p); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, borderRadius: 8, color: T.purple, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                      <Users size={12} /> Share
                    </button>
                    <button onClick={e => { e.stopPropagation(); void clonePage(p); }} title="Clone" style={{ width: 30, height: 30, borderRadius: 7, background: T.greenBg, border: `1px solid ${T.greenBorder}`, color: T.green, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CopyPlus size={13} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); const blob = new Blob([p.html_content], { type: 'text/html' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${p.name.replace(/[^a-z0-9]/gi, '_')}.html`; a.click(); URL.revokeObjectURL(a.href); }} title="Download HTML" style={{ width: 30, height: 30, borderRadius: 7, background: T.blueBg, border: `1px solid ${T.blueBorder}`, color: T.blue, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Download size={13} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); openEdit(p); }} title="Edit" style={{ width: 30, height: 30, borderRadius: 7, background: T.blueBg, border: `1px solid ${T.blueBorder}`, color: T.blue, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Edit2 size={13} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setDeleteId(p.id); }} title="Delete" style={{ width: 30, height: 30, borderRadius: 7, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={13} />
                    </button>
                    {expandedId === p.id ? <ChevronUp size={14} style={{ color: T.textMuted }} /> : <ChevronDown size={14} style={{ color: T.textMuted }} />}
                  </div>
                </div>

                {expandedId === p.id && (
                  <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${T.borderFaint}`, paddingTop: 16 }}>
                    {p.redirect_url && (
                      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Link size={12} /> Redirects to: <span style={{ color: T.textBody }}>{p.redirect_url}</span>
                      </div>
                    )}
                    {p.visibility === 'GLOBAL' ? (
                      <div style={{ fontSize: 12, color: T.green, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Globe size={12} /> Available to all companies on the platform.
                      </div>
                    ) : (p.shared_companies?.length || 0) > 0 ? (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Shared with</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {p.shared_companies?.map(sc => {
                            const co = companies.find(c => c.id === sc.company_id);
                            return co ? (
                              <span key={sc.company_id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 9999, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, color: T.purple }}>{co.name}</span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: T.textMuted }}>Not shared with any company yet. Use “Share” to grant access.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Full-screen Builder */}
      {builderOpen && (
        <div style={{ position: 'fixed', inset: 0, background: T.bg, zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0 20px', height: 52, borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 12, background: T.bgCard, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <LayoutTemplate size={15} style={{ color: T.orange }} />
              <input className="aw-lpa-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Landing Page Name *" style={{ maxWidth: 260, padding: '6px 12px', fontSize: 14, fontWeight: 700 }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              <input className="aw-lpa-input" value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="https://site-to-clone.com" style={{ padding: '6px 12px', fontSize: 12 }} />
              <button onClick={handleImport} disabled={importing} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, borderRadius: 8, color: T.orange, cursor: importing ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit', opacity: importing ? 0.7 : 1 }}>
                {importing ? <Loader2 size={12} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> : <Link size={12} />}
                {importing ? 'Cloning…' : 'Clone'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: T.textBody }}>
                <input type="checkbox" className="aw-lpa-cb" checked={form.capture_credentials} onChange={e => setForm(f => ({ ...f, capture_credentials: e.target.checked }))} />
                Capture Creds
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: T.textBody }}>
                <input type="checkbox" className="aw-lpa-cb" checked={form.capture_passwords} onChange={e => setForm(f => ({ ...f, capture_passwords: e.target.checked }))} />
                Capture Passwords
              </label>
            </div>

            <button onClick={() => setShowPreview(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: showPreview ? T.blueBg : 'rgba(255,255,255,0.04)', border: `1px solid ${showPreview ? T.blueBorder : T.borderFaint}`, borderRadius: 8, color: showPreview ? T.blue : T.textMuted, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
              {showPreview ? <><Code size={12} /> Code Only</> : <><Eye size={12} /> Split Preview</>}
            </button>

            <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', background: T.accent, color: T.accentDark, border: 'none', borderRadius: 9, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, opacity: saving ? 0.7 : 1 }}>
              {saving ? <><Loader2 size={13} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</> : <><Check size={13} /> Save</>}
            </button>
            <button onClick={() => setBuilderOpen(false)} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, borderRadius: 8, color: T.textMuted, cursor: 'pointer' }}>
              <X size={15} />
            </button>
          </div>

          {/* Visibility + Variables bar */}
          <div style={{ padding: '8px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: 'rgba(0,0,0,0.20)', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>Visibility:</span>
            {([
              { v: 'GLOBAL' as Visibility, label: 'Global (all companies)' },
              { v: 'SHARED' as Visibility, label: 'Specific companies' },
            ]).map(opt => (
              <label key={opt.v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: form.visibility === opt.v ? T.white : T.textBody }}>
                <input type="radio" name="visibility" className="aw-lpa-cb" style={{ width: 14, height: 14 }} checked={form.visibility === opt.v} onChange={() => setForm(f => ({ ...f, visibility: opt.v }))} />
                {opt.label}
              </label>
            ))}
            <span style={{ width: 1, height: 16, background: T.border }} />
            <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>Variables:</span>
            {VARIABLES.map(v => (
              <button key={v} className="aw-lpa-chip" onClick={() => copyVar(v)}>
                {copiedVar === v ? <><Check size={10} /> Copied!</> : <><Copy size={10} /> {v}</>}
              </button>
            ))}
          </div>

          {/* Redirect bar */}
          <div style={{ padding: '8px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.10)', flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>Redirect after submit:</span>
            <input className="aw-lpa-input" value={form.redirect_url} onChange={e => setForm(f => ({ ...f, redirect_url: e.target.value }))} placeholder="https://real-site.com (leave blank to show awareness page)" style={{ padding: '6px 12px', fontSize: 12, maxWidth: 400 }} />
          </div>

          {/* Editor + preview */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: showPreview ? `1px solid ${T.borderFaint}` : 'none', overflow: 'hidden' }}>
              <div style={{ padding: '6px 16px', borderBottom: `1px solid ${T.borderFaint}`, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Code size={12} style={{ color: T.textMuted }} />
                <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>HTML / CSS / JavaScript</span>
              </div>
              <textarea className="aw-lpa-code" value={form.html_content} onChange={e => setForm(f => ({ ...f, html_content: e.target.value }))} spellCheck={false} />
            </div>
            {showPreview && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '6px 16px', borderBottom: `1px solid ${T.borderFaint}`, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Eye size={12} style={{ color: T.textMuted }} />
                  <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>Live Preview</span>
                </div>
                <iframe srcDoc={previewHtml} title="Landing Page Preview" sandbox="allow-scripts" style={{ flex: 1, border: 'none', background: '#fff' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModal.open && shareModal.page && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShareModal({ open: false, page: null })}>
          <div className="aw-modal-in" style={{ width: '100%', maxWidth: 540, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.purple}, ${T.purple}40)` }} />
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>Share Landing Page</h2>
                <p style={{ fontSize: 12, color: T.textMuted, margin: 0, marginTop: 2 }}>{shareModal.page.name}</p>
              </div>
              <button onClick={() => setShareModal({ open: false, page: null })} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {shareModal.page.visibility === 'GLOBAL' ? (
              <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px', background: T.greenBg, border: `1px solid ${T.greenBorder}`, borderRadius: 10 }}>
                  <Globe size={16} style={{ color: T.green, flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: T.green }}>This page is <strong>Global</strong> — already available to every company. To restrict it to specific companies, edit the page and switch visibility to “Specific companies”.</span>
                </div>
                <button onClick={() => setShareModal({ open: false, page: null })} style={{ padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textBody, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Close</button>
              </div>
            ) : (
              <>
                <div style={{ padding: '14px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setSelectedCompanies(new Set(companies.map(c => c.id)))} style={{ padding: '7px 14px', background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.22)', borderRadius: 8, color: T.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Select All</button>
                  <button onClick={() => setSelectedCompanies(new Set())} style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, borderRadius: 8, color: T.textMuted, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>Clear</button>
                  <span style={{ fontSize: 12, color: T.textMuted, display: 'flex', alignItems: 'center', marginLeft: 4 }}>{selectedCompanies.size} selected</span>
                </div>

                <div style={{ padding: '12px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {companies.length === 0 ? (
                    <p style={{ color: T.textMuted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No companies available</p>
                  ) : companies.map(c => {
                    const shared = shareStatus[c.id];
                    return (
                      <label key={c.id} className="aw-lpa-corow" onClick={() => toggleCompany(c.id)}>
                        <input type="checkbox" className="aw-lpa-cb" checked={selectedCompanies.has(c.id)} onChange={() => {}} style={{ width: 15, height: 15 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.white }}>{c.name}</div>
                          {shared && <div style={{ fontSize: 11, color: T.purple }}>Shared {new Date(shared).toLocaleDateString('en-SA', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {shared && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, color: T.purple }}>Shared</span>}
                          {!c.is_active && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textMuted }}>Inactive</span>}
                          {shared && (
                            <button onClick={e => { e.preventDefault(); e.stopPropagation(); void revokeCompany(c.id); }} title="Revoke access" style={{ padding: '3px 8px', borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Revoke</button>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10, flexShrink: 0 }}>
                  <button onClick={() => setShareModal({ open: false, page: null })} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textBody, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Close</button>
                  <button onClick={() => shareToSelected(true)} disabled={sharing} style={{ padding: '10px 16px', borderRadius: 10, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, color: T.orange, cursor: sharing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13 }}>Share to All</button>
                  <button onClick={() => shareToSelected(false)} disabled={sharing || selectedCompanies.size === 0} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 10, background: selectedCompanies.size > 0 ? T.purple : 'rgba(255,255,255,0.04)', color: selectedCompanies.size > 0 ? T.white : T.textMuted, border: 'none', cursor: (sharing || selectedCompanies.size === 0) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, opacity: sharing ? 0.7 : 1 }}>
                    {sharing ? <><Loader2 size={13} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Sharing…</> : <><Users size={13} /> Share to Selected</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setDeleteId(null)}>
          <div className="aw-modal-in" style={{ width: '100%', maxWidth: 380, background: T.bgCard, border: `1px solid ${T.redBorder}`, borderRadius: 14, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.red}, ${T.red}40)` }} />
            <div style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={14} style={{ color: T.red }} /></div>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>Delete Landing Page</h2>
              </div>
              <p style={{ fontSize: 13, color: T.textBody, margin: '0 0 18px' }}>This will permanently delete the landing page and all company sharing records. This action cannot be undone.</p>
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
    </div>
  );
};
