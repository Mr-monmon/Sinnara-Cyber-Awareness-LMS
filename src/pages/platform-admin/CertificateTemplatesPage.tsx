import React, { useState, useEffect } from 'react';
import { Award, Plus, Edit2, Trash2, Eye, X, Save, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CertificateTemplate } from '../../lib/types';

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
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
  red:         '#f87171',
  redBg:       'rgba(248,113,113,0.08)',
  redBorder:   'rgba(248,113,113,0.22)',
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
  goldBorder:  'rgba(251,191,36,0.22)',
} as const;

/* ─────────────────────────────────────────
   CSS — id = "aw-ctp-styles" (unique)
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-ctp-card {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; overflow: hidden;
    font-family: 'Inter', sans-serif;
    display: flex; flex-direction: column;
    transition: border-color 0.2s, transform 0.18s;
  }
  .aw-ctp-card:hover { border-color: rgba(251,191,36,0.30); transform: translateY(-1px); }

  .aw-ctp-icon-btn {
    width: 30px; height: 30px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid transparent; cursor: pointer;
    transition: all 0.18s; background: none; flex-shrink: 0;
  }
  .aw-ctp-icon-btn.preview { color: #64748b; border-color: rgba(255,255,255,0.09); background: rgba(255,255,255,0.04); }
  .aw-ctp-icon-btn.preview:hover { color: #fbbf24; border-color: rgba(251,191,36,0.28); background: rgba(251,191,36,0.08); }
  .aw-ctp-icon-btn.edit    { color: #60a5fa; border-color: rgba(96,165,250,0.22); background: rgba(96,165,250,0.08); }
  .aw-ctp-icon-btn.edit:hover    { background: rgba(96,165,250,0.18); }
  .aw-ctp-icon-btn.del     { color: #f87171; border-color: rgba(248,113,113,0.22); background: rgba(248,113,113,0.07); }
  .aw-ctp-icon-btn.del:hover     { background: rgba(248,113,113,0.16); }

  /* ── Form inputs ── */
  .aw-ctp-input, .aw-ctp-textarea {
    width: 100%; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-ctp-input   { padding: 11px 14px; }
  .aw-ctp-textarea { padding: 11px 14px; resize: vertical; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  .aw-ctp-input:focus, .aw-ctp-textarea:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-ctp-input::placeholder { color: rgba(148,163,184,0.35); }

  .aw-ctp-label {
    display: block; font-size: 12px; font-weight: 600; color: #94a3b8;
    margin-bottom: 7px; letter-spacing: 0.3px; font-family: 'Inter', sans-serif;
  }

  /* ── Buttons ── */
  .aw-ctp-save-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 20px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 18px rgba(200,255,0,0.20); transition: opacity 0.2s, transform 0.15s;
  }
  .aw-ctp-save-btn:hover { opacity: 0.88; transform: translateY(-1px); }
  .aw-ctp-save-btn:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }
  .aw-ctp-cancel-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 12px 20px; border-radius: 10px; cursor: pointer;
    font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-ctp-cancel-btn:hover { background: rgba(255,255,255,0.08); color: #ffffff; }

  /* ── Scrollbar ── */
  .aw-ctp-scroll::-webkit-scrollbar { width: 4px; }
  .aw-ctp-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-ctp-scroll::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-fade-up  { animation: aw-fade-up  0.4s ease both; }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-ctp-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-ctp-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   DEFAULT TEMPLATE & HELPERS (unchanged)
───────────────────────────────────────── */
const DEFAULT_TEMPLATE = `
<div style="width: 800px; height: 600px; padding: 60px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-family: 'Arial', sans-serif; position: relative; border: 10px solid gold;">
  <div style="background: rgba(255,255,255,0.1); padding: 40px; border-radius: 20px; height: 100%;">
    <h1 style="font-size: 48px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 3px;">شهادة إتمام</h1>
    <div style="width: 100px; height: 4px; background: gold; margin: 0 auto 30px;"></div>
    <p style="font-size: 18px; margin-bottom: 40px;">هذه الشهادة تمنح لـ</p>
    <h2 style="font-size: 42px; margin-bottom: 40px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">{{employee_name}}</h2>
    <p style="font-size: 18px; margin-bottom: 20px;">لإتمامه بنجاح دورة</p>
    <h3 style="font-size: 32px; margin-bottom: 40px; color: gold;">{{course_name}}</h3>
    <p style="font-size: 16px; margin-bottom: 10px;">بدرجة: <strong>{{score}}%</strong></p>
    <p style="font-size: 16px; margin-top: 60px;">تاريخ الإصدار: {{completion_date}}</p>
  </div>
</div>
`;

const buildPreviewDocument = (content: string) => `
<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"/><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;}body{display:inline-block;}</style></head>
<body>${content}</body></html>`;

const getPreviewHtml = (html: string) =>
  html
    .replace(/\{\{employee_name\}\}/g, 'أحمد محمد')
    .replace(/\{\{course_name\}\}/g, 'اسم الدورة')
    .replace(/\{\{completion_date\}\}/g, new Date().toLocaleDateString('ar'))
    .replace(/\{\{score\}\}/g, '95');

const defaultForm = {
  name: '', template_html: DEFAULT_TEMPLATE,
  background_image_url: '', logo_url: '', signature_image_url: '',
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const CertificateTemplatesPage: React.FC = () => {
  const { user }   = useAuth();
  const [templates, setTemplates]           = useState<CertificateTemplate[]>([]);
  const [showModal, setShowModal]           = useState(false);
  const [showPreview, setShowPreview]       = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CertificateTemplate | null>(null);
  const [form, setForm]                     = useState({ ...defaultForm });
  const [saving, setSaving]                 = useState(false);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    const { data } = await supabase.from('certificate_templates').select('*').order('created_at', { ascending: false });
    if (data) setTemplates(data);
  };

  const resetForm = () => setForm({ ...defaultForm });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, created_by: user?.id };
      if (selectedTemplate) {
        await supabase.from('certificate_templates').update(payload).eq('id', selectedTemplate.id);
      } else {
        await supabase.from('certificate_templates').insert(payload);
      }
      setShowModal(false); setSelectedTemplate(null); resetForm();
      await loadTemplates();
    } catch { alert('فشل حفظ القالب'); }
    finally { setSaving(false); }
  };

  const handleEdit = (t: CertificateTemplate) => {
    setSelectedTemplate(t);
    setForm({ name: t.name, template_html: t.template_html, background_image_url: t.background_image_url || '', logo_url: t.logo_url || '', signature_image_url: t.signature_image_url || '' });
    setShowModal(true);
  };

  const handlePreview = (t: CertificateTemplate) => {
    setSelectedTemplate(t);
    setForm({ name: t.name, template_html: t.template_html, background_image_url: t.background_image_url || '', logo_url: t.logo_url || '', signature_image_url: t.signature_image_url || '' });
    setShowPreview(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا القالب؟')) return;
    await supabase.from('certificate_templates').delete().eq('id', id);
    await loadTemplates();
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: T.goldBg, border: `1px solid ${T.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={18} style={{ color: T.gold }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Certificate Templates</h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>Customize the design of certificates issued to employees.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ padding: '7px 14px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 9, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: T.gold }}>{templates.length}</span>
            <span style={{ fontSize: 11, color: T.textMuted }}>templates</span>
          </div>
          <button
            onClick={() => { setSelectedTemplate(null); resetForm(); setShowModal(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: T.accent, color: T.accentDark, boxShadow: '0 0 18px rgba(200,255,0,0.20)' }}>
            <Plus size={14} /> New Template
          </button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: T.goldBg, border: `1px solid ${T.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Award size={26} style={{ color: T.textMuted }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: T.textBody, margin: '0 0 6px' }}>No templates yet</p>
          <p style={{ fontSize: 13, color: T.textMuted, margin: '0 0 20px' }}>Create your first certificate template.</p>
          <button onClick={() => { resetForm(); setShowModal(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: T.accent, color: T.accentDark }}>
            <Plus size={14} /> New Template
          </button>
        </div>
      ) : (
        /* ── Grid ── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {templates.map((t, idx) => (
            <div key={t.id} className={`aw-ctp-card aw-fade-up`} style={{ animationDelay: `${idx * 0.05}s` }}>
              {/* Gold top bar */}
              <div style={{ height: 3, background: `linear-gradient(90deg, ${T.gold}, ${T.gold}40)` }} />

              {/* Card header */}
              <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 13, borderBottom: `1px solid ${T.borderFaint}` }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: T.goldBg, border: `1px solid ${T.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Award size={18} style={{ color: T.gold }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: T.white, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.name}
                  </h3>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>Certificate Template</p>
                </div>
              </div>

              {/* Preview thumbnail */}
              <div style={{ padding: '14px 16px', flex: 1 }}>
                <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.borderFaint}`, background: '#fff', height: 130, position: 'relative' }}>
                  <iframe
                    title={`${t.name} preview`}
                    srcDoc={buildPreviewDocument(
                      t.template_html
                        .replace(/\{\{employee_name\}\}/g, 'اسم الموظف')
                        .replace(/\{\{course_name\}\}/g, 'اسم الدورة')
                        .replace(/\{\{completion_date\}\}/g, 'التاريخ')
                        .replace(/\{\{score\}\}/g, '95')
                    )}
                    sandbox=""
                    style={{ width: '800px', height: '600px', border: '0', display: 'block', pointerEvents: 'none', transform: 'scale(0.21)', transformOrigin: 'top left' }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 7 }}>
                {/* Preview button */}
                <button
                  className="aw-ctp-icon-btn preview"
                  style={{ flex: 1, width: 'auto', gap: 6, fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}
                  title="Preview" onClick={() => handlePreview(t)}>
                  <Eye size={13} /> Preview
                </button>
                <button className="aw-ctp-icon-btn edit"    title="Edit"   onClick={() => handleEdit(t)}><Edit2 size={13} /></button>
                <button className="aw-ctp-icon-btn del"     title="Delete" onClick={() => handleDelete(t.id)}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════ EDIT / CREATE MODAL ═══════════ */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.86)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => { setShowModal(false); setSelectedTemplate(null); }}>
          <div className="aw-modal-in"
            style={{ width: '100%', maxWidth: 860, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 18, overflow: 'hidden', maxHeight: '94vh', boxShadow: '0 40px 100px rgba(0,0,0,0.65)', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.gold}, ${T.gold}40)` }} />

            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: T.goldBg, border: `1px solid ${T.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Award size={16} style={{ color: T.gold }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 900, color: T.white, margin: 0 }}>
                    {selectedTemplate ? 'Edit Template' : 'New Certificate Template'}
                  </h2>
                  <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>Use {'{{employee_name}}'}, {'{{course_name}}'}, {'{{score}}'}, {'{{completion_date}}'}</p>
                </div>
              </div>
              <button onClick={() => { setShowModal(false); setSelectedTemplate(null); }}
                style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>

            {/* Two-column body */}
            <form onSubmit={handleSubmit} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                {/* LEFT: Inputs */}
                <div style={{ borderRight: `1px solid ${T.borderFaint}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.borderFaint}`, fontSize: 12, fontWeight: 700, color: T.textMuted, flexShrink: 0 }}>
                    Template Settings
                  </div>
                  <div className="aw-ctp-scroll" style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                    <div>
                      <label className="aw-ctp-label">Template Name <span style={{ color: T.accent }}>*</span></label>
                      <input className="aw-ctp-input" type="text" required placeholder="e.g. Course Completion Certificate"
                        value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                    </div>

                    <div>
                      <label className="aw-ctp-label">Certificate HTML <span style={{ color: T.accent }}>*</span></label>
                      <textarea className="aw-ctp-textarea" rows={14} required
                        value={form.template_html} onChange={e => setForm(p => ({ ...p, template_html: e.target.value }))} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label className="aw-ctp-label">Background URL <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                        <input className="aw-ctp-input" type="url" placeholder="https://..." value={form.background_image_url} onChange={e => setForm(p => ({ ...p, background_image_url: e.target.value }))} />
                      </div>
                      <div>
                        <label className="aw-ctp-label">Logo URL <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                        <input className="aw-ctp-input" type="url" placeholder="https://..." value={form.logo_url} onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="aw-ctp-label">Signature Image URL <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                      <input className="aw-ctp-input" type="url" placeholder="https://..." value={form.signature_image_url} onChange={e => setForm(p => ({ ...p, signature_image_url: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* RIGHT: Live preview */}
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.borderFaint}`, fontSize: 12, fontWeight: 700, color: T.textMuted, flexShrink: 0 }}>
                    Live Preview
                  </div>
                  <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
                    <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.borderFaint}`, background: '#fff', flex: 1, position: 'relative', minHeight: 0 }}>
                      <iframe
                        title="Certificate editor preview"
                        srcDoc={buildPreviewDocument(getPreviewHtml(form.template_html))}
                        sandbox=""
                        style={{ width: '800px', height: '600px', border: '0', display: 'block', pointerEvents: 'none', transform: 'scale(0.48)', transformOrigin: 'top left' }}
                      />
                    </div>
                    <div style={{ padding: '10px 14px', background: T.goldBg, border: `1px solid ${T.goldBorder}`, borderRadius: 9, fontSize: 12, color: T.gold }}>
                      💡 Variables shown with sample values: <strong>أحمد محمد</strong>, <strong>اسم الدورة</strong>, <strong>95%</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 24px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10, flexShrink: 0, background: T.bgCard }}>
                <button type="button" className="aw-ctp-cancel-btn" onClick={() => { setShowModal(false); setSelectedTemplate(null); }}>Cancel</button>
                <button type="submit" className="aw-ctp-save-btn" disabled={saving}>
                  {saving
                    ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</>
                    : <><Save size={14} /> {selectedTemplate ? 'Update Template' : 'Save Template'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════ FULL PREVIEW MODAL ═══════════ */}
      {showPreview && selectedTemplate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.92)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={() => setShowPreview(false)}>
          <div className="aw-modal-in"
            style={{ width: '100%', maxWidth: 900, background: T.bgCard, border: `1px solid ${T.goldBorder}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.70)', fontFamily: "'Inter', sans-serif" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.gold}, ${T.gold}40)` }} />

            {/* Preview header */}
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Eye size={16} style={{ color: T.gold }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: T.white }}>Preview — {selectedTemplate.name}</span>
              </div>
              <button onClick={() => setShowPreview(false)}
                style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>

            {/* Certificate preview */}
            <div style={{ padding: '24px', background: 'rgba(0,0,0,0.20)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflowX: 'auto' }}>
              <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.50)' }}>
                <iframe
                  title="Certificate full preview"
                  srcDoc={buildPreviewDocument(getPreviewHtml(form.template_html))}
                  sandbox=""
                  style={{ width: '800px', height: '600px', border: '0', display: 'block' }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: `1px solid ${T.borderFaint}`, textAlign: 'center' }}>
              <button onClick={() => setShowPreview(false)} className="aw-ctp-cancel-btn">Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
