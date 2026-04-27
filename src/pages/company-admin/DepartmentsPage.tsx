import React, { useState, useEffect } from "react";
import {
  Users, Plus, Edit2, Trash2, FolderTree,
  UserPlus, Eye, X, Loader2,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { DepartmentForm } from "./DepartmentForm";
import { DepartmentAssign } from "./DepartmentAssign";
import { Department, Employee } from "../../lib/types";

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

  .aw-dept-card {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    transition: border-color 0.2s;
    font-family: 'Inter', sans-serif;
  }
  .aw-dept-card:hover { border-color: rgba(255,255,255,0.14); }

  /* ── Icon action buttons ── */
  .aw-icon-btn {
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid transparent; cursor: pointer;
    transition: all 0.18s; background: none; flex-shrink: 0;
  }
  .aw-icon-btn.view   { color: #94a3b8; border-color: rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); }
  .aw-icon-btn.view:hover { background: rgba(255,255,255,0.09); color: #ffffff; border-color: rgba(255,255,255,0.15); }
  .aw-icon-btn.add    { color: #60a5fa; border-color: rgba(96,165,250,0.22); background: rgba(96,165,250,0.08); }
  .aw-icon-btn.add:hover { background: rgba(96,165,250,0.18); border-color: rgba(96,165,250,0.40); }
  .aw-icon-btn.edit   { color: #94a3b8; border-color: rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); }
  .aw-icon-btn.edit:hover { background: rgba(200,255,0,0.08); border-color: rgba(200,255,0,0.22); color: #c8ff00; }
  .aw-icon-btn.del    { color: #f87171; border-color: rgba(248,113,113,0.22); background: rgba(248,113,113,0.06); }
  .aw-icon-btn.del:hover { background: rgba(248,113,113,0.16); border-color: rgba(248,113,113,0.40); }
  .aw-icon-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── Employee pill in modal ── */
  .aw-emp-pill {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 5px 10px 5px 12px; border-radius: 9999px;
    font-size: 13px; font-weight: 500; color: #cbd5e1;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
    transition: border-color 0.18s;
  }
  .aw-emp-pill:hover { border-color: rgba(248,113,113,0.30); }
  .aw-emp-remove {
    width: 18px; height: 18px; border-radius: '50%'; display: flex; align-items: center; justify-content: center;
    background: none; border: none; cursor: pointer; color: #64748b; transition: color 0.18s; padding: 0;
  }
  .aw-emp-remove:hover { color: #f87171; }

  /* ── Primary btn ── */
  .aw-btn-primary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 20px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 18px rgba(200,255,0,0.20);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  @keyframes aw-fade-up  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up  { animation: aw-fade-up 0.4s ease both; }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-depts-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-depts-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const DepartmentsPage: React.FC = () => {
  const { user } = useAuth();
  const [departments, setDepartments]   = useState<Department[]>([]);
  const [employees, setEmployees]       = useState<Employee[]>([]);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [removingEmpId, setRemovingEmpId] = useState<string | null>(null);
  const [showDeptModal, setShowDeptModal]   = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEmpsModal, setShowEmpsModal]   = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);

  useEffect(() => { loadDepartments(); loadEmployees(); }, [user]);

  const loadDepartments = async () => {
    if (!user?.company_id) return;
    const { data } = await supabase
      .from("departments")
      .select(`*, users:users!users_department_id_fkey(id, full_name, email, department_id)`)
      .eq("company_id", user.company_id).order("name");
    if (data) {
      const withCount = data.map(d => ({ ...d, employee_count: d.users?.length || 0 }));
      setDepartments(withCount);
      setSelectedDept(prev => prev ? withCount.find(d => d.id === prev.id) ?? null : null);
    }
  };

  const loadEmployees = async () => {
    if (!user?.company_id) return;
    const { data } = await supabase.from("users").select("id, full_name, email, department_id")
      .eq("company_id", user.company_id).eq("role", "EMPLOYEE").order("full_name");
    if (data) setEmployees(data as Employee[]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this department?")) return;
    const prev = departments;
    setDeletingId(id);
    setDepartments(d => d.filter(x => x.id !== id));
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) { setDepartments(prev); }
    await loadDepartments();
    setDeletingId(null);
  };

  const handleRemoveEmployee = async (empId: string) => {
    setRemovingEmpId(empId);
    await supabase.from("users").update({ department_id: null }).eq("id", empId);
    await loadDepartments();
    await loadEmployees();
    setRemovingEmpId(null);
  };

  /* ── Department tree renderer ── */
  const renderTree = (parentId: string | null = null, level = 0): React.ReactNode => {
    const depts = departments.filter(d => d.parent_department_id === parentId);
    if (depts.length === 0) return null;

    return depts.map((dept, idx) => (
      <div key={dept.id} style={{ marginLeft: level > 0 ? 24 : 0 }}>
        {level > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 0 }}>
            <div style={{ width: 16, borderBottom: `1px dashed rgba(255,255,255,0.10)`, marginRight: 0 }} />
          </div>
        )}

        <div
          className={`aw-dept-card aw-fade-up`}
          style={{ marginBottom: 10, animationDelay: `${idx * 0.05}s`, borderLeft: level > 0 ? `2px solid rgba(200,255,0,0.15)` : undefined }}
        >
          <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Icon */}
            <div style={{ width: 44, height: 44, borderRadius: 11, background: 'rgba(200,255,0,0.07)', border: '1px solid rgba(200,255,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FolderTree size={20} style={{ color: T.accent }} />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: T.white, margin: '0 0 3px', lineHeight: '21px' }}>
                {dept.name}
              </h3>
              {dept.description && (
                <p style={{ fontSize: 12, color: T.textMuted, margin: '0 0 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dept.description}
                </p>
              )}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, borderRadius: 9999 }}>
                <Users size={10} style={{ color: T.textMuted }} />
                <span style={{ fontSize: 11, color: T.textMuted }}>{dept.employee_count} employee{dept.employee_count !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="aw-icon-btn view"
                title="View Employees"
                onClick={() => { setSelectedDept(dept); setShowEmpsModal(true); }}
              >
                <Eye size={14} />
              </button>
              <button
                className="aw-icon-btn add"
                title="Add Employees"
                onClick={() => { setSelectedDept(dept); setShowAssignModal(true); }}
              >
                <UserPlus size={14} />
              </button>
              <button
                className="aw-icon-btn edit"
                title="Edit Department"
                onClick={() => { setSelectedDept(dept); setShowDeptModal(true); }}
              >
                <Edit2 size={14} />
              </button>
              <button
                className="aw-icon-btn del"
                title="Delete Department"
                disabled={deletingId === dept.id}
                onClick={() => handleDelete(dept.id)}
              >
                {deletingId === dept.id
                  ? <Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} />
                  : <Trash2 size={14} />
                }
              </button>
            </div>
          </div>
        </div>

        {/* Recursive children */}
        {renderTree(dept.id, level + 1)}
      </div>
    ));
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderTree size={18} style={{ color: T.accent }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>
              Departments & Groups
            </h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
            Manage company departments and distribute employees.
          </p>
        </div>

        <button
          className="aw-btn-primary"
          onClick={() => { setSelectedDept(null); setShowDeptModal(true); }}
        >
          <Plus size={15} /> New Department
        </button>
      </div>

      {/* ── Content ── */}
      {departments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(200,255,0,0.07)', border: '1px solid rgba(200,255,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <FolderTree size={26} style={{ color: T.textMuted }} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, marginBottom: 8 }}>No departments yet</h3>
          <p style={{ fontSize: 14, color: T.textBody, marginBottom: 20 }}>Create your first department to start organizing employees.</p>
          <button className="aw-btn-primary" onClick={() => { setSelectedDept(null); setShowDeptModal(true); }}>
            <Plus size={14} /> Create First Department
          </button>
        </div>
      ) : (
        <div>{renderTree()}</div>
      )}

      {/* ── Modals ── */}
      <DepartmentForm
        isOpen={showDeptModal}
        department={selectedDept}
        departments={departments}
        companyId={user?.company_id}
        userId={user?.id}
        onClose={() => { setShowDeptModal(false); setSelectedDept(null); }}
        onSaved={loadDepartments}
      />

      <DepartmentAssign
        isOpen={showAssignModal}
        department={selectedDept}
        employees={employees}
        onAssigned={async () => { await loadDepartments(); await loadEmployees(); setShowAssignModal(false); setSelectedDept(null); }}
        onClose={() => { setShowAssignModal(false); setSelectedDept(null); }}
      />

      {/* ── Employees Modal ── */}
      {showEmpsModal && selectedDept && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.80)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => { setShowEmpsModal(false); setSelectedDept(null); }}
        >
          <div
            className="aw-modal-in"
            style={{ width: '100%', maxWidth: 560, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.55)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal accent bar */}
            <div style={{ height: 3, background: 'linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))' }} />

            {/* Modal header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: T.accent, letterSpacing: '1.2px', textTransform: 'uppercase', margin: '0 0 5px' }}>
                  Department Employees
                </p>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: T.white, margin: '0 0 5px', letterSpacing: '-0.2px' }}>
                  {selectedDept.name}
                </h2>
                <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>
                  {selectedDept.employee_count || 0} assigned employee{(selectedDept.employee_count || 0) !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer', transition: 'all 0.18s' }}
                onClick={() => { setShowEmpsModal(false); setSelectedDept(null); }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'; (e.currentTarget as HTMLElement).style.color = T.white; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = T.textMuted; }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Employee list */}
            <div style={{ maxHeight: 400, overflowY: 'auto', padding: '20px 24px' }}>
              {selectedDept.users && selectedDept.users.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedDept.users.map(emp => (
                    <span key={emp.id} className="aw-emp-pill">
                      {emp.full_name}
                      <button
                        className="aw-emp-remove"
                        disabled={removingEmpId === emp.id}
                        onClick={() => handleRemoveEmployee(emp.id)}
                        title={`Remove ${emp.full_name}`}
                      >
                        {removingEmpId === emp.id
                          ? <Loader2 size={12} style={{ animation: 'aw-spin 0.8s linear infinite', color: T.red }} />
                          : <X size={12} />
                        }
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <Users size={22} style={{ color: T.textMuted }} />
                  </div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: T.white, margin: '0 0 6px' }}>No employees assigned</h4>
                  <p style={{ fontSize: 13, color: T.textBody, margin: 0 }}>Add employees to this department to see them here.</p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: T.blueBg, border: `1px solid ${T.blueBorder}`, borderRadius: 8, color: T.blue, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.18s' }}
                onClick={() => { setShowEmpsModal(false); setSelectedDept(null); setShowAssignModal(true); }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,0.16)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.blueBg}
              >
                <UserPlus size={13} /> Add Employees
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
