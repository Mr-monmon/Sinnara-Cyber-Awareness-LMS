import React, { useState, useEffect } from "react";
import {
  Globe, Plus, Edit2, Trash2, X, Check, Loader2, AlertCircle,
  Copy, Eye, Code, Download, Link
} from "lucide-react";
import { supabase } from "../../lib/supabase";
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
  .aw-lp-input {
    width: 100%; padding: 10px 14px; box-sizing: border-box;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 13px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .aw-lp-input:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-lp-input::placeholder { color: rgba(148,163,184,0.40); }
  .aw-lp-code {
    width: 100%; height: 100%; padding: 14px; box-sizing: border-box;
    background: #0a0c06; border: none; outline: none; resize: none;
    font-size: 13px; color: #e2e8f0; font-family: 'JetBrains Mono', 'Fira Code', monospace;
    line-height: 1.6;
  }
  .aw-lp-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px; border-radius: 6px;
    background: rgba(200,255,0,0.08); border: 1px solid rgba(200,255,0,0.20);
    color: #c8ff00; font-size: 11px; font-weight: 600; font-family: monospace;
    cursor: pointer; transition: background 0.18s;
  }
  .aw-lp-chip:hover { background: rgba(200,255,0,0.16); }
  .aw-lp-cb { width: 16px; height: 16px; accent-color: #c8ff00; cursor: pointer; }
  @keyframes aw-spin { to { transform: rotate(360deg); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-lp-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-lp-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

interface LandingPage {
  id: string;
  company_id: string;
  name: string;
  html_content: string;
  capture_credentials: boolean;
  capture_passwords: boolean;
  redirect_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
    <img src="{{.TrackingURL}}" class="track" />
  </div>
</body>
</html>`;

const VARIABLES = [
  '{{.FirstName}}', '{{.LastName}}', '{{.Email}}', '{{.Position}}',
  '{{.Department}}', '{{.Company}}', '{{.URL}}', '{{.TrackingURL}}',
  '{{.Date}}', '{{.RId}}',
];

export const PhishingLandingPagesPage: React.FC = () => {
  const { user } = useAuth();
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editPage, setEditPage] = useState<LandingPage | null>(null);
  const [form, setForm] = useState({
    name: '',
    html_content: TEMPLATE_HTML,
    capture_credentials: false,
    capture_passwords: false,
    redirect_url: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => { if (user?.company_id) loadPages(); }, [user]);
  useEffect(() => { setPreviewHtml(form.html_content); }, [form.html_content]);

  const loadPages = async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('phishing_company_landing_pages').select('*').eq('company_id', user.company_id).order('created_at', { ascending: false });
      setPages(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditPage(null);
    setForm({ name: '', html_content: TEMPLATE_HTML, capture_credentials: false, capture_passwords: false, redirect_url: '', is_active: true });
    setImportUrl('');
    setBuilderOpen(true);
  };

  const openEdit = (p: LandingPage) => {
    setEditPage(p);
    setForm({ name: p.name, html_content: p.html_content, capture_credentials: p.capture_credentials, capture_passwords: p.capture_passwords, redirect_url: p.redirect_url || '', is_active: p.is_active });
    setImportUrl('');
    setBuilderOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { alert('Page name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, company_id: user?.company_id, updated_at: new Date().toISOString() };
      if (editPage) {
        await supabase.from('phishing_company_landing_pages').update(payload).eq('id', editPage.id);
      } else {
        await supabase.from('phishing_company_landing_pages').insert(payload);
      }
      setBuilderOpen(false);
      loadPages();
    } catch (err: any) { alert(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await supabase.from('phishing_company_landing_pages').delete().eq('id', deleteId);
      setDeleteId(null);
      loadPages();
    } catch (err: any) { alert(err.message || 'Failed to delete'); }
    finally { setDeleting(false); }
  };

  const copyVar = (v: string) => {
    navigator.clipboard.writeText(v).catch(() => {});
    setCopiedVar(v);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  const handleImport = () => {
    if (!importUrl.trim()) return;
    const placeholder = `<!-- Cloned from: ${importUrl} -->
<!-- Note: Full site cloning happens server-side. This is a placeholder. -->
<!-- Replace this content with the actual cloned HTML after server processing. -->

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cloned from ${importUrl}</title>
</head>
<body>
  <p>Site content from <a href="${importUrl}">${importUrl}</a> will appear here after server-side cloning.</p>
  <img src="{{.TrackingURL}}" style="display:none" />
</body>
</html>`;
    setForm(f => ({ ...f, html_content: placeholder }));
    setImportUrl('');
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={18} style={{ color: T.orange }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Landing Pages</h1>
            <p style={{ fontSize: 13, color: T.textBody, margin: 0 }}>Build phishing simulation landing pages.</p>
          </div>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.accent, color: T.accentDark, fontWeight: 700, borderRadius: 10, padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 13 }}>
          <Plus size={15} /> New Page
        </button>
      </div>

      {/* Pages list */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
        </div>
      ) : pages.length === 0 ? (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '60px 20px', textAlign: 'center' }}>
          <Globe size={36} style={{ color: 'rgba(255,255,255,0.08)', marginBottom: 12 }} />
          <p style={{ color: T.textMuted, fontSize: 14, margin: 0 }}>No landing pages yet. Create your first one to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {pages.map(p => (
            <div key={p.id} className="aw-fade-up" style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ height: 3, background: `linear-gradient(90deg, ${T.orange}, ${T.orange}40)` }} />
              <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.white, marginBottom: 6 }}>{p.name}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {p.capture_credentials && (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, color: T.orange, fontWeight: 700 }}>Captures Credentials</span>
                      )}
                      {p.capture_passwords && (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, fontWeight: 700 }}>Captures Passwords</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => openEdit(p)} style={{ width: 28, height: 28, borderRadius: 7, background: T.blueBg, border: `1px solid ${T.blueBorder}`, color: T.blue, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => setDeleteId(p.id)} style={{ width: 28, height: 28, borderRadius: 7, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: T.textMuted }}>{new Date(p.created_at).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full-screen Builder Modal */}
      {builderOpen && (
        <div style={{ position: 'fixed', inset: 0, background: T.bg, zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
          {/* Builder top bar */}
          <div style={{ padding: '0 20px', height: 52, borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 12, background: T.bgCard, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <Globe size={15} style={{ color: T.orange }} />
              <input
                className="aw-lp-input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Landing Page Name *"
                style={{ maxWidth: 280, padding: '6px 12px', fontSize: 14, fontWeight: 700 }}
              />
            </div>

            {/* Import site */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              <input
                className="aw-lp-input"
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                placeholder="https://site-to-clone.com"
                style={{ padding: '6px 12px', fontSize: 12 }}
              />
              <button onClick={handleImport} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, borderRadius: 8, color: T.orange, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                <Link size={12} /> Clone
              </button>
            </div>

            {/* Options */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: T.textBody }}>
                <input type="checkbox" className="aw-lp-cb" checked={form.capture_credentials} onChange={e => setForm(f => ({ ...f, capture_credentials: e.target.checked }))} />
                Capture Creds
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: T.textBody }}>
                <input type="checkbox" className="aw-lp-cb" checked={form.capture_passwords} onChange={e => setForm(f => ({ ...f, capture_passwords: e.target.checked }))} />
                Capture Passwords
              </label>
            </div>

            {/* View toggle */}
            <button
              onClick={() => setShowPreview(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: showPreview ? T.blueBg : 'rgba(255,255,255,0.04)', border: `1px solid ${showPreview ? T.blueBorder : T.borderFaint}`, borderRadius: 8, color: showPreview ? T.blue : T.textMuted, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
              {showPreview ? <><Code size={12} /> Code Only</> : <><Eye size={12} /> Split Preview</>}
            </button>

            <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', background: T.accent, color: T.accentDark, border: 'none', borderRadius: 9, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, opacity: saving ? 0.7 : 1 }}>
              {saving ? <><Loader2 size={13} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</> : <><Check size={13} /> Save</>}
            </button>
            <button onClick={() => setBuilderOpen(false)} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, borderRadius: 8, color: T.textMuted, cursor: 'pointer' }}>
              <X size={15} />
            </button>
          </div>

          {/* Variables bar */}
          <div style={{ padding: '8px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: 'rgba(0,0,0,0.20)', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: T.textMuted, marginRight: 4, fontWeight: 600 }}>Variables:</span>
            {VARIABLES.map(v => (
              <button key={v} className="aw-lp-chip" onClick={() => copyVar(v)}>
                {copiedVar === v ? <><Check size={10} /> Copied!</> : <><Copy size={10} /> {v}</>}
              </button>
            ))}
          </div>

          {/* Redirect URL bar */}
          <div style={{ padding: '8px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.10)', flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>Redirect after submit:</span>
            <input
              className="aw-lp-input"
              value={form.redirect_url}
              onChange={e => setForm(f => ({ ...f, redirect_url: e.target.value }))}
              placeholder="https://your-company.com (leave blank to show awareness page)"
              style={{ padding: '6px 12px', fontSize: 12, maxWidth: 400 }}
            />
          </div>

          {/* Code + Preview split */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Code Editor */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: showPreview ? `1px solid ${T.borderFaint}` : 'none', overflow: 'hidden' }}>
              <div style={{ padding: '6px 16px', borderBottom: `1px solid ${T.borderFaint}`, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Code size={12} style={{ color: T.textMuted }} />
                <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>HTML / CSS / JavaScript</span>
              </div>
              <textarea
                className="aw-lp-code"
                value={form.html_content}
                onChange={e => setForm(f => ({ ...f, html_content: e.target.value }))}
                spellCheck={false}
              />
            </div>

            {/* Live Preview */}
            {showPreview && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '6px 16px', borderBottom: `1px solid ${T.borderFaint}`, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Eye size={12} style={{ color: T.textMuted }} />
                  <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>Live Preview</span>
                </div>
                <iframe
                  srcDoc={previewHtml}
                  title="Landing Page Preview"
                  sandbox="allow-scripts"
                  style={{ flex: 1, border: 'none', background: '#fff' }}
                />
              </div>
            )}
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
                <div style={{ width: 32, height: 32, borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={14} style={{ color: T.red }} /></div>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>Delete Landing Page</h2>
              </div>
              <p style={{ fontSize: 13, color: T.textBody, margin: '0 0 18px' }}>This will permanently delete the landing page. This action cannot be undone.</p>
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
