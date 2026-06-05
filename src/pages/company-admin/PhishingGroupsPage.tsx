import React, { useState, useEffect, useRef } from "react";
import {
  Users, Plus, Edit2, Trash2, ArrowLeft, Upload,
  Download, X, Check, Loader2, AlertCircle, UserPlus, Search,
  RefreshCw, Building2, ChevronDown
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
  .aw-groups-input {
    width: 100%; padding: 10px 14px; box-sizing: border-box;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 13px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .aw-groups-input:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-groups-input::placeholder { color: rgba(148,163,184,0.40); }
  .aw-groups-table { width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; }
  .aw-groups-table th {
    padding: 10px 14px; text-align: left; font-size: 10px; font-weight: 700; color: #64748b;
    letter-spacing: 0.9px; text-transform: uppercase;
    border-bottom: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02);
  }
  .aw-groups-table td {
    padding: 11px 14px; font-size: 13px; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .aw-groups-table tr:last-child td { border-bottom: none; }
  .aw-groups-table tr:hover td { background: rgba(255,255,255,0.025); }
  .aw-groups-dropzone {
    border: 2px dashed rgba(255,255,255,0.15); border-radius: 12px;
    padding: 32px; text-align: center; cursor: pointer; transition: all 0.2s;
  }
  .aw-groups-dropzone:hover, .aw-groups-dropzone.dragover {
    border-color: rgba(200,255,0,0.45); background: rgba(200,255,0,0.04);
  }
  @keyframes aw-spin { to { transform: rotate(360deg); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-groups-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-groups-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

interface Group { id: string; company_id: string; name: string; description: string; member_count: number; created_at: string; }
interface Member { id: string; group_id: string; first_name: string; last_name: string; email: string; position: string; department: string; created_at: string; }
interface Employee { id: string; full_name: string; email: string; job_title: string; department_id: string | null; department_name: string; }
interface Department { id: string; name: string; }

const EMPTY_MEMBER = { first_name: '', last_name: '', email: '', position: '', department: '' };

export const PhishingGroupsPage: React.FC = () => {
  const { user } = useAuth();
  const [view, setView] = useState<'groups' | 'members'>('groups');
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [groupModal, setGroupModal] = useState<{ open: boolean; edit: Group | null }>({ open: false, edit: null });
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });
  const [savingGroup, setSavingGroup] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [memberForm, setMemberForm] = useState({ ...EMPTY_MEMBER });
  const [addingMember, setAddingMember] = useState(false);
  const [deleteMemberId, setDeleteMemberId] = useState<string | null>(null);
  const [deletingMember, setDeletingMember] = useState(false);
  const [searchMember, setSearchMember] = useState('');
  const [csvPreview, setCsvPreview] = useState<string[][] | null>(null);
  const [csvRaw, setCsvRaw] = useState<string[][] | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync from employees
  const [syncModal, setSyncModal] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [filterDeptId, setFilterDeptId] = useState<string>('');
  const [searchEmployee, setSearchEmployee] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ inserted: number } | null>(null);
  const [alreadySyncedIds, setAlreadySyncedIds] = useState<Set<string>>(new Set());

  useEffect(() => { if (user?.company_id) loadGroups(); }, [user]);

  const loadGroups = async () => {
    if (!user?.company_id) return;
    setLoadingGroups(true);
    try {
      const { data } = await supabase.from('phishing_groups').select('*').eq('company_id', user.company_id).order('created_at', { ascending: false });
      setGroups(data || []);
    } catch (err) { console.error(err); }
    finally { setLoadingGroups(false); }
  };

  const loadMembers = async (groupId: string) => {
    setLoadingMembers(true);
    try {
      const { data } = await supabase.from('phishing_group_members').select('*').eq('group_id', groupId).order('created_at', { ascending: false });
      setMembers(data || []);
    } catch (err) { console.error(err); }
    finally { setLoadingMembers(false); }
  };

  const openGroup = (g: Group) => {
    setActiveGroup(g);
    setView('members');
    loadMembers(g.id);
    setSearchMember('');
    setCsvPreview(null);
  };

  const saveGroup = async () => {
    if (!groupForm.name.trim()) { alert('Group name is required'); return; }
    setSavingGroup(true);
    try {
      if (groupModal.edit) {
        await supabase.from('phishing_groups').update({ name: groupForm.name, description: groupForm.description, updated_at: new Date().toISOString() }).eq('id', groupModal.edit.id);
      } else {
        await supabase.from('phishing_groups').insert({ name: groupForm.name, description: groupForm.description, company_id: user?.company_id });
      }
      setGroupModal({ open: false, edit: null });
      loadGroups();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed to save'); }
    finally { setSavingGroup(false); }
  };

  const deleteGroup = async () => {
    if (!deleteGroupId) return;
    setDeletingGroup(true);
    try {
      await supabase.from('phishing_groups').delete().eq('id', deleteGroupId);
      setDeleteGroupId(null);
      loadGroups();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed to delete'); }
    finally { setDeletingGroup(false); }
  };

  const addMember = async () => {
    if (!memberForm.first_name.trim() || !memberForm.email.trim()) { alert('First name and email are required'); return; }
    if (!activeGroup) return;
    setAddingMember(true);
    try {
      await supabase.from('phishing_group_members').insert({ ...memberForm, group_id: activeGroup.id });
      setMemberForm({ ...EMPTY_MEMBER });
      loadMembers(activeGroup.id);
      loadGroups();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed to add member'); }
    finally { setAddingMember(false); }
  };

  const deleteMember = async () => {
    if (!deleteMemberId || !activeGroup) return;
    setDeletingMember(true);
    try {
      await supabase.from('phishing_group_members').delete().eq('id', deleteMemberId);
      setDeleteMemberId(null);
      loadMembers(activeGroup.id);
      loadGroups();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed to delete'); }
    finally { setDeletingMember(false); }
  };

  const parseCSV = (text: string): string[][] => {
    return text.trim().split('\n').map(line => {
      const cols: string[] = [];
      let cur = ''; let inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      cols.push(cur.trim());
      return cols;
    });
  };

  const handleCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) { alert('CSV must have at least a header row and one data row'); return; }
      setCsvRaw(rows.slice(1)); // skip header
      setCsvPreview(rows.slice(0, 6)); // show header + 5 rows
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) handleCSVFile(file);
    else alert('Please drop a CSV file');
  };

  const importCSV = async () => {
    if (!csvRaw || !activeGroup) return;
    setCsvImporting(true);
    try {
      const rows = csvRaw.map(r => ({
        group_id: activeGroup.id,
        first_name: r[0] || '',
        last_name: r[1] || '',
        email: r[2] || '',
        position: r[3] || '',
        department: r[4] || '',
      })).filter(r => r.first_name && r.email);

      const BATCH = 100;
      for (let i = 0; i < rows.length; i += BATCH) {
        await supabase.from('phishing_group_members').insert(rows.slice(i, i + BATCH));
      }
      setCsvPreview(null); setCsvRaw(null);
      loadMembers(activeGroup.id);
      loadGroups();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Import failed'); }
    finally { setCsvImporting(false); }
  };

  const exportCSV = () => {
    if (!activeGroup || members.length === 0) return;
    const header = 'first_name,last_name,email,position,department';
    const rows = members.map(m => `"${m.first_name}","${m.last_name}","${m.email}","${m.position}","${m.department}"`);
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${activeGroup.name}-members.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const openSyncModal = async () => {
    if (!user?.company_id || !activeGroup) return;
    setSyncModal(true);
    setSyncResult(null);
    setSelectedEmployeeIds(new Set());
    setFilterDeptId('');
    setSearchEmployee('');
    setLoadingEmployees(true);
    try {
      const [{ data: emps }, { data: depts }, { data: existing }] = await Promise.all([
        supabase
          .from('users')
          .select('id, full_name, email, job_title, department_id, departments!users_department_id_fkey(name)')
          .eq('company_id', user.company_id)
          .eq('role', 'EMPLOYEE')
          .order('full_name'),
        supabase
          .from('departments')
          .select('id, name')
          .eq('company_id', user.company_id)
          .order('name'),
        supabase
          .from('phishing_group_members')
          .select('employee_id')
          .eq('group_id', activeGroup.id)
          .not('employee_id', 'is', null),
      ]);
      setEmployees((emps || []).map((e: { id: string; full_name: string; email: string; job_title: string | null; department_id: string | null; departments?: { name?: string | null } | null }) => ({
        id: e.id,
        full_name: e.full_name,
        email: e.email,
        job_title: e.job_title || '',
        department_id: e.department_id,
        department_name: e.departments?.name || '',
      })));
      setDepartments(depts || []);
      setAlreadySyncedIds(new Set((existing || []).map((r: { employee_id: string | null }) => r.employee_id)));
    } finally {
      setLoadingEmployees(false);
    }
  };

  const syncEmployees = async () => {
    if (!activeGroup || selectedEmployeeIds.size === 0) return;
    setSyncing(true);
    try {
      // Filter out anyone already synced (defence in depth — UI hides them too)
      const rows = employees
        .filter(e => selectedEmployeeIds.has(e.id) && !alreadySyncedIds.has(e.id))
        .map(e => {
          const parts = e.full_name.trim().split(/\s+/);
          return {
            group_id: activeGroup.id,
            employee_id: e.id,
            first_name: parts[0] || '',
            last_name: parts.slice(1).join(' ') || '',
            email: e.email,
            position: e.job_title,
            department: e.department_name,
          };
        });

      const BATCH = 100;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        const { error } = await supabase.from('phishing_group_members').insert(chunk);
        if (!error) inserted += chunk.length;
      }
      setSyncResult({ inserted });
      loadMembers(activeGroup.id);
      loadGroups();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const filteredEmployees = employees.filter(e => {
    if (alreadySyncedIds.has(e.id)) return false; // hide already-synced
    const matchDept = !filterDeptId || e.department_id === filterDeptId;
    const q = searchEmployee.toLowerCase();
    const matchSearch = !q || e.full_name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
    return matchDept && matchSearch;
  });

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedEmployeeIds(new Set(filteredEmployees.map(e => e.id)));
  const clearAll  = () => setSelectedEmployeeIds(new Set());

  const filteredMembers = searchMember.trim()
    ? members.filter(m => `${m.first_name} ${m.last_name} ${m.email} ${m.department}`.toLowerCase().includes(searchMember.toLowerCase()))
    : members;

  // ── GROUPS VIEW ────────────────────────────────────────
  if (view === 'groups') {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: T.greenBg, border: `1px solid ${T.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} style={{ color: T.green }} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Target Groups</h1>
              <p style={{ fontSize: 13, color: T.textBody, margin: 0 }}>Manage phishing campaign target lists.</p>
            </div>
          </div>
          <button onClick={() => { setGroupModal({ open: true, edit: null }); setGroupForm({ name: '', description: '' }); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.accent, color: T.accentDark, fontWeight: 700, borderRadius: 10, padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 13 }}>
            <Plus size={15} /> New Group
          </button>
        </div>

        {loadingGroups ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
          </div>
        ) : groups.length === 0 ? (
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '60px 20px', textAlign: 'center' }}>
            <Users size={36} style={{ color: 'rgba(255,255,255,0.08)', marginBottom: 12 }} />
            <p style={{ color: T.textMuted, fontSize: 14, margin: 0 }}>No target groups yet. Create one to start managing targets.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {groups.map(g => (
              <div key={g.id} className="aw-fade-up" style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s' }}
                onClick={() => openGroup(g)}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(200,255,0,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}>
                <div style={{ height: 3, background: `linear-gradient(90deg, ${T.green}, ${T.green}40)` }} />
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: T.white, marginBottom: 4 }}>{g.name}</div>
                      {g.description && <div style={{ fontSize: 12, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.description}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); setGroupModal({ open: true, edit: g }); setGroupForm({ name: g.name, description: g.description || '' }); }}
                        style={{ width: 28, height: 28, borderRadius: 7, background: T.blueBg, border: `1px solid ${T.blueBorder}`, color: T.blue, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Edit2 size={12} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteGroupId(g.id); }}
                        style={{ width: 28, height: 28, borderRadius: 7, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={12} style={{ color: T.textMuted }} />
                      <span style={{ fontSize: 12, color: T.textMuted }}>{g.member_count} member{g.member_count !== 1 ? 's' : ''}</span>
                    </div>
                    <span style={{ fontSize: 11, color: T.textMuted }}>{new Date(g.created_at).toLocaleDateString('en-SA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Group Modal */}
        {groupModal.open && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => setGroupModal({ open: false, edit: null })}>
            <div className="aw-modal-in" style={{ width: '100%', maxWidth: 440, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
              <div style={{ height: 3, background: `linear-gradient(90deg, ${T.green}, ${T.green}40)` }} />
              <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: T.white, margin: 0 }}>{groupModal.edit ? 'Edit Group' : 'New Target Group'}</h2>
                <button onClick={() => setGroupModal({ open: false, edit: null })} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Group Name *</label>
                  <input className="aw-groups-input" value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Finance Department" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Description</label>
                  <textarea className="aw-groups-input" value={groupForm.description} onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description..." rows={3} style={{ resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10 }}>
                <button onClick={() => setGroupModal({ open: false, edit: null })} style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textBody, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
                <button onClick={saveGroup} disabled={savingGroup} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 10, background: T.accent, color: T.accentDark, border: 'none', cursor: savingGroup ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, opacity: savingGroup ? 0.7 : 1 }}>
                  {savingGroup ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</> : <><Check size={14} /> Save</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Group Modal */}
        {deleteGroupId && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => setDeleteGroupId(null)}>
            <div className="aw-modal-in" style={{ width: '100%', maxWidth: 380, background: T.bgCard, border: `1px solid ${T.redBorder}`, borderRadius: 14, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
              <div style={{ height: 3, background: `linear-gradient(90deg, ${T.red}, ${T.red}40)` }} />
              <div style={{ padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={14} style={{ color: T.red }} /></div>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>Delete Group</h2>
                </div>
                <p style={{ fontSize: 13, color: T.textBody, margin: '0 0 18px' }}>This will permanently delete the group and all its members. This action cannot be undone.</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setDeleteGroupId(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textBody, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
                  <button onClick={deleteGroup} disabled={deletingGroup} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 10, background: T.red, color: T.white, border: 'none', cursor: deletingGroup ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                    {deletingGroup ? <Loader2 size={13} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> : <Trash2 size={13} />} Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── MEMBERS VIEW ────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => { setView('groups'); setActiveGroup(null); setCsvPreview(null); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`, borderRadius: 8, color: T.textBody, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}>
          <ArrowLeft size={13} /> Back to Groups
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: T.white, margin: 0 }}>{activeGroup?.name}</h1>
            <span style={{ fontSize: 12, padding: '2px 10px', background: T.greenBg, border: `1px solid ${T.greenBorder}`, borderRadius: 9999, color: T.green, fontWeight: 700 }}>
              {activeGroup?.member_count || members.length} members
            </span>
          </div>
          {activeGroup?.description && <p style={{ fontSize: 12, color: T.textMuted, margin: 0, marginTop: 2 }}>{activeGroup.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={openSyncModal} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, borderRadius: 8, color: T.purple, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>
            <RefreshCw size={13} /> Sync from Employees
          </button>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', background: T.greenBg, border: `1px solid ${T.greenBorder}`, borderRadius: 8, color: T.green, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'flex-start' }}>
        {/* Members Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textMuted }} />
            <input className="aw-groups-input" value={searchMember} onChange={e => setSearchMember(e.target.value)} placeholder="Search members..." style={{ paddingLeft: 34 }} />
          </div>

          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            {loadingMembers ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="aw-groups-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Position</th>
                      <th>Department</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.length > 0 ? filteredMembers.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600, color: T.white }}>{m.first_name} {m.last_name}</td>
                        <td style={{ color: T.blue }}>{m.email}</td>
                        <td style={{ color: T.textMuted }}>{m.position || '—'}</td>
                        <td style={{ color: T.textMuted }}>{m.department || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button onClick={() => setDeleteMemberId(m.id)} style={{ width: 26, height: 26, borderRadius: 6, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                            <Trash2 size={11} />
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} style={{ padding: '40px 0', textAlign: 'center', color: T.textMuted }}>
                        <Users size={28} style={{ color: 'rgba(255,255,255,0.07)', margin: '0 auto 8px', display: 'block' }} />
                        {searchMember ? 'No members match your search' : 'No members yet'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Add Member + CSV Import */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Add Single Member */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlus size={13} style={{ color: T.accent }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Add Member</span>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { key: 'first_name', label: 'First Name *', placeholder: 'John' },
                { key: 'last_name', label: 'Last Name', placeholder: 'Smith' },
                { key: 'email', label: 'Email *', placeholder: 'john@company.com' },
                { key: 'position', label: 'Position', placeholder: 'Software Engineer' },
                { key: 'department', label: 'Department', placeholder: 'Engineering' },
              ] as const).map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>{field.label}</label>
                  <input className="aw-groups-input" value={memberForm[field.key]} onChange={e => setMemberForm(f => ({ ...f, [field.key]: e.target.value }))} placeholder={field.placeholder} style={{ padding: '8px 12px', fontSize: 12 }} />
                </div>
              ))}
              <button onClick={addMember} disabled={addingMember} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 10, background: T.accent, color: T.accentDark, border: 'none', cursor: addingMember ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, opacity: addingMember ? 0.7 : 1, marginTop: 4 }}>
                {addingMember ? <><Loader2 size={13} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Adding…</> : <><Plus size={13} /> Add Member</>}
              </button>
            </div>
          </div>

          {/* CSV Import */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Upload size={13} style={{ color: T.orange }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>CSV Import</span>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11, color: T.textMuted }}>Expected headers: <span style={{ color: T.textBody, fontFamily: 'monospace' }}>first_name, last_name, email, position, department</span></div>

              {!csvPreview ? (
                <div
                  className={`aw-groups-dropzone ${dragOver ? 'dragover' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}>
                  <Upload size={22} style={{ color: T.textMuted, marginBottom: 8 }} />
                  <div style={{ fontSize: 13, color: T.textBody, fontWeight: 600 }}>Drop CSV here or click to browse</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>Supports .csv files</div>
                  <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleCSVFile(f); }} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>Preview (first 5 rows):</div>
                  <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'monospace' }}>
                      <thead>
                        <tr>
                          {csvPreview[0].map((h, i) => <th key={i} style={{ padding: '4px 8px', textAlign: 'left', color: T.textMuted, borderBottom: `1px solid ${T.borderFaint}` }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.slice(1).map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => <td key={ci} style={{ padding: '4px 8px', color: T.textBody }}>{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{csvRaw?.length} total rows to import</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setCsvPreview(null); setCsvRaw(null); }} style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textBody, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>Cancel</button>
                    <button onClick={importCSV} disabled={csvImporting} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 8, background: T.orange, color: T.white, border: 'none', cursor: csvImporting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, opacity: csvImporting ? 0.7 : 1 }}>
                      {csvImporting ? <><Loader2 size={12} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Importing…</> : <><Upload size={12} /> Import All</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Member Modal */}
      {deleteMemberId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setDeleteMemberId(null)}>
          <div className="aw-modal-in" style={{ width: '100%', maxWidth: 360, background: T.bgCard, border: `1px solid ${T.redBorder}`, borderRadius: 14, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.red}, ${T.red}40)` }} />
            <div style={{ padding: '20px 22px' }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: '0 0 10px' }}>Remove Member</h2>
              <p style={{ fontSize: 13, color: T.textBody, margin: '0 0 18px' }}>Remove this member from the group?</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDeleteMemberId(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textBody, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
                <button onClick={deleteMember} disabled={deletingMember} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 10, background: T.red, color: T.white, border: 'none', cursor: deletingMember ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                  {deletingMember ? <Loader2 size={13} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> : <Trash2 size={13} />} Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync from Employees Modal */}
      {syncModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => { if (!syncing) setSyncModal(false); }}>
          <div className="aw-modal-in" style={{ width: '100%', maxWidth: 640, maxHeight: '85vh', background: T.bgCard, border: `1px solid ${T.purpleBorder}`, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.purple}, ${T.purple}40)` }} />

            {/* Modal header */}
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <RefreshCw size={15} style={{ color: T.purple }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.white }}>Sync from Employees</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>Select employees to add to <span style={{ color: T.white, fontWeight: 600 }}>{activeGroup?.name}</span></div>
                </div>
              </div>
              <button onClick={() => setSyncModal(false)} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {syncResult ? (
              /* Success state */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '32px 20px' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: T.greenBg, border: `1px solid ${T.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={24} style={{ color: T.green }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: T.white, marginBottom: 6 }}>Sync Complete</div>
                  <div style={{ fontSize: 13, color: T.textBody }}>{syncResult.inserted} employee{syncResult.inserted !== 1 ? 's' : ''} added to the group.</div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Existing members were skipped automatically.</div>
                </div>
                <button onClick={() => setSyncModal(false)} style={{ padding: '10px 24px', borderRadius: 10, background: T.accent, color: T.accentDark, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13 }}>Done</button>
              </div>
            ) : (
              <>
                {/* Filters */}
                <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10, flexShrink: 0 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textMuted }} />
                    <input className="aw-groups-input" value={searchEmployee} onChange={e => setSearchEmployee(e.target.value)} placeholder="Search name or email…" style={{ paddingLeft: 30, padding: '8px 10px 8px 30px', fontSize: 12 }} />
                  </div>
                  <div style={{ position: 'relative', minWidth: 160 }}>
                    <Building2 size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, pointerEvents: 'none' }} />
                    <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, pointerEvents: 'none' }} />
                    <select value={filterDeptId} onChange={e => setFilterDeptId(e.target.value)}
                      style={{ width: '100%', paddingLeft: 28, paddingRight: 26, padding: '8px 26px 8px 28px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12, color: T.textBody, outline: 'none', appearance: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                      <option value="">All Departments</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Select all / clear row */}
                <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.borderFaint}`, flexShrink: 0, background: 'rgba(255,255,255,0.015)' }}>
                  <span style={{ fontSize: 12, color: T.textMuted }}>{filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''} shown</span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={selectAll} style={{ fontSize: 12, color: T.purple, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Select all</button>
                    <button onClick={clearAll} style={{ fontSize: 12, color: T.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Clear</button>
                  </div>
                </div>

                {/* Employee list */}
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {loadingEmployees ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.purple, animation: 'aw-spin 0.8s linear infinite' }} />
                    </div>
                  ) : filteredEmployees.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                      No employees found.
                    </div>
                  ) : (
                    filteredEmployees.map(e => {
                      const selected = selectedEmployeeIds.has(e.id);
                      return (
                        <div key={e.id} onClick={() => toggleEmployee(e.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', cursor: 'pointer', borderBottom: `1px solid ${T.borderFaint}`, background: selected ? 'rgba(167,139,250,0.06)' : 'transparent', transition: 'background 0.15s' }}>
                          <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${selected ? T.purple : T.border}`, background: selected ? T.purple : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                            {selected && <Check size={11} style={{ color: T.white }} />}
                          </div>
                          <div style={{ minWidth: 32, height: 32, borderRadius: '50%', background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: T.purple }}>{e.full_name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.full_name}</div>
                            <div style={{ fontSize: 11, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.email}</div>
                          </div>
                          {e.department_name && (
                            <span style={{ fontSize: 11, padding: '2px 8px', background: T.blueBg, border: `1px solid ${T.blueBorder}`, borderRadius: 9999, color: T.blue, flexShrink: 0 }}>{e.department_name}</span>
                          )}
                          {e.job_title && (
                            <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.job_title}</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 20px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, color: selectedEmployeeIds.size > 0 ? T.purple : T.textMuted, fontWeight: selectedEmployeeIds.size > 0 ? 700 : 400 }}>
                    {selectedEmployeeIds.size} selected
                  </span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setSyncModal(false)} style={{ padding: '9px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textBody, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13 }}>Cancel</button>
                    <button onClick={syncEmployees} disabled={syncing || selectedEmployeeIds.size === 0}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 10, background: selectedEmployeeIds.size > 0 ? T.purple : 'rgba(255,255,255,0.04)', color: selectedEmployeeIds.size > 0 ? T.white : T.textMuted, border: 'none', cursor: (syncing || selectedEmployeeIds.size === 0) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, opacity: syncing ? 0.7 : 1 }}>
                      {syncing ? <><Loader2 size={13} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Syncing…</> : <><RefreshCw size={13} /> Sync {selectedEmployeeIds.size > 0 ? selectedEmployeeIds.size : ''} Employee{selectedEmployeeIds.size !== 1 ? 's' : ''}</>}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
