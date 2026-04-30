import React, { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Mail, Eye,
  CheckCircle, XCircle, X, Save, Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface PhishingTemplate {
  id: string; name: string; description: string | null;
  subject: string; html_content: string;
  category: string; difficulty_level: string;
  language: string; is_active: boolean; created_at: string;
}

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
  orange:      '#fb923c',
  orangeBg:    'rgba(251,146,60,0.08)',
  orangeBorder:'rgba(251,146,60,0.22)',
  red:         '#f87171',
  redBg:       'rgba(248,113,113,0.08)',
  redBorder:   'rgba(248,113,113,0.22)',
  purple:      '#a78bfa',
  purpleBg:    'rgba(167,139,250,0.08)',
  purpleBorder:'rgba(167,139,250,0.22)',
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
  goldBorder:  'rgba(251,191,36,0.22)',
} as const;

/* ─────────────────────────────────────────
   BADGE CONFIGS
───────────────────────────────────────── */
const DIFFICULTY_CFG: Record<string, { color: string; bg: string; border: string }> = {
  EASY:   { color: T.green,  bg: T.greenBg,  border: T.greenBorder  },
  MEDIUM: { color: T.gold,   bg: T.goldBg,   border: T.goldBorder   },
  HARD:   { color: T.red,    bg: T.redBg,    border: T.redBorder    },
};
const CATEGORY_CFG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  GENERAL:            { color: T.blue,   bg: T.blueBg,   border: T.blueBorder,   label: 'General'           },
  SPEAR_PHISHING:     { color: T.purple, bg: T.purpleBg, border: T.purpleBorder, label: 'Spear Phishing'    },
  CREDENTIAL_HARVEST: { color: T.orange, bg: T.orangeBg, border: T.orangeBorder, label: 'Credential Harvest'},
  MALWARE:            { color: T.red,    bg: T.redBg,    border: T.redBorder,    label: 'Malware'           },
};
const getDiff    = (d: string) => DIFFICULTY_CFG[d]  ?? DIFFICULTY_CFG['MEDIUM'];
const getCategory = (c: string) => CATEGORY_CFG[c]  ?? CATEGORY_CFG['GENERAL'];

