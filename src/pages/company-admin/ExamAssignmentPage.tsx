import React, { useState, useEffect, useMemo } from "react";
import {
  Send, Users, ClipboardList, AlertCircle, Undo2, Mail,
  Plus, X, Loader2, Building, CheckCircle, Clock, BookOpen,
  ChevronDown, ChevronRight, Search, Calendar, Filter,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { sendNotificationEmail } from "../../lib/email";
import { buildSameHostRedirectUrl } from "../../lib/browserTenant";

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bg:"#12140a",bgCard:"#1a1e0e",accent:"#c8ff00",accentDark:"#12140a",
  white:"#ffffff",textBody:"#cbd5e1",textMuted:"#64748b",
  border:"rgba(255,255,255,0.09)",borderFaint:"rgba(255,255,255,0.05)",
  green:"#34d399",greenBg:"rgba(52,211,153,0.08)",greenBorder:"rgba(52,211,153,0.22)",
  blue:"#60a5fa",blueBg:"rgba(96,165,250,0.08)",blueBorder:"rgba(96,165,250,0.22)",
  orange:"#fb923c",orangeBg:"rgba(251,146,60,0.08)",orangeBorder:"rgba(251,146,60,0.22)",
  red:"#f87171",redBg:"rgba(248,113,113,0.08)",redBorder:"rgba(248,113,113,0.22)",
  purple:"#a78bfa",purpleBg:"rgba(167,139,250,0.08)",purpleBorder:"rgba(167,139,250,0.22)",
  gold:"#fbbf24",goldBg:"rgba(251,191,36,0.08)",goldBorder:"rgba(251,191,36,0.22)",
} as const;

const STATUS_CFG: Record<string,{color:string;bg:string;border:string;label:string;icon:typeof Clock}> = {
  active:   {color:T.blue,  bg:T.blueBg,  border:T.blueBorder,  label:"Active",    icon:Clock},
  completed:{color:T.green, bg:T.greenBg, border:T.greenBorder, label:"Completed", icon:CheckCircle},
  expired:  {color:T.orange,bg:T.orangeBg,border:T.orangeBorder,label:"Expired",   icon:AlertCircle},
  withdrawn:{color:T.textMuted,bg:"rgba(255,255,255,0.04)",border:T.borderFaint,label:"Withdrawn",icon:X},
};

/* ─── Period presets ─── */
const PERIODS = [
  { key:"7d",   label:"7 days" },
  { key:"1m",   label:"1 month" },
  { key:"3m",   label:"3 months" },
  { key:"6m",   label:"6 months" },
  { key:"1y",   label:"1 year" },
  { key:"all",  label:"All time" },
  { key:"custom",label:"Custom" },
] as const;
type PeriodKey = typeof PERIODS[number]["key"];

const periodStart = (key: PeriodKey): Date | null => {
  if (key === "all" || key === "custom") return null;
  const d = new Date();
  if (key === "7d") { d.setDate(d.getDate() - 7); return d; }
  if (key === "1m") { d.setMonth(d.getMonth() - 1); return d; }
  if (key === "3m") { d.setMonth(d.getMonth() - 3); return d; }
  if (key === "6m") { d.setMonth(d.getMonth() - 6); return d; }
  if (key === "1y") { d.setFullYear(d.getFullYear() - 1); return d; }
  return null;
};

/* ─────────────────────────────────────────
   CSS — id = "aw-ea-styles"
───────────────────────────────────────── */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

