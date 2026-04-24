import React, { useState, useEffect, useRef } from "react";
import {
  Plus, Edit2, Trash2, User, Eye, Key,
  Upload, X, Save, Loader2, Search, Users,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { User as UserType } from "../../lib/types";
import { buildSameHostRedirectUrl } from "../../lib/browserTenant";

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
  orange:      '#fb923c',
  orangeBg:    'rgba(251,146,60,0.08)',
  orangeBorder:'rgba(251,146,60,0.22)',
  red:         '#f87171',
  redBg:       'rgba(248,113,113,0.08)',
  redBorder:   'rgba(248,113,113,0.22)',
  blue:        '#60a5fa',
  blueBg:      'rgba(96,165,250,0.08)',
  blueBorder:  'rgba(96,165,250,0.22)',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Table ── */
  .aw-emp-table { width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; }
  .aw-emp-table th {
    padding: 11px 16px; text-align: left;
    font-size: 10px; font-weight: 700; color: #64748b;
    letter-spacing: 0.9px; text-transform: uppercase;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
  }
  .aw-emp-table td {
    padding: 13px 16px; font-size: 13px; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    transition: background 0.15s;
  }
  .aw-emp-table tr:hover td { background: rgba(255,255,255,0.025); }
  .aw-emp-table tr:last-child td { border-bottom: none; }

  /* ── Icon action button ── */
  .aw-emp-icon-btn {
    width: 30px; height: 30px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid transparent; cursor: pointer;
    transition: all 0.18s; background: none;
  }
  .aw-emp-icon-btn.view   { color: #34d399; border-color: rgba(52,211,153,0.22); background: rgba(52,211,153,0.07); }
  .aw-emp-icon-btn.view:hover   { background: rgba(52,211,153,0.16); }
  .aw-emp-icon-btn.reset  { color: #fb923c; border-color: rgba(251,146,60,0.22);  background: rgba(251,146,60,0.07); }
  .aw-emp-icon-btn.reset:hover  { background: rgba(251,146,60,0.16); }
  .aw-emp-icon-btn.edit   { color: #60a5fa; border-color: rgba(96,165,250,0.22);  background: rgba(96,165,250,0.07); }
  .aw-emp-icon-btn.edit:hover   { background: rgba(96,165,250,0.16); }
  .aw-emp-icon-btn.del    { color: #f87171; border-color: rgba(248,113,113,0.22); background: rgba(248,113,113,0.07); }
  .aw-emp-icon-btn.del:hover    { background: rgba(248,113,113,0.18); }

  /* ── Modal inputs ── */
  .aw-emp-input, .aw-emp-select {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-emp-input  { padding: 11px 14px; }
  .aw-emp-select {
    padding: 11px 36px 11px 14px;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    cursor: pointer;
  }
  .aw-emp-input:focus, .aw-emp-select:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-emp-input::placeholder { color: rgba(148,163,184,0.35); }
  .aw-emp-input:disabled { opacity: 0.45; cursor: not-allowed; }
  .aw-emp-select option { background: #1a1e0e; color: #ffffff; }

  .aw-emp-label {
    display: block; font-size: 12px; font-weight: 600;
    color: #94a3b8; margin-bottom: 7px; letter-spacing: 0.3px;
    font-family: 'Inter', sans-serif;
  }

  /* ── Primary btn ── */
  .aw-emp-btn-primary {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 16px rgba(200,255,0,0.18);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-emp-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
  .aw-emp-btn-primary:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }

  /* ── Ghost btn ── */
  .aw-emp-btn-ghost {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: 9px; cursor: pointer;
    font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-emp-btn-ghost:hover { background: rgba(255,255,255,0.08); color: #ffffff; }

  /* ── Green btn ── */
  .aw-emp-btn-green {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: 9px; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: rgba(52,211,153,0.10); border: 1px solid rgba(52,211,153,0.28);
    color: #34d399; transition: all 0.18s;
  }
  .aw-emp-btn-green:hover:not(:disabled) { background: rgba(52,211,153,0.18); }
  .aw-emp-btn-green:disabled { opacity: 0.45; cursor: not-allowed; }

  @keyframes aw-spin     { to { transform: rotate(360deg); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  @keyframes aw-fade-up  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
  .aw-fade-up  { animation: aw-fade-up  0.40s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-emp-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-emp-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface Department { id: string; name: string; }
interface EmployeesPageProps { onViewEmployee?: (employeeId: string) => void; }

/* ─────────────────────────────────────────
   EMAIL HELPER (unchanged)
───────────────────────────────────────── */
const sendEmail = async (to: string, fullName: string, subject: string, title: string, description: string, loginUrl?: string, isDelete = false) => {
  return await supabase.functions.invoke("send-email", {
    body: {
      to, subject,
      html: `<div style="margin:0;padding:32px 16px;background:#12140a;font-family:Arial,sans-serif;color:#ffffff;"><div style="max-width:600px;margin:0 auto;background:rgba(200,255,0,0.03);border:1px solid rgba(255,255,255,0.10);border-radius:18px;overflow:hidden;"><div style="padding:32px;background:linear-gradient(135deg,#12140a 0%,#1f2610 100%);border-bottom:1px solid rgba(255,255,255,0.10);"><p style="margin:0 0 10px;font-size:13px;letter-spacing:1.6px;text-transform:uppercase;color:#c8ff00;">Awareone</p><h1 style="margin:0;font-size:28px;line-height:1.3;">${title}, ${fullName}</h1></div><div style="padding:32px;"><p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#94a3b8;">${description}</p>${!isDelete ? `<div style="margin:24px 0;padding:24px;background:rgba(200,255,0,0.10);border:1px solid rgba(200,255,0,0.20);border-radius:14px;"><p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#c8ff00;">Account Details</p><p style="margin:0 0 10px;font-size:15px;color:#ffffff;"><strong>Email:</strong> ${to}</p><p style="margin:0 0 10px;font-size:15px;color:#ffffff;"><strong>Password:</strong> employee123</p><p style="margin:0;font-size:15px;color:#ffffff;"><strong>Role:</strong> Employee</p></div>` : ""}${loginUrl ? `<div style="margin:24px 0;"><a href="${loginUrl}" style="display:inline-block;padding:14px 22px;background:#c8ff00;color:#12140a;text-decoration:none;font-size:15px;font-weight:700;border-radius:10px;">Go to Login</a></div>` : ""}${!isDelete ? `<div style="margin:24px 0;padding:18px 20px;background:rgba(255,255,255,0.03);border-left:4px solid #c8ff00;border-radius:10px;"><p style="margin:0;font-size:14px;line-height:1.7;color:#cbd5e1;">For security, please sign in and change your password as soon as possible.</p></div>` : ""}</div></div></div>`,
    },
  });
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const EmployeesPage: React.FC<EmployeesPageProps> = ({ onViewEmployee }) => {
  const { user: currentUser } = useAuth();
  const loginUrl = buildSameHostRedirectUrl(window.location.href, "/login");

  const [employees, setEmployees]       = useState<UserType[]>([]);
  const [departments, setDepartments]   = useState<Department[]>([]);
  const [showModal, setShowModal]       = useState(false);
  const [editingEmployee, setEditing]   = useState<UserType | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [uploadError, setUploadError]   = useState('');
  const [uploadSummary, setUploadSummary] = useState('');
  const [isUploading, setIsUploading]   = useState(false);
  const [search, setSearch]             = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    full_name: '', email: '', phone: '',
    employee_id: '', password: 'employee123', department_id: '',
  });

  useEffect(() => { loadEmployees(); loadDepartments(); }, [currentUser]);

  const loadEmployees = async () => {
    if (!currentUser?.company_id) return;
    const { data } = await supabase.from("users")
      .select("*, department:departments!users_department_id_fkey(name)")
      .eq("company_id", currentUser.company_id).eq("role", "EMPLOYEE")
      .order("created_at", { ascending: false });
    if (data) setEmployees(data);
  };

  const loadDepartments = async () => {
    if (!currentUser?.company_id) return;
    const { data } = await supabase.from("departments").select("id, name")
      .eq("company_id", currentUser.company_id).order("name");
    if (data) setDepartments(data);
  };

  const resetForm = () => setFormData({ full_name: '', email: '', phone: '', employee_id: '', password: 'employee123', department_id: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingEmployee) {
        const { password: _, email: __, ...profileData } = formData;
        await supabase.from("users").update(profileData).eq("id", editingEmployee.id);
      } else {
        const { data: res, error } = await supabase.functions.invoke("user-admin", {
          body: { action: "createUser", email: formData.email, password: formData.password, full_name: formData.full_name, phone: formData.phone || null, employee_id: formData.employee_id || null, role: "EMPLOYEE", company_id: currentUser?.company_id, department_id: formData.department_id || null },
        });
        if (error || !res?.success) throw new Error(res?.error || "Failed to create employee");
        await sendEmail(formData.email, formData.full_name, "Welcome to Awareone", "Welcome aboard", "We created your employee account. Use the credentials below to sign in.", loginUrl);
      }
      setShowModal(false); setEditing(null); resetForm(); loadEmployees();
    } catch (err) { console.error(err); alert("Failed to save employee"); }
    finally { setSubmitting(false); }
  };

  const handleEdit = (emp: UserType) => {
    setEditing(emp);
    setFormData({ full_name: emp.full_name, email: emp.email, phone: emp.phone || '', employee_id: emp.employee_id || '', password: 'employee123', department_id: emp.department_id || '' });
    setShowModal(true);
  };

  const handleDelete = async (id: string, email: string, fullName: string) => {
    if (!confirm(`Delete ${fullName}?`)) return;
    try {
      const { data: res, error } = await supabase.functions.invoke("user-admin", { body: { action: "deleteUser", userId: id } });
      if (error || !res?.success) throw new Error(res?.error || "Failed to delete");
      await sendEmail(email, fullName, "Account Deleted", "Account Deleted", "Your account has been deleted.", undefined, true);
      loadEmployees();
    } catch { alert("Failed to delete employee"); }
  };

  const handleResetPassword = async (emp: UserType) => {
    if (!confirm(`Reset password for ${emp.full_name} to default (employee123)?`)) return;
    try {
      const { data: res, error } = await supabase.functions.invoke("user-admin", { body: { action: "resetPassword", userId: emp.id, password: "employee123" } });
      if (error || !res?.success) throw new Error(res?.error || "Failed to reset");
      alert(`Password reset!\nEmail: ${emp.email}\nNew Password: employee123`);
      await sendEmail(emp.email, emp.full_name, "Password Reset", "Password Reset", "Your password has been reset to the default.", loginUrl);
    } catch { alert("Failed to reset password"); }
  };

  /* CSV upload (logic unchanged) */
  const parseCSVLine = (line: string) => {
    const values: string[] = []; let current = ""; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i], next = line[i + 1];
      if (char === '"' && inQuotes && next === '"') { current += '"'; i++; continue; }
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { values.push(current); current = ""; continue; }
      current += char;
    }
    values.push(current); return values;
  };
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const uploadCSV = async (file?: File) => {
    if (!currentUser?.company_id) { setUploadError("Missing company context."); return; }
    if (!file) { setUploadError("Please select a CSV file."); return; }
    if (!file.name.toLowerCase().endsWith('.csv') && !file.type.includes('csv')) { setUploadError("Selected file is not a CSV."); return; }
    setUploadError(''); setUploadSummary(''); setIsUploading(true);
    try {
      const content = await file.text();
      const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
      if (lines.length < 2) { setUploadError("CSV must include a header row and at least one data row."); return; }
      const requiredHeaders = ["full name","email","employee id","phone","department","password"];
      const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
      if (headers.length !== requiredHeaders.length || !requiredHeaders.every((h, i) => headers[i] === h)) { setUploadError("Invalid CSV headers. Required: full name, email, employee id, phone, department, password."); return; }
      const deptLookup = new Map(departments.map(d => [d.name.trim().toLowerCase(), d.id]));
      const validRows: any[] = [];
      const rejected = { missingName: 0, missingEmail: 0, invalidEmail: 0, existingEmail: 0 };
      const existingEmails = employees.map(e => e.email);
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = requiredHeaders.reduce<Record<string, string>>((acc, h, idx) => { acc[h] = values[idx]?.trim() || ''; return acc; }, {});
        if (!row["full name"]) { rejected.missingName++; continue; }
        if (!row.email) { rejected.missingEmail++; continue; }
        if (!isValidEmail(row.email)) { rejected.invalidEmail++; continue; }
        if (existingEmails.includes(row.email)) { rejected.existingEmail++; continue; }
        const deptId = row.department ? deptLookup.get(row.department.trim().toLowerCase()) || null : null;
        validRows.push({ full_name: row["full name"], email: row.email, employee_id: row["employee id"], phone: row.phone, department_id: deptId, password: row.password, role: "EMPLOYEE", company_id: currentUser.company_id });
      }
      const totalRejected = Object.values(rejected).reduce((a, b) => a + b, 0);
      if (validRows.length === 0) { setUploadSummary(`No valid rows found. Rejected ${totalRejected}.`); return; }
      const { data: bulkResult, error: bulkError } = await supabase.functions.invoke("user-admin", { body: { action: "bulkCreate", users: validRows } });
      if (bulkError) throw bulkError;
      const serverFailed = bulkResult?.failed ?? 0;
      setUploadSummary(`Imported ${bulkResult?.succeeded ?? 0} employees. Rejected ${totalRejected + serverFailed} rows. (missing name: ${rejected.missingName}, email: ${rejected.missingEmail}, invalid: ${rejected.invalidEmail}, existing: ${rejected.existingEmail}, server: ${serverFailed})`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadEmployees();
    } catch { setUploadError("Failed to parse or upload CSV. Please check the file and try again."); }
    finally { setIsUploading(false); }
  };

  /* Filtered employees */
  const filtered = search.trim()
    ? employees.filter(e => e.full_name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase()) || e.employee_id?.toLowerCase().includes(search.toLowerCase()))
    : employees;

  /* Avatar initial */
  const Avatar = ({ name }: { name: string }) => (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: T.accent, flexShrink: 0 }}>
      {name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} style={{ color: T.accent }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Employees</h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>Manage employee accounts and access.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; setUploadError(''); setUploadSummary(''); uploadCSV(f); }} />

          <button className="aw-emp-btn-green" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Uploading…</> : <><Upload size={14} /> Upload CSV</>}
          </button>

          <button className="aw-emp-btn-primary" onClick={() => { setEditing(null); resetForm(); setShowModal(true); }}>
            <Plus size={14} /> Add Employee
          </button>
        </div>
      </div>

      {/* ── Upload feedback ── */}
      {(uploadError || uploadSummary) && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: uploadError ? T.redBg : T.greenBg, border: `1px solid ${uploadError ? T.redBorder : T.greenBorder}`, borderRadius: 10, fontSize: 13, color: uploadError ? T.red : T.green, lineHeight: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <span>{uploadError || uploadSummary}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, flexShrink: 0 }} onClick={() => { setUploadError(''); setUploadSummary(''); }}><X size={14} /></button>
        </div>
      )}

      {/* ── Search ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.05s', position: 'relative', marginBottom: 16, maxWidth: 360 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, pointerEvents: 'none' }} />
        <input
          style={{ width: '100%', padding: '10px 14px 10px 36px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, color: T.white, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
          placeholder="Search by name, email or ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={e => (e.target.style.borderColor = 'rgba(200,255,0,0.45)')}
          onBlur={e  => (e.target.style.borderColor = T.border)}
        />
        {search && <button style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 0 }} onClick={() => setSearch('')}><X size={13} /></button>}
      </div>

      {/* ── Table ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.08s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <table className="aw-emp-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Email</th>
              <th>Department</th>
              <th>Employee ID</th>
              <th>Phone</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => (
              <tr key={emp.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={emp.full_name} />
                    <span style={{ fontWeight: 600, color: T.white }}>{emp.full_name}</span>
                  </div>
                </td>
                <td style={{ color: T.textMuted }}>{emp.email}</td>
                <td>
                  {emp.department?.name
                    ? <span style={{ display: 'inline-flex', padding: '3px 10px', background: 'rgba(200,255,0,0.07)', border: '1px solid rgba(200,255,0,0.18)', borderRadius: 9999, fontSize: 11, fontWeight: 600, color: T.accent }}>{emp.department.name}</span>
                    : <span style={{ color: T.textMuted }}>—</span>
                  }
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: T.textMuted }}>{emp.employee_id || '—'}</td>
                <td style={{ color: T.textMuted }}>{emp.phone || '—'}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    {onViewEmployee && (
                      <button className="aw-emp-icon-btn view" title="View Details" onClick={() => onViewEmployee(emp.id)}><Eye size={13} /></button>
                    )}
                    <button className="aw-emp-icon-btn reset" title="Reset Password" onClick={() => handleResetPassword(emp)}><Key size={13} /></button>
                    <button className="aw-emp-icon-btn edit"  title="Edit Employee"  onClick={() => handleEdit(emp)}><Edit2 size={13} /></button>
                    <button className="aw-emp-icon-btn del"   title="Delete Employee" onClick={() => handleDelete(emp.id, emp.email, emp.full_name)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '52px 24px' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(200,255,0,0.06)', border: '1px solid rgba(200,255,0,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <User size={22} style={{ color: T.textMuted }} />
            </div>
            <p style={{ fontSize: 14, color: T.textBody, margin: '0 0 4px' }}>
              {search ? `No employees matching "${search}"` : 'No employees yet'}
            </p>
            {!search && <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>Click "Add Employee" to get started.</p>}
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => { setShowModal(false); setEditing(null); }}
        >
          <div
            className="aw-modal-in"
            style={{ width: '100%', maxWidth: 480, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.55)', fontFamily: "'Inter', sans-serif" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Accent bar */}
            <div style={{ height: 3, background: 'linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))' }} />

            {/* Header */}
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={16} style={{ color: T.accent }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>
                    {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                  </h2>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>
                    {editingEmployee ? `Editing ${editingEmployee.full_name}` : 'Fill in the employee details'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowModal(false); setEditing(null); }}
                style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Full Name */}
                <div>
                  <label className="aw-emp-label">Full Name <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-emp-input" type="text" required placeholder="Ahmed Al-Rashidi" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
                </div>

                {/* Email */}
                <div>
                  <label className="aw-emp-label">Email <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-emp-input" type="email" required placeholder="ahmed@company.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} disabled={!!editingEmployee} />
                </div>

                {/* ID + Phone in 2 cols */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="aw-emp-label">Employee ID</label>
                    <input className="aw-emp-input" type="text" placeholder="EMP-001" value={formData.employee_id} onChange={e => setFormData({ ...formData, employee_id: e.target.value })} />
                  </div>
                  <div>
                    <label className="aw-emp-label">Phone</label>
                    <input className="aw-emp-input" type="tel" placeholder="+966 5x xxx xxxx" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                </div>

                {/* Department */}
                <div>
                  <label className="aw-emp-label">Department</label>
                  <select className="aw-emp-select" value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })}>
                    <option value="">No Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <p style={{ fontSize: 11, color: T.textMuted, marginTop: 5 }}>Assigning a department auto-enrolls the employee in department courses.</p>
                </div>

                {/* Password (create only) */}
                {!editingEmployee && (
                  <div>
                    <label className="aw-emp-label">Password <span style={{ color: T.accent }}>*</span></label>
                    <input className="aw-emp-input" type="text" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10 }}>
                <button type="button" className="aw-emp-btn-ghost" onClick={() => { setShowModal(false); setEditing(null); }} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="aw-emp-btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={submitting}>
                  {submitting
                    ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> {editingEmployee ? 'Updating…' : 'Creating…'}</>
                    : <><Save size={14} /> {editingEmployee ? 'Update' : 'Create'}</>
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
