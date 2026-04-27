import React, { useState, useEffect } from "react";
import {
  Send,
  Users,
  ClipboardList,
  AlertCircle,
  Undo2,
  Mail,
  Plus,
  X,
  Loader2,
  Building,
  CheckCircle,
  Clock,
  BookOpen,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { sendNotificationEmail } from '../../lib/email';
import { buildSameHostRedirectUrl } from '../../lib/browserTenant';

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bg: "#12140a",
  bgCard: "#1a1e0e",
  accent: "#c8ff00",
  accentDark: "#12140a",
  white: "#ffffff",
  textBody: "#cbd5e1",
  textMuted: "#64748b",
  border: "rgba(255,255,255,0.09)",
  borderFaint: "rgba(255,255,255,0.05)",
  green: "#34d399",
  greenBg: "rgba(52,211,153,0.08)",
  greenBorder: "rgba(52,211,153,0.22)",
  blue: "#60a5fa",
  blueBg: "rgba(96,165,250,0.08)",
  blueBorder: "rgba(96,165,250,0.22)",
  orange: "#fb923c",
  orangeBg: "rgba(251,146,60,0.08)",
  orangeBorder: "rgba(251,146,60,0.22)",
  red: "#f87171",
  redBg: "rgba(248,113,113,0.08)",
  redBorder: "rgba(248,113,113,0.22)",
  purple: "#a78bfa",
  purpleBg: "rgba(167,139,250,0.08)",
  purpleBorder: "rgba(167,139,250,0.22)",
  gold: "#fbbf24",
  goldBg: "rgba(251,191,36,0.08)",
  goldBorder: "rgba(251,191,36,0.22)",
} as const;

/* ─────────────────────────────────────────
   STATUS CONFIG
───────────────────────────────────────── */
const STATUS_CFG: Record<
  string,
  {
    color: string;
    bg: string;
    border: string;
    label: string;
    icon: typeof Clock;
  }