/* ─────────────────────────────────────────
   CSS — id = "aw-ptp-styles" (unique)
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-ptp-card {
    background: #1a1e0e; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; overflow: hidden; font-family: 'Inter', sans-serif;
    display: flex; flex-direction: column;
    transition: border-color 0.2s, transform 0.18s;
  }
  .aw-ptp-card:hover { border-color: rgba(255,255,255,0.14); transform: translateY(-1px); }

  .aw-ptp-icon-btn {
    width: 30px; height: 30px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid transparent; cursor: pointer;
    transition: all 0.18s; background: none; flex-shrink: 0;
  }
  .aw-ptp-icon-btn.edit { color: #60a5fa; border-color: rgba(96,165,250,0.22); background: rgba(96,165,250,0.08); }
  .aw-ptp-icon-btn.edit:hover { background: rgba(96,165,250,0.18); }
  .aw-ptp-icon-btn.del  { color: #f87171; border-color: rgba(248,113,113,0.22); background: rgba(248,113,113,0.07); }
  .aw-ptp-icon-btn.del:hover  { background: rgba(248,113,113,0.16); }

  .aw-ptp-preview-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 8px 10px; border-radius: 8px; cursor: pointer;
    font-size: 12px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-ptp-preview-btn:hover { background: rgba(255,255,255,0.08); color: #ffffff; }

  /* ── Form inputs ── */
  .aw-ptp-input, .aw-ptp-select, .aw-ptp-textarea {
    width: 100%; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 13px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-ptp-input   { padding: 10px 14px; }
  .aw-ptp-textarea { padding: 10px 14px; resize: vertical; }
  .aw-ptp-select  {
    padding: 10px 34px 10px 14px; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
  }
  .aw-ptp-input:focus, .aw-ptp-select:focus, .aw-ptp-textarea:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-ptp-input::placeholder, .aw-ptp-textarea::placeholder { color: rgba(148,163,184,0.35); }
  .aw-ptp-select option { background: #1a1e0e; color: #ffffff; }
  .aw-ptp-textarea.mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }

  .aw-ptp-label {
    display: block; font-size: 12px; font-weight: 600; color: #94a3b8;
    margin-bottom: 6px; letter-spacing: 0.3px; font-family: 'Inter', sans-serif;
  }

  /* ── Toggle ── */
  .aw-ptp-toggle-row {
    display: flex; align-items: center; gap: 10px; cursor: pointer;
    padding: 11px 14px; border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02);
    transition: all 0.18s; font-family: 'Inter', sans-serif;
  }
  .aw-ptp-toggle-row.on { background: rgba(52,211,153,0.06); border-color: rgba(52,211,153,0.22); }

  /* ── Buttons ── */
  .aw-ptp-save-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 24px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 18px rgba(200,255,0,0.20);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-ptp-save-btn:hover { opacity: 0.88; transform: translateY(-1px); }
  .aw-ptp-save-btn:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }
  .aw-ptp-cancel-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 12px 20px; border-radius: 10px; cursor: pointer;
    font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-ptp-cancel-btn:hover { background: rgba(255,255,255,0.08); color: #ffffff; }

  /* ── Scrollbar ── */
  .aw-ptp-scroll::-webkit-scrollbar { width: 4px; }
  .aw-ptp-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-ptp-scroll::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-fade-up  { animation: aw-fade-up  0.4s ease both; }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-ptp-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-ptp-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   DEFAULT FORM
───────────────────────────────────────── */
const defaultForm = {
  name: '', description: '', subject: '', html_content: '',
  category: 'GENERAL', difficulty_level: 'MEDIUM',
  language: 'en', is_active: true,
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const PhishingTemplatesPage: React.FC = () => {
  const { user }   = useAuth();
  const [templates, setTemplates]           = useState<PhishingTemplate[]>([]);
  const [loading, setLoading]               = useState(true);
  const [showModal, setShowModal]           = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PhishingTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<PhishingTemplate | null>(null);
  const [form, setForm]                     = useState({ ...defaultForm });
  const [saving, setSaving]                 = useState(false);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase.from('phishing_templates').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setTemplates(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const resetForm = () => { setForm({ ...defaultForm }); setEditingTemplate(null); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingTemplate) {
        const { error } = await supabase.from('phishing_templates').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('phishing_templates').insert([{ ...form, created_by: user?.id }]);
        if (error) throw error;
      }
      setShowModal(false); resetForm(); await loadTemplates();
    } catch (err) { alert('Failed to save template: ' + (err as any).message); }
    finally { setSaving(false); }
  };

  const handleEdit = (t: PhishingTemplate) => {
    setEditingTemplate(t);
    setForm({ name: t.name, description: t.description || '', subject: t.subject, html_content: t.html_content, category: t.category, difficulty_level: t.difficulty_level, language: t.language, is_active: t.is_active });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    const { error } = await supabase.from('phishing_templates').delete().eq('id', id);
    if (error) { alert('Failed to delete template'); return; }
    await loadTemplates();
  };

  const toggleActive = async (t: PhishingTemplate) => {
    await supabase.from('phishing_templates').update({ is_active: !t.is_active }).eq('id', t.id);
    await loadTemplates();
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
    </div>
  );

  const activeCount   = templates.filter(t => t.is_active).length;
  const inactiveCount = templates.length - activeCount;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail size={18} style={{ color: T.orange }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Phishing Templates</h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>Manage email templates used in phishing simulation campaigns.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Quick stats */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ padding: '7px 13px', background: T.bgCard, border: `1px solid ${T.greenBorder}`, borderRadius: 9, display: 'flex', gap: 7, alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: T.green }}>{activeCount}</span>
              <span style={{ fontSize: 11, color: T.textMuted }}>active</span>
            </div>
            <div style={{ padding: '7px 13px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 9, display: 'flex', gap: 7, alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: T.textMuted }}>{inactiveCount}</span>
              <span style={{ fontSize: 11, color: T.textMuted }}>inactive</span>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: T.accent, color: T.accentDark, boxShadow: '0 0 18px rgba(200,255,0,0.20)' }}>
            <Plus size={14} /> Add Template
          </button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Mail size={26} style={{ color: T.textMuted }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: T.textBody, margin: '0 0 6px' }}>No templates yet</p>
          <p style={{ fontSize: 13, color: T.textMuted, margin: '0 0 20px' }}>Click "Add Template" to create your first phishing simulation template.</p>
          <button onClick={() => { resetForm(); setShowModal(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: T.accent, color: T.accentDark }}>
            <Plus size={14} /> Add Template
          </button>
        </div>
      ) : (
        /* ── Grid ── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
          {templates.map((t, idx) => {
            const diff = getDiff(t.difficulty_level);
            const cat  = getCategory(t.category);
            return (
              <div key={t.id} className={`aw-ptp-card aw-fade-up`} style={{ animationDelay: `${idx * 0.04}s` }}>
                {/* Top bar color by category */}
                <div style={{ height: 2, background: `linear-gradient(90deg, ${cat.color}, ${cat.color}40)` }} />

                <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: cat.bg, border: `1px solid ${cat.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Mail size={17} style={{ color: cat.color }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: T.white, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{t.name}</h3>
                        <span style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {t.language === 'ar' ? 'Arabic' : 'English'}
                        </span>
                      </div>
                    </div>

                    {/* Active toggle */}
                    <button onClick={() => toggleActive(t)} title={t.is_active ? 'Deactivate' : 'Activate'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
                      {t.is_active
                        ? <CheckCircle size={18} style={{ color: T.green }} />
                        : <XCircle    size={18} style={{ color: T.textMuted }} />
                      }
                    </button>
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: 12, color: T.textMuted, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '18px' }}>
                    {t.description || 'No description'}
                  </p>

                  {/* Subject */}
                  <div style={{ padding: '8px 11px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Subject</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.textBody, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 'auto' }}>
                    <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', background: cat.bg, border: `1px solid ${cat.border}`, color: cat.color }}>
                      {cat.label}
                    </span>
                    <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', background: diff.bg, border: `1px solid ${diff.border}`, color: diff.color }}>
                      {t.difficulty_level}
                    </span>
                    {!t.is_active && (
                      <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textMuted }}>
                        INACTIVE
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions footer */}
                <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 7 }}>
                  <button className="aw-ptp-preview-btn" onClick={() => setPreviewTemplate(t)}>
                    <Eye size={13} /> Preview
                  </button>
                  <button className="aw-ptp-icon-btn edit" title="Edit"   onClick={() => handleEdit(t)}><Edit2 size={13} /></button>
                  <button className="aw-ptp-icon-btn del"  title="Delete" onClick={() => handleDelete(t.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════ CREATE / EDIT MODAL ═══════════ */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.86)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="aw-modal-in aw-ptp-scroll"
            style={{ width: '100%', maxWidth: 720, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 18, overflow: 'hidden', overflowY: 'auto', maxHeight: '94vh', boxShadow: '0 40px 100px rgba(0,0,0,0.65)', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: 'linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))' }} />

            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: T.bgCard, zIndex: 2, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={16} style={{ color: T.orange }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 900, color: T.white, margin: 0 }}>
                    {editingTemplate ? 'Edit Template' : 'Create New Template'}
                  </h2>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>Fill in the template details below</p>
                </div>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }}
                style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflowY: 'auto' }} className="aw-ptp-scroll">

              {/* Name + Category row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="aw-ptp-label">Template Name <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-ptp-input" type="text" required placeholder="e.g. IT Security Update"
                    value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="aw-ptp-label">Category <span style={{ color: T.accent }}>*</span></label>
                  <select className="aw-ptp-select" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    <option value="GENERAL">General</option>
                    <option value="SPEAR_PHISHING">Spear Phishing</option>
                    <option value="CREDENTIAL_HARVEST">Credential Harvest</option>
                    <option value="MALWARE">Malware</option>
                  </select>
                </div>
              </div>

              {/* Difficulty + Language */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="aw-ptp-label">Difficulty <span style={{ color: T.accent }}>*</span></label>
                  <select className="aw-ptp-select" value={form.difficulty_level} onChange={e => setForm(p => ({ ...p, difficulty_level: e.target.value }))}>
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="aw-ptp-label">Language <span style={{ color: T.accent }}>*</span></label>
                  <select className="aw-ptp-select" value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))}>
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="aw-ptp-label">Description <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                <textarea className="aw-ptp-textarea" rows={2} placeholder="Brief description of this template…"
                  value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>

              {/* Subject */}
              <div>
                <label className="aw-ptp-label">Email Subject <span style={{ color: T.accent }}>*</span></label>
                <input className="aw-ptp-input" type="text" required placeholder="e.g. Urgent: Security Update Required"
                  value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
              </div>

              {/* HTML Content */}
              <div>
                <label className="aw-ptp-label">HTML Content <span style={{ color: T.accent }}>*</span></label>
                <textarea className="aw-ptp-textarea mono" rows={12} required
                  placeholder={'<html>\n  <body>\n    Your email content here...\n  </body>\n</html>'}
                  value={form.html_content} onChange={e => setForm(p => ({ ...p, html_content: e.target.value }))} />
                <p style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>
                  Use variables like <code style={{ color: T.accent }}>&#123;username&#125;</code> for personalization.
                </p>
              </div>

              {/* Active toggle */}
              <div className={`aw-ptp-toggle-row ${form.is_active ? 'on' : ''}`}
                onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}>
                <div style={{ width: 36, height: 20, borderRadius: 9999, background: form.is_active ? T.green : 'rgba(255,255,255,0.10)', border: `1px solid ${form.is_active ? T.greenBorder : T.borderFaint}`, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: form.is_active ? T.accentDark : 'rgba(255,255,255,0.40)', position: 'absolute', top: 2, left: form.is_active ? 18 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.30)' }} />
                </div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: form.is_active ? T.green : T.textMuted }}>
                    {form.is_active ? 'Active — available for campaigns' : 'Inactive — hidden from campaigns'}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10, flexShrink: 0, background: T.bgCard }}>
              <button className="aw-ptp-cancel-btn" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
              <button className="aw-ptp-save-btn" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                {saving
                  ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</>
                  : <><Save size={14} /> {editingTemplate ? 'Update Template' : 'Create Template'}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ PREVIEW MODAL ═══════════ */}
      {previewTemplate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.90)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={() => setPreviewTemplate(null)}>
          <div className="aw-modal-in aw-ptp-scroll"
            style={{ width: '100%', maxWidth: 760, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 18, overflow: 'hidden', overflowY: 'auto', maxHeight: '92vh', boxShadow: '0 40px 100px rgba(0,0,0,0.65)', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.orange}, ${T.orange}40)` }} />

            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Eye size={16} style={{ color: T.orange }} />
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 900, color: T.white, margin: 0 }}>Template Preview</h2>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{previewTemplate.name}</p>
                </div>
              </div>
              <button onClick={() => setPreviewTemplate(null)}
                style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>

            {/* Subject badge */}
            <div style={{ padding: '12px 24px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>Subject:</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.textBody }}>{previewTemplate.subject}</span>
            </div>

            {/* Email preview */}
            <div style={{ padding: '20px 24px', flex: 1, overflow: 'hidden' }}>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.borderFaint}` }}>
                <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderBottom: `1px solid ${T.borderFaint}`, fontSize: 11, fontWeight: 700, color: T.textMuted, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Mail size={11} style={{ color: T.orange }} /> Email Content
                </div>
                <div style={{ padding: '20px', background: '#ffffff', maxHeight: 420, overflowY: 'auto', fontSize: 14, lineHeight: '1.6', color: '#1a1a1a' }} className="aw-ptp-scroll">
                  <div dangerouslySetInnerHTML={{ __html: previewTemplate.html_content }} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${T.borderFaint}`, flexShrink: 0 }}>
              <button className="aw-ptp-cancel-btn" style={{ width: '100%' }} onClick={() => setPreviewTemplate(null)}>Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
