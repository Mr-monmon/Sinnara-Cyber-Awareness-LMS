import React, { useState, useEffect, useRef } from "react";
import {
  Mail, Plus, Edit2, Trash2, X, Check, Loader2, AlertCircle,
  Copy, Code, Eye, Type
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
  .aw-et-input {
    width: 100%; padding: 10px 14px; box-sizing: border-box;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 13px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .aw-et-input:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-et-input::placeholder { color: rgba(148,163,184,0.40); }
  .aw-et-code {
    width: 100%; height: 100%; padding: 14px; box-sizing: border-box;
    background: #0a0c06; border: none; outline: none; resize: none;
    font-size: 13px; color: #e2e8f0; font-family: 'JetBrains Mono', 'Fira Code', monospace;
    line-height: 1.6;
  }
  .aw-et-tab {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.03); cursor: pointer;
    font-size: 12px; font-weight: 700; font-family: 'Inter', sans-serif;
    color: #64748b; transition: all 0.18s;
  }
  .aw-et-tab:hover { background: rgba(255,255,255,0.06); color: #cbd5e1; }
  .aw-et-tab.active { background: rgba(200,255,0,0.10); border-color: rgba(200,255,0,0.28); color: #c8ff00; }
  .aw-et-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 9px; border-radius: 6px;
    background: rgba(167,139,250,0.10); border: 1px solid rgba(167,139,250,0.25);
    color: #a78bfa; font-size: 11px; font-weight: 600; font-family: monospace;
    cursor: pointer; transition: background 0.18s;
  }
  .aw-et-chip:hover { background: rgba(167,139,250,0.20); }
  /* Quill overrides */
  .aw-et-quill-wrap .ql-toolbar { background: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.09) !important; border-radius: 10px 10px 0 0; }
  .aw-et-quill-wrap .ql-container { background: rgba(255,255,255,0.03) !important; border-color: rgba(255,255,255,0.09) !important; border-radius: 0 0 10px 10px; min-height: 300px; }
  .aw-et-quill-wrap .ql-editor { color: #e2e8f0 !important; font-family: 'Inter', sans-serif; font-size: 14px; min-height: 280px; }
  .aw-et-quill-wrap .ql-stroke { stroke: #94a3b8 !important; }
  .aw-et-quill-wrap .ql-fill { fill: #94a3b8 !important; }
  .aw-et-quill-wrap .ql-picker { color: #94a3b8 !important; }
  .aw-et-quill-wrap .ql-picker-options { background: #1a1e0e !important; border-color: rgba(255,255,255,0.09) !important; }
  @keyframes aw-spin { to { transform: rotate(360deg); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-et-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-et-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

interface EmailTemplate {
  id: string;
  company_id: string;
  name: string;
  subject: string;
  html_content: string;
  text_content: string;
  envelope_sender: string;
  created_at: string;
  updated_at: string;
}

const VARIABLES = [
  '{{.FirstName}}', '{{.LastName}}', '{{.Email}}', '{{.Position}}',
  '{{.Department}}', '{{.Company}}', '{{.URL}}', '{{.TrackingURL}}',
  '{{.Date}}', '{{.RId}}',
];

const TEMPLATE_HTML = `<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 20px; }
    .container { background: #fff; border-radius: 8px; max-width: 600px; margin: 0 auto; padding: 32px; }
    h2 { color: #1a1a1a; margin-bottom: 12px; }
    p { color: #444; line-height: 1.6; }
    .btn { display: inline-block; padding: 12px 28px; background: #0073e6; color: #fff; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Action Required: Verify Your Account</h2>
    <p>Hello {{.FirstName}},</p>
    <p>We've detected unusual activity on your account. Please verify your credentials to continue.</p>
    <p>
      <a href="{{.URL}}" class="btn">Verify Now</a>
    </p>
    <p style="color:#999;font-size:12px;margin-top:24px;">
      This email was sent to {{.Email}}. If you believe this is an error, please contact support.
    </p>
  </div>
  <img src="{{.TrackingURL}}" width="1" height="1" style="display:none" />
</body>
</html>`;

type EditorTab = 'visual' | 'html' | 'text';

export const PhishingEmailTemplatesPage: React.FC = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState({
    name: '',
    subject: '',
    envelope_sender: '',
    html_content: TEMPLATE_HTML,
    text_content: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>('visual');
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const quillRef = useRef<any>(null);
  const quillContainerRef = useRef<HTMLDivElement>(null);
  const quillInitialized = useRef(false);

  useEffect(() => { if (user?.company_id) loadTemplates(); }, [user]);

  // Initialize Quill when modal opens on visual tab
  useEffect(() => {
    if (!modalOpen || editorTab !== 'visual') return;
    const timer = setTimeout(() => initQuill(), 100);
    return () => clearTimeout(timer);
  }, [modalOpen, editorTab]);

  const initQuill = async () => {
    if (!quillContainerRef.current || quillInitialized.current) return;
    try {
      const Quill = (await import('quill')).default;
      // Load snow CSS
      if (!document.getElementById('quill-snow-css')) {
        const link = document.createElement('link');
        link.id = 'quill-snow-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.quilljs.com/1.3.7/quill.snow.css';
        document.head.appendChild(link);
      }
      quillRef.current = new Quill(quillContainerRef.current, {
        theme: 'snow',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['link', 'image', 'clean'],
          ],
        },
      });
      // Set initial content
      quillRef.current.root.innerHTML = form.html_content;
      quillInitialized.current = true;
    } catch (err) { console.error('Quill init error:', err); }
  };

  const syncFromQuill = () => {
    if (quillRef.current) {
      const html = quillRef.current.root.innerHTML;
      setForm(f => ({ ...f, html_content: html }));
    }
  };

  const handleTabSwitch = (tab: EditorTab) => {
    if (editorTab === 'visual') syncFromQuill();
    setEditorTab(tab);
    if (tab === 'visual') {
      quillInitialized.current = false;
    }
  };

  const loadTemplates = async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('phishing_company_email_templates').select('*').eq('company_id', user.company_id).order('created_at', { ascending: false });
      setTemplates(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditTemplate(null);
    setForm({ name: '', subject: '', envelope_sender: '', html_content: TEMPLATE_HTML, text_content: '' });
    setEditorTab('visual');
    quillInitialized.current = false;
    setModalOpen(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditTemplate(t);
    setForm({ name: t.name, subject: t.subject, envelope_sender: t.envelope_sender || '', html_content: t.html_content, text_content: t.text_content || '' });
    setEditorTab('visual');
    quillInitialized.current = false;
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    quillRef.current = null;
    quillInitialized.current = false;
  };

  const save = async () => {
    if (editorTab === 'visual') syncFromQuill();
    if (!form.name.trim() || !form.subject.trim()) { alert('Name and Subject are required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, company_id: user?.company_id, updated_at: new Date().toISOString() };
      if (editTemplate) {
        await supabase.from('phishing_company_email_templates').update(payload).eq('id', editTemplate.id);
      } else {
        await supabase.from('phishing_company_email_templates').insert(payload);
      }
      closeModal();
      loadTemplates();
    } catch (err: any) { alert(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await supabase.from('phishing_company_email_templates').delete().eq('id', deleteId);
      setDeleteId(null);
      loadTemplates();
    } catch (err: any) { alert(err.message || 'Failed to delete'); }
    finally { setDeleting(false); }
  };

  const copyVar = (v: string) => {
    navigator.clipboard.writeText(v).catch(() => {});
    setCopiedVar(v);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={18} style={{ color: T.purple }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Email Templates</h1>
            <p style={{ fontSize: 13, color: T.textBody, margin: 0 }}>Build phishing simulation email templates.</p>
          </div>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.accent, color: T.accentDark, fontWeight: 700, borderRadius: 10, padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 13 }}>
          <Plus size={15} /> New Template
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
        </div>
      ) : templates.length === 0 ? (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '60px 20px', textAlign: 'center' }}>
          <Mail size={36} style={{ color: 'rgba(255,255,255,0.08)', marginBottom: 12 }} />
          <p style={{ color: T.textMuted, fontSize: 14, margin: 0 }}>No email templates yet. Create one to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {templates.map(t => (
            <div key={t.id} className="aw-fade-up" style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ height: 3, background: `linear-gradient(90deg, ${T.purple}, ${T.purple}40)` }} />
              <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.white, marginBottom: 4 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Subject: {t.subject}
                    </div>
                    {t.envelope_sender && (
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        From: {t.envelope_sender}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => openEdit(t)} style={{ width: 28, height: 28, borderRadius: 7, background: T.blueBg, border: `1px solid ${T.blueBorder}`, color: T.blue, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => setDeleteId(t.id)} style={{ width: 28, height: 28, borderRadius: 7, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: T.textMuted }}>{new Date(t.created_at).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={closeModal}>
          <div className="aw-modal-in"
            style={{ width: '100%', maxWidth: 820, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.purple}, ${T.purple}40)` }} />

            {/* Modal Header */}
            <div style={{ padding: '14px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={13} style={{ color: T.purple }} />
                </div>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>{editTemplate ? 'Edit Email Template' : 'New Email Template'}</h2>
              </div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {/* Form Fields */}
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flexShrink: 0 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 5 }}>Template Name *</label>
                <input className="aw-et-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. IT Security Alert" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 5 }}>Envelope Sender</label>
                <input className="aw-et-input" value={form.envelope_sender} onChange={e => setForm(f => ({ ...f, envelope_sender: e.target.value }))} placeholder="IT Support <support@company.com>" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 5 }}>Subject *</label>
                <input className="aw-et-input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Action Required: Verify your account" />
              </div>
            </div>

            {/* Variables */}
            <div style={{ padding: '8px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: T.textMuted, marginRight: 4, fontWeight: 600 }}>Variables:</span>
              {VARIABLES.map(v => (
                <button key={v} className="aw-et-chip" onClick={() => copyVar(v)}>
                  {copiedVar === v ? <><Check size={10} /> Copied!</> : <><Copy size={10} /> {v}</>}
                </button>
              ))}
            </div>

            {/* Editor Tabs */}
            <div style={{ padding: '10px 22px 0', display: 'flex', gap: 6, flexShrink: 0 }}>
              {([
                { key: 'visual' as EditorTab, icon: Type, label: 'Visual' },
                { key: 'html' as EditorTab, icon: Code, label: 'HTML' },
                { key: 'text' as EditorTab, icon: Eye, label: 'Plain Text' },
              ]).map(tab => (
                <button key={tab.key} className={`aw-et-tab ${editorTab === tab.key ? 'active' : ''}`} onClick={() => handleTabSwitch(tab.key)}>
                  <tab.icon size={11} /> {tab.label}
                </button>
              ))}
            </div>

            {/* Editor Body */}
            <div style={{ flex: 1, padding: '12px 22px', overflowY: 'auto', minHeight: 0 }}>
              {editorTab === 'visual' && (
                <div className="aw-et-quill-wrap">
                  <div ref={quillContainerRef} style={{ minHeight: 300 }} />
                </div>
              )}
              {editorTab === 'html' && (
                <div style={{ background: '#0a0c06', borderRadius: 10, border: `1px solid ${T.borderFaint}`, overflow: 'hidden', height: 360 }}>
                  <textarea
                    className="aw-et-code"
                    value={form.html_content}
                    onChange={e => setForm(f => ({ ...f, html_content: e.target.value }))}
                    spellCheck={false}
                  />
                </div>
              )}
              {editorTab === 'text' && (
                <div>
                  <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>Plain text version for email clients that don't support HTML.</p>
                  <textarea
                    className="aw-et-input"
                    value={form.text_content}
                    onChange={e => setForm(f => ({ ...f, text_content: e.target.value }))}
                    placeholder={`Hello {{.FirstName}},\n\nPlease verify your account at: {{.URL}}\n\nThank you`}
                    rows={14}
                    style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10, flexShrink: 0 }}>
              <button onClick={closeModal} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textBody, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 10, background: T.accent, color: T.accentDark, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</> : <><Check size={14} /> Save Template</>}
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
                <div style={{ width: 32, height: 32, borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={14} style={{ color: T.red }} /></div>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>Delete Template</h2>
              </div>
              <p style={{ fontSize: 13, color: T.textBody, margin: '0 0 18px' }}>This will permanently delete the email template.</p>
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
