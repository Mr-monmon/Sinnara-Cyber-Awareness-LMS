import React, { useEffect, useMemo, useState } from "react";
import { Search, X, UserPlus, Check, Users, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Department, Employee } from "../../lib/types";

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bgCard:      '#1a1e0e',
  accent:      '#c8ff00',
  accentDark:  '#12140a',
  white:       '#ffffff',
  textBody:    '#cbd5e1',
  textMuted:   '#64748b',
  border:      'rgba(255,255,255,0.09)',
  borderFaint: 'rgba(255,255,255,0.05)',
  blue:        '#60a5fa',
  blueBg:      'rgba(96,165,250,0.08)',
  blueBorder:  'rgba(96,165,250,0.22)',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Search input ── */
  .aw-da-search {
    width: 100%;
    padding: 11px 14px 11px 40px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-da-search:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-da-search::placeholder { color: rgba(148,163,184,0.35); }

  /* ── Employee row ── */
  .aw-da-row {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 14px; border-radius: 10px;
    border: 1px solid transparent;
    cursor: pointer; transition: all 0.18s;
    background: rgba(255,255,255,0.02);
    font-family: 'Inter', sans-serif;
  }
  .aw-da-row:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.09); }
  .aw-da-row.selected {
    background: rgba(200,255,0,0.06);
    border-color: rgba(200,255,0,0.25);
  }

  /* ── Custom checkbox ── */
  .aw-da-check {
    width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0;
    border: 2px solid rgba(255,255,255,0.20);
    display: flex; align-items: center; justify-content: center;
    background: transparent; transition: all 0.18s;
  }
  .aw-da-row.selected .aw-da-check {
    background: #c8ff00;
    border-color: #c8ff00;
  }

  /* ── Assign button ── */
  .aw-da-assign-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 20px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 18px rgba(200,255,0,0.20);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-da-assign-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .aw-da-assign-btn:disabled {
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.22);
    cursor: not-allowed; box-shadow: none;
  }

  /* ── Cancel button ── */
  .aw-da-cancel-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 20px; border-radius: 10px; cursor: pointer;
    font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: background 0.18s, color 0.18s;
  }
  .aw-da-cancel-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: #ffffff; }
  .aw-da-cancel-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── Scrollbar ── */
  .aw-da-list::-webkit-scrollbar        { width: 3px; }
  .aw-da-list::-webkit-scrollbar-track  { background: transparent; }
  .aw-da-list::-webkit-scrollbar-thumb  { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  @keyframes aw-spin     { to { transform: rotate(360deg); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-dept-assign-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-dept-assign-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   PROPS
───────────────────────────────────────── */
type DepartmentAssignProps = {
  isOpen:     boolean;
  department: Department | null;
  employees:  Employee[];
  onAssigned: () => Promise<void> | void;
  onClose:    () => void;
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const DepartmentAssign: React.FC<DepartmentAssignProps> = ({
  isOpen, department, employees, onAssigned, onClose,
}) => {
  const [selected, setSelected]   = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch]       = useState('');

  const unassigned = useMemo(
    () => employees.filter(e => e.department_id === null),
    [employees]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return unassigned;
    return unassigned.filter(e =>
      e.full_name?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.id?.toLowerCase().includes(q)
    );
  }, [search, unassigned]);

  useEffect(() => {
    if (isOpen) { setSelected([]); setSearch(''); }
  }, [isOpen, department?.id]);

  if (!isOpen || !department) return null;

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleAssign = async () => {
    if (selected.length === 0) return;
    setAssigning(true);
    await supabase.from("users").update({ department_id: department.id }).in("id", selected);
    setAssigning(false);
    setSelected([]);
    await onAssigned();
  };

  const handleClose = () => { setSelected([]); onClose(); };

  const toggleAll = () => {
    if (selected.length === filtered.length && filtered.length > 0) {
      setSelected([]);
    } else {
      setSelected(filtered.map(e => e.id));
    }
  };

  const allSelected = filtered.length > 0 && selected.length === filtered.length;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.80)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={handleClose}
    >
      <div
        className="aw-modal-in"
        style={{ width: '100%', maxWidth: 500, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.55)', fontFamily: "'Inter', sans-serif" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Accent bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))' }} />

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={17} style={{ color: T.blue }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: T.white, margin: '0 0 2px', letterSpacing: '-0.2px' }}>
                Add Employees
              </h2>
              <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>
                to <strong style={{ color: T.textBody }}>{department.name}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer', transition: 'all 0.18s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'; (e.currentTarget as HTMLElement).style.color = T.white; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = T.textMuted; }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Search + select all */}
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, pointerEvents: 'none' }} />
            <input
              className="aw-da-search"
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, display: 'flex', padding: 0 }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Stats + select all */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>
              {filtered.length > 0
                ? <><strong style={{ color: T.textBody }}>{filtered.length}</strong> available · <strong style={{ color: T.accent }}>{selected.length}</strong> selected</>
                : 'No employees found'
              }
            </span>
            {filtered.length > 0 && (
              <button
                onClick={toggleAll}
                style={{ fontSize: 11, fontWeight: 700, color: allSelected ? T.accent : T.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, transition: 'color 0.18s' }}
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
        </div>

        {/* Employee list */}
        <div
          className="aw-da-list"
          style={{ maxHeight: 320, overflowY: 'auto', padding: '0 24px' }}
        >
          {/* No unassigned employees */}
          {unassigned.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Users size={20} style={{ color: T.textMuted }} />
              </div>
              <p style={{ fontSize: 13, color: T.textBody, margin: 0 }}>All employees are already assigned to departments.</p>
            </div>
          )}

          {/* No search results */}
          {unassigned.length > 0 && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <p style={{ fontSize: 13, color: T.textBody, margin: 0 }}>No employees match "<strong>{search}</strong>"</p>
            </div>
          )}

          {/* Employee rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 16 }}>
            {filtered.map(emp => {
              const isSelected = selected.includes(emp.id);
              return (
                <label
                  key={emp.id}
                  className={`aw-da-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggle(emp.id)}
                >
                  {/* Custom checkbox */}
                  <div className="aw-da-check">
                    {isSelected && <Check size={12} style={{ color: T.accentDark, strokeWidth: 3 }} />}
                  </div>

                  {/* Avatar initial */}
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: isSelected ? 'rgba(200,255,0,0.10)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isSelected ? 'rgba(200,255,0,0.25)' : T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, color: isSelected ? T.accent : T.textMuted, transition: 'all 0.18s' }}>
                    {emp.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? T.white : T.textBody, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.18s' }}>
                      {emp.full_name}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {emp.email}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10 }}>
          <button className="aw-da-cancel-btn" onClick={handleClose} disabled={assigning}>
            Cancel
          </button>
          <button
            className="aw-da-assign-btn"
            onClick={handleAssign}
            disabled={assigning || selected.length === 0}
          >
            {assigning
              ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Adding…</>
              : <><UserPlus size={14} /> Add {selected.length > 0 ? `(${selected.length})` : 'Employees'}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
};
