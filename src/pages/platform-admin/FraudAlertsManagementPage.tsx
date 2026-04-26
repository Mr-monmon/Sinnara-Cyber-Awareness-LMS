import React, { useEffect, useState } from 'react';
import {
  Plus, Trash2, Eye, EyeOff, Edit2, AlertTriangle,
  Shield, X, Save, Loader2, Check, ChevronDown,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
  goldBorder:  'rgba(251,191,36,0.22)',
} as const;

/* ─────────────────────────────────────────
   SEVERITY CONFIG
───────────────────────────────────────── */
const SEV_CFG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  HIGH:   { color: T.red,    bg: T.redBg,    border: T.redBorder,    label: 'High'   },
  MEDIUM: { color: T.gold,   bg: T.goldBg,   border: T.goldBorder,   label: 'Medium' },
  LOW:    { color: T.blue,   bg: T.blueBg,   border: T.blueBorder,   label: 'Low'    },
};

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Form inputs ── */
  .aw-fa-input, .aw-fa-select, .aw-fa-textarea {
    width: 100%; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-fa-input   { padding: 11px 14px; }
  .aw-fa-textarea { padding: 11px 14px; resize: vertical; }
  .aw-fa-select  {
    padding: 11px 36px 11px 14px; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
  }
  .aw-fa-input:focus, .aw-fa-select:focus, .aw-fa-textarea:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-fa-input::placeholder, .aw-fa-textarea::placeholder { color: rgba(148,163,184,0.35); }
  .aw-fa-select option { background: #1a1e0e; color: #ffffff; }

  .aw-fa-label {
    display: block; font-size: 12px; font-weight: 600; color: #94a3b8;
    margin-bottom: 7px; letter-spacing: 0.3px; font-family: 'Inter', sans-serif;
  }

  /* ── List input row ── */
  .aw-fa-list-input {
    flex: 1; padding: 9px 13px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 9px; font-size: 13px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s;
  }
  .aw-fa-list-input:focus { border-color: rgba(200,255,0,0.38); }
  .aw-fa-list-input::placeholder { color: rgba(148,163,184,0.35); }

  /* ── Alert card ── */
  .aw-fa-card {
    background: #1a1e0e; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; overflow: hidden;
    transition: border-color 0.2s; font-family: 'Inter', sans-serif;
  }
  .aw-fa-card:hover { border-color: rgba(255,255,255,0.14); }

  /* ── Icon action btns ── */
  .aw-fa-icon-btn {
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid transparent; cursor: pointer;
    transition: all 0.18s; background: none;
  }
  .aw-fa-icon-btn.edit { color: #60a5fa; border-color: rgba(96,165,250,0.22); background: rgba(96,165,250,0.08); }
  .aw-fa-icon-btn.edit:hover { background: rgba(96,165,250,0.16); }
  .aw-fa-icon-btn.del  { color: #f87171; border-color: rgba(248,113,113,0.22); background: rgba(248,113,113,0.07); }
  .aw-fa-icon-btn.del:hover  { background: rgba(248,113,113,0.16); }

  /* ── Primary btn ── */
  .aw-fa-save-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 20px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 18px rgba(200,255,0,0.20);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-fa-save-btn:hover { opacity: 0.88; transform: translateY(-1px); }
  .aw-fa-save-btn:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }

  .aw-fa-cancel-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 12px 20px; border-radius: 10px; cursor: pointer;
    font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-fa-cancel-btn:hover { background: rgba(255,255,255,0.08); color: #ffffff; }

  /* ── Publish toggle ── */
  .aw-fa-toggle-row {
    display: flex; align-items: center; gap: 12px; cursor: pointer;
    padding: 12px 16px; border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
    transition: all 0.18s; font-family: 'Inter', sans-serif;
  }
  .aw-fa-toggle-row.on  { background: rgba(52,211,153,0.06); border-color: rgba(52,211,153,0.22); }

  /* ── Scrollbar ── */
  .aw-fa-scroll::-webkit-scrollbar { width: 3px; }
  .aw-fa-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-fa-scroll::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-fa-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-fa-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPE
───────────────────────────────────────── */
interface FraudAlert {
  id: string; title: string; fraud_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  public_summary: string; internal_content: string;
  video_url?: string; safety_tips: string[];
  internal_steps: string[]; is_published: boolean;
  created_at: string;
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' });

const EMPTY_FORM = {
  title: '', fraud_type: '', severity: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
  public_summary: '', internal_content: '', video_url: '',
  safety_tips: [''], internal_steps: [''], is_published: false,
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const FraudAlertsManagementPage: React.FC = () => {
  const { user }  = useAuth();
  const [alerts, setAlerts]     = useState<FraudAlert[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({ ...EMPTY_FORM });

  useEffect(() => { fetchAlerts(); }, []);

  const fetchAlerts = async () => {
    const { data, error } = await supabase.from('fraud_alerts').select('*').order('created_at', { ascending: false });
    if (!error && data) setAlerts(data);
    setLoading(false);
  };

  const resetForm = () => { setForm({ ...EMPTY_FORM }); setEditingId(null); };

  const openNew = () => { resetForm(); setShowForm(true); };

  const handleEdit = (alert: FraudAlert) => {
    setForm({
      title: alert.title, fraud_type: alert.fraud_type, severity: alert.severity,
      public_summary: alert.public_summary, internal_content: alert.internal_content,
      video_url: alert.video_url || '', safety_tips: alert.safety_tips?.length ? alert.safety_tips : [''],
      internal_steps: alert.internal_steps?.length ? alert.internal_steps : [''],
      is_published: alert.is_published,
    });
    setEditingId(alert.id); setShowForm(true);
    setTimeout(() => document.getElementById('aw-fa-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this fraud alert?')) return;
    await supabase.from('fraud_alerts').delete().eq('id', id);
    await fetchAlerts();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        safety_tips: form.safety_tips.filter(t => t.trim()),
        internal_steps: form.internal_steps.filter(s => s.trim()),
        created_by: user.id,
      };
      if (editingId) {
        await supabase.from('fraud_alerts').update(payload).eq('id', editingId);
      } else {
        await supabase.from('fraud_alerts').insert(payload);
      }
      await fetchAlerts();
      setShowForm(false); resetForm();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  /* Dynamic list helpers */
  const updateListItem = (field: 'safety_tips' | 'internal_steps', idx: number, val: string) => {
    const arr = [...form[field]]; arr[idx] = val;
    setForm(p => ({ ...p, [field]: arr }));
  };
  const addListItem    = (field: 'safety_tips' | 'internal_steps') => setForm(p => ({ ...p, [field]: [...p[field], ''] }));
  const removeListItem = (field: 'safety_tips' | 'internal_steps', idx: number) =>
    setForm(p => ({ ...p, [field]: p[field].filter((_, i) => i !== idx) }));

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: T.redBg, border: `1px solid ${T.redBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={18} style={{ color: T.red }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Fraud Alerts Management</h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>Create and manage fraud alerts visible across the platform.</p>
        </div>

        <button
          onClick={showForm && !editingId ? () => setShowForm(false) : openNew}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: T.accent, color: T.accentDark, boxShadow: '0 0 18px rgba(200,255,0,0.20)', transition: 'opacity 0.2s' }}
        >
          {showForm && !editingId ? <><X size={14} /> Cancel</> : <><Plus size={14} /> New Alert</>}
        </button>
      </div>

      {/* ── Form ── */}
      {showForm && (
        <div id="aw-fa-form" className="aw-fade-up" style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          {/* Form header */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))' }} />
          <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={15} style={{ color: T.red }} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>
              {editingId ? 'Edit Alert' : 'Create New Alert'}
            </h2>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Title */}
              <div>
                <label className="aw-fa-label">Alert Title <span style={{ color: T.accent }}>*</span></label>
                <input className="aw-fa-input" type="text" required placeholder="e.g. Phishing SMS Targeting Bank Customers" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>

              {/* Type + Severity */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="aw-fa-label">Fraud Type <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-fa-input" type="text" required placeholder="SMS, WhatsApp, Banking, Email…" value={form.fraud_type} onChange={e => setForm(p => ({ ...p, fraud_type: e.target.value }))} />
                </div>
                <div>
                  <label className="aw-fa-label">Severity <span style={{ color: T.accent }}>*</span></label>
                  <select className="aw-fa-select" value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value as any }))}>
                    <option value="LOW">🔵 Low Severity</option>
                    <option value="MEDIUM">🟡 Medium Severity</option>
                    <option value="HIGH">🔴 High Severity</option>
                  </select>
                </div>
              </div>

              {/* Public summary */}
              <div>
                <label className="aw-fa-label">Public Summary <span style={{ color: T.accent }}>*</span> <span style={{ color: T.textMuted, fontWeight: 400 }}>(shown to everyone)</span></label>
                <textarea className="aw-fa-textarea" required rows={3} placeholder="Brief description visible to the public…" value={form.public_summary} onChange={e => setForm(p => ({ ...p, public_summary: e.target.value }))} />
              </div>

              {/* Internal content */}
              <div>
                <label className="aw-fa-label">Internal Content <span style={{ color: T.accent }}>*</span> <span style={{ color: T.textMuted, fontWeight: 400 }}>(full details for employees)</span></label>
                <textarea className="aw-fa-textarea" required rows={5} placeholder="Detailed information, context, and background for employees…" value={form.internal_content} onChange={e => setForm(p => ({ ...p, internal_content: e.target.value }))} />
              </div>

              {/* Video URL */}
              <div>
                <label className="aw-fa-label">Video URL <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional — YouTube or direct link)</span></label>
                <input className="aw-fa-input" type="url" placeholder="https://youtube.com/watch?v=…" value={form.video_url} onChange={e => setForm(p => ({ ...p, video_url: e.target.value }))} />
              </div>

              {/* Safety tips */}
              <div>
                <label className="aw-fa-label">Safety Tips</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {form.safety_tips.map((tip, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: T.greenBg, border: `1px solid ${T.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: T.green, flexShrink: 0 }}>
                        {idx + 1}
                      </div>
                      <input
                        type="text"
                        className="aw-fa-list-input"
                        placeholder={`Safety tip ${idx + 1}`}
                        value={tip}
                        onChange={e => updateListItem('safety_tips', idx, e.target.value)}
                      />
                      {form.safety_tips.length > 1 && (
                        <button type="button" onClick={() => removeListItem('safety_tips', idx)}
                          style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer', flexShrink: 0 }}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => addListItem('safety_tips')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: T.green, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}>
                    <Plus size={13} /> Add Safety Tip
                  </button>
                </div>
              </div>

              {/* Internal steps */}
              <div>
                <label className="aw-fa-label">Internal Action Steps</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {form.internal_steps.map((step, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: T.blue, flexShrink: 0 }}>
                        {idx + 1}
                      </div>
                      <input
                        type="text"
                        className="aw-fa-list-input"
                        placeholder={`Action step ${idx + 1}`}
                        value={step}
                        onChange={e => updateListItem('internal_steps', idx, e.target.value)}
                      />
                      {form.internal_steps.length > 1 && (
                        <button type="button" onClick={() => removeListItem('internal_steps', idx)}
                          style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer', flexShrink: 0 }}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => addListItem('internal_steps')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: T.blue, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}>
                    <Plus size={13} /> Add Action Step
                  </button>
                </div>
              </div>

              {/* Publish toggle */}
              <div
                className={`aw-fa-toggle-row ${form.is_published ? 'on' : ''}`}
                onClick={() => setForm(p => ({ ...p, is_published: !p.is_published }))}
              >
                <div style={{ width: 38, height: 22, borderRadius: 9999, background: form.is_published ? T.green : 'rgba(255,255,255,0.10)', border: `1px solid ${form.is_published ? T.greenBorder : T.borderFaint}`, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: form.is_published ? T.accentDark : 'rgba(255,255,255,0.40)', position: 'absolute', top: 2, left: form.is_published ? 18 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.30)' }} />
                </div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: form.is_published ? T.green : T.textMuted }}>
                    {form.is_published ? 'Published' : 'Draft'}
                  </span>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0, marginTop: 2 }}>
                    {form.is_published ? 'Alert is visible to all users' : 'Alert is hidden — not visible to users yet'}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10 }}>
              <button type="button" className="aw-fa-cancel-btn" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
              <button type="submit" className="aw-fa-save-btn" disabled={saving}>
                {saving
                  ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</>
                  : <><Save size={14} /> {editingId ? 'Update Alert' : 'Create Alert'}</>
                }
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Alerts list ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '60px 0', flexDirection: 'column' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
        </div>
      ) : alerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: T.redBg, border: `1px solid ${T.redBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <AlertTriangle size={26} style={{ color: T.red }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: T.textBody, marginBottom: 6 }}>No alerts yet</p>
          <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>Create your first fraud alert to start protecting users.</p>
          <button onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: T.accent, color: T.accentDark }}>
            <Plus size={14} /> New Alert
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Stats row */}
          <div className="aw-fade-up" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            {[
              { label: 'Total Alerts',  value: alerts.length,                                   color: T.textBody },
              { label: 'Published',     value: alerts.filter(a => a.is_published).length,        color: T.green   },
              { label: 'Drafts',        value: alerts.filter(a => !a.is_published).length,       color: T.textMuted },
              { label: 'High Severity', value: alerts.filter(a => a.severity === 'HIGH').length, color: T.red     },
            ].map(s => (
              <div key={s.label} style={{ padding: '8px 16px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 9, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: 11, color: T.textMuted }}>{s.label}</span>
              </div>
            ))}
          </div>

          {alerts.map((alert, idx) => {
            const sev = SEV_CFG[alert.severity] ?? SEV_CFG.MEDIUM;
            return (
              <div key={alert.id} className={`aw-fa-card aw-fade-up`} style={{ animationDelay: `${idx * 0.04}s` }}>
                {/* Severity bar */}
                <div style={{ height: 2, background: `linear-gradient(90deg, ${sev.color}, ${sev.color}30)` }} />

                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  {/* Icon */}
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: sev.bg, border: `1px solid ${sev.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <AlertTriangle size={17} style={{ color: sev.color }} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: T.white, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.title}</h3>

                      {/* Severity badge */}
                      <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', background: sev.bg, border: `1px solid ${sev.border}`, color: sev.color, flexShrink: 0 }}>
                        {sev.label}
                      </span>

                      {/* Published badge */}
                      {alert.is_published ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', background: T.greenBg, border: `1px solid ${T.greenBorder}`, color: T.green, flexShrink: 0 }}>
                          <Eye size={9} /> Published
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, flexShrink: 0 }}>
                          <EyeOff size={9} /> Draft
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>
                      Type: <strong style={{ color: T.textBody }}>{alert.fraud_type}</strong>
                      {' · '}
                      {alert.safety_tips?.length ? `${alert.safety_tips.length} tips` : 'No tips'}
                      {' · '}
                      {alert.internal_steps?.length ? `${alert.internal_steps.length} steps` : 'No steps'}
                      {' · '}
                      {fmt(alert.created_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                    <button className="aw-fa-icon-btn edit" title="Edit" onClick={() => handleEdit(alert)}>
                      <Edit2 size={14} />
                    </button>
                    <button className="aw-fa-icon-btn del" title="Delete" onClick={() => handleDelete(alert.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