/* Table */
.aw-ea-table{width:100%;border-collapse:collapse;font-family:'Inter',sans-serif}
.aw-ea-table th{padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:#64748b;letter-spacing:.9px;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02)}
.aw-ea-table td{padding:0;font-size:13px;color:#cbd5e1}

/* Group row */
.aw-ea-group-row{display:flex;align-items:center;gap:12px;padding:13px 16px;cursor:pointer;transition:background .14s;border-bottom:1px solid rgba(255,255,255,.04)}
.aw-ea-group-row:hover{background:rgba(255,255,255,.025)}
.aw-ea-group-row.open{background:rgba(200,255,0,.03);border-bottom-color:rgba(200,255,0,.10)}

/* Child row */
.aw-ea-child-row{display:flex;align-items:center;gap:12px;padding:10px 16px 10px 52px;border-bottom:1px solid rgba(255,255,255,.03);transition:background .14s}
.aw-ea-child-row:last-child{border-bottom:1px solid rgba(255,255,255,.04)}
.aw-ea-child-row:hover{background:rgba(255,255,255,.018)}

/* Inputs */
.aw-ea-input,.aw-ea-select{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:10px;font-size:14px;color:#fff;font-family:'Inter',sans-serif;outline:none;transition:border-color .2s,box-shadow .2s,background .2s}
.aw-ea-input{padding:11px 14px}
.aw-ea-select{padding:11px 36px 11px 14px;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
.aw-ea-input:focus,.aw-ea-select:focus{border-color:rgba(200,255,0,.45);box-shadow:0 0 0 3px rgba(200,255,0,.07);background:rgba(255,255,255,.06)}
.aw-ea-input::placeholder{color:rgba(148,163,184,.35)}
.aw-ea-select option{background:#1a1e0e;color:#fff}
input[type="date"].aw-ea-input::-webkit-calendar-picker-indicator{filter:invert(1) opacity(.4);cursor:pointer}
input[type="number"].aw-ea-input::-webkit-inner-spin-button{filter:invert(1) opacity(.3)}
.aw-ea-label{display:block;font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:7px;letter-spacing:.3px;font-family:'Inter',sans-serif}

/* Filter search */
.aw-ea-search{display:flex;align-items:center;gap:8px;padding:9px 13px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:9px;flex:1;min-width:180px}
.aw-ea-search input{background:none;border:none;outline:none;color:#fff;font-size:13px;font-family:'Inter',sans-serif;width:100%}
.aw-ea-search input::placeholder{color:rgba(148,163,184,.35)}
.aw-ea-search:focus-within{border-color:rgba(200,255,0,.40)}

/* Period pill */
.aw-ea-period-btn{padding:7px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02);cursor:pointer;font-size:11px;font-weight:700;font-family:'Inter',sans-serif;color:#64748b;transition:all .18s;white-space:nowrap}
.aw-ea-period-btn:hover{background:rgba(255,255,255,.06);color:#cbd5e1}
.aw-ea-period-btn.sel{background:rgba(200,255,0,.08);border-color:rgba(200,255,0,.28);color:#c8ff00}

/* Filter select (small) */
.aw-ea-fsel{padding:7px 30px 7px 11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:8px;font-size:11px;font-weight:600;color:#cbd5e1;font-family:'Inter',sans-serif;outline:none;appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center}
.aw-ea-fsel:focus{border-color:rgba(200,255,0,.40)}
.aw-ea-fsel option{background:#1a1e0e}

/* Assignment type tabs (modal) */
.aw-ea-type-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:10px 8px;border-radius:9px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02);cursor:pointer;font-size:11px;font-weight:700;font-family:'Inter',sans-serif;color:#64748b;transition:all .18s}
.aw-ea-type-btn:hover{background:rgba(255,255,255,.05)}
.aw-ea-type-btn.sel{background:rgba(200,255,0,.08);border-color:rgba(200,255,0,.28);color:#c8ff00}

/* Toggle */
.aw-ea-toggle-row{display:flex;align-items:center;gap:10px;cursor:pointer;padding:11px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);transition:all .18s;font-family:'Inter',sans-serif}
.aw-ea-toggle-row.on{background:rgba(52,211,153,.06);border-color:rgba(52,211,153,.22)}

/* Action icon btns */
.aw-ea-icon-btn{width:30px;height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center;border:1px solid transparent;cursor:pointer;background:none;transition:all .18s;position:relative;flex-shrink:0}
.aw-ea-icon-btn.remind  {color:#60a5fa;border-color:rgba(96,165,250,.22);background:rgba(96,165,250,.08)}
.aw-ea-icon-btn.remind:hover  {background:rgba(96,165,250,.18)}
.aw-ea-icon-btn.withdraw{color:#f87171;border-color:rgba(248,113,113,.22);background:rgba(248,113,113,.07)}
.aw-ea-icon-btn.withdraw:hover{background:rgba(248,113,113,.18)}
.aw-ea-icon-btn .tooltip{pointer-events:none;position:absolute;bottom:calc(100% + 7px);left:50%;transform:translateX(-50%);white-space:nowrap;padding:4px 9px;background:#0a0c06;border:1px solid rgba(255,255,255,.09);border-radius:6px;font-size:11px;color:#cbd5e1;font-family:'Inter';font-weight:600;opacity:0;transition:opacity .18s;z-index:10}
.aw-ea-icon-btn:hover .tooltip{opacity:1}

/* Remind-all btn */
.aw-ea-remind-all{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:700;font-family:'Inter',sans-serif;background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.22);color:#60a5fa;transition:all .18s;white-space:nowrap}
.aw-ea-remind-all:hover{background:rgba(96,165,250,.18)}
.aw-ea-remind-all:disabled{opacity:.35;cursor:not-allowed}

/* Save btn */
.aw-ea-save-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:13px 20px;border-radius:10px;border:none;cursor:pointer;font-size:14px;font-weight:700;font-family:'Inter',sans-serif;background:#c8ff00;color:#12140a;box-shadow:0 0 18px rgba(200,255,0,.20);transition:opacity .2s,transform .15s}
.aw-ea-save-btn:hover{opacity:.88;transform:translateY(-1px)}
.aw-ea-save-btn:disabled{background:rgba(255,255,255,.08);color:rgba(255,255,255,.25);cursor:not-allowed;box-shadow:none}
.aw-ea-cancel-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:13px 20px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:600;font-family:'Inter',sans-serif;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);color:#94a3b8;transition:all .18s}
.aw-ea-cancel-btn:hover{background:rgba(255,255,255,.08);color:#fff}

/* multi-select list */
.aw-ea-sel-count{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;background:rgba(200,255,0,.08);border:1px solid rgba(200,255,0,.22);color:#c8ff00}
.aw-ea-list{max-height:190px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;padding-right:4px}
.aw-ea-list::-webkit-scrollbar{width:3px}
.aw-ea-list::-webkit-scrollbar-track{background:transparent}
.aw-ea-list::-webkit-scrollbar-thumb{background:rgba(200,255,0,.20);border-radius:9999px}
.aw-ea-check-row{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;cursor:pointer;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02);transition:all .15s;font-family:'Inter',sans-serif}
.aw-ea-check-row:hover{background:rgba(255,255,255,.05)}
.aw-ea-check-row.on{background:rgba(200,255,0,.06);border-color:rgba(200,255,0,.22)}
.aw-ea-checkbox{width:16px;height:16px;border-radius:4px;border:1.5px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
.aw-ea-check-row.on .aw-ea-checkbox{background:#c8ff00;border-color:#c8ff00}

/* Progress bar */
.aw-ea-prog-track{height:5px;background:rgba(255,255,255,.07);border-radius:9999px;overflow:hidden;min-width:60px}
.aw-ea-prog-fill{height:100%;border-radius:9999px;transition:width .4s ease}

.aw-ea-scroll::-webkit-scrollbar{width:3px}
.aw-ea-scroll::-webkit-scrollbar-track{background:transparent}
.aw-ea-scroll::-webkit-scrollbar-thumb{background:rgba(200,255,0,.20);border-radius:9999px}

@keyframes aw-spin{to{transform:rotate(360deg)}}
@keyframes aw-fade-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes aw-modal-in{from{opacity:0;transform:scale(.97) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes aw-slide-down{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.aw-fade-up  {animation:aw-fade-up   .4s ease both}
.aw-modal-in {animation:aw-modal-in  .28s ease both}
.aw-slide-down{animation:aw-slide-down .22s ease both}
`;

if (typeof document !== "undefined" && !document.getElementById("aw-ea-styles")) {
  const tag = document.createElement("style");
  tag.id = "aw-ea-styles"; tag.textContent = STYLES; document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface Exam       { id: string; title: string; description: string; passing_score: number; }
interface Employee   { id: string; full_name: string; email: string; department_id: string | null; }
interface Department { id: string; name: string; }
interface AssignedExam {
  id: string; exam_id: string; exams?: { title: string };
  assigned_to_employee: { id?: string; full_name: string; email: string } | null;
  assigned_to_department: { id: string; name: string } | null;
  due_date: string | null; max_attempts: number; status: string; assigned_at: string;
}
type AssignmentInsert = {
  exam_id: string; company_id: string | undefined; assigned_by: string | undefined;
  due_date: string | null; max_attempts: number; is_mandatory: boolean; status: "active";
  assigned_to_employee?: string; assigned_to_department?: string;
};

/* ─── Group shape ─── */
interface ExamGroup {
  exam_id: string; exam_title: string;
  total: number; completed: number; active: number; expired: number;
  rows: AssignedExam[];
}

const fmt = (d: string) => new Date(d).toLocaleDateString("en-SA", { year: "numeric", month: "short", day: "numeric" });

/* ─────────────────────────────────────────
   STAT CARD
───────────────────────────────────────── */
const StatCard: React.FC<{ icon: React.ElementType; color: string; bg: string; label: string; value: number; delay?: string }> = ({
  icon: Icon, color, bg, label, value, delay = "0s",
}) => (
  <div className="aw-fade-up" style={{ animationDelay: delay, padding: "16px 18px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, position: "relative", overflow: "hidden", flex: "1 1 140px" }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},${color}40)` }} />
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: bg, border: `1px solid ${color}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={15} style={{ color }} />
      </div>
      <span style={{ fontSize: 24, fontWeight: 900, color: T.white }}>{value}</span>
    </div>
    <div style={{ fontSize: 12, color: T.textMuted }}>{label}</div>
  </div>
);

const Checkmark = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M2 5L4.5 7.5L8.5 3" stroke="#12140a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const ExamAssignmentPage: React.FC = () => {
  const { user }  = useAuth();
  const loginUrl  = buildSameHostRedirectUrl(window.location.href, "/login");

  const [exams, setExams]             = useState<Exam[]>([]);
  const [employees, setEmployees]     = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<AssignedExam[]>([]);
  const [showModal, setShowModal]     = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

  /* ── Expanded groups ── */
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  /* ── Filters ── */
  const [search, setSearch]         = useState("");
  const [period, setPeriod]         = useState<PeriodKey>("3m");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [examFilter, setExamFilter]     = useState("all");

  /* ── Modal form ── */
  const [examId, setExamId]           = useState("");
  const [assignType, setAssignType]   = useState<"employee"|"department"|"all">("employee");
  const [selEmps, setSelEmps]         = useState<string[]>([]);
  const [selDepts, setSelDepts]       = useState<string[]>([]);
  const [dueDate, setDueDate]         = useState("");
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [isMandatory, setIsMandatory] = useState(true);

  useEffect(() => { loadExams(); loadEmployees(); loadDepartments(); loadAssignments(); }, [user]);

  const loadExams = async () => {
    const { data } = await supabase.from("exams").select("*").order("title");
    if (data) setExams(data);
  };
  const loadEmployees = async () => {
    if (!user?.company_id) return;
    const { data } = await supabase.from("users").select("id,full_name,email,department_id").eq("company_id", user.company_id).eq("role", "EMPLOYEE").order("full_name");
    if (data) setEmployees(data);
  };
  const loadDepartments = async () => {
    if (!user?.company_id) return;
    const { data } = await supabase.from("departments").select("id,name").eq("company_id", user.company_id).order("name");
    if (data) setDepartments(data);
  };
  const loadAssignments = async () => {
    if (!user?.company_id) return;
    const { data: raw, error } = await supabase.from("assigned_exams").select("*").eq("company_id", user.company_id).not("status", "in", "(withdrawn)").order("assigned_at", { ascending: false });
    if (error) { setError("Failed to load: " + error.message); return; }
    if (!raw?.length) { setAssignments([]); return; }

    const examIds = [...new Set(raw.map(a => a.exam_id))];
    const empIds  = [...new Set(raw.map(a => a.assigned_to_employee).filter(Boolean))];
    const deptIds = [...new Set(raw.map(a => a.assigned_to_department).filter(Boolean))];

    const [er, ur, dr, rr] = await Promise.all([
      supabase.from("exams").select("id,title").in("id", examIds),
      empIds.length  > 0 ? supabase.from("users").select("id,full_name,email").in("id", empIds)  : Promise.resolve({ data: [] }),
      deptIds.length > 0 ? supabase.from("departments").select("id,name").in("id", deptIds)      : Promise.resolve({ data: [] }),
      supabase.from("exam_results").select("assignment_id,passed").eq("passed", true),
    ]);

    const em = new Map((er.data || []).map(e => [e.id, e]));
    const um = new Map((ur.data || []).map(u => [u.id, u]));
    const dm = new Map((dr.data || []).map(d => [d.id, d]));
    const pi = new Set((rr.data || []).map(r => r.assignment_id));

    const enriched = await Promise.all(raw.map(async a => {
      let s = a.status;
      if (pi.has(a.id) && s === "active") {
        s = "completed";
        await supabase.from("assigned_exams").update({ status: "completed" }).eq("id", a.id);
      }
      return {
        ...a, status: s,
        exams: em.get(a.exam_id) || null,
        assigned_to_employee: a.assigned_to_employee ? (um.get(a.assigned_to_employee) ? { id: a.assigned_to_employee, ...um.get(a.assigned_to_employee) } : null) : null,
        assigned_to_department: a.assigned_to_department ? dm.get(a.assigned_to_department) || null : null,
      };
    }));
    setAssignments(enriched as AssignedExam[]);
  };

  /* ── Filtered assignments ── */
  const filtered = useMemo(() => {
    let list = [...assignments];

    // Date filter
    const start = period === "custom"
      ? (customFrom ? new Date(customFrom) : null)
      : periodStart(period);
    const end = period === "custom" && customTo ? new Date(customTo) : null;
    if (start) list = list.filter(a => new Date(a.assigned_at) >= start);
    if (end)   list = list.filter(a => new Date(a.assigned_at) <= end);

    // Status filter
    if (statusFilter !== "all") list = list.filter(a => a.status === statusFilter);

    // Exam filter
    if (examFilter !== "all") list = list.filter(a => a.exam_id === examFilter);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.exams?.title?.toLowerCase().includes(q) ||
        a.assigned_to_employee?.full_name?.toLowerCase().includes(q) ||
        a.assigned_to_employee?.email?.toLowerCase().includes(q) ||
        a.assigned_to_department?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [assignments, period, customFrom, customTo, statusFilter, examFilter, search]);

  /* ── Group by exam ── */
  const groups = useMemo<ExamGroup[]>(() => {
    const map = new Map<string, ExamGroup>();
    for (const a of filtered) {
      const eid = a.exam_id;
      if (!map.has(eid)) {
        map.set(eid, { exam_id: eid, exam_title: a.exams?.title || "Unknown", total: 0, completed: 0, active: 0, expired: 0, rows: [] });
      }
      const g = map.get(eid)!;
      g.total++;
      g.rows.push(a);
      if (a.status === "completed") g.completed++;
      else if (a.status === "active")  g.active++;
      else if (a.status === "expired") g.expired++;
    }
    return [...map.values()].sort((a, b) => a.exam_title.localeCompare(b.exam_title));
  }, [filtered]);

  const toggleGroup = (examId: string) =>
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(examId) ? next.delete(examId) : next.add(examId);
      return next;
    });

  /* ── Remind all incomplete in group ── */
  const handleRemindAll = async (group: ExamGroup) => {
    const incompleteRows = group.rows.filter(a => a.status === "active");
    if (!incompleteRows.length) { alert("No active assignments to remind."); return; }
    if (!confirm(`Send reminders for "${group.exam_title}" to ${incompleteRows.length} employee(s)?`)) return;
    setSendingReminderId(group.exam_id);
    try {
      const recipients = incompleteRows
        .filter(a => a.assigned_to_employee?.email)
        .map(a => ({ email: a.assigned_to_employee!.email, full_name: a.assigned_to_employee!.full_name }));
      // For department assignments, expand to employees
      const deptRows = incompleteRows.filter(a => a.assigned_to_department?.id);
      for (const dr of deptRows) {
        const emps = employees.filter(e => e.department_id === dr.assigned_to_department?.id && e.email);
        emps.forEach(e => recipients.push({ email: e.email, full_name: e.full_name }));
      }
      if (!recipients.length) { alert("No email recipients found."); return; }
      const dueTxt = incompleteRows[0]?.due_date ? ` Please complete it before ${new Date(incompleteRows[0].due_date).toLocaleDateString()}.` : "";
      await Promise.allSettled(recipients.map(r =>
        sendNotificationEmail(r.email, r.full_name, `Exam Reminder: ${group.exam_title}`, "Exam Reminder",
          `This is a reminder that "${group.exam_title}" is still assigned to you.${dueTxt} Please log in to complete it.`, { loginUrl })
      ));
      alert(`Reminders sent to ${recipients.length} recipient(s).`);
    } finally { setSendingReminderId(null); }
  };

  /* ── Remind single row ── */
  const handleReminder = async (a: AssignedExam) => {
    setError(null);
    const title = a.exams?.title || "your assigned exam";
    const dueTxt = a.due_date ? ` Complete it before ${new Date(a.due_date).toLocaleDateString()}.` : "";
    let recipients: { email: string; full_name: string }[] = [];
    if (a.assigned_to_employee?.email) {
      recipients = [{ email: a.assigned_to_employee.email, full_name: a.assigned_to_employee.full_name }];
    } else if (a.assigned_to_department?.id) {
      recipients = employees.filter(e => e.department_id === a.assigned_to_department?.id && e.email).map(e => ({ email: e.email, full_name: e.full_name }));
    }
    if (!recipients.length) { setError("No recipients found."); return; }
    if (!confirm(`Send reminder for "${title}" to ${recipients.length > 1 ? recipients.length + " employees" : recipients[0].full_name}?`)) return;
    await Promise.allSettled(recipients.map(r =>
      sendNotificationEmail(r.email, r.full_name, `Exam Reminder: ${title}`, "Exam Reminder",
        `This is a reminder that "${title}" is still assigned to you.${dueTxt} Please log in to complete it.`, { loginUrl })
    ));
    alert("Reminder(s) sent.");
  };

  const handleWithdraw = async (id: string, title: string, name: string) => {
    if (!confirm(`Withdraw "${title}" from ${name}?\n\nAttempt history will be preserved.`)) return;
    const { error } = await supabase.from("assigned_exams").update({ status: "withdrawn", withdrawn_at: new Date().toISOString(), withdrawn_by: user?.id }).eq("id", id);
    if (error) { setError("Error: " + error.message); return; }
    loadAssignments();
  };

  /* ── Assign ── */
  const resolveInserts = (): AssignmentInsert[] => {
    const base = { exam_id: examId, company_id: user?.company_id, assigned_by: user?.id, due_date: dueDate || null, max_attempts: maxAttempts, is_mandatory: isMandatory, status: "active" as const };
    if (assignType === "all")        return employees.map(e => ({ ...base, assigned_to_employee: e.id }));
    if (assignType === "employee")   return selEmps.map(id => ({ ...base, assigned_to_employee: id }));
    return selDepts.map(id => ({ ...base, assigned_to_department: id }));
  };
  const isFormValid = () => {
    if (!examId) return false;
    if (assignType === "employee"   && selEmps.length === 0)  return false;
    if (assignType === "department" && selDepts.length === 0) return false;
    if (assignType === "all"        && employees.length === 0) return false;
    return true;
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault(); if (isAssigning || !isFormValid()) return;
    setSaving(true); setIsAssigning(true); setError(null);
    try {
      const inserts = resolveInserts();
      const examTitle = exams.find(ex => ex.id === examId)?.title || "exam";
      const dueDateText = dueDate ? ` Complete it before ${new Date(dueDate).toLocaleDateString()}.` : "";
      let skipped = 0;
      for (const row of inserts) {
        const { error: ie } = await supabase.from("assigned_exams").insert(row);
        if (ie) { if (ie.code === "23505") { skipped++; } else { setError("Failed: " + ie.message); return; } }
      }
      const recipients = assignType === "all"
        ? employees.filter(e => e.email).map(e => ({ email: e.email, full_name: e.full_name }))
        : assignType === "employee"
          ? employees.filter(e => selEmps.includes(e.id) && e.email).map(e => ({ email: e.email, full_name: e.full_name }))
          : employees.filter(e => e.department_id && selDepts.includes(e.department_id) && e.email).map(e => ({ email: e.email, full_name: e.full_name }));
      let warn: string | null = null;
      if (recipients.length > 0) {
        const res = await Promise.allSettled(recipients.map(r =>
          sendNotificationEmail(r.email, r.full_name, `New Exam Assigned: ${examTitle}`, "New Exam Assigned",
            `"${examTitle}" has been assigned to you.${dueDateText} Please log in to complete it.`, { loginUrl })
        ));
        const failed = res.filter(r => r.status === "rejected").length;
        if (failed > 0) warn = `${failed} email(s) could not be sent.`;
      }
      if (skipped > 0) warn = (warn ? warn + " " : "") + `${skipped} duplicate(s) skipped.`;
      resetModal(); setError(warn); loadAssignments();
    } finally { setIsAssigning(false); setSaving(false); }
  };

  const resetModal = () => { setExamId(""); setAssignType("employee"); setSelEmps([]); setSelDepts([]); setDueDate(""); setMaxAttempts(1); setIsMandatory(true); setShowModal(false); };
  const toggleEmp  = (id: string) => setSelEmps(p  => p.includes(id)  ? p.filter(x => x !== id)  : [...p, id]);
  const toggleDept = (id: string) => setSelDepts(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const counts = {
    active:    assignments.filter(a => a.status === "active").length,
    completed: assignments.filter(a => a.status === "completed").length,
    expired:   assignments.filter(a => a.status === "expired").length,
    exams:     new Set(assignments.map(a => a.exam_id)).size,
  };

  const assignBtnLabel = () => {
    if (assignType === "all")                                return `Assign to All (${employees.length})`;
    if (assignType === "employee"   && selEmps.length > 0)  return `Assign (${selEmps.length} emp)`;
    if (assignType === "department" && selDepts.length > 0) return `Assign (${selDepts.length} dept)`;
    return "Assign Exam";
  };

  /* ── Progress color ── */
  const progColor = (pct: number) => pct >= 80 ? T.green : pct >= 40 ? T.gold : T.orange;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 5 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ClipboardList size={18} style={{ color: T.blue }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: "-0.3px", margin: 0 }}>Exam Assignment</h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>Assign and track exams across employees and departments.</p>
        </div>
        <button onClick={() => { setShowModal(true); setError(null); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", background: T.accent, color: T.accentDark, boxShadow: "0 0 18px rgba(200,255,0,.20)" }}>
          <Plus size={14} /> Assign Exam
        </button>
      </div>

      {/* ── Error ── */}
      {error && !showModal && (
        <div style={{ padding: "11px 16px", background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 10, display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.red }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} /><span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: T.red, padding: 0 }}><X size={13} /></button>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="aw-fade-up" style={{ animationDelay: "0.05s", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard icon={ClipboardList} color={T.blue}   bg={T.blueBg}   label="Active"          value={counts.active}    delay="0.05s" />
        <StatCard icon={CheckCircle}  color={T.green}  bg={T.greenBg}  label="Completed"        value={counts.completed} delay="0.09s" />
        <StatCard icon={AlertCircle}  color={T.orange} bg={T.orangeBg} label="Expired"           value={counts.expired}  delay="0.13s" />
        <StatCard icon={BookOpen}     color={T.purple} bg={T.purpleBg} label="Distinct Exams"    value={counts.exams}    delay="0.17s" />
        <StatCard icon={Users}        color={T.gold}   bg={T.goldBg}   label="Total Employees"   value={employees.length} delay="0.21s" />
      </div>

      {/* ── Filters bar ── */}
      <div className="aw-fade-up" style={{ animationDelay: "0.23s", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Row 1: search + status + exam */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Filter size={13} style={{ color: T.textMuted }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T.textMuted }}>FILTERS</span>
          </div>
          <div className="aw-ea-search" style={{ maxWidth: 260 }}>
            <Search size={13} style={{ color: T.textMuted, flexShrink: 0 }} />
            <input placeholder="Search exam, employee, department…" value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 0, display: "flex" }}><X size={12} /></button>}
          </div>
          <select className="aw-ea-fsel" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="expired">Expired</option>
          </select>
          <select className="aw-ea-fsel" value={examFilter} onChange={e => setExamFilter(e.target.value)}>
            <option value="all">All exams</option>
            {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
          </select>
          {(search || statusFilter !== "all" || examFilter !== "all") && (
            <button onClick={() => { setSearch(""); setStatusFilter("all"); setExamFilter("all"); }}
              style={{ fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
              Clear filters
            </button>
          )}
        </div>

        {/* Row 2: Period presets */}
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          <Calendar size={13} style={{ color: T.textMuted, flexShrink: 0 }} />
          {PERIODS.map(p => (
            <button key={p.key} className={`aw-ea-period-btn${period === p.key ? " sel" : ""}`} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
          {period === "custom" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="date" className="aw-ea-fsel" style={{ padding: "6px 10px" }} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <span style={{ fontSize: 11, color: T.textMuted }}>→</span>
              <input type="date" className="aw-ea-fsel" style={{ padding: "6px 10px" }} value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          )}
          <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 4 }}>{filtered.length} assignments</span>
        </div>
      </div>

      {/* ── Grouped table ── */}
      <div className="aw-fade-up" style={{ animationDelay: "0.26s", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.borderFaint}`, display: "flex", alignItems: "center", gap: 8 }}>
          <BookOpen size={14} style={{ color: T.accent }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Assignments by Exam</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: T.textMuted }}>{groups.length} exam{groups.length !== 1 ? "s" : ""}</span>
        </div>

        {groups.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <ClipboardList size={22} style={{ color: T.blue }} />
            </div>
            <p style={{ fontSize: 14, color: T.textMuted, margin: 0 }}>No assignments found</p>
            <p style={{ fontSize: 12, color: T.textMuted, opacity: 0.7, margin: "6px 0 18px" }}>
              {search || statusFilter !== "all" || examFilter !== "all" || period !== "all" ? "Try adjusting your filters" : "Click \"Assign Exam\" to get started"}
            </p>
          </div>
        ) : (
          <div>
            {groups.map((group, gi) => {
              const isOpen = expandedGroups.has(group.exam_id);
              const pct = group.total > 0 ? Math.round((group.completed / group.total) * 100) : 0;
              const pc = progColor(pct);
              const isSendingThis = sendingReminderId === group.exam_id;

              return (
                <div key={group.exam_id} style={{ borderBottom: gi < groups.length - 1 ? `1px solid ${T.borderFaint}` : "none" }}>
                  {/* ── Group row ── */}
                  <div className={`aw-ea-group-row${isOpen ? " open" : ""}`} onClick={() => toggleGroup(group.exam_id)}>
                    {/* Chevron */}
                    <div style={{ flexShrink: 0, color: isOpen ? T.accent : T.textMuted, transition: "color .18s" }}>
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>

                    {/* Exam icon */}
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <ClipboardList size={15} style={{ color: T.blue }} />
                    </div>

                    {/* Title */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.exam_title}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                        {group.total} assignment{group.total !== 1 ? "s" : ""}
                        {group.active > 0 && <span style={{ color: T.blue, marginLeft: 8 }}>· {group.active} active</span>}
                        {group.expired > 0 && <span style={{ color: T.orange, marginLeft: 8 }}>· {group.expired} expired</span>}
                      </div>
                    </div>

                    {/* Progress */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: pc }}>{pct}%</div>
                        <div style={{ fontSize: 10, color: T.textMuted }}>{group.completed}/{group.total}</div>
                      </div>
                      <div className="aw-ea-prog-track" style={{ width: 70 }}>
                        <div className="aw-ea-prog-fill" style={{ width: `${pct}%`, background: pc }} />
                      </div>
                    </div>

                    {/* Stat badges */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      {[
                        { label: "Completed", val: group.completed, color: T.green, bg: T.greenBg },
                        { label: "Active",    val: group.active,    color: T.blue,  bg: T.blueBg  },
                        { label: "Expired",   val: group.expired,   color: T.orange,bg: T.orangeBg},
                      ].map(s => s.val > 0 && (
                        <span key={s.label} style={{ padding: "3px 9px", borderRadius: 9999, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color }}>
                          {s.val} {s.label}
                        </span>
                      ))}
                    </div>

                    {/* Remind all */}
                    {group.active > 0 && (
                      <button
                        className="aw-ea-remind-all"
                        disabled={isSendingThis}
                        onClick={e => { e.stopPropagation(); handleRemindAll(group); }}
                      >
                        {isSendingThis ? <Loader2 size={11} style={{ animation: "aw-spin 0.8s linear infinite" }} /> : <Mail size={11} />}
                        Remind All ({group.active})
                      </button>
                    )}
                  </div>

                  {/* ── Child rows ── */}
                  {isOpen && (
                    <div className="aw-slide-down" style={{ background: "rgba(0,0,0,0.15)", borderTop: `1px solid ${T.borderFaint}` }}>
                      {/* Child header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px 8px 52px", borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                        {["Assigned To", "Max Attempts", "Due Date", "Status", "Date", "Actions"].map((h, i) => (
                          <div key={h} style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", flex: i === 0 ? "1 1 160px" : "0 0 auto", minWidth: i === 0 ? 160 : i === 5 ? 80 : 90, textAlign: i > 0 ? "center" : "left" }}>
                            {h}
                          </div>
                        ))}
                      </div>

                      {group.rows.map(a => {
                        const cfg  = STATUS_CFG[a.status] ?? STATUS_CFG.active;
                        const Icon = cfg.icon;
                        const target = a.assigned_to_employee?.full_name ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160 }}>
                            <div style={{ width: 26, height: 26, borderRadius: "50%", background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Users size={11} style={{ color: T.blue }} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: T.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>{a.assigned_to_employee.full_name}</div>
                              <div style={{ fontSize: 10, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>{a.assigned_to_employee.email}</div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160 }}>
                            <div style={{ width: 26, height: 26, borderRadius: "50%", background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Building size={11} style={{ color: T.purple }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: T.white }}>Dept: {a.assigned_to_department?.name || "N/A"}</span>
                          </div>
                        );

                        return (
                          <div key={a.id} className="aw-ea-child-row">
                            <div style={{ flex: "1 1 160px", minWidth: 160 }}>{target}</div>
                            <div style={{ minWidth: 90, textAlign: "center" }}>
                              <span style={{ padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,.04)", color: T.textBody }}>{a.max_attempts}</span>
                            </div>
                            <div style={{ minWidth: 90, textAlign: "center", fontSize: 11, color: T.textMuted }}>{a.due_date ? fmt(a.due_date) : "—"}</div>
                            <div style={{ minWidth: 90, textAlign: "center" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 9999, fontSize: 9, fontWeight: 700, textTransform: "uppercase", background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                                <Icon size={8} /> {cfg.label}
                              </span>
                            </div>
                            <div style={{ minWidth: 90, textAlign: "center", fontSize: 10, color: T.textMuted }}>{fmt(a.assigned_at)}</div>
                            <div style={{ minWidth: 80, display: "flex", gap: 6, justifyContent: "center" }}>
                              {a.status === "active" ? (
                                <>
                                  <button className="aw-ea-icon-btn remind"   onClick={() => handleReminder(a)}><Mail size={12} /><span className="tooltip">Remind</span></button>
                                  <button className="aw-ea-icon-btn withdraw" onClick={() => { const n = a.assigned_to_employee?.full_name ?? `Dept: ${a.assigned_to_department?.name || "?"}`; handleWithdraw(a.id, a.exams?.title || "Exam", n); }}><Undo2 size={12} /><span className="tooltip">Withdraw</span></button>
                                </>
                              ) : <span style={{ fontSize: 11, color: T.borderFaint }}>—</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════ ASSIGN MODAL ═══════════ */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(10,12,6,0.82)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
          onClick={resetModal}>
          <div className="aw-modal-in aw-ea-scroll"
            style={{ width: "100%", maxWidth: 520, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", overflowY: "auto", maxHeight: "94vh", boxShadow: "0 32px 80px rgba(0,0,0,.55)", fontFamily: "'Inter', sans-serif" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: "linear-gradient(90deg,#c8ff00,rgba(200,255,0,.20))" }} />
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.borderFaint}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Send size={15} style={{ color: T.blue }} /></div>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>Assign New Exam</h2>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>Select targets and configuration</p>
                </div>
              </div>
              <button onClick={resetModal} style={{ width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.05)", border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: "pointer" }}><X size={13} /></button>
            </div>

            <form onSubmit={handleAssign}>
              <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
                {error && (
                  <div style={{ padding: "10px 14px", background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 9, display: "flex", gap: 8, fontSize: 12, color: T.red }}>
                    <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
                  </div>
                )}
                <div>
                  <label className="aw-ea-label">Exam <span style={{ color: T.accent }}>*</span></label>
                  <select className="aw-ea-select" required value={examId} onChange={e => setExamId(e.target.value)}>
                    <option value="">Select an exam…</option>
                    {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="aw-ea-label">Assign to</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {([{ key:"employee",icon:Users,label:"Employees"},{key:"department",icon:Building,label:"Departments"},{key:"all",icon:Users,label:"All Company"}] as const).map(({ key, icon: Icon, label }) => (
                      <button key={key} type="button" className={`aw-ea-type-btn${assignType === key ? " sel" : ""}`} onClick={() => { setAssignType(key); setSelEmps([]); setSelDepts([]); }}>
                        <Icon size={13} /> {label}
                      </button>
                    ))}
                  </div>
                </div>
                {assignType === "all" && (
                  <div style={{ padding: "13px 15px", background: T.greenBg, border: `1px solid ${T.greenBorder}`, borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
                    <CheckCircle size={18} style={{ color: T.green, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.green }}>Assign to all {employees.length} employees</div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Creates {employees.length} individual records — one per employee.</div>
                    </div>
                  </div>
                )}
                {assignType === "employee" && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <label className="aw-ea-label" style={{ margin: 0 }}>Select Employees <span style={{ color: T.accent }}>*</span></label>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {selEmps.length > 0 && <span className="aw-ea-sel-count">{selEmps.length}</span>}
                        <button type="button" style={{ fontSize: 11, color: T.textMuted, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                          onClick={() => setSelEmps(selEmps.length === employees.length ? [] : employees.map(e => e.id))}>
                          {selEmps.length === employees.length ? "Deselect all" : "Select all"}
                        </button>
                      </div>
                    </div>
                    <div className="aw-ea-list">
                      {employees.map(emp => (
                        <div key={emp.id} className={`aw-ea-check-row${selEmps.includes(emp.id) ? " on" : ""}`} onClick={() => toggleEmp(emp.id)}>
                          <div className="aw-ea-checkbox">{selEmps.includes(emp.id) && <Checkmark />}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emp.full_name}</div>
                            <div style={{ fontSize: 11, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emp.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {assignType === "department" && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <label className="aw-ea-label" style={{ margin: 0 }}>Select Departments <span style={{ color: T.accent }}>*</span></label>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {selDepts.length > 0 && <span className="aw-ea-sel-count">{selDepts.length}</span>}
                        <button type="button" style={{ fontSize: 11, color: T.textMuted, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                          onClick={() => setSelDepts(selDepts.length === departments.length ? [] : departments.map(d => d.id))}>
                          {selDepts.length === departments.length ? "Deselect all" : "Select all"}
                        </button>
                      </div>
                    </div>
                    <div className="aw-ea-list">
                      {departments.map(dept => {
                        const ec = employees.filter(e => e.department_id === dept.id).length;
                        return (
                          <div key={dept.id} className={`aw-ea-check-row${selDepts.includes(dept.id) ? " on" : ""}`} onClick={() => toggleDept(dept.id)}>
                            <div className="aw-ea-checkbox">{selDepts.includes(dept.id) && <Checkmark />}</div>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Building size={12} style={{ color: T.purple }} /></div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: T.white }}>{dept.name}</div>
                              <div style={{ fontSize: 11, color: T.textMuted }}>{ec} employee{ec !== 1 ? "s" : ""}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="aw-ea-label">Max Attempts <span style={{ color: T.accent }}>*</span></label>
                    <input className="aw-ea-input" type="number" min="1" max="10" required value={maxAttempts} onChange={e => setMaxAttempts(parseInt(e.target.value) || 1)} />
                  </div>
                  <div>
                    <label className="aw-ea-label">Due Date <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                    <input className="aw-ea-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                  </div>
                </div>
                <div className={`aw-ea-toggle-row${isMandatory ? " on" : ""}`} onClick={() => setIsMandatory(p => !p)}>
                  <div style={{ width: 36, height: 20, borderRadius: 9999, background: isMandatory ? T.green : "rgba(255,255,255,.10)", border: `1px solid ${isMandatory ? T.greenBorder : T.borderFaint}`, position: "relative", transition: "background .2s", flexShrink: 0 }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: isMandatory ? T.accentDark : "rgba(255,255,255,.40)", position: "absolute", top: 2, left: isMandatory ? 18 : 2, transition: "left .2s" }} />
                  </div>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isMandatory ? T.green : T.textMuted }}>{isMandatory ? "Mandatory Exam" : "Optional Exam"}</span>
                    <p style={{ fontSize: 11, color: T.textMuted, margin: "2px 0 0" }}>{isMandatory ? "Employees must complete this exam" : "Employees can skip this exam"}</p>
                  </div>
                </div>
              </div>
              <div style={{ padding: "14px 22px", borderTop: `1px solid ${T.borderFaint}`, display: "flex", gap: 10 }}>
                <button type="button" className="aw-ea-cancel-btn" onClick={resetModal}>Cancel</button>
                <button type="submit" className="aw-ea-save-btn" disabled={saving || !isFormValid()}>
                  {saving ? <><Loader2 size={14} style={{ animation: "aw-spin 0.8s linear infinite" }} /> Assigning…</> : <><Send size={14} /> {assignBtnLabel()}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
