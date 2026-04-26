import React, { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Eye, EyeOff,
  ArrowUp, ArrowDown, Globe, X, Save, Loader2, Image,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

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
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Partner card ── */
  .aw-pm-card {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; overflow: hidden;
    font-family: 'Inter', sans-serif;
    transition: border-color 0.2s, transform 0.18s;
    display: flex; flex-direction: column;
  }
  .aw-pm-card:hover { border-color: rgba(255,255,255,0.14); transform: translateY(-1px); }
  .aw-pm-card.inactive { opacity: 0.55; }

  /* ── Logo preview area ── */
  .aw-pm-logo-box {
    background: rgba(255,255,255,0.97);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    height: 88px; overflow: hidden;
    border: 1px solid rgba(255,255,255,0.12);
  }

  /* ── Action icon btns ── */
  .aw-pm-icon-btn {
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid transparent; cursor: pointer;
    transition: all 0.18s; background: none; flex-shrink: 0;
  }
  .aw-pm-icon-btn.edit { color: #60a5fa; border-color: rgba(96,165,250,0.22); background: rgba(96,165,250,0.08); }
  .aw-pm-icon-btn.edit:hover { background: rgba(96,165,250,0.18); }
  .aw-pm-icon-btn.del  { color: #f87171; border-color: rgba(248,113,113,0.22); background: rgba(248,113,113,0.07); }
  .aw-pm-icon-btn.del:hover  { background: rgba(248,113,113,0.16); }
  .aw-pm-icon-btn.order { color: #64748b; border-color: rgba(255,255,255,0.09); background: rgba(255,255,255,0.04); }
  .aw-pm-icon-btn.order:hover:not(:disabled) { background: rgba(255,255,255,0.09); color: #ffffff; }
  .aw-pm-icon-btn:disabled { opacity: 0.25; cursor: not-allowed; }

  /* ── Visibility toggle btn ── */
  .aw-pm-vis-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 8px 12px; border-radius: 8px; cursor: pointer;
    font-size: 12px; font-weight: 600; font-family: 'Inter', sans-serif;
    transition: all 0.18s;
  }
  .aw-pm-vis-btn.hide  { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); color: #94a3b8; }
  .aw-pm-vis-btn.hide:hover  { background: rgba(255,255,255,0.08); color: #ffffff; }
  .aw-pm-vis-btn.show  { background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.22); color: #34d399; }
  .aw-pm-vis-btn.show:hover  { background: rgba(52,211,153,0.16); }

  /* ── Modal inputs ── */
  .aw-pm-input {
    width: 100%; padding: 11px 14px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-pm-input:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-pm-input::placeholder { color: rgba(148,163,184,0.35); }
  .aw-pm-label { display: block; font-size: 12px; font-weight: 600; color: #94a3b8; margin-bottom: 7px; letter-spacing: 0.3px; font-family: 'Inter', sans-serif; }

  /* ── Primary btn ── */
  .aw-pm-save-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 20px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 18px rgba(200,255,0,0.20);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-pm-save-btn:hover { opacity: 0.88; transform: translateY(-1px); }
  .aw-pm-save-btn:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }

  .aw-pm-cancel-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 12px 20px; border-radius: 10px; cursor: pointer;
    font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-pm-cancel-btn:hover { background: rgba(255,255,255,0.08); color: #ffffff; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-fade-up  { animation: aw-fade-up  0.4s ease both; }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-pm-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-pm-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPE
───────────────────────────────────────── */
interface Partner {
  id: string; name: string; logo_url: string;
  website: string | null; order_index: number;
  is_active: boolean; created_at: string;
}

const EMPTY = { name: '', logo_url: '', website: '' };

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const PartnersManagementPage: React.FC = () => {
  const [partners, setPartners]         = useState<Partner[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [saving, setSaving]             = useState(false);
  const [form, setForm]                 = useState({ ...EMPTY });
  const [logoError, setLogoError]       = useState<string | null>(null);

  useEffect(() => { loadPartners(); }, []);

  const loadPartners = async () => {
    try {
      const { data, error } = await supabase.from('partners').select('*').order('order_index');
      if (error) throw error;
      if (data) setPartners(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openNew = () => { setEditingPartner(null); setForm({ ...EMPTY }); setLogoError(null); setShowModal(true); };

  const handleEdit = (p: Partner) => {
    setEditingPartner(p);
    setForm({ name: p.name, logo_url: p.logo_url, website: p.website || '' });
    setLogoError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingPartner) {
        await supabase.from('partners').update({ name: form.name, logo_url: form.logo_url, website: form.website || null, updated_at: new Date().toISOString() }).eq('id', editingPartner.id);
      } else {
        const maxOrder = partners.length > 0 ? Math.max(...partners.map(p => p.order_index)) : -1;
        await supabase.from('partners').insert([{ name: form.name, logo_url: form.logo_url, website: form.website || null, order_index: maxOrder + 1 }]);
      }
      setShowModal(false); setEditingPartner(null); setForm({ ...EMPTY });
      await loadPartners();
    } catch { alert('Failed to save partner'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this partner?')) return;
    await supabase.from('partners').delete().eq('id', id);
    await loadPartners();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('partners').update({ is_active: !current }).eq('id', id);
    await loadPartners();
  };

  const movePartner = async (id: string, dir: 'up' | 'down') => {
    const idx = partners.findIndex(p => p.id === id);
    if (idx === -1) return;
    if (dir === 'up'   && idx === 0) return;
    if (dir === 'down' && idx === partners.length - 1) return;
    const swapIdx  = dir === 'up' ? idx - 1 : idx + 1;
    const p        = partners[idx];
    const swapP    = partners[swapIdx];
    await Promise.all([
      supabase.from('partners').update({ order_index: swapP.order_index }).eq('id', p.id),
      supabase.from('partners').update({ order_index: p.order_index }).eq('id', swapP.id),
    ]);
    await loadPartners();
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 14, flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={18} style={{ color: T.accent }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Partner Logos</h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
            Manage "Our Success Partners" logos displayed on the homepage.
          </p>
        </div>
        <button onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: T.accent, color: T.accentDark, boxShadow: '0 0 18px rgba(200,255,0,0.20)', transition: 'opacity 0.2s' }}>
          <Plus size={14} /> Add Partner
        </button>
      </div>

      {/* ── Stats ── */}
      {partners.length > 0 && (
        <div className="aw-fade-up" style={{ animationDelay: '0.04s', display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Partners', value: partners.length,                                     color: T.textBody },
            { label: 'Active',         value: partners.filter(p => p.is_active).length,            color: T.green    },
            { label: 'Hidden',         value: partners.filter(p => !p.is_active).length,           color: T.textMuted },
          ].map(s => (
            <div key={s.label} style={{ padding: '8px 16px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 9, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: 11, color: T.textMuted }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {partners.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(200,255,0,0.07)', border: '1px solid rgba(200,255,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Image size={26} style={{ color: T.textMuted }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: T.textBody, marginBottom: 6 }}>No partners yet</p>
          <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>Click "Add Partner" to add your first partner logo.</p>
          <button onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: T.accent, color: T.accentDark }}>
            <Plus size={14} /> Add Partner
          </button>
        </div>
      ) : (
        /* ── Partners grid ── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {partners.map((partner, idx) => (
            <div key={partner.id} className={`aw-pm-card aw-fade-up ${partner.is_active ? '' : 'inactive'}`} style={{ animationDelay: `${idx * 0.04}s` }}>

              {/* Card header: index + order controls */}
              <div style={{ padding: '12px 14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: T.textMuted }}>#{idx + 1}</span>
                  <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', background: partner.is_active ? T.greenBg : 'rgba(255,255,255,0.04)', border: `1px solid ${partner.is_active ? T.greenBorder : T.borderFaint}`, color: partner.is_active ? T.green : T.textMuted }}>
                    {partner.is_active ? 'Active' : 'Hidden'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button className="aw-pm-icon-btn order" disabled={idx === 0} onClick={() => movePartner(partner.id, 'up')} title="Move up">
                    <ArrowUp size={12} />
                  </button>
                  <button className="aw-pm-icon-btn order" disabled={idx === partners.length - 1} onClick={() => movePartner(partner.id, 'down')} title="Move down">
                    <ArrowDown size={12} />
                  </button>
                </div>
              </div>

              {/* Logo preview */}
              <div style={{ padding: '14px', flex: 1 }}>
                <div className="aw-pm-logo-box">
                  {partner.logo_url ? (
                    <img
                      src={partner.logo_url}
                      alt={partner.name}
                      style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                      onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <Image size={32} style={{ color: '#94a3b8' }} />
                  )}
                </div>

                {/* Name + website */}
                <h3 style={{ fontSize: 14, fontWeight: 700, color: T.white, margin: '12px 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {partner.name}
                </h3>
                {partner.website ? (
                  <a href={partner.website} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: T.blue, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Globe size={11} /> {partner.website}
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: T.textMuted }}>No website</span>
                )}
              </div>

              {/* Footer actions */}
              <div style={{ padding: '10px 14px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 7 }}>
                <button
                  className={`aw-pm-vis-btn ${partner.is_active ? 'hide' : 'show'}`}
                  onClick={() => toggleActive(partner.id, partner.is_active)}
                >
                  {partner.is_active ? <><EyeOff size={12} /> Hide</> : <><Eye size={12} /> Show</>}
                </button>
                <button className="aw-pm-icon-btn edit" title="Edit" onClick={() => handleEdit(partner)}>
                  <Edit2 size={13} />
                </button>
                <button className="aw-pm-icon-btn del" title="Delete" onClick={() => handleDelete(partner.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════ MODAL ═══════════ */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => { setShowModal(false); setEditingPartner(null); }}>
          <div className="aw-modal-in" style={{ width: '100%', maxWidth: 460, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.55)', fontFamily: "'Inter', sans-serif" }}
            onClick={e => e.stopPropagation()}>

            {/* Accent bar */}
            <div style={{ height: 3, background: 'linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))' }} />

            {/* Header */}
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Globe size={16} style={{ color: T.accent }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>{editingPartner ? 'Edit Partner' : 'Add New Partner'}</h2>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{editingPartner ? `Editing: ${editingPartner.name}` : 'Fill in the partner details'}</p>
                </div>
              </div>
              <button onClick={() => { setShowModal(false); setEditingPartner(null); }}
                style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer' }}>
                <X size={13} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Name */}
                <div>
                  <label className="aw-pm-label">Partner Name <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-pm-input" type="text" required placeholder="e.g. Microsoft" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>

                {/* Logo URL + preview */}
                <div>
                  <label className="aw-pm-label">Logo URL <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-pm-input" type="url" required placeholder="https://example.com/logo.png" value={form.logo_url}
                    onChange={e => { setForm(p => ({ ...p, logo_url: e.target.value })); setLogoError(null); }} />
                  <p style={{ fontSize: 11, color: T.textMuted, marginTop: 5 }}>Enter the full URL to the logo image (PNG, SVG, WebP supported).</p>

                  {/* Logo preview */}
                  {form.logo_url && (
                    <div style={{ marginTop: 10, padding: '12px', background: 'rgba(255,255,255,0.97)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 72, border: `1px solid ${T.border}` }}>
                      {logoError ? (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Failed to load image</span>
                      ) : (
                        <img
                          src={form.logo_url}
                          alt="Preview"
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                          onError={() => setLogoError('failed')}
                          onLoad={() => setLogoError(null)}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Website */}
                <div>
                  <label className="aw-pm-label">Website <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                  <input className="aw-pm-input" type="url" placeholder="https://example.com" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} />
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10 }}>
                <button type="button" className="aw-pm-cancel-btn" onClick={() => { setShowModal(false); setEditingPartner(null); }}>Cancel</button>
                <button type="submit" className="aw-pm-save-btn" disabled={saving}>
                  {saving
                    ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</>
                    : <><Save size={14} /> {editingPartner ? 'Update' : 'Add'} Partner</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
