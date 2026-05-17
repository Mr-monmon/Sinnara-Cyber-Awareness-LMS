import React, { useState, useEffect } from 'react';
import { Variable, Plus, Trash2, Edit2, Copy, Check, X, Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
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
  .aw-cv-input, .aw-cv-textarea {
    width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; color: #fff; font-family: 'Inter',sans-serif; outline: none;
    transition: border-color .2s, box-shadow .2s;
  }
  .aw-cv-input { padding: 11px 14px; }
  .aw-cv-textarea { padding: 11px 14px; resize: vertical; min-height: 72px; }
  .aw-cv-input:focus, .aw-cv-textarea:focus {
    border-color: rgba(200,255,0,.45); box-shadow: 0 0 0 3px rgba(200,255,0,.07);
    background: rgba(255,255,255,.06);
  }
  .aw-cv-input::placeholder, .aw-cv-textarea::placeholder { color: rgba(148,163,184,.35); }
  .aw-cv-btn { border: none; border-radius: 9px; cursor: pointer; font-family: 'Inter',sans-serif; font-weight: 600; transition: all .15s; }
  .aw-cv-chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px;
    background: rgba(200,255,0,.10); border: 1px solid rgba(200,255,0,.20); border-radius: 6px;
    font-size: 12px; color: #c8ff00; font-family: monospace; cursor: pointer; transition: background .15s; }
  .aw-cv-chip:hover { background: rgba(200,255,0,.18); }
  .aw-cv-row:hover { background: rgba(255,255,255,.03); }
`;

const BUILT_IN_VARS = [
  { name: 'FirstName', desc: 'Target first name' },
  { name: 'LastName', desc: 'Target last name' },
  { name: 'Email', desc: 'Target email address' },
  { name: 'Position', desc: 'Target job title' },
  { name: 'Department', desc: 'Target department' },
  { name: 'Company', desc: 'Company name' },
  { name: 'URL', desc: 'Phishing tracking URL' },
  { name: 'TrackingURL', desc: 'Email open tracking pixel URL' },
  { name: 'Date', desc: 'Current date' },
  { name: 'RId', desc: 'Unique recipient ID' },
  { name: 'ManagerName', desc: 'Target manager name (if set)' },
  { name: 'CompanyDomain', desc: 'Company email domain' },
  { name: 'RandomInt', desc: 'Random integer (1-9999)' },
];

interface CustomVar {
  id: string;
  variable_name: string;
  variable_value: string;
  description: string;
  created_at: string;
}

interface FormState { variable_name: string; variable_value: string; description: string; }
const EMPTY_FORM: FormState = { variable_name: '', variable_value: '', description: '' };

export const PhishingCustomVariablesPage: React.FC = () => {
  const { user } = useAuth();
  const [vars, setVars] = useState<CustomVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'closed' | 'add' | 'edit'>('closed');
  const [editTarget, setEditTarget] = useState<CustomVar | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { fetchVars(); }, []);

  const fetchVars = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('phishing_custom_variables')
      .select('*')
      .eq('company_id', user?.company_id)
      .order('variable_name');
    setVars(data || []);
    setLoading(false);
  };

  const openAdd = () => { setForm(EMPTY_FORM); setError(''); setModal('add'); };
  const openEdit = (v: CustomVar) => {
    setEditTarget(v);
    setForm({ variable_name: v.variable_name, variable_value: v.variable_value, description: v.description });
    setError('');
    setModal('edit');
  };
  const closeModal = () => { setModal('closed'); setEditTarget(null); };

  const validate = () => {
    if (!form.variable_name.trim()) return 'Variable name is required.';
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(form.variable_name)) return 'Name must start with a letter and contain only letters, numbers, underscore.';
    if (!form.variable_value.trim()) return 'Variable value is required.';
    return '';
  };

  const save = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');
    try {
      if (modal === 'add') {
        const { error: e } = await supabase.from('phishing_custom_variables').insert({
          company_id: user?.company_id,
          variable_name: form.variable_name.trim(),
          variable_value: form.variable_value.trim(),
          description: form.description.trim(),
        });
        if (e) throw e;
      } else if (editTarget) {
        const { error: e } = await supabase.from('phishing_custom_variables')
          .update({ variable_value: form.variable_value.trim(), description: form.description.trim(), variable_name: form.variable_name.trim() })
          .eq('id', editTarget.id);
        if (e) throw e;
      }
      await fetchVars();
      closeModal();
    } catch (e: unknown) {
      setError((e as { message?: string }).message || 'Save failed');
    } finally { setSaving(false); }
  };

  const deleteVar = async (id: string) => {
    await supabase.from('phishing_custom_variables').delete().eq('id', id);
    setDeleteId(null);
    fetchVars();
  };

  const copyToClipboard = (name: string) => {
    navigator.clipboard.writeText(`{{.${name}}}`);
    setCopied(name);
    setTimeout(() => setCopied(null), 1500);
  };

  const card = (style?: React.CSSProperties): React.CSSProperties => ({
    background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, ...style,
  });

  return (
    <div style={{ fontFamily: "'Inter',sans-serif" }}>
      <style>{STYLES}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Variable size={20} color={T.accent} />
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.white }}>Custom Variables</h2>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>
            Define company-specific template variables usable in emails and landing pages.
          </p>
        </div>
        <button className="aw-cv-btn" onClick={openAdd}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: T.accent, color: T.accentDark, fontSize: 13 }}>
          <Plus size={14} /> Add Variable
        </button>
      </div>

      {/* Built-in variables reference */}
      <div style={{ ...card(), padding: '18px 22px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Info size={14} color={T.blue} />
          <span style={{ fontSize: 12, fontWeight: 700, color: T.blue, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Built-in Variables</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {BUILT_IN_VARS.map(v => (
            <span key={v.name} className="aw-cv-chip" title={v.desc} onClick={() => copyToClipboard(v.name)}>
              {copied === v.name ? <Check size={10} /> : <Copy size={10} />}
              {`{{.${v.name}}}`}
            </span>
          ))}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: T.textMuted }}>Click any variable to copy it. These are resolved at send-time per recipient.</p>
      </div>

      {/* Custom variables table */}
      <div style={card()}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.borderFaint}` }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Your Custom Variables</span>
          <span style={{ marginLeft: 10, fontSize: 12, color: T.textMuted }}>({vars.length})</span>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>Loading…</div>
        ) : vars.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Variable size={36} color={T.textMuted} style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ color: T.textMuted, fontSize: 14 }}>No custom variables yet. Add one to use it in your templates.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Variable', 'Usage', 'Value', 'Description', ''].map(h => (
                  <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vars.map(v => (
                <tr key={v.id} className="aw-cv-row" style={{ borderTop: `1px solid ${T.borderFaint}` }}>
                  <td style={{ padding: '14px 18px', fontSize: 14, fontWeight: 600, color: T.white }}>{v.variable_name}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <span className="aw-cv-chip" title="Click to copy" onClick={() => copyToClipboard(v.variable_name)}>
                      {copied === v.variable_name ? <Check size={10} /> : <Copy size={10} />}
                      {`{{.${v.variable_name}}}`}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: 13, color: T.textBody, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.variable_value}</td>
                  <td style={{ padding: '14px 18px', fontSize: 13, color: T.textMuted }}>{v.description || '—'}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="aw-cv-btn" onClick={() => openEdit(v)}
                        style={{ padding: '6px 12px', fontSize: 12, background: T.blueBg, color: T.blue, border: `1px solid ${T.blueBorder}` }}>
                        <Edit2 size={12} />
                      </button>
                      <button className="aw-cv-btn" onClick={() => setDeleteId(v.id)}
                        style={{ padding: '6px 12px', fontSize: 12, background: T.redBg, color: T.red, border: `1px solid ${T.redBorder}` }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal !== 'closed' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ ...card(), padding: 28, width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.white }}>
                {modal === 'add' ? 'Add Custom Variable' : 'Edit Variable'}
              </h3>
              <button className="aw-cv-btn" onClick={closeModal} style={{ padding: 6, background: 'rgba(255,255,255,.06)', color: T.textMuted }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6, letterSpacing: '0.3px' }}>
                  Variable Name <span style={{ color: T.red }}>*</span>
                </label>
                <input className="aw-cv-input" placeholder="e.g. SupportEmail" value={form.variable_name}
                  onChange={e => setForm(f => ({ ...f, variable_name: e.target.value }))} />
                <p style={{ margin: '5px 0 0', fontSize: 11, color: T.textMuted }}>Used as <code style={{ color: T.accent }}>{'{{.'}SupportEmail{'}}'}</code> — letters, numbers, underscore only.</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>
                  Value <span style={{ color: T.red }}>*</span>
                </label>
                <input className="aw-cv-input" placeholder="e.g. it-support@company.com" value={form.variable_value}
                  onChange={e => setForm(f => ({ ...f, variable_value: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>Description</label>
                <textarea className="aw-cv-textarea" placeholder="What is this variable for?" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              {error && <p style={{ margin: 0, fontSize: 13, color: T.red }}>{error}</p>}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button className="aw-cv-btn" onClick={closeModal}
                style={{ padding: '10px 18px', fontSize: 13, background: 'rgba(255,255,255,.06)', color: T.textBody, border: `1px solid ${T.border}` }}>
                Cancel
              </button>
              <button className="aw-cv-btn" onClick={save} disabled={saving}
                style={{ padding: '10px 18px', fontSize: 13, background: T.accent, color: T.accentDark, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save Variable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...card(), padding: 28, maxWidth: 380 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, color: T.white }}>Delete Variable?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: T.textMuted }}>This variable will be removed from all future template renders. Existing sent emails are not affected.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="aw-cv-btn" onClick={() => setDeleteId(null)}
                style={{ flex: 1, padding: '10px 0', fontSize: 13, background: 'rgba(255,255,255,.06)', color: T.textBody, border: `1px solid ${T.border}` }}>
                Cancel
              </button>
              <button className="aw-cv-btn" onClick={() => deleteVar(deleteId)}
                style={{ flex: 1, padding: '10px 0', fontSize: 13, background: T.red, color: T.white }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
