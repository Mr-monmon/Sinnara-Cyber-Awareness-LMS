import React, { useState, useEffect } from "react";
import {
  Shield,
  ArrowLeft,
  FileText,
  Send,
  Eye,
  Mail,
  Lock,
  Activity,
  Loader2,
  Check,
  X,
  ChevronRight,
} from "lucide-react";
import DOMPurify from "dompurify";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { PhishingTemplate, PhishingCampaignQuota, PhishingDomain } from "../../lib/types";

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
} as const;

const ADDITIONAL_PHISHING_CAMPAIGNS_SUBJECT =
  "Request Additional Phishing Campaigns";

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Form inputs ── */
  .aw-pr-input, .aw-pr-select, .aw-pr-textarea {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-pr-input    { padding: 11px 14px; }
  .aw-pr-textarea { padding: 11px 14px; resize: vertical; min-height: 100px; }
  .aw-pr-select   {
    padding: 11px 36px 11px 14px; cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
  }
  .aw-pr-input:focus, .aw-pr-select:focus, .aw-pr-textarea:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-pr-input::placeholder, .aw-pr-textarea::placeholder { color: rgba(148,163,184,0.35); }
  .aw-pr-select option { background: #1a1e0e; color: #ffffff; }

  .aw-pr-label {
    display: block; font-size: 12px; font-weight: 600;
    color: #94a3b8; margin-bottom: 7px; letter-spacing: 0.3px;
    font-family: 'Inter', sans-serif;
  }

  /* ── Tabs ── */
  .aw-pr-tab {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 16px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif;
    transition: all 0.18s; background: none; color: #64748b;
  }
  .aw-pr-tab:hover { background: rgba(255,255,255,0.05); color: #cbd5e1; }
  .aw-pr-tab.active {
    background: rgba(200,255,0,0.10);
    border: 1px solid rgba(200,255,0,0.22);
    color: #c8ff00;
  }

  /* ── Dept checkbox row ── */
  .aw-pr-dept-row {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 14px; border-radius: 9px;
    border: 1px solid transparent;
    background: rgba(255,255,255,0.02); cursor: pointer;
    transition: all 0.18s; font-family: 'Inter', sans-serif;
  }
  .aw-pr-dept-row:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.08); }
  .aw-pr-dept-row.checked {
    background: rgba(200,255,0,0.06);
    border-color: rgba(200,255,0,0.25);
  }

  /* ── Tracking toggle row ── */
  .aw-pr-track-row {
    display: flex; align-items: flex-start; gap: 14px;
    padding: 14px 16px; border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02); cursor: pointer;
    transition: all 0.18s; font-family: 'Inter', sans-serif;
  }
  .aw-pr-track-row:hover { background: rgba(255,255,255,0.05); }
  .aw-pr-track-row.checked {
    background: rgba(200,255,0,0.04);
    border-color: rgba(200,255,0,0.20);
  }

  /* ── Custom checkbox ── */
  .aw-pr-check {
    width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0;
    border: 2px solid rgba(255,255,255,0.20);
    display: flex; align-items: center; justify-content: center;
    background: transparent; transition: all 0.18s;
  }
  .checked .aw-pr-check {
    background: #c8ff00; border-color: #c8ff00;
  }

  /* ── Submit btn ── */
  .aw-pr-submit {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 9px;
    padding: 14px 24px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 15px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 22px rgba(200,255,0,0.22);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-pr-submit:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .aw-pr-submit:disabled {
    background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25);
    cursor: not-allowed; box-shadow: none;
  }

  /* ── Checklist dot ── */
  .aw-pr-dot { width: 8px; height: 8px; border-radius: '50%'; flex-shrink: 0; margin-top: 5px; }

  /* ── Progress steps ── */
  .aw-pr-step {
    display: flex; align-items: flex-start; gap: 12px;
    font-family: 'Inter', sans-serif;
  }
  .aw-pr-step-num {
    width: 30px; height: 30px; border-radius: '50%'; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 800;
  }

  /* ── Code textarea ── */
  .aw-pr-code {
    font-family: 'Fira Code', 'Courier New', monospace !important;
    font-size: 12px !important; line-height: 1.6;
  }

  /* ── Preview modal overlay ── */
  .aw-pr-overlay {
    position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
    padding: 24px; background: rgba(10,12,6,0.85);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById("aw-pr-styles")
) {
  const tag = document.createElement("style");
  tag.id = "aw-pr-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

type Tab = "basics" | "content" | "tracking";

// A landing page option offered in the picker (company-owned or shared platform page).
type LandingPageOption = {
  id: string;
  name: string;
  is_platform_page: boolean;
};

/* ─────────────────────────────────────────
   SECTION WRAPPER
───────────────────────────────────────── */
const Section: React.FC<{ children: React.ReactNode; delay?: string }> = ({
  children,
  delay = "0s",
}) => (
  <div
    className="aw-fade-up"
    style={{
      animationDelay: delay,
      background: T.bgCard,
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      overflow: "hidden",
    }}
  >
    {children}
  </div>
);
const SectionHeader: React.FC<{
  icon: React.ElementType;
  color?: string;
  title: string;
  right?: React.ReactNode;
}> = ({ icon: Icon, color = T.accent, title, right }) => (
  <div
    style={{
      padding: "14px 20px",
      borderBottom: `1px solid ${T.borderFaint}`,
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}
  >
    <Icon size={14} style={{ color }} />
    <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>
      {title}
    </span>
    {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
  </div>
);

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
// A Phishing Scenario presented in the picker. Scenarios are the unified library
// (the old "Phishing Templates" were folded in). We map the scenario shape onto the
// picker's option shape and keep the bundle fields so selecting a scenario can
// pre-fill the email AND the landing page / redirect / capture settings.
type ScenarioOption = PhishingTemplate & {
  landing_page_html?: string;
  redirect_url?: string;
  capture_credentials?: boolean;
};

export const PhishingRequestPage: React.FC = () => {
  const { user } = useAuth();
  const [templates, setTemplates]   = useState<ScenarioOption[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [quota, setQuota]           = useState<PhishingCampaignQuota | null>(null);
  const [domains, setDomains]       = useState<PhishingDomain[]>([]);
  const [smtpProfiles, setSmtpProfiles] =
    useState<{ id: string; name: string; from_address: string; from_name: string }[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewTemplate, setPreviewTemplate] =
    useState<PhishingTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("basics");
  const [requestingMore, setRequestingMore] = useState(false);
  const [moreError, setMoreError] = useState("");

  const [form, setForm] = useState({
    campaign_name: "",
    template_id: "",
    target_departments: [] as string[],
    scheduled_date: "",
    notes: "",
    priority: "NORMAL",
    email_subject: "",
    email_html_body: "",
    email_text_body: "",
    // landing_page_html is no longer edited in the UI (replaced by a picker); kept
    // null in the insert. landing_page_id holds the chosen landing page ("" = blank).
    landing_page_html: "",
    landing_page_id: "",
    redirect_url: "",
    domain_id: "",
    from_address: "",
    from_name: "",
    track_opens: true,
    track_clicks: true,
    capture_credentials: true,
    capture_passwords: false,
    // Sending method (section H): how the platform should send this campaign.
    sending_method: "PLATFORM_DEFAULT" as
      | "PLATFORM_DEFAULT"
      | "COMPANY_SMTP"
      | "REQUEST_ADMIN_CONFIG",
    smtp_profile_id: "",
    reply_to_address: "",
    timezone: "Asia/Riyadh",
    // Requester attests they are authorised to run this simulation.
    authorization_confirmed: false,
  });

  useEffect(() => {
    loadFormData();
  }, [user]);

  const loadFormData = async () => {
    if (!user?.company_id) return;
    try {
      const year = new Date().getFullYear();
      const [tRes, dRes, qRes, domRes, smRes, lpRes] = await Promise.all([
        supabase
          .from("phishing_scenarios")
          .select("*")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("departments")
          .select("*")
          .eq("company_id", user.company_id)
          .order("name"),
        supabase
          .from("phishing_campaign_quotas")
          .select("*")
          .eq("company_id", user.company_id)
          .eq("quota_year", year)
          .maybeSingle(),
        supabase
          .from("phishing_domains")
          .select("*")
          .eq("is_platform_domain", true)
          .eq("is_verified", true)
          .order("domain_name"),
        // Company SMTP profiles the requester can choose as the sending method.
        supabase
          .from("smtp_profiles")
          .select("id, name, from_address, from_name")
          .eq("is_active", true)
          .order("name"),
        // Landing pages the requester can pick: company-owned + shared platform
        // pages. RLS already restricts platform pages to GLOBAL/shared ones.
        supabase
          .from("phishing_company_landing_pages")
          .select("id, name, is_platform_page")
          .or(`company_id.eq.${user.company_id},is_platform_page.eq.true`)
          .order("name"),
      ]);
      // Map scenario rows onto the picker option shape (subject/html come from the
      // scenario's email fields; bundle fields are retained for pre-fill).
      if (tRes.data)
        setTemplates(
          (tRes.data as Record<string, unknown>[]).map((s) => ({
            id: String(s.id),
            name: String(s.name ?? ""),
            description: String(s.description ?? ""),
            subject: String(s.email_subject ?? ""),
            html_content: String(s.email_html ?? ""),
            difficulty_level: String(s.difficulty ?? "MEDIUM"),
            category: String(s.category ?? "GENERAL"),
            created_at: String(s.created_at ?? ""),
            updated_at: String(s.updated_at ?? ""),
            landing_page_html: String(s.landing_page_html ?? ""),
            redirect_url: String(s.redirect_url ?? ""),
            capture_credentials: !!s.capture_credentials,
          })),
        );
      if (dRes.data) setDepartments(dRes.data);
      if (qRes.data) setQuota(qRes.data);
      if (domRes.data) setDomains(domRes.data);
      if (smRes.data) setSmtpProfiles(smRes.data);
      if (lpRes.data) setLandingPages(lpRes.data as LandingPageOption[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (tpl)
      setForm((prev) => ({
        ...prev,
        // form.template_id holds the selected SCENARIO id (unified library).
        template_id: id,
        email_subject: tpl.subject,
        email_html_body: tpl.html_content,
        // Landing page HTML is no longer edited here (replaced by a picker), so we
        // don't pre-fill it. Redirect / capture are still pre-filled from the bundle.
        redirect_url: tpl.redirect_url || prev.redirect_url,
        capture_credentials:
          tpl.capture_credentials ?? prev.capture_credentials,
      }));
    else setForm((prev) => ({ ...prev, template_id: id }));
  };

  const toggleDept = (id: string) =>
    setForm((prev) => ({
      ...prev,
      target_departments: prev.target_departments.includes(id)
        ? prev.target_departments.filter((x) => x !== id)
        : [...prev.target_departments, id],
    }));


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company_id || !user?.id) return;

    const remainingQuota =
      (quota?.annual_quota || 0) - (quota?.used_campaigns || 0);
    if (remainingQuota <= 0) {
      alert("No remaining quota. Please contact support.");
      return;
    }

    if (!form.authorization_confirmed) {
      alert("Please confirm you are authorised to run this phishing simulation before submitting.");
      return;
    }

    if (form.sending_method === "COMPANY_SMTP" && !form.smtp_profile_id) {
      alert("Select a company SMTP profile, or choose a different sending method.");
      return;
    }

    setSubmitting(true);

    try {
      // NOTE: submitting a request does NOT consume campaign quota. A request is a
      // ticket that may be rejected; campaign quota is consumed exactly once when
      // the platform admin creates the actual campaign (DB trigger on
      // phishing_campaigns INSERT). We only do a read-only remaining-quota check above.
      const { count: employeeCount } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("company_id", user.company_id)
        .eq("role", "EMPLOYEE")
        .in("department_id", form.target_departments);

      // Dedicated phishing ticket numbering (references phishing_campaign_requests).
      const { data: ticketData, error: ticketErr } = await supabase.rpc(
        "generate_phishing_ticket_number"
      );

      const ticketNumber =
        !ticketErr && ticketData
          ? ticketData
          : `PHC-${Date.now().toString().slice(-6)}`;

      const launchType = form.scheduled_date ? "SCHEDULED" : "IMMEDIATE";

      const { error } = await supabase
        .from("phishing_campaign_requests")
        .insert([
          {
            ticket_number: ticketNumber,
            company_id: user.company_id,
            requested_by: user.id,
            campaign_name: form.campaign_name,
            // Unified library: the picker stores a scenario id. Persist it as
            // scenario_id and leave the deprecated template_id null.
            scenario_id: form.template_id || null,
            template_id: null,
            target_departments: form.target_departments,
            target_employee_count: employeeCount,
            scheduled_date: form.scheduled_date || null,
            scheduled_launch_at: form.scheduled_date || null,
            launch_type: launchType,
            timezone: form.timezone,
            status: "SUBMITTED",
            priority: form.priority,
            notes: form.notes || null,
            email_subject: form.email_subject || null,
            email_html_body: form.email_html_body || null,
            email_text_body: form.email_text_body || null,
            landing_page_html: form.landing_page_html || null,
            landing_page_id: form.landing_page_id || null,
            redirect_url: form.redirect_url || null,
            domain_id: form.domain_id || null,
            from_address: form.from_address || null,
            from_name: form.from_name || null,
            // Sending method (section H)
            sending_method: form.sending_method,
            smtp_profile_id:
              form.sending_method === "COMPANY_SMTP"
                ? form.smtp_profile_id || null
                : null,
            reply_to_address: form.reply_to_address || null,
            authorization_confirmed: form.authorization_confirmed,
            track_opens: form.track_opens,
            track_clicks: form.track_clicks,
            capture_credentials: form.capture_credentials,
            capture_passwords: form.capture_passwords,
          },
        ]);

      if (error) throw error;

      alert(`Campaign request submitted successfully! Ticket: ${ticketNumber}`);

      window.location.reload();
    } catch (error) {
      console.error("Error submitting request:", error);
      alert("Failed to submit request: " + getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestMore = async () => {
    if (!user?.id) {
      setMoreError("Unable to identify user.");
      return;
    }
    setRequestingMore(true);
    setMoreError("");
    try {
      const { error } = await supabase
        .from("support_ticket")
        .insert([
          { user_id: user.id, subject: ADDITIONAL_PHISHING_CAMPAIGNS_SUBJECT },
        ])
        .select("id")
        .single();
      if (error) throw error;
      alert("Support request submitted successfully.");
    } catch {
      setMoreError("Failed to create support request. Please try again.");
    } finally {
      setRequestingMore(false);
    }
  };

  if (loading)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 0",
          gap: 14,
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.06)",
            borderTopColor: T.accent,
            animation: "aw-spin 0.8s linear infinite",
          }}
        />
      </div>
    );

  const remainingQuota =
    Math.max(0, (quota?.annual_quota || 0) - (quota?.used_campaigns || 0));
  const selectedTpl = templates.find((t) => t.id === form.template_id);
  const annualQuotaIsZero = quota !== null && quota.annual_quota === 0;

  if (annualQuotaIsZero) {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif" }}>
        <button
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 13,
            fontWeight: 600,
            color: T.textMuted,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0 0 24px",
            fontFamily: "inherit",
          }}
          onClick={() => window.history.back()}
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>

        <div
          style={{
            maxWidth: 520,
            margin: "0 auto",
            textAlign: "center",
            padding: "40px 32px",
            background: T.bgCard,
            border: `1px solid ${T.orangeBorder}`,
            borderRadius: 16,
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: T.orangeBg,
              border: `1px solid ${T.orangeBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <Shield size={26} style={{ color: T.orange }} />
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: T.white,
              margin: "0 0 10px",
            }}
          >
            Quota Exhausted
          </h1>
          <p
            style={{
              fontSize: 14,
              color: T.textBody,
              margin: "0 0 24px",
              lineHeight: "22px",
            }}
          >
            Your organization has used all phishing campaigns for this year.
            Contact support to increase your quota.
          </p>
          {moreError && (
            <div
              style={{
                padding: "10px 16px",
                background: T.redBg,
                border: `1px solid ${T.redBorder}`,
                borderRadius: 9,
                fontSize: 13,
                color: T.red,
                marginBottom: 16,
              }}
            >
              {moreError}
            </div>
          )}
          <button
            onClick={handleRequestMore}
            disabled={requestingMore}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px",
              background: T.accent,
              color: T.accentDark,
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {requestingMore ? (
              <>
                <Loader2
                  size={14}
                  style={{ animation: "aw-spin 0.8s linear infinite" }}
                />{" "}
                Sending…
              </>
            ) : (
              ADDITIONAL_PHISHING_CAMPAIGNS_SUBJECT
            )}
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; icon: React.ElementType; label: string; done: boolean }[] = [
    {
      id: "basics",
      icon: FileText,
      label: "Basics & Targets",
      done: !!form.campaign_name && form.target_departments.length > 0,
    },
    {
      id: "content",
      icon: Mail,
      label: "Email & Landing Page",
      done: !!form.email_subject && !!form.email_html_body,
    },
    {
      id: "tracking",
      icon: Activity,
      label: "Tracking & Submit",
      done: form.authorization_confirmed,
    },
  ];

  const tabOrder: Tab[] = ["basics", "content", "tracking"];
  const activeIndex = tabOrder.indexOf(activeTab);
  const goNext = () =>
    setActiveTab(tabOrder[Math.min(activeIndex + 1, tabOrder.length - 1)]);
  const goBack = () =>
    setActiveTab(tabOrder[Math.max(activeIndex - 1, 0)]);

  /* Checklist items */
  const checklist = [
    {
      label: "Campaign Name",
      done: !!form.campaign_name,
      sub: "Appears in reports",
    },
    {
      label: "Email Template",
      done: !!form.email_subject && !!form.email_html_body,
      sub: "Subject & HTML body",
    },
    {
      label: "Landing Page",
      done: !!form.landing_page_id,
      sub: "Optional — admin picks if blank",
      optional: true,
    },
    {
      label: "Target Group",
      done: form.target_departments.length > 0,
      sub: "Recipient departments",
    },
    { label: "Sending Profile", done: !!form.from_address, sub: "SMTP config" },
    {
      label: "Scheduling",
      done: !!form.scheduled_date,
      sub: form.scheduled_date ? "Scheduled" : "Immediate on approval",
      optional: true,
    },
    {
      label: "Tracking Options",
      done: true,
      sub: "Opens, clicks, credentials",
    },
  ];

  const isSubmitDisabled =
    submitting ||
    remainingQuota <= 0 ||
    form.target_departments.length === 0 ||
    !form.campaign_name ||
    !form.email_subject ||
    !form.email_html_body ||
    !form.authorization_confirmed ||
    (form.sending_method === "COMPANY_SMTP" && !form.smtp_profile_id);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Back button ── */}
      <button
        className="aw-fade-up"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontSize: 13,
          fontWeight: 600,
          color: T.textMuted,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0 0 20px",
          fontFamily: "inherit",
          transition: "color 0.18s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = T.white)}
        onMouseLeave={(e) => (e.currentTarget.style.color = T.textMuted)}
        onClick={() => window.history.back()}
      >
        <ArrowLeft size={14} /> Back to Dashboard
      </button>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ marginBottom: 24 }}>
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
              background: T.redBg,
              border: `1px solid ${T.redBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Shield size={18} style={{ color: T.red }} />
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
            Create Phishing Campaign
          </h1>
        </div>
        <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
          Configure all elements of your phishing simulation campaign.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: 20,
          alignItems: "flex-start",
        }}
      >
        {/* ── Main form ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Quota bar */}
          <div
            className="aw-fade-up"
            style={{
              animationDelay: "0.05s",
              padding: "14px 18px",
              background: remainingQuota > 0 ? "rgba(200,255,0,0.04)" : T.redBg,
              border: `1px solid ${
                remainingQuota > 0 ? "rgba(200,255,0,0.20)" : T.redBorder
              }`,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <Shield
              size={18}
              style={{
                color: remainingQuota > 0 ? T.accent : T.red,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: T.white,
                  marginBottom: 5,
                }}
              >
                Campaign Quota
              </div>
              <div
                style={{
                  height: 5,
                  background: "rgba(255,255,255,0.07)",
                  borderRadius: 9999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.max(
                      0,
                      (remainingQuota / (quota?.annual_quota || 1)) * 100
                    )}%`,
                    background: remainingQuota > 0 ? T.accent : T.red,
                    borderRadius: 9999,
                  }}
                />
              </div>
            </div>
            <span
              style={{
                fontSize: 16,
                fontWeight: 900,
                color: remainingQuota > 0 ? T.accent : T.red,
                flexShrink: 0,
              }}
            >
              {remainingQuota} / {quota?.annual_quota || 0}
            </span>
          </div>

          {/* Tabs */}
          <div
            className="aw-fade-up"
            style={{
              animationDelay: "0.08s",
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${T.borderFaint}`,
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              {tabs.map((tab, i) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`aw-pr-tab ${
                    activeTab === tab.id ? "active" : ""
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.done ? (
                    <Check size={13} style={{ color: T.green }} />
                  ) : (
                    <tab.icon size={13} />
                  )}{" "}
                  <span style={{ opacity: 0.55, fontWeight: 700 }}>{i + 1}.</span>{" "}
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ padding: "20px" }}>
                {/* ── STEP 1: BASICS & TARGETS ── */}
                {activeTab === "basics" && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 18,
                    }}
                  >
                    <div>
                      <label className="aw-pr-label">
                        Campaign Name <span style={{ color: T.accent }}>*</span>
                      </label>
                      <input
                        className="aw-pr-input"
                        type="text"
                        required
                        placeholder="Q4 2025 Security Awareness Test"
                        value={form.campaign_name}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            campaign_name: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="aw-pr-label">Phishing Scenario</label>
                      <select
                        className="aw-pr-select"
                        value={form.template_id}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                      >
                        <option value="">
                          Select a scenario (or create custom below)…
                        </option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.difficulty_level})
                          </option>
                        ))}
                      </select>
                      {selectedTpl && (
                        <button
                          type="button"
                          onClick={() => setPreviewTemplate(selectedTpl)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            marginTop: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            color: T.blue,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            fontFamily: "inherit",
                          }}
                        >
                          <Eye size={12} /> Preview Scenario
                        </button>
                      )}
                    </div>

                    {/* Target departments */}
                    <div>
                      <label className="aw-pr-label">
                        Target Departments{" "}
                        <span style={{ color: T.accent }}>*</span>
                      </label>
                      <div
                        style={{
                          maxHeight: 200,
                          overflowY: "auto",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          padding: "4px 0",
                        }}
                      >
                        {departments.length > 0 ? (
                          departments.map((dept) => {
                            const checked = form.target_departments.includes(
                              dept.id
                            );
                            return (
                              <div
                                key={dept.id}
                                className={`aw-pr-dept-row ${
                                  checked ? "checked" : ""
                                }`}
                                onClick={() => toggleDept(dept.id)}
                              >
                                <div className="aw-pr-check">
                                  {checked && (
                                    <Check
                                      size={12}
                                      style={{
                                        color: T.accentDark,
                                        strokeWidth: 3,
                                      }}
                                    />
                                  )}
                                </div>
                                <div
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: "50%",
                                    background: checked
                                      ? "rgba(200,255,0,0.10)"
                                      : "rgba(255,255,255,0.05)",
                                    border: `1px solid ${
                                      checked
                                        ? "rgba(200,255,0,0.25)"
                                        : T.borderFaint
                                    }`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: checked ? T.accent : T.textMuted,
                                    flexShrink: 0,
                                  }}
                                >
                                  {dept.name.charAt(0).toUpperCase()}
                                </div>
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: checked ? 600 : 400,
                                    color: checked ? T.white : T.textBody,
                                  }}
                                >
                                  {dept.name}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <p
                            style={{
                              fontSize: 13,
                              color: T.textMuted,
                              padding: "8px 0",
                            }}
                          >
                            No departments available
                          </p>
                        )}
                      </div>
                      {form.target_departments.length > 0 && (
                        <p
                          style={{
                            fontSize: 11,
                            color: T.accent,
                            marginTop: 7,
                          }}
                        >
                          ✓ {form.target_departments.length} department
                          {form.target_departments.length !== 1 ? "s" : ""}{" "}
                          selected
                        </p>
                      )}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 14,
                      }}
                    >
                      <div>
                        <label className="aw-pr-label">
                          Scheduled Launch Date
                        </label>
                        <input
                          className="aw-pr-input"
                          type="datetime-local"
                          value={form.scheduled_date}
                          min={new Date().toISOString().slice(0, 16)}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              scheduled_date: e.target.value,
                            }))
                          }
                        />
                        <p
                          style={{
                            fontSize: 11,
                            color: T.textMuted,
                            marginTop: 5,
                          }}
                        >
                          Leave empty to launch immediately upon approval
                        </p>
                      </div>
                      <div>
                        <label className="aw-pr-label">Priority</label>
                        <select
                          className="aw-pr-select"
                          value={form.priority}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, priority: e.target.value }))
                          }
                        >
                          {["LOW", "NORMAL", "HIGH", "URGENT"].map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="aw-pr-label">Additional Notes</label>
                      <textarea
                        className="aw-pr-textarea"
                        rows={3}
                        placeholder="Any specific requirements or instructions…"
                        value={form.notes}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, notes: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                )}

                {/* ── STEP 2: EMAIL & LANDING PAGE ── */}
                {activeTab === "content" && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 18,
                    }}
                  >
                    <div
                      style={{
                        padding: "12px 16px",
                        background: "rgba(251,191,36,0.07)",
                        border: "1px solid rgba(251,191,36,0.22)",
                        borderRadius: 10,
                        fontSize: 13,
                        color: T.gold,
                      }}
                    >
                      <strong>Template Variables:</strong> Use{" "}
                      <code
                        style={{
                          background: "rgba(251,191,36,0.14)",
                          padding: "1px 6px",
                          borderRadius: 4,
                        }}
                      >
                        {"{{.FirstName}}"}
                      </code>
                      ,{" "}
                      <code
                        style={{
                          background: "rgba(251,191,36,0.14)",
                          padding: "1px 6px",
                          borderRadius: 4,
                        }}
                      >
                        {"{{.Email}}"}
                      </code>
                      ,{" "}
                      <code
                        style={{
                          background: "rgba(251,191,36,0.14)",
                          padding: "1px 6px",
                          borderRadius: 4,
                        }}
                      >
                        {"{{.URL}}"}
                      </code>{" "}
                      to personalize emails.
                    </div>
                    {/* Sending method (section H) */}
                    <div>
                      <label className="aw-pr-label">
                        Sending Method <span style={{ color: T.accent }}>*</span>
                      </label>
                      <select
                        className="aw-pr-select"
                        value={form.sending_method}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            sending_method: e.target.value as typeof p.sending_method,
                            smtp_profile_id:
                              e.target.value === "COMPANY_SMTP" ? p.smtp_profile_id : "",
                          }))
                        }
                      >
                        <option value="PLATFORM_DEFAULT">Platform default sender</option>
                        <option value="COMPANY_SMTP">Use a company SMTP profile</option>
                        <option value="REQUEST_ADMIN_CONFIG">
                          Ask the platform admin to configure SMTP
                        </option>
                      </select>
                      {form.sending_method === "COMPANY_SMTP" && (
                        <div style={{ marginTop: 10 }}>
                          <label className="aw-pr-label">
                            SMTP Profile <span style={{ color: T.accent }}>*</span>
                          </label>
                          {smtpProfiles.length > 0 ? (
                            <select
                              className="aw-pr-select"
                              value={form.smtp_profile_id}
                              onChange={(e) => {
                                const p = smtpProfiles.find((s) => s.id === e.target.value);
                                setForm((prev) => ({
                                  ...prev,
                                  smtp_profile_id: e.target.value,
                                  from_name: p?.from_name || prev.from_name,
                                  from_address: p?.from_address || prev.from_address,
                                }));
                              }}
                            >
                              <option value="">— Select an SMTP profile —</option>
                              {smtpProfiles.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.from_address})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p style={{ fontSize: 12, color: T.orange, marginTop: 4 }}>
                              No active SMTP profiles found. Create one in SMTP Settings,
                              or choose a different sending method.
                            </p>
                          )}
                        </div>
                      )}
                      <p style={{ fontSize: 11, color: T.textMuted, marginTop: 6, marginBottom: 0 }}>
                        Tells the platform team exactly how this campaign should send mail.
                      </p>
                    </div>
                    {domains.length > 0 && (
                      <div>
                        <label className="aw-pr-label">
                          Sending Domain <span style={{ color: T.accent }}>*</span>
                        </label>
                        <select
                          className="aw-pr-select"
                          value={form.domain_id}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, domain_id: e.target.value }))
                          }
                        >
                          <option value="">— Select a verified domain —</option>
                          {domains.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.domain_name}
                            </option>
                          ))}
                        </select>
                        <p style={{ fontSize: 11, color: T.textMuted, marginTop: 6, marginBottom: 0 }}>
                          Emails will be sent from this domain. Domains are managed by the platform team.
                        </p>
                      </div>
                    )}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 14,
                      }}
                    >
                      <div>
                        <label className="aw-pr-label">From Name</label>
                        <input
                          className="aw-pr-input"
                          type="text"
                          placeholder="IT Support Team"
                          value={form.from_name}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              from_name: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="aw-pr-label">
                          From Email Address
                        </label>
                        <input
                          className="aw-pr-input"
                          type="email"
                          placeholder={
                            form.domain_id
                              ? `support@${domains.find(d => d.id === form.domain_id)?.domain_name || 'domain.com'}`
                              : "support@company.com"
                          }
                          value={form.from_address}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              from_address: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label className="aw-pr-label">Reply-To Address (optional)</label>
                      <input
                        className="aw-pr-input"
                        type="email"
                        placeholder="replies@company.com"
                        value={form.reply_to_address}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, reply_to_address: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="aw-pr-label">
                        Email Subject <span style={{ color: T.accent }}>*</span>
                      </label>
                      <input
                        className="aw-pr-input"
                        type="text"
                        required
                        placeholder="Urgent: Password Reset Required"
                        value={form.email_subject}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            email_subject: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="aw-pr-label">
                        HTML Body <span style={{ color: T.accent }}>*</span>
                      </label>
                      <textarea
                        className="aw-pr-textarea aw-pr-code"
                        required
                        rows={10}
                        placeholder={`<html><body><p>Hello {{.FirstName}},</p><p>Click here: <a href='{{.URL}}'>Reset Password</a></p></body></html>`}
                        value={form.email_html_body}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            email_html_body: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="aw-pr-label">
                        Plain Text Body{" "}
                        <span style={{ color: T.textMuted }}>(optional)</span>
                      </label>
                      <textarea
                        className="aw-pr-textarea aw-pr-code"
                        rows={4}
                        placeholder="Hello {{.FirstName}}, Click here: {{.URL}}"
                        value={form.email_text_body}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            email_text_body: e.target.value,
                          }))
                        }
                      />
                    </div>

                    {/* ── Landing page (merged into step 2) ── */}
                    <div
                      style={{
                        height: 1,
                        background: T.borderFaint,
                        margin: "2px 0",
                      }}
                    />
                    <div
                      style={{
                        padding: "12px 16px",
                        background: T.blueBg,
                        border: `1px solid ${T.blueBorder}`,
                        borderRadius: 10,
                        fontSize: 13,
                        color: T.blue,
                      }}
                    >
                      <strong>Landing Page:</strong> The page displayed when
                      users click the phishing link. Pick one below, or leave it
                      blank and the platform admin will choose the best landing
                      page for this campaign.
                    </div>
                    <div>
                      <label className="aw-pr-label">Landing Page</label>
                      <select
                        className="aw-pr-select"
                        value={form.landing_page_id}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            landing_page_id: e.target.value,
                          }))
                        }
                      >
                        <option value="">
                          Leave blank — platform admin will choose the best
                          landing page
                        </option>
                        {landingPages.map((lp) => (
                          <option key={lp.id} value={lp.id}>
                            {lp.name}
                            {lp.is_platform_page ? " — Platform" : ""}
                          </option>
                        ))}
                      </select>
                      {(() => {
                        const sel = landingPages.find(
                          (lp) => lp.id === form.landing_page_id,
                        );
                        return sel?.is_platform_page ? (
                          <span
                            style={{
                              display: "inline-block",
                              marginTop: 8,
                              padding: "2px 9px",
                              background: T.purpleBg,
                              border: `1px solid ${T.purpleBorder}`,
                              borderRadius: 9999,
                              fontSize: 10,
                              fontWeight: 700,
                              color: T.purple,
                            }}
                          >
                            Platform
                          </span>
                        ) : null;
                      })()}
                      <p
                        style={{
                          fontSize: 11,
                          color: T.textMuted,
                          marginTop: 6,
                          marginBottom: 0,
                        }}
                      >
                        Optional. Platform pages are shared templates maintained
                        by the platform team.
                      </p>
                    </div>
                    <div>
                      <label className="aw-pr-label">
                        Redirect URL{" "}
                        <span style={{ color: T.textMuted }}>
                          (after landing page)
                        </span>
                      </label>
                      <input
                        className="aw-pr-input"
                        type="url"
                        placeholder="https://www.company.com/security-awareness"
                        value={form.redirect_url}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            redirect_url: e.target.value,
                          }))
                        }
                      />
                      <p
                        style={{
                          fontSize: 11,
                          color: T.textMuted,
                          marginTop: 5,
                        }}
                      >
                        Where to redirect users after they interact with the
                        landing page
                      </p>
                    </div>
                  </div>
                )}

                {/* ── STEP 3: TRACKING & SUBMIT ── */}
                {activeTab === "tracking" && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        padding: "12px 16px",
                        background: T.greenBg,
                        border: `1px solid ${T.greenBorder}`,
                        borderRadius: 10,
                        fontSize: 13,
                        color: T.green,
                      }}
                    >
                      <strong>Tracking Options:</strong> Configure what user
                      actions to monitor during the campaign.
                    </div>
                    {[
                      {
                        key: "track_opens" as const,
                        label: "Track Email Opens",
                        sub: "Monitor when recipients open the phishing email",
                        warn: false,
                      },
                      {
                        key: "track_clicks" as const,
                        label: "Track Link Clicks",
                        sub: "Monitor when recipients click links in the email",
                        warn: false,
                      },
                      {
                        key: "capture_credentials" as const,
                        label: "Capture Credential Submissions",
                        sub: "Track when users enter credentials on the landing page",
                        warn: false,
                      },
                      {
                        key: "capture_passwords" as const,
                        label: "Capture Actual Passwords",
                        sub: "Store actual passwords entered — use with caution",
                        warn: true,
                      },
                    ].map(({ key, label, sub, warn }) => {
                      const checked = form[key];
                      return (
                        <div
                          key={key}
                          className={`aw-pr-track-row ${
                            checked ? "checked" : ""
                          }`}
                          onClick={() =>
                            setForm((p) => ({ ...p, [key]: !p[key] }))
                          }
                        >
                          <div style={{ marginTop: 1 }}>
                            <div
                              className="aw-pr-check"
                              style={{
                                background: checked ? T.accent : "transparent",
                                borderColor: checked
                                  ? T.accent
                                  : "rgba(255,255,255,0.20)",
                              }}
                            >
                              {checked && (
                                <Check
                                  size={12}
                                  style={{
                                    color: T.accentDark,
                                    strokeWidth: 3,
                                  }}
                                />
                              )}
                            </div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 7,
                                marginBottom: 3,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: T.white,
                                }}
                              >
                                {label}
                              </span>
                              {warn && (
                                <Lock size={12} style={{ color: T.gold }} />
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: T.textMuted }}>
                              {sub}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div
                      style={{
                        padding: "12px 16px",
                        background: T.orangeBg,
                        border: `1px solid ${T.orangeBorder}`,
                        borderRadius: 10,
                        fontSize: 12,
                        color: T.orange,
                        lineHeight: "18px",
                      }}
                    >
                      <strong>Note:</strong> All captured data is encrypted and
                      only accessible to authorized administrators. Capturing
                      actual passwords is not recommended for security reasons.
                    </div>

                    {/* Authorisation attestation (required) */}
                    <div
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          authorization_confirmed: !p.authorization_confirmed,
                        }))
                      }
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "12px 16px",
                        background: form.authorization_confirmed ? T.greenBg : "rgba(255,255,255,0.03)",
                        border: `1px solid ${form.authorization_confirmed ? T.greenBorder : T.border}`,
                        borderRadius: 10,
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 5,
                          marginTop: 1,
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: form.authorization_confirmed ? T.accent : "transparent",
                          border: `2px solid ${form.authorization_confirmed ? T.accent : "rgba(255,255,255,0.20)"}`,
                        }}
                      >
                        {form.authorization_confirmed && (
                          <Check size={12} style={{ color: T.accentDark, strokeWidth: 3 }} />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.white, marginBottom: 3 }}>
                          I am authorised to run this phishing simulation{" "}
                          <span style={{ color: T.accent }}>*</span>
                        </div>
                        <div style={{ fontSize: 12, color: T.textMuted }}>
                          I confirm my organisation has authorised this simulation against the
                          selected employees, and that I am permitted to request it.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step navigation / Submit */}
              <div
                style={{
                  padding: "16px 20px",
                  borderTop: `1px solid ${T.borderFaint}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  onClick={goBack}
                  disabled={activeIndex === 0}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "12px 18px",
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    background: "rgba(255,255,255,0.03)",
                    color: activeIndex === 0 ? T.textMuted : T.textBody,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: activeIndex === 0 ? "not-allowed" : "pointer",
                    opacity: activeIndex === 0 ? 0.5 : 1,
                  }}
                >
                  <ArrowLeft size={15} /> Back
                </button>

                {activeTab === "tracking" ? (
                  <button
                    type="submit"
                    className="aw-pr-submit"
                    style={{ flex: 1 }}
                    disabled={isSubmitDisabled}
                  >
                    {submitting ? (
                      <>
                        <Loader2
                          size={16}
                          style={{ animation: "aw-spin 0.8s linear infinite" }}
                        />{" "}
                        Submitting…
                      </>
                    ) : (
                      <>
                        <Send size={16} /> Submit Campaign Request
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    className="aw-pr-submit"
                    style={{ flex: 1 }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            position: "sticky",
            top: 88,
          }}
        >
          {/* Campaign elements checklist */}
          <Section delay="0.12s">
            <SectionHeader icon={Check} title="Campaign Elements" />
            <div
              style={{
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {checklist.map(({ label, done, sub, optional }) => (
                <div
                  key={label}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      flexShrink: 0,
                      marginTop: 5,
                      background: done
                        ? T.green
                        : optional
                        ? T.gold
                        : "rgba(255,255,255,0.15)",
                      boxShadow: done
                        ? "0 0 6px rgba(52,211,153,0.45)"
                        : "none",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: done ? T.white : T.textMuted,
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>
                      {sub}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* What happens next */}
          <Section delay="0.16s">
            <SectionHeader icon={ChevronRight} title="What Happens Next?" />
            <div
              style={{
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {[
                {
                  color: T.blue,
                  label: "Request Submitted",
                  sub: "Your request is sent to platform team",
                },
                {
                  color: T.green,
                  label: "Review & Setup",
                  sub: "Team configures the campaign",
                },
                {
                  color: T.orange,
                  label: "Campaign Launched",
                  sub: "Phishing emails sent to targets",
                },
                {
                  color: T.purple,
                  label: "Results & Analytics",
                  sub: "View detailed performance metrics",
                },
              ].map(({ color, label, sub }, i) => (
                <div
                  key={label}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: `${color}14`,
                      border: `1px solid ${color}30`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 800,
                      color,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: T.white,
                        marginBottom: 2,
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>
                      {sub}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Best practices */}
          <Section delay="0.20s">
            <SectionHeader
              icon={Shield}
              color={T.green}
              title="Best Practices"
            />
            <div
              style={{
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {[
                "Use template variables for personalization",
                "Test HTML rendering before submission",
                "Schedule during business hours",
                "Enable all tracking options for insights",
                "Review department vulnerability after completion",
              ].map((tip) => (
                <div
                  key={tip}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    fontSize: 12,
                    color: T.textBody,
                    lineHeight: "18px",
                  }}
                >
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: T.accent,
                      flexShrink: 0,
                      marginTop: 6,
                    }}
                  />
                  {tip}
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      {/* ── Template preview modal ── */}
      {previewTemplate && (
        <div className="aw-pr-overlay" onClick={() => setPreviewTemplate(null)}>
          <div
            className="aw-modal-in"
            style={{
              width: "100%",
              maxWidth: 660,
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: 16,
              overflow: "hidden",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 32px 80px rgba(0,0,0,0.55)",
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
            <div
              style={{
                padding: "18px 22px",
                borderBottom: `1px solid ${T.borderFaint}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: T.white,
                    margin: "0 0 4px",
                  }}
                >
                  {previewTemplate.name}
                </h2>
                <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>
                  {previewTemplate.description}
                </p>
                <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                  {[
                    previewTemplate.category,
                    previewTemplate.difficulty_level,
                  ].map((tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: "2px 9px",
                        background: T.blueBg,
                        border: `1px solid ${T.blueBorder}`,
                        borderRadius: 9999,
                        fontSize: 10,
                        fontWeight: 700,
                        color: T.blue,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
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
            <div style={{ overflowY: "auto", padding: "18px 22px" }}>
              <div
                style={{
                  marginBottom: 12,
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${T.borderFaint}`,
                  borderRadius: 9,
                }}
              >
                <span style={{ fontSize: 11, color: T.textMuted }}>
                  Subject:{" "}
                </span>
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: T.textBody }}
                >
                  {previewTemplate.subject}
                </span>
              </div>
              <div
                style={{
                  padding: "14px",
                  background: "#ffffff",
                  borderRadius: 10,
                  overflow: "auto",
                }}
              >
                <div
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(previewTemplate.html_content),
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
