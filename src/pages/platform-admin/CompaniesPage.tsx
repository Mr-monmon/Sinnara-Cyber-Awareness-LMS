import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Building2,
  Settings,
  Shield,
  Check,
  X,
  BookOpen,
  ClipboardCheck,
  Loader2,
  Save,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Company, Course, Exam } from "../../lib/types";
import { CompanyFormModal } from "../../components/platform-admin/CompanyFormModal";
import { useAuth } from "../../contexts/AuthContext";
import { buildTenantRedirectUrl } from "../../lib/browserTenant";

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
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Company card ── */
  .aw-co-card {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; overflow: hidden;
    font-family: 'Inter', sans-serif;
    transition: border-color 0.2s, transform 0.2s;
  }
  .aw-co-card:hover { border-color: rgba(255,255,255,0.14); transform: translateY(-1px); }

  /* ── Icon action btns ── */
  .aw-co-icon-btn {
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid transparent; cursor: pointer;
    transition: all 0.18s; background: none;
  }
  .aw-co-icon-btn.assign { color: #a78bfa; border-color: rgba(167,139,250,0.22); background: rgba(167,139,250,0.08); }
  .aw-co-icon-btn.assign:hover { background: rgba(167,139,250,0.18); }
  .aw-co-icon-btn.edit   { color: #60a5fa; border-color: rgba(96,165,250,0.22);  background: rgba(96,165,250,0.08);  }
  .aw-co-icon-btn.edit:hover   { background: rgba(96,165,250,0.18); }
  .aw-co-icon-btn.del    { color: #f87171; border-color: rgba(248,113,113,0.22); background: rgba(248,113,113,0.07); }
  .aw-co-icon-btn.del:hover    { background: rgba(248,113,113,0.18); }

  /* ── Quota inline input ── */
  .aw-co-quota-input {
    width: 64px; padding: 6px 10px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(200,255,0,0.35); border-radius: 8px;
    font-size: 13px; color: #ffffff; font-family: 'Inter', sans-serif;
    outline: none;
  }
  .aw-co-quota-input:focus { border-color: rgba(200,255,0,0.60); }

  /* ── Modal input ── */
  .aw-co-input { 
    width: 100%; padding: 11px 14px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .aw-co-input:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
  }

  /* ── Assign checkbox row ── */
  .aw-co-check-row {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 14px; border-radius: 9px; cursor: pointer;
    border: 1px solid transparent;
    background: rgba(255,255,255,0.02);
    transition: all 0.18s; font-family: 'Inter', sans-serif;
  }
  .aw-co-check-row:hover { background: rgba(255,255,255,0.05); }
  .aw-co-check-row.checked { background: rgba(200,255,0,0.05); border-color: rgba(200,255,0,0.22); }
  .aw-co-checkbox {
    width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0;
    border: 2px solid rgba(255,255,255,0.20);
    display: flex; align-items: center; justify-content: center;
    background: transparent; transition: all 0.15s;
  }
  .checked .aw-co-checkbox { background: #c8ff00; border-color: #c8ff00; }

  /* ── Scrollbar ── */
  .aw-co-scroll::-webkit-scrollbar { width: 3px; }
  .aw-co-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-co-scroll::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  /* ── Primary btn ── */
  .aw-co-btn-primary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 20px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 18px rgba(200,255,0,0.20);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-co-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
  .aw-co-btn-primary:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }

  .aw-co-btn-ghost {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 10px 18px; border-radius: 9px; cursor: pointer;
    font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-co-btn-ghost:hover { background: rgba(255,255,255,0.08); color: #ffffff; }

  @keyframes aw-spin     { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-fade-up  { animation: aw-fade-up  0.4s ease both; }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById("aw-co-styles")
) {
  const tag = document.createElement("style");
  tag.id = "aw-co-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface CompanyWithQuota extends Company {
  annual_quota?: number;
  used_campaigns?: number;
}

const fmt = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-SA", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

/* ─────────────────────────────────────────
   PACKAGE BADGE
───────────────────────────────────────── */
const PkgBadge: React.FC<{ type: string }> = ({ type }) => {
  const isA = type === "TYPE_A";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.4px",
        background: isA ? T.greenBg : T.blueBg,
        border: `1px solid ${isA ? T.greenBorder : T.blueBorder}`,
        color: isA ? T.green : T.blue,
      }}
    >
      {isA ? <BookOpen size={10} /> : <ClipboardCheck size={10} />}
      {isA ? "Full Courses" : "Exams Only"}
    </span>
  );
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const CompaniesPage: React.FC = () => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<CompanyWithQuota[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [assigningCompany, setAssigningCompany] = useState<Company | null>(
    null
  );
  const [editingQuota, setEditingQuota] = useState<string | null>(null);
  const [quotaValue, setQuotaValue] = useState<number>(4);
  const [savingQuota, setSavingQuota] = useState(false);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [savingAssign, setSavingAssign] = useState(false);

  useEffect(() => {
    loadCompanies();
    loadAllContent();
  }, []);

  const loadCompanies = async () => {
    const { data } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });
    if (!data) return;
    const year = new Date().getFullYear();
    const withQuota = await Promise.all(
      data.map(async (co) => {
        const { data: q } = await supabase
          .from("phishing_campaign_quotas")
          .select("annual_quota, used_campaigns")
          .eq("company_id", co.id)
          .eq("quota_year", year)
          .maybeSingle();
        return {
          ...co,
          annual_quota: q?.annual_quota || 4,
          used_campaigns: q?.used_campaigns || 0,
        };
      })
    );
    setCompanies(withQuota);
  };

  const loadAllContent = async () => {
    const [cRes, eRes] = await Promise.all([
      supabase.from("courses").select("*").order("order_index"),
      supabase.from("exams").select("*").order("created_at"),
    ]);
    if (cRes.data) setAllCourses(cRes.data);
    if (eRes.data) setAllExams(eRes.data);
  };

  const handleUpdateQuota = async (companyId: string) => {
    setSavingQuota(true);
    try {
      const year = new Date().getFullYear();
      const { data: existing } = await supabase
        .from("phishing_campaign_quotas")
        .select("id")
        .eq("company_id", companyId)
        .eq("quota_year", year)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("phishing_campaign_quotas")
          .update({ annual_quota: quotaValue })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("phishing_campaign_quotas")
          .insert({
            company_id: companyId,
            annual_quota: quotaValue,
            quota_year: year,
            used_campaigns: 0,
          });
      }
      setEditingQuota(null);
      await loadCompanies();
    } catch {
      alert("Failed to update quota");
    } finally {
      setSavingQuota(false);
    }
  };

  const handleSaveCompany = async (formData: any) => {
    try {
      if (editingCompany) {
        await supabase
          .from("companies")
          .update(formData)
          .eq("id", editingCompany.id);
        await supabase
          .from("users")
          .update({
            full_name: formData.admin_name,
            phone: formData.admin_phone,
          })
          .eq("company_id", editingCompany.id)
          .eq("role", "COMPANY_ADMIN");
        await supabase
          .from("audit_logs")
          .insert([
            {
              user_id: user?.id,
              action_type: "UPDATE_COMPANY",
              entity_type: "COMPANY",
              entity_id: editingCompany.id,
              entity_name: formData.name,
              description: `Update company: ${formData.name}`,
              new_value: formData,
            },
          ]);
      } else {
        const { data: newCo, error: coErr } = await supabase
          .from("companies")
          .insert([formData])
          .select()
          .single();
        if (coErr) throw coErr;
        const { data: adminRes, error: adminErr } =
          await supabase.functions.invoke("user-admin", {
            body: {
              action: "createUser",
              email: formData.admin_email,
              password: "Admin123!",
              full_name: formData.admin_name,
              phone: formData.admin_phone || null,
              role: "COMPANY_ADMIN",
              company_id: newCo.id,
            },
          });
        if (adminErr || !adminRes?.success)
          throw new Error(adminRes?.error || "Failed to create admin");
        await supabase
          .from("subscriptions")
          .insert([
            {
              company_id: newCo.id,
              subscription_type: formData.subscription_type,
              start_date: formData.subscription_start,
              end_date: formData.subscription_end,
              license_count: formData.license_limit,
              status: formData.is_active ? "ACTIVE" : "PENDING",
            },
          ]);
        await supabase
          .from("audit_logs")
          .insert([
            {
              user_id: user?.id,
              action_type: "CREATE_COMPANY",
              entity_type: "COMPANY",
              entity_id: newCo.id,
              entity_name: formData.name,
              description: `Create company: ${formData.name}`,
              new_value: formData,
            },
          ]);
        const loginUrl = newCo.subdomain
          ? buildTenantRedirectUrl(
              window.location.href,
              newCo.subdomain,
              "/login"
            )
          : null;
        await supabase.functions.invoke("send-email", {
          body: {
            to: formData.admin_email,
            subject: "Welcome to Awareone",
            html: `<div style="margin:0;padding:32px 16px;background:#12140a;font-family:Arial,sans-serif;color:#fff;"><div style="max-width:600px;margin:0 auto;background:rgba(200,255,0,0.03);border:1px solid rgba(255,255,255,0.10);border-radius:18px;overflow:hidden;"><div style="padding:32px;background:linear-gradient(135deg,#12140a 0%,#1f2610 100%);border-bottom:1px solid rgba(255,255,255,0.10);"><p style="margin:0 0 10px;font-size:13px;letter-spacing:1.6px;text-transform:uppercase;color:#c8ff00;">Awareone</p><h1 style="margin:0;font-size:28px;line-height:1.3;">Welcome aboard, ${
              formData.admin_name
            }</h1><p style="margin:12px 0 0;font-size:15px;color:#cbd5e1;">Your company workspace for <strong>${
              formData.name
            }</strong> is ready.</p></div><div style="padding:32px;"><div style="margin:24px 0;padding:24px;background:rgba(200,255,0,0.10);border:1px solid rgba(200,255,0,0.20);border-radius:14px;"><p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#c8ff00;">Account Details</p><p style="margin:0 0 10px;font-size:15px;color:#fff;"><strong>Email:</strong> ${
              formData.admin_email
            }</p><p style="margin:0 0 10px;font-size:15px;color:#fff;"><strong>Password:</strong> Admin123!</p><p style="margin:0;font-size:15px;color:#fff;"><strong>Role:</strong> Company Admin</p></div>${
              loginUrl
                ? `<div style="margin:24px 0;"><a href="${loginUrl}" style="display:inline-block;padding:14px 22px;background:#c8ff00;color:#12140a;text-decoration:none;font-size:15px;font-weight:700;border-radius:10px;">Go to Login</a><p style="margin:12px 0 0;font-size:14px;color:#94a3b8;">Link: <a href="${loginUrl}" style="color:#c8ff00;text-decoration:none;">${loginUrl}</a></p></div>`
                : ""
            }<div style="margin:24px 0;padding:18px 20px;background:rgba(255,255,255,0.03);border-left:4px solid #c8ff00;border-radius:10px;"><p style="margin:0;font-size:14px;line-height:1.7;color:#cbd5e1;">For security, please sign in and change your password as soon as possible.</p></div></div></div></div>`,
          },
        });
      }
      setShowModal(false);
      setEditingCompany(null);
      await loadCompanies();
    } catch (err) {
      alert("Failed to save company: " + (err as any).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Delete this company and all associated users? This cannot be undone."
      )
    )
      return;
    try {
      const { data: usersData } = await supabase
        .from("users")
        .select("id")
        .eq("company_id", id);
      if (usersData?.length) {
        for (const u of usersData) {
          await supabase.functions.invoke("user-admin", {
            body: { action: "deleteUser", userId: u.id },
          });
        }
      }
      await supabase.from("companies").delete().eq("id", id);
      await loadCompanies();
    } catch {
      alert("Failed to delete company");
    }
  };

  const handleAssignContent = async (company: Company) => {
    setAssigningCompany(company);
    const [cRes, eRes] = await Promise.all([
      supabase
        .from("company_courses")
        .select("course_id")
        .eq("company_id", company.id),
      supabase
        .from("company_exams")
        .select("exam_id")
        .eq("company_id", company.id),
    ]);
    setSelectedCourses(cRes.data?.map((c) => c.course_id) || []);
    setSelectedExams(eRes.data?.map((e) => e.exam_id) || []);
    setShowAssignModal(true);
  };

  const handleSaveAssignments = async () => {
    if (!assigningCompany) return;
    setSavingAssign(true);
    try {
      await Promise.all([
        supabase
          .from("company_courses")
          .delete()
          .eq("company_id", assigningCompany.id),
        supabase
          .from("company_exams")
          .delete()
          .eq("company_id", assigningCompany.id),
      ]);
      if (selectedCourses.length > 0)
        await supabase
          .from("company_courses")
          .insert(
            selectedCourses.map((id) => ({
              company_id: assigningCompany.id,
              course_id: id,
            }))
          );
      if (selectedExams.length > 0)
        await supabase
          .from("company_exams")
          .insert(
            selectedExams.map((id) => ({
              company_id: assigningCompany.id,
              exam_id: id,
            }))
          );
      setShowAssignModal(false);
      setAssigningCompany(null);
    } catch {
      alert("Failed to save assignments");
    } finally {
      setSavingAssign(false);
    }
  };

  const toggleCourse = (id: string) =>
    setSelectedCourses((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  const toggleExam = (id: string) =>
    setSelectedExams((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  /* ── Avatar ── */
  const CoAvatar: React.FC<{ name: string }> = ({ name }) => (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        background: "rgba(200,255,0,0.08)",
        border: "1px solid rgba(200,255,0,0.20)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 15,
        fontWeight: 800,
        color: T.accent,
        flexShrink: 0,
      }}
    >
      {name?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Page header ── */}
      <div
        className="aw-fade-up"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
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
                background: "rgba(200,255,0,0.08)",
                border: "1px solid rgba(200,255,0,0.20)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Building2 size={18} style={{ color: T.accent }} />
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
              Companies
            </h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
            Manage company accounts, packages and campaign quotas.
          </p>
        </div>
        <button
          className="aw-co-btn-primary"
          onClick={() => {
            setEditingCompany(null);
            setShowModal(true);
          }}
        >
          <Plus size={15} /> Add New Company
        </button>
      </div>

      {/* ── Summary stats ── */}
      <div
        className="aw-fade-up"
        style={{
          animationDelay: "0.05s",
          display: "flex",
          gap: 10,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {[
          {
            label: "Total Companies",
            value: companies.length,
            color: T.accent,
            bg: "rgba(200,255,0,0.08)",
            border: "rgba(200,255,0,0.20)",
          },
          {
            label: "Full Courses",
            value: companies.filter((c) => c.package_type === "TYPE_A").length,
            color: T.green,
            bg: T.greenBg,
            border: T.greenBorder,
          },
          {
            label: "Exams Only",
            value: companies.filter((c) => c.package_type !== "TYPE_A").length,
            color: T.blue,
            bg: T.blueBg,
            border: T.blueBorder,
          },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: "10px 18px",
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 20, fontWeight: 900, color: s.color }}>
              {s.value}
            </span>
            <span style={{ fontSize: 12, color: T.textMuted }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Companies grid ── */}
      {companies.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "64px 24px",
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: "rgba(200,255,0,0.07)",
              border: "1px solid rgba(200,255,0,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <Building2 size={26} style={{ color: T.textMuted }} />
          </div>
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: T.textBody,
              marginBottom: 6,
            }}
          >
            No companies yet
          </p>
          <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>
            Click "Add New Company" to get started.
          </p>
          <button
            className="aw-co-btn-primary"
            onClick={() => {
              setEditingCompany(null);
              setShowModal(true);
            }}
          >
            <Plus size={14} /> Add New Company
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {companies.map((co, idx) => {
            const quotaPct = co.annual_quota
              ? Math.min(
                  100,
                  ((co.used_campaigns || 0) / co.annual_quota) * 100
                )
              : 0;
            const quotaColor =
              quotaPct >= 90 ? T.red : quotaPct >= 70 ? T.orange : T.green;

            return (
              <div
                key={co.id}
                className={`aw-co-card aw-fade-up`}
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                <div
                  style={{
                    padding: "18px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  {/* Avatar + name */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flex: "1 1 200px",
                      minWidth: 0,
                    }}
                  >
                    <CoAvatar name={co.name} />
                    <div style={{ minWidth: 0 }}>
                      <h3
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: T.white,
                          margin: "0 0 4px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {co.name}
                      </h3>
                      <div
                        style={{
                          display: "flex",
                          gap: 7,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <PkgBadge type={co.package_type || "TYPE_B"} />
                        {/* Active badge */}
                        <span
                          style={{
                            display: "inline-flex",
                            padding: "2px 9px",
                            borderRadius: 9999,
                            fontSize: 10,
                            fontWeight: 700,
                            background: co.is_active ? T.greenBg : T.redBg,
                            border: `1px solid ${
                              co.is_active ? T.greenBorder : T.redBorder
                            }`,
                            color: co.is_active ? T.green : T.red,
                          }}
                        >
                          {co.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* License */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      minWidth: 90,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: T.textMuted,
                        textTransform: "uppercase",
                        letterSpacing: "0.7px",
                        fontWeight: 700,
                      }}
                    >
                      Licenses
                    </span>
                    <span
                      style={{ fontSize: 15, fontWeight: 800, color: T.white }}
                    >
                      {co.license_limit || "—"}
                    </span>
                    <span style={{ fontSize: 10, color: T.textMuted }}>
                      employees
                    </span>
                  </div>

                  {/* Campaign quota */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      minWidth: 140,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: T.textMuted,
                        textTransform: "uppercase",
                        letterSpacing: "0.7px",
                        fontWeight: 700,
                      }}
                    >
                      Campaign Quota
                    </span>
                    {editingQuota === co.id ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <input
                          type="number"
                          min="0"
                          className="aw-co-quota-input"
                          value={quotaValue}
                          onChange={(e) =>
                            setQuotaValue(parseInt(e.target.value) || 0)
                          }
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdateQuota(co.id);
                            if (e.key === "Escape") setEditingQuota(null);
                          }}
                        />
                        <button
                          onClick={() => handleUpdateQuota(co.id)}
                          disabled={savingQuota}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: T.greenBg,
                            border: `1px solid ${T.greenBorder}`,
                            color: T.green,
                            cursor: "pointer",
                          }}
                        >
                          {savingQuota ? (
                            <Loader2
                              size={11}
                              style={{
                                animation: "aw-spin 0.8s linear infinite",
                              }}
                            />
                          ) : (
                            <Check size={11} />
                          )}
                        </button>
                        <button
                          onClick={() => setEditingQuota(null)}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(255,255,255,0.04)",
                            border: `1px solid ${T.borderFaint}`,
                            color: T.textMuted,
                            cursor: "pointer",
                          }}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingQuota(co.id);
                          setQuotaValue(co.annual_quota || 4);
                        }}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          textAlign: "left",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <Shield size={12} style={{ color: quotaColor }} />
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: quotaColor,
                            }}
                          >
                            {co.used_campaigns || 0}
                          </span>
                          <span style={{ fontSize: 12, color: T.textMuted }}>
                            / {co.annual_quota || 4}
                          </span>
                        </div>
                        <div
                          style={{
                            width: 100,
                            height: 4,
                            background: "rgba(255,255,255,0.07)",
                            borderRadius: 9999,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${quotaPct}%`,
                              background: quotaColor,
                              borderRadius: 9999,
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Created date */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      minWidth: 100,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: T.textMuted,
                        textTransform: "uppercase",
                        letterSpacing: "0.7px",
                        fontWeight: 700,
                      }}
                    >
                      Created
                    </span>
                    <span style={{ fontSize: 12, color: T.textMuted }}>
                      {fmt(co.created_at?.toISOString() || null)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      display: "flex",
                      gap: 7,
                      alignItems: "center",
                      marginLeft: "auto",
                      flexShrink: 0,
                    }}
                  >
                    <button
                      className="aw-co-icon-btn assign"
                      title="Assign Content"
                      onClick={() => handleAssignContent(co)}
                    >
                      <Settings size={14} />
                    </button>
                    <button
                      className="aw-co-icon-btn edit"
                      title="Edit Company"
                      onClick={() => {
                        setEditingCompany(co);
                        setShowModal(true);
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="aw-co-icon-btn del"
                      title="Delete Company"
                      onClick={() => handleDelete(co.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Company form modal ── */}
      {showModal && (
        <CompanyFormModal
          company={editingCompany}
          onClose={() => {
            setShowModal(false);
            setEditingCompany(null);
          }}
          onSave={handleSaveCompany}
          companies={companies}
        />
      )}

      {/* ── Assign content modal ── */}
      {showAssignModal && assigningCompany && (
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
            setShowAssignModal(false);
            setAssigningCompany(null);
          }}
        >
          <div
            className="aw-modal-in"
            style={{
              width: "100%",
              maxWidth: 560,
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 32px 80px rgba(0,0,0,0.55)",
              fontFamily: "'Inter', sans-serif",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Accent bar */}
            <div
              style={{
                height: 3,
                background:
                  "linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))",
                flexShrink: 0,
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
                gap: 12,
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: T.purpleBg,
                    border: `1px solid ${T.purpleBorder}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Settings size={16} style={{ color: T.purple }} />
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
                    Assign Content
                  </h2>
                  <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>
                    {assigningCompany.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setAssigningCompany(null);
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

            {/* Content */}
            <div
              className="aw-co-scroll"
              style={{
                overflowY: "auto",
                flex: 1,
                padding: "16px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 22,
              }}
            >
              {/* Courses */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <BookOpen size={13} style={{ color: T.accent }} />
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: T.white }}
                  >
                    Training Courses
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      color: T.accent,
                    }}
                  >
                    {selectedCourses.length} selected
                  </span>
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {allCourses.map((course) => {
                    const checked = selectedCourses.includes(course.id);
                    return (
                      <div
                        key={course.id}
                        className={`aw-co-check-row ${
                          checked ? "checked" : ""
                        }`}
                        onClick={() => toggleCourse(course.id)}
                      >
                        <div className="aw-co-checkbox">
                          {checked && (
                            <Check
                              size={11}
                              style={{ color: T.accentDark, strokeWidth: 3 }}
                            />
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: 13,
                            color: checked ? T.white : T.textBody,
                            fontWeight: checked ? 600 : 400,
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {course.title}
                        </span>
                      </div>
                    );
                  })}
                  {allCourses.length === 0 && (
                    <p
                      style={{
                        fontSize: 13,
                        color: T.textMuted,
                        padding: "8px 0",
                      }}
                    >
                      No courses available
                    </p>
                  )}
                </div>
              </div>

              {/* Exams */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <ClipboardCheck size={13} style={{ color: T.blue }} />
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: T.white }}
                  >
                    Exams
                  </span>
                  <span
                    style={{ marginLeft: "auto", fontSize: 11, color: T.blue }}
                  >
                    {selectedExams.length} selected
                  </span>
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {allExams.map((exam) => {
                    const checked = selectedExams.includes(exam.id);
                    return (
                      <div
                        key={exam.id}
                        className={`aw-co-check-row ${
                          checked ? "checked" : ""
                        }`}
                        onClick={() => toggleExam(exam.id)}
                        style={
                          checked
                            ? {
                                background: T.blueBg,
                                borderColor: T.blueBorder,
                              }
                            : {}
                        }
                      >
                        <div
                          className="aw-co-checkbox"
                          style={
                            checked
                              ? { background: T.blue, borderColor: T.blue }
                              : {}
                          }
                        >
                          {checked && (
                            <Check
                              size={11}
                              style={{ color: T.white, strokeWidth: 3 }}
                            />
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: 13,
                            color: checked ? T.white : T.textBody,
                            fontWeight: checked ? 600 : 400,
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {exam.title}
                        </span>
                      </div>
                    );
                  })}
                  {allExams.length === 0 && (
                    <p
                      style={{
                        fontSize: 13,
                        color: T.textMuted,
                        padding: "8px 0",
                      }}
                    >
                      No exams available
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "14px 22px",
                borderTop: `1px solid ${T.borderFaint}`,
                display: "flex",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <button
                className="aw-co-btn-ghost"
                onClick={() => {
                  setShowAssignModal(false);
                  setAssigningCompany(null);
                }}
                style={{ flex: 1, justifyContent: "center" }}
              >
                Cancel
              </button>
              <button
                className="aw-co-btn-primary"
                onClick={handleSaveAssignments}
                disabled={savingAssign}
                style={{
                  flex: 1,
                  justifyContent: "center",
                  boxShadow: "0 0 16px rgba(200,255,0,0.18)",
                }}
              >
                {savingAssign ? (
                  <>
                    <Loader2
                      size={14}
                      style={{ animation: "aw-spin 0.8s linear infinite" }}
                    />{" "}
                    Saving…
                  </>
                ) : (
                  <>
                    <Save size={14} /> Save Assignments
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
