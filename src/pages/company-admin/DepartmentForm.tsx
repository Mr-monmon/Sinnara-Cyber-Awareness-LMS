import React, { useEffect, useState } from "react";
import { FolderTree, X, Loader2, Save, ChevronDown } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Department } from "../../lib/types";

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
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-df-input, .aw-df-textarea, .aw-df-select {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    font-size: 14px;
    color: #ffffff;
    font-family: 'Inter', sans-serif;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-df-input    { padding: 11px 14px; }
  .aw-df-textarea { padding: 11px 14px; resize: vertical; min-height: 88px; }
  .aw-df-select   {
    padding: 11px 36px 11px 14px;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    cursor: pointer;
  }
  .aw-df-input:focus, .aw-df-textarea:focus, .aw-df-select:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-df-input::placeholder, .aw-df-textarea::placeholder { color: rgba(148,163,184,0.35); }
  .aw-df-select option { background: #1a1e0e; color: #ffffff; }

  .aw-df-label {
    display: block;
    font-size: 12px; font-weight: 600;
    color: #94a3b8;
    margin-bottom: 7px;
    letter-spacing: 0.3px;
    font-family: 'Inter', sans-serif;
  }

  /* ── Save button ── */
  .aw-df-save-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 20px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 18px rgba(200,255,0,0.20);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-df-save-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .aw-df-save-btn:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }

  /* ── Cancel button ── */
  .aw-df-cancel-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 20px; border-radius: 10px; cursor: pointer;
    font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: background 0.18s, color 0.18s;
  }
  .aw-df-cancel-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: #ffffff; }
  .aw-df-cancel-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  @keyframes aw-spin     { to { transform: rotate(360deg); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(14px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-dept-form-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-dept-form-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   PROPS
───────────────────────────────────────── */
interface DepartmentFormProps {
  isOpen:     boolean;
  department: Department | null;
  departments: Department[];
  companyId?: string;
  userId?:    string;
  onClose:    () => void;
  onSaved:    () => void | Promise<void>;
}

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const DepartmentForm: React.FC<DepartmentFormProps> = ({
  isOpen, department, departments, companyId, userId, onClose, onSaved,
}) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState({ name: '', description: '', parent_department_id: '' });

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      name:                   department?.name                   ?? '',
      description:            department?.description            ?? '',
      parent_department_id:   department?.parent_department_id   ?? '',
    });
  }, [department, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);

    if (department) {
      await supabase.from("departments").update({
        name:                 form.name,
        description:          form.description,
        parent_department_id: form.parent_department_id || null,
      }).eq("id", department.id);
    } else {
      await supabase.from("departments").insert({
        company_id:           companyId,
        name:                 form.name,
        description:          form.description,
        parent_department_id: form.parent_department_id || null,
        created_by:           userId,
      });
    }

    await onSaved();
    setSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  const isEdit = !!department;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.80)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="aw-modal-in"
        style={{ width: '100%', maxWidth: 460, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.55)', fontFamily: "'Inter', sans-serif" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Accent bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))' }} />

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderTree size={17} style={{ color: T.accent }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: T.white, margin: 0, letterSpacing: '-0.2px' }}>
                {isEdit ? 'Edit Department' : 'New Department'}
              </h2>
              <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>
                {isEdit ? `Editing: ${department?.name}` : 'Fill in the details below'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer', transition: 'all 0.18s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'; (e.currentTarget as HTMLElement).style.color = T.white; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = T.textMuted; }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Department Name */}
            <div>
              <label className="aw-df-label">
                Department Name <span style={{ color: T.accent }}>*</span>
              </label>
              <input
                className="aw-df-input"
                type="text"
                placeholder="e.g. Information Technology"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="aw-df-label">Description</label>
              <textarea
                className="aw-df-textarea"
                placeholder="Brief description of this department's role…"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Parent Department */}
            <div>
              <label className="aw-df-label">Parent Department <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
              <div style={{ position: 'relative' }}>
                <select
                  className="aw-df-select"
                  value={form.parent_department_id}
                  onChange={e => setForm({ ...form, parent_department_id: e.target.value })}
                >
                  <option value="">None (Top-level Department)</option>
                  {departments
                    .filter(d => d.id !== department?.id)
                    .map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
              </div>
              <p style={{ fontSize: 11, color: T.textMuted, marginTop: 5 }}>
                Select a parent to create a sub-department hierarchy.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10 }}>
            <button type="button" className="aw-df-cancel-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="aw-df-save-btn" disabled={saving}>
              {saving
                ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</>
                : <><Save size={14} /> {isEdit ? 'Update' : 'Create'}</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