> = {
  active: {
    color: T.blue,
    bg: T.blueBg,
    border: T.blueBorder,
    label: "Active",
    icon: Clock,
  },
  completed: {
    color: T.green,
    bg: T.greenBg,
    border: T.greenBorder,
    label: "Completed",
    icon: CheckCircle,
  },
  expired: {
    color: T.orange,
    bg: T.orangeBg,
    border: T.orangeBorder,
    label: "Expired",
    icon: AlertCircle,
  },
  withdrawn: {
    color: T.textMuted,
    bg: "rgba(255,255,255,0.04)",
    border: T.borderFaint,
    label: "Withdrawn",
    icon: X,
  },
};

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-ea-table { width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; }
  .aw-ea-table th {
    padding: 10px 14px; text-align: left;
    font-size: 10px; font-weight: 700; color: #64748b;
    letter-spacing: 0.9px; text-transform: uppercase;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
  }
  .aw-ea-table td {
    padding: 13px 14px; font-size: 13px; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: background 0.14s;
  }
  .aw-ea-table tr:last-child td { border-bottom: none; }
  .aw-ea-table tr:hover td { background: rgba(255,255,255,0.025); }

  /* ── Form inputs ── */
  .aw-ea-input, .aw-ea-select {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-ea-input  { padding: 11px 14px; }
  .aw-ea-select {
    padding: 11px 36px 11px 14px; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
  }
  .aw-ea-input:focus, .aw-ea-select:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-ea-input::placeholder { color: rgba(148,163,184,0.35); }
  .aw-ea-select option { background: #1a1e0e; color: #ffffff; }
  input[type="date"].aw-ea-input::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.4); cursor: pointer; }
  input[type="number"].aw-ea-input::-webkit-inner-spin-button { filter: invert(1) opacity(0.3); }

  .aw-ea-label {
    display: block; font-size: 12px; font-weight: 600; color: #94a3b8;
    margin-bottom: 7px; letter-spacing: 0.3px; font-family: 'Inter', sans-serif;
  }

  /* ── Radio row ── */
  .aw-ea-radio-row {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 14px; border-radius: 10px; cursor: pointer;
    border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02);
    transition: all 0.18s; font-family: 'Inter', sans-serif; flex: 1;
  }
  .aw-ea-radio-row.sel { background: rgba(200,255,0,0.06); border-color: rgba(200,255,0,0.25); }
  .aw-ea-radio-row:not(.sel):hover { background: rgba(255,255,255,0.04); }
  .aw-ea-rdot {
    width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
    border: 2px solid rgba(255,255,255,0.22); display: flex; align-items: center; justify-content: center;
    transition: all 0.18s;
  }
  .sel .aw-ea-rdot { border-color: #c8ff00; background: #c8ff00; }
  .aw-ea-rdot-inner { width: 7px; height: 7px; border-radius: 50%; background: #12140a; }

  /* ── Toggle ── */
  .aw-ea-toggle-row {
    display: flex; align-items: center; gap: 10px; cursor: pointer;
    padding: 11px 14px; border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02);
    transition: all 0.18s; font-family: 'Inter', sans-serif;
  }
  .aw-ea-toggle-row.on { background: rgba(52,211,153,0.06); border-color: rgba(52,211,153,0.22); }

  /* ── Action icon btns ── */
  .aw-ea-icon-btn {
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid transparent; cursor: pointer; background: none;
    transition: all 0.18s; position: relative;
  }
  .aw-ea-icon-btn.remind { color: #60a5fa; border-color: rgba(96,165,250,0.22); background: rgba(96,165,250,0.08); }
  .aw-ea-icon-btn.remind:hover { background: rgba(96,165,250,0.18); }
  .aw-ea-icon-btn.withdraw { color: #f87171; border-color: rgba(248,113,113,0.22); background: rgba(248,113,113,0.07); }
  .aw-ea-icon-btn.withdraw:hover { background: rgba(248,113,113,0.18); }
  .aw-ea-icon-btn .tooltip {
    pointer-events: none; position: absolute; bottom: calc(100% + 7px); left: 50%; transform: translateX(-50%);
    white-space: nowrap; padding: 4px 9px; background: #0a0c06; border: 1px solid rgba(255,255,255,0.09);
    border-radius: 6px; font-size: 11px; color: #cbd5e1; font-family: 'Inter'; font-weight: 600;
    opacity: 0; transition: opacity 0.18s; z-index: 10;
  }
  .aw-ea-icon-btn:hover .tooltip { opacity: 1; }

  /* ── Primary btn ── */
  .aw-ea-save-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 13px 20px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 18px rgba(200,255,0,0.20);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-ea-save-btn:hover { opacity: 0.88; transform: translateY(-1px); }
  .aw-ea-save-btn:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }

  .aw-ea-cancel-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 13px 20px; border-radius: 10px; cursor: pointer;
    font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-ea-cancel-btn:hover { background: rgba(255,255,255,0.08); color: #ffffff; }

  /* ── Scrollbar ── */
  .aw-ea-scroll::-webkit-scrollbar { width: 3px; }
  .aw-ea-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-ea-scroll::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-fade-up  { animation: aw-fade-up  0.4s ease both; }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById("aw-ea-styles")
) {
  const tag = document.createElement("style");
  tag.id = "aw-ea-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface Exam {
  id: string;
  title: string;
  description: string;
  passing_score: number;
}
interface Employee {
  id: string;
  full_name: string;
  email: string;
  department_id: string | null;
}
interface Department {
  id: string;
  name: string;
}
interface AssignedExam {
  id: string;
  exams?: { title: string };
  assigned_to_employee: { full_name: string; email: string } | null;
  assigned_to_department: { id: string; name: string } | null;
  due_date: string | null;
  max_attempts: number;
  status: string;
  assigned_at: string;
}

type AssignmentInsert = {
  exam_id: string;
  company_id: string | undefined;
  assigned_by: string | undefined;
  due_date: string | null;
  max_attempts: number;
  is_mandatory: boolean;
  status: 'active';
  assigned_to_employee?: string;
  assigned_to_department?: string;
};

type EmailRecipient = {
  email: string;
  full_name: string;
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("en-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

/* ─────────────────────────────────────────
   STAT CARD
───────────────────────────────────────── */
const StatCard: React.FC<{
  icon: React.ElementType;
  color: string;
  bg: string;
  label: string;
  value: number;
  delay?: string;
}> = ({ icon: Icon, color, bg, label, value, delay = "0s" }) => (
  <div
    className="aw-fade-up"
    style={{
      animationDelay: delay,
      padding: "16px 18px",
      background: T.bgCard,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      position: "relative",
      overflow: "hidden",
      flex: "1 1 140px",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: `linear-gradient(90deg, ${color}, ${color}40)`,
      }}
    />
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: bg,
          border: `1px solid ${color}28`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={15} style={{ color }} />
      </div>
      <span style={{ fontSize: 24, fontWeight: 900, color: T.white }}>
        {value}
      </span>
    </div>
    <div style={{ fontSize: 12, color: T.textMuted }}>{label}</div>
  </div>
);

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const ExamAssignmentPage: React.FC = () => {
  const { user } = useAuth();
  const loginUrl = buildSameHostRedirectUrl(window.location.href, "/login");
  const [exams, setExams] = useState<Exam[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<AssignedExam[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    exam_id: "",
    assignment_type: "employee",
    target_id: "",
    due_date: "",
    max_attempts: 1,
    is_mandatory: true,
  });

  useEffect(() => {
    loadExams();
    loadEmployees();
    loadDepartments();
    loadAssignments();
  }, [user]);

  const loadExams = async () => {
    const { data } = await supabase.from("exams").select("*").order("title");
    if (data) setExams(data);
  };
  const loadEmployees = async () => {
    if (!user?.company_id) return;
    const { data } = await supabase
      .from("users")
      .select("id,full_name,email,department_id")
      .eq("company_id", user.company_id)
      .eq("role", "EMPLOYEE")
      .order("full_name");
    if (data) setEmployees(data);
  };
  const loadDepartments = async () => {
    if (!user?.company_id) return;
    const { data } = await supabase
      .from("departments")
      .select("id,name")
      .eq("company_id", user.company_id)
      .order("name");
    if (data) setDepartments(data);
  };

  const getSelectedAssignmentRecipients = (): EmailRecipient[] => {
    if (form.assignment_type === 'employee') {
      const selectedEmployee = employees.find((employee) => employee.id === form.target_id);

      return selectedEmployee?.email
        ? [{
          email: selectedEmployee.email,
          full_name: selectedEmployee.full_name
        }]
        : [];
    }

    return employees
      .filter((employee) => employee.department_id === form.target_id && employee.email)
      .map((employee) => ({
        email: employee.email,
        full_name: employee.full_name
      }));
  };

  const loadAssignments = async () => {
    if (!user?.company_id) return;
    const { data: rawData, error } = await supabase
      .from("assigned_exams")
      .select("*")
      .eq("company_id", user.company_id)
      .not("status", "in", "(withdrawn)")
      .order("assigned_at", { ascending: false });
    if (error) {
      setError("Failed to load assignments: " + error.message);
      return;
    }
    if (!rawData?.length) {
      setAssignments([]);
      return;
    }

    const examIds = [...new Set(rawData.map((a) => a.exam_id))];
    const employeeIds = [
      ...new Set(rawData.map((a) => a.assigned_to_employee).filter(Boolean)),
    ];
    const departmentIds = [
      ...new Set(rawData.map((a) => a.assigned_to_department).filter(Boolean)),
    ];

    const [examsRes, usersRes, deptsRes, resultsRes] = await Promise.all([
      supabase.from("exams").select("id,title").in("id", examIds),
      employeeIds.length > 0
        ? supabase
            .from("users")
            .select("id,full_name,email")
            .in("id", employeeIds)
        : Promise.resolve({ data: [] }),
      departmentIds.length > 0
        ? supabase.from("departments").select("id,name").in("id", departmentIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("exam_results")
        .select("assignment_id,employee_id,passed")
        .eq("passed", true),
    ]);

    const examsMap = new Map((examsRes.data || []).map((e) => [e.id, e]));
    const usersMap = new Map((usersRes.data || []).map((u) => [u.id, u]));
    const deptsMap = new Map((deptsRes.data || []).map((d) => [d.id, d]));
    const passedIds = new Set(
      (resultsRes.data || []).map((r) => r.assignment_id)
    );

    const enrichedAssignments = await Promise.all(rawData.map(async assignment => {
      let actualStatus = assignment.status;

      const isCompleted = passedIds.has(assignment.id);

      if (isCompleted && actualStatus === 'active') {
        actualStatus = 'completed';
        await supabase
          .from('assigned_exams')
          .update({ status: 'completed' })
          .eq('id', assignment.id);
      }

      return {
        ...assignment,
        status: actualStatus,
        exams: examsMap.get(assignment.exam_id) || null,
        assigned_to_employee: assignment.assigned_to_employee
          ? usersMap.get(assignment.assigned_to_employee) || null
          : null,
        assigned_to_department: assignment.assigned_to_department
          ? deptsMap.get(assignment.assigned_to_department) || null
          : null
      };
    }));

    setAssignments(enrichedAssignments as AssignedExam[]);
  };

  const handleAssign = async (e: React.FormEvent) => {
    setSaving(true);
    e.preventDefault();
    if (isAssigning) return;

    setError(null);
    setIsAssigning(true);

    try {
      const assignment: AssignmentInsert = {
        exam_id: form.exam_id,
        company_id: user?.company_id,
        assigned_by: user?.id,
        due_date: form.due_date || null,
        max_attempts: form.max_attempts,
        is_mandatory: form.is_mandatory,
        status: 'active'
      };

      if (form.assignment_type === 'employee') {
        assignment.assigned_to_employee = form.target_id;
      } else {
        assignment.assigned_to_department = form.target_id;
      }

      const { error: insertError } = await supabase.from('assigned_exams').insert(assignment);

      if (insertError) {
        console.error('Error assigning exam:', insertError);

        if (insertError.code === '23505') {
          setError('This exam is already assigned to the selected employee/department. Check existing assignments.');
        } else {
          setError('Failed to assign exam: ' + insertError.message);
        }
        return;
      }

      const assignedExamTitle = exams.find((exam) => exam.id === form.exam_id)?.title || 'your assigned exam';
      const dueDateText = form.due_date
        ? ` Please complete it before ${new Date(form.due_date).toLocaleDateString()}.`
        : '';
      const recipients = getSelectedAssignmentRecipients();
      let emailWarning: string | null = null;

      if (recipients.length === 0) {
        emailWarning = 'Exam assigned, but no email recipients were found to notify.';
      } else {
        const emailResults = await Promise.allSettled(
          recipients.map((recipient) =>
            sendNotificationEmail(
              recipient.email,
              recipient.full_name,
              `New Exam Assigned: ${assignedExamTitle}`,
              'New Exam Assigned',
              `"${assignedExamTitle}" has been assigned to you.${dueDateText} Please log in to your Awareone account to complete it.`,
              {
                loginUrl,
              }
            )
          )
        );

        const failedCount = emailResults.filter((result) => result.status === 'rejected').length;

        if (failedCount > 0) {
          emailWarning = `Exam assigned, but ${failedCount} assignment notification email(s) could not be sent.`;
        }
      }

      setShowModal(false);
      setError(emailWarning);
      setForm({
        exam_id: '',
        assignment_type: 'employee',
        target_id: '',
        due_date: '',
        max_attempts: 1,
        is_mandatory: true
      });
      loadAssignments();
    } finally {
      setIsAssigning(false);
      setSaving(false);
    }
  };

  const handleWithdraw = async (
    id: string,
    examTitle: string,
    targetName: string
  ) => {
    if (
      !confirm(
        `Withdraw "${examTitle}" from ${targetName}?\n\nThe exam will no longer be visible but attempt history will be preserved.`
      )
    )
      return;
    const { error } = await supabase
      .from("assigned_exams")
      .update({
        status: "withdrawn",
        withdrawn_at: new Date().toISOString(),
        withdrawn_by: user?.id,
      })
      .eq("id", id);
    if (error) {
      setError("Error withdrawing: " + error.message);
      return;
    }
    loadAssignments();
  };

  const handleReminder = async (assignment: AssignedExam) => {
    setError(null);
    const examTitle = assignment.exams?.title || "your assigned exam";
    const dueTxt = assignment.due_date
      ? ` Please complete it before ${new Date(
          assignment.due_date
        ).toLocaleDateString()}.`
      : "";
    let recipients: Array<{ email: string; full_name: string }> = [];
    let targetName = "this assignee";
    if (assignment.assigned_to_employee?.email) {
      recipients = [
        {
          email: assignment.assigned_to_employee.email,
          full_name: assignment.assigned_to_employee.full_name,
        },
      ];
      targetName = assignment.assigned_to_employee.full_name;
    } else if (assignment.assigned_to_department?.id) {
      recipients = employees
        .filter(
          (emp) =>
            emp.department_id === assignment.assigned_to_department?.id &&
            emp.email
        )
        .map((emp) => ({ email: emp.email, full_name: emp.full_name }));
      targetName = `Dept: ${assignment.assigned_to_department.name}`;
    }
    if (!recipients.length) {
      setError("No email recipients found for this assignment.");
      return;
    }
    if (
      !confirm(
        `Send ${
          recipients.length > 1 ? "reminders" : "a reminder"
        } for "${examTitle}" to ${targetName}?`
      )
    )
      return;
    try {
      const results = await Promise.allSettled(
        recipients.map((recipient) =>
          sendNotificationEmail(
            recipient.email,
            recipient.full_name,
            `Exam Reminder: ${examTitle}`,
            'Exam Reminder',
            `This is a reminder that "${examTitle}" is still assigned to you.${dueTxt} Please log in to your Awareone account to complete it.`,
            {
              loginUrl,
            }
          )
        )
      );

      const failedCount = results.filter((r) => r.status === 'rejected').length;

      if (failedCount > 0) {
        throw new Error(`${failedCount} reminder email(s) could not be sent.`);
      }

      window.alert(
        recipients.length > 1
          ? `Reminders sent to ${recipients.length} employees.`
          : "Reminder sent successfully."
      );
    } catch {
      setError("Failed to send reminder email.");
    }
  };

  const counts = {
    active: assignments.filter((a) => a.status === "active").length,
    completed: assignments.filter((a) => a.status === "completed").length,
    expired: assignments.filter((a) => a.status === "expired").length,
  };

  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* ── Page header ── */}
      <div
        className="aw-fade-up"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 5,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: T.blueBg,
                border: `1px solid ${T.blueBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ClipboardList size={18} style={{ color: T.blue }} />
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: T.white,
                letterSpacing: "-0.3px",
                margin: 0,
              }}
            >
              Exam Assignment
            </h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
            Assign exams to individual employees or entire departments.
          </p>
        </div>
        <button
          onClick={() => {
            setShowModal(true);
            setError(null);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            borderRadius: 9,
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            background: T.accent,
            color: T.accentDark,
            boxShadow: "0 0 18px rgba(200,255,0,0.20)",
            transition: "opacity 0.2s",
          }}
        >
          <Plus size={14} /> Assign Exam
        </button>
      </div>

      {/* ── Error ── */}
      {error && !showModal && (
        <div
          style={{
            padding: "11px 16px",
            background: T.redBg,
            border: `1px solid ${T.redBorder}`,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            color: T.red,
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: T.red,
              padding: 0,
            }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div
        className="aw-fade-up"
        style={{
          animationDelay: "0.05s",
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <StatCard
          icon={ClipboardList}
          color={T.blue}
          bg={T.blueBg}
          label="Active Assignments"
          value={counts.active}
          delay="0.05s"
        />
        <StatCard
          icon={CheckCircle}
          color={T.green}
          bg={T.greenBg}
          label="Completed"
          value={counts.completed}
          delay="0.09s"
        />
        <StatCard
          icon={AlertCircle}
          color={T.orange}
          bg={T.orangeBg}
          label="Expired"
          value={counts.expired}
          delay="0.13s"
        />
        <StatCard
          icon={Users}
          color={T.purple}
          bg={T.purpleBg}
          label="Total Employees"
          value={employees.length}
          delay="0.17s"
        />
      </div>

      {/* ── Assignments table ── */}
      <div
        className="aw-fade-up"
        style={{
          animationDelay: "0.19s",
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${T.borderFaint}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <BookOpen size={14} style={{ color: T.accent }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>
            Assigned Exams
          </span>
          <span
            style={{ marginLeft: "auto", fontSize: 11, color: T.textMuted }}
          >
            {assignments.length} total
          </span>
        </div>
        <div style={{ overflowX: "auto" }} className="aw-ea-scroll">
          <table className="aw-ea-table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Assigned To</th>
                <th style={{ textAlign: "center" }}>Max Attempts</th>
                <th style={{ textAlign: "center" }}>Due Date</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th style={{ textAlign: "center" }}>Assigned At</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const cfg = STATUS_CFG[a.status] ?? STATUS_CFG.active;
                const Icon = cfg.icon;
                const targetEl = a.assigned_to_employee?.full_name ? (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: T.blueBg,
                        border: `1px solid ${T.blueBorder}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Users size={12} style={{ color: T.blue }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: T.white }}>
                        {a.assigned_to_employee.full_name}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>
                        {a.assigned_to_employee.email}
                      </div>
                    </div>
                  </div>
                ) : a.assigned_to_department?.name ? (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: T.purpleBg,
                        border: `1px solid ${T.purpleBorder}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Building size={12} style={{ color: T.purple }} />
                    </div>
                    <span style={{ fontWeight: 600, color: T.white }}>
                      Dept: {a.assigned_to_department.name}
                    </span>
                  </div>
                ) : (
                  <span style={{ color: T.textMuted }}>N/A</span>
                );

                return (
                  <tr key={a.id}>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <ClipboardList
                          size={14}
                          style={{ color: T.blue, flexShrink: 0 }}
                        />
                        <span style={{ fontWeight: 600, color: T.white }}>
                          {a.exams?.title || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td>{targetEl}</td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          padding: "3px 10px",
                          borderRadius: 9999,
                          fontSize: 12,
                          fontWeight: 700,
                          background: "rgba(255,255,255,0.04)",
                          border: `1px solid ${T.borderFaint}`,
                          color: T.textBody,
                        }}
                      >
                        {a.max_attempts}
                      </span>
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        fontSize: 12,
                        color: T.textMuted,
                      }}
                    >
                      {a.due_date ? (
                        fmt(a.due_date)
                      ) : (
                        <span style={{ color: T.borderFaint }}>Not set</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "3px 10px",
                          borderRadius: 9999,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.5px",
                          textTransform: "uppercase",
                          background: cfg.bg,
                          border: `1px solid ${cfg.border}`,
                          color: cfg.color,
                        }}
                      >
                        <Icon size={9} /> {cfg.label}
                      </span>
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        fontSize: 11,
                        color: T.textMuted,
                      }}
                    >
                      {fmt(a.assigned_at)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {a.status === "active" ? (
                        <div
                          style={{
                            display: "flex",
                            gap: 7,
                            justifyContent: "center",
                          }}
                        >
                          <button
                            className="aw-ea-icon-btn remind"
                            onClick={() => handleReminder(a)}
                          >
                            <Mail size={13} />
                            <span className="tooltip">Send Reminder</span>
                          </button>
                          <button
                            className="aw-ea-icon-btn withdraw"
                            onClick={() => {
                              const name =
                                a.assigned_to_employee?.full_name ??
                                `Dept: ${
                                  a.assigned_to_department?.name || "Unknown"
                                }`;
                              handleWithdraw(
                                a.id,
                                a.exams?.title || "Unknown Exam",
                                name
                              );
                            }}
                          >
                            <Undo2 size={13} />
                            <span className="tooltip">Withdraw</span>
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: T.borderFaint, fontSize: 12 }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {assignments.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: T.blueBg,
                  border: `1px solid ${T.blueBorder}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <ClipboardList size={22} style={{ color: T.blue }} />
              </div>
              <p style={{ fontSize: 14, color: T.textMuted, margin: 0 }}>
                No exams assigned yet
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: T.textMuted,
                  opacity: 0.7,
                  margin: "6px 0 18px",
                }}
              >
                Click "Assign Exam" to get started
              </p>
              <button
                onClick={() => {
                  setShowModal(true);
                  setError(null);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "9px 18px",
                  borderRadius: 9,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  background: T.accent,
                  color: T.accentDark,
                }}
              >
                <Plus size={13} /> Assign Exam
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ MODAL ═══════════ */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(10,12,6,0.82)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
          onClick={() => {
            setShowModal(false);
            setError(null);
          }}
        >
          <div
            className="aw-modal-in aw-ea-scroll"
            style={{
              width: "100%",
              maxWidth: 500,
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: 16,
              overflow: "hidden",
              overflowY: "auto",
              maxHeight: "92vh",
              boxShadow: "0 32px 80px rgba(0,0,0,0.55)",
              fontFamily: "'Inter', sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                height: 3,
                background:
                  "linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))",
              }}
            />

            {/* Header */}
            <div
              style={{
                padding: "18px 22px",
                borderBottom: `1px solid ${T.borderFaint}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: T.blueBg,
                    border: `1px solid ${T.blueBorder}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Send size={15} style={{ color: T.blue }} />
                </div>
                <div>
                  <h2
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: T.white,
                      margin: 0,
                    }}
                  >
                    Assign New Exam
                  </h2>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>
                    Fill in the details below
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError(null);
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${T.borderFaint}`,
                  color: T.textMuted,
                  cursor: "pointer",
                }}
              >
                <X size={13} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleAssign}>
              <div
                style={{
                  padding: "18px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {error && (
                  <div
                    style={{
                      padding: "10px 14px",
                      background: T.redBg,
                      border: `1px solid ${T.redBorder}`,
                      borderRadius: 9,
                      display: "flex",
                      gap: 8,
                      fontSize: 12,
                      color: T.red,
                    }}
                  >
                    <AlertCircle
                      size={13}
                      style={{ flexShrink: 0, marginTop: 1 }}
                    />{" "}
                    {error}
                  </div>
                )}

                {/* Exam select */}
                <div>
                  <label className="aw-ea-label">
                    Exam <span style={{ color: T.accent }}>*</span>
                  </label>
                  <select
                    className="aw-ea-select"
                    required
                    value={form.exam_id}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, exam_id: e.target.value }))
                    }
                  >
                    <option value="">Select an exam…</option>
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assignment type */}
                <div>
                  <label className="aw-ea-label">Assign to</label>
                  <div style={{ display: "flex", gap: 9 }}>
                    {[
                      {
                        key: "employee",
                        icon: Users,
                        label: "Individual Employee",
                      },
                      {
                        key: "department",
                        icon: Building,
                        label: "Entire Department",
                      },
                    ].map(({ key, icon: Icon, label }) => (
                      <div
                        key={key}
                        className={`aw-ea-radio-row ${
                          form.assignment_type === key ? "sel" : ""
                        }`}
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            assignment_type: key,
                            target_id: "",
                          }))
                        }
                      >
                        <div className="aw-ea-rdot">
                          {form.assignment_type === key && (
                            <div className="aw-ea-rdot-inner" />
                          )}
                        </div>
                        <Icon
                          size={13}
                          style={{
                            color:
                              form.assignment_type === key
                                ? T.accent
                                : T.textMuted,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color:
                              form.assignment_type === key
                                ? T.white
                                : T.textMuted,
                          }}
                        >
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Target select */}
                <div>
                  <label className="aw-ea-label">
                    {form.assignment_type === "employee"
                      ? "Select Employee"
                      : "Select Department"}{" "}
                    <span style={{ color: T.accent }}>*</span>
                  </label>
                  <select
                    className="aw-ea-select"
                    required
                    value={form.target_id}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, target_id: e.target.value }))
                    }
                  >
                    <option value="">Select…</option>
                    {form.assignment_type === "employee"
                      ? employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.full_name} ({emp.email})
                          </option>
                        ))
                      : departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                  </select>
                </div>

                {/* Max attempts + Due date */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <label className="aw-ea-label">
                      Max Attempts <span style={{ color: T.accent }}>*</span>
                    </label>
                    <input
                      className="aw-ea-input"
                      type="number"
                      min="1"
                      max="10"
                      required
                      value={form.max_attempts}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          max_attempts: parseInt(e.target.value) || 1,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="aw-ea-label">
                      Due Date{" "}
                      <span style={{ color: T.textMuted, fontWeight: 400 }}>
                        (optional)
                      </span>
                    </label>
                    <input
                      className="aw-ea-input"
                      type="date"
                      value={form.due_date}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, due_date: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* Mandatory toggle */}
                <div
                  className={`aw-ea-toggle-row ${
                    form.is_mandatory ? "on" : ""
                  }`}
                  onClick={() =>
                    setForm((p) => ({ ...p, is_mandatory: !p.is_mandatory }))
                  }
                >
                  <div
                    style={{
                      width: 36,
                      height: 20,
                      borderRadius: 9999,
                      background: form.is_mandatory
                        ? T.green
                        : "rgba(255,255,255,0.10)",
                      border: `1px solid ${
                        form.is_mandatory ? T.greenBorder : T.borderFaint
                      }`,
                      position: "relative",
                      transition: "background 0.2s",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: form.is_mandatory
                          ? T.accentDark
                          : "rgba(255,255,255,0.40)",
                        position: "absolute",
                        top: 2,
                        left: form.is_mandatory ? 18 : 2,
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.30)",
                      }}
                    />
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: form.is_mandatory ? T.green : T.textMuted,
                      }}
                    >
                      {form.is_mandatory ? "Mandatory Exam" : "Optional Exam"}
                    </span>
                    <p
                      style={{
                        fontSize: 11,
                        color: T.textMuted,
                        margin: 0,
                        marginTop: 2,
                      }}
                    >
                      {form.is_mandatory
                        ? "Employees must complete this exam"
                        : "Employees can skip this exam"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  {isAssigning ? 'Assigning...' : 'Assign'}
                </button>
              {/* Footer */}
              <div
                style={{
                  padding: "14px 22px",
                  borderTop: `1px solid ${T.borderFaint}`,
                  display: "flex",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  className="aw-ea-cancel-btn"
                  onClick={() => {
                    setShowModal(false);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="aw-ea-save-btn"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={14}
                        style={{ animation: "aw-spin 0.8s linear infinite" }}
                      />{" "}
                      Assigning…
                    </>
                  ) : (
                    <>
                      <Send size={14} /> Assign Exam
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
