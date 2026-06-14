import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, Download, Rocket, Loader2, Settings, Save,
  Server, LayoutTemplate, Globe, Clock, Gauge, X,
} from "lucide-react";
import DOMPurify from "dompurify";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { missingCampaignFields } from "../../lib/requestCompleteness";
import { RequestWithCompany, User } from "../../lib/types";

/* ─────────────────────────────────────────
   DARK ADMIN THEME TOKENS (match the rest of platform-admin)
───────────────────────────────────────── */
const T = {
  bgCard:      '#1a1e0e',
  panel:       'rgba(255,255,255,0.03)',
  accent:      '#c8ff00',
  accentDark:  '#12140a',
  white:       '#ffffff',
  textBody:    '#cbd5e1',
  textMuted:   '#64748b',
  textFaint:   '#94a3b8',
  border:      'rgba(255,255,255,0.09)',
  borderFaint: 'rgba(255,255,255,0.05)',
  green:       '#34d399', greenBg: 'rgba(52,211,153,0.08)',  greenBorder: 'rgba(52,211,153,0.22)',
  blue:        '#60a5fa', blueBg:  'rgba(96,165,250,0.08)',  blueBorder:  'rgba(96,165,250,0.22)',
  orange:      '#fb923c', orangeBg:'rgba(251,146,60,0.08)',  orangeBorder:'rgba(251,146,60,0.22)',
  gold:        '#fbbf24', goldBg:  'rgba(251,191,36,0.08)',  goldBorder:  'rgba(251,191,36,0.22)',
  red:         '#f87171', redBg:   'rgba(248,113,113,0.08)', redBorder:   'rgba(248,113,113,0.22)',
  purple:      '#a78bfa', purpleBg:'rgba(167,139,250,0.08)', purpleBorder:'rgba(167,139,250,0.22)',
} as const;

const STYLES = `
  .aw-rp-input {
    width: 100%; box-sizing: border-box; padding: 9px 12px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 9px; font-size: 13px; color: #fff; font-family: inherit; outline: none;
    transition: border-color .2s, box-shadow .2s, background .2s;
  }
  .aw-rp-input:focus { border-color: rgba(200,255,0,0.45); box-shadow: 0 0 0 3px rgba(200,255,0,0.07); background: rgba(255,255,255,0.06); }
  .aw-rp-input::placeholder { color: rgba(148,163,184,0.4); }
  .aw-rp-input option { background: #1a1e0e; color: #fff; }
  .aw-rp-label { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; color: #94a3b8; margin-bottom: 6px; }
  .aw-rp-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
  .aw-rp-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-rp-scroll::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }
  @keyframes aw-rp-in  { from { opacity: 0; transform: scale(.97) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  @keyframes aw-rp-spin { to { transform: rotate(360deg); } }
  .aw-rp-modal { animation: aw-rp-in .25s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-rp-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-rp-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

const STATUS_BADGE: Record<string, { bg: string; border: string; color: string }> = {
  DRAFT:     { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)', color: '#94a3b8' },
  SUBMITTED: { bg: T.blueBg,   border: T.blueBorder,   color: T.blue },
  APPROVED:  { bg: T.greenBg,  border: T.greenBorder,  color: T.green },
  RUNNING:   { bg: T.orangeBg, border: T.orangeBorder, color: T.orange },
  PAUSED:    { bg: T.goldBg,   border: T.goldBorder,   color: T.gold },
  COMPLETED: { bg: T.purpleBg, border: T.purpleBorder, color: T.purple },
  REJECTED:  { bg: T.redBg,    border: T.redBorder,    color: T.red },
};
const badgeStyle = (s: string) => STATUS_BADGE[s] ?? STATUS_BADGE.DRAFT;

/* Read-only label/value cell used across the request summary grid. */
const SummaryField = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: T.white, wordBreak: 'break-word' }}>{children}</div>
  </div>
);

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
  color: T.textMuted, marginBottom: 8,
};

type DepartmentOption = {
  id: string;
  name: string;
};

type TargetUser = Pick<User, "id" | "full_name" | "email" | "department_id">;

type Props = {
  selectedRequest: RequestWithCompany;
  updateSelectedRequest: (request: RequestWithCompany | null) => void;
  getStatusColor: (status: string) => string;
  onConverted?: () => void;
};

const SENDING_METHOD_LABEL: Record<string, string> = {
  PLATFORM_DEFAULT: "Platform default sender",
  COMPANY_SMTP: "Company SMTP profile",
  REQUEST_ADMIN_CONFIG: "Platform admin to configure SMTP",
};

const RequestPreview = ({
  selectedRequest,
  updateSelectedRequest,
  onConverted,
}: Props) => {
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [users, setUsers] = useState<TargetUser[]>([]);
  const [domainName, setDomainName] = useState<string>("");
  const [smtpProfileName, setSmtpProfileName] = useState<string>("");
  const [converting, setConverting] = useState(false);

  // ── Execution Setup (Platform Admin completes/overrides before converting) ──
  const [smtpProfiles, setSmtpProfiles] = useState<
    { id: string; name: string; is_platform_profile: boolean }[]
  >([]);
  const [landingPages, setLandingPages] = useState<
    { id: string; name: string; is_platform_page: boolean }[]
  >([]);
  const [domainOptions, setDomainOptions] = useState<
    { id: string; domain_name: string; is_platform_domain: boolean }[]
  >([]);
  const [savingSetup, setSavingSetup] = useState(false);
  const [setup, setSetup] = useState({
    campaign_name: "",
    email_subject: "",
    email_html_body: "",
    smtp_profile_id: "",
    landing_page_id: "",
    domain_id: "",
    from_name: "",
    from_address: "",
    redirect_url: "",
    reply_to_address: "",
    emails_per_minute: 10,
    launch_type: "IMMEDIATE",
    scheduled_launch_at: "",
  });

  // Seed the editable setup from the request whenever a different request opens.
  useEffect(() => {
    setSetup({
      campaign_name: selectedRequest.campaign_name || "",
      email_subject: selectedRequest.email_subject || "",
      email_html_body: selectedRequest.email_html_body || "",
      smtp_profile_id: selectedRequest.smtp_profile_id || "",
      landing_page_id: selectedRequest.landing_page_id || "",
      domain_id: selectedRequest.domain_id || "",
      from_name: selectedRequest.from_name || "",
      from_address: selectedRequest.from_address || "",
      redirect_url: selectedRequest.redirect_url || "",
      reply_to_address: selectedRequest.reply_to_address || "",
      emails_per_minute: selectedRequest.emails_per_minute ?? 10,
      launch_type: selectedRequest.launch_type || "IMMEDIATE",
      scheduled_launch_at: selectedRequest.scheduled_launch_at
        ? String(selectedRequest.scheduled_launch_at).slice(0, 16)
        : "",
    });
  }, [selectedRequest.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sanitizedEmailHtml = useMemo(
    () =>
      selectedRequest.email_html_body
        ? DOMPurify.sanitize(selectedRequest.email_html_body)
        : "",
    [selectedRequest.email_html_body]
  );

  const loadTargetData = useCallback(async () => {
    setDepartments([]);
    setUsers([]);
    setDomainName("");

    const { data } = await supabase
      .from("departments")
      .select("id, name")
      .in("id", selectedRequest.target_departments);

    if (data) setDepartments(data);

    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, email, department_id")
      .eq("company_id", selectedRequest.company_id)
      .in("department_id", data?.map((d) => d.id) || []);

    if (users) setUsers(users as TargetUser[]);

    if (selectedRequest.domain_id) {
      const { data: domain } = await supabase
        .from("phishing_domains")
        .select("domain_name")
        .eq("id", selectedRequest.domain_id)
        .maybeSingle();
      if (domain?.domain_name) setDomainName(domain.domain_name);
    }

    if (selectedRequest.smtp_profile_id) {
      const { data: profile } = await supabase
        .from("smtp_profiles")
        .select("name")
        .eq("id", selectedRequest.smtp_profile_id)
        .maybeSingle();
      if (profile?.name) setSmtpProfileName(profile.name);
    }

    // ── Execution Setup option lists (company-owned + platform resources) ──
    const company = selectedRequest.company_id;
    const [smtpRes, lpRes, lpAccessRes, domRes] = await Promise.all([
      supabase
        .from("smtp_profiles")
        .select("id, name, is_platform_profile, company_id, is_active")
        .or(`company_id.eq.${company},is_platform_profile.eq.true`)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("phishing_company_landing_pages")
        .select("id, name, company_id, is_platform_page, visibility")
        .or(`company_id.eq.${company},is_platform_page.eq.true`)
        .order("name"),
      supabase
        .from("landing_page_company_access")
        .select("landing_page_id")
        .eq("company_id", company),
      supabase
        .from("phishing_domains")
        .select("id, domain_name, is_platform_domain, is_verified, company_id")
        .or(`company_id.eq.${company},is_platform_domain.eq.true`)
        .eq("is_verified", true)
        .order("domain_name"),
    ]);

    setSmtpProfiles(
      (smtpRes.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        is_platform_profile: !!p.is_platform_profile,
      }))
    );

    // Only offer landing pages this company may actually use: its own, GLOBAL
    // platform pages, or platform pages explicitly shared with it.
    const sharedIds = new Set(
      (lpAccessRes.data ?? []).map((a) => a.landing_page_id)
    );
    setLandingPages(
      (lpRes.data ?? [])
        .filter(
          (lp) =>
            lp.company_id === company ||
            lp.visibility === "GLOBAL" ||
            sharedIds.has(lp.id)
        )
        .map((lp) => ({
          id: lp.id,
          name: lp.name,
          is_platform_page: !!lp.is_platform_page,
        }))
    );

    setDomainOptions(
      (domRes.data ?? []).map((d) => ({
        id: d.id,
        domain_name: d.domain_name,
        is_platform_domain: !!d.is_platform_domain,
      }))
    );
  }, [selectedRequest]);

  // Persist the platform admin's execution setup onto the request row. The
  // conversion function reads these fields, so saving = "fix the setup".
  const buildSetupPayload = () => ({
    campaign_name: setup.campaign_name?.trim() || null,
    email_subject: setup.email_subject?.trim() || null,
    email_html_body: setup.email_html_body || null,
    smtp_profile_id: setup.smtp_profile_id || null,
    landing_page_id: setup.landing_page_id || null,
    domain_id: setup.domain_id || null,
    from_name: setup.from_name?.trim() || null,
    from_address: setup.from_address?.trim() || null,
    redirect_url: setup.redirect_url?.trim() || null,
    reply_to_address: setup.reply_to_address?.trim() || null,
    emails_per_minute: Math.max(1, Number(setup.emails_per_minute) || 10),
    // SMTP profile chosen ⇒ company SMTP, otherwise the platform default sender.
    sending_method: setup.smtp_profile_id ? "COMPANY_SMTP" : "PLATFORM_DEFAULT",
    launch_type: setup.launch_type,
    scheduled_launch_at:
      setup.launch_type === "SCHEDULED" && setup.scheduled_launch_at
        ? new Date(setup.scheduled_launch_at).toISOString()
        : null,
    updated_at: new Date().toISOString(),
  });

  const saveSetup = async (): Promise<boolean> => {
    setSavingSetup(true);
    try {
      const payload = buildSetupPayload();
      const { error } = await supabase
        .from("phishing_campaign_requests")
        .update(payload)
        .eq("id", selectedRequest.id);
      if (error) throw error;
      // Reflect the saved values back into the open request (keeps the summary
      // grid + completeness warning in sync).
      updateSelectedRequest({
        ...selectedRequest,
        ...payload,
      } as unknown as RequestWithCompany);
      return true;
    } catch (err) {
      alert("Failed to save setup: " + getErrorMessage(err));
      return false;
    } finally {
      setSavingSetup(false);
    }
  };

  const handleSaveSetup = async () => {
    const ok = await saveSetup();
    if (ok) alert("Execution setup saved.");
  };

  const handleCreateCampaign = async () => {
    if (converting || savingSetup) return;
    if (
      !confirm(
        `Create and launch a campaign from request ${selectedRequest.ticket_number}? This will queue emails to the requested targets.`
      )
    )
      return;
    setConverting(true);
    try {
      // Always persist the platform admin's setup first so the conversion uses it.
      const saved = await saveSetup();
      if (!saved) return;
      const { data, error } = await supabase.functions.invoke(
        "create-campaign-from-request",
        { body: { request_id: selectedRequest.id } }
      );
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error ?? "Conversion failed");
      alert(
        `Campaign created (${data.status}) with ${data.target_count} targets.`
      );
      updateSelectedRequest(null);
      onConverted?.();
    } catch (err) {
      alert("Failed to create campaign: " + getErrorMessage(err));
    } finally {
      setConverting(false);
    }
  };

  const escapeCsvValue = (value: string | number | null | undefined) => {
    const normalized = value == null ? "" : String(value);
    return `"${normalized.replace(/"/g, '""')}"`;
  };

  const exportUsersCsv = () => {
    if (users.length === 0) return;

    const departmentNameById = new Map(
      departments.map((department) => [department.id, department.name])
    );
    const headers = ["Full Name", "Email", "Company", "Department"];
    const rows = users.map((user) =>
      [
        escapeCsvValue(user.full_name),
        escapeCsvValue(user.email),
        escapeCsvValue(selectedRequest.companies?.name),
        escapeCsvValue(
          user.department_id ? departmentNameById.get(user.department_id) : ""
        ),
      ].join(",")
    );
    const csvContent = [
      headers.map((header) => escapeCsvValue(header)).join(","),
      ...rows,
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().split("T")[0];
    const safeTicketNumber = selectedRequest.ticket_number
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "_");

    link.href = url;
    link.download = `request-users-${
      safeTicketNumber || "request"
    }-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    loadTargetData();
  }, [loadTargetData]);

  const sb = badgeStyle(selectedRequest.status);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(10,12,6,0.86)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", fontFamily: "'Inter', sans-serif" }}
      onClick={() => updateSelectedRequest(null)}
    >
      <div
        className="aw-rp-modal"
        style={{ width: "100%", maxWidth: 780, maxHeight: "88vh", display: "flex", flexDirection: "column", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ height: 3, background: `linear-gradient(90deg, ${T.accent}, ${T.accent}30)` }} />

        {/* Header */}
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${T.borderFaint}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexShrink: 0, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: T.white, margin: 0 }}>Request Details</h2>
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, fontWeight: 700, color: T.accent, background: "rgba(200,255,0,0.08)", border: "1px solid rgba(200,255,0,0.22)", borderRadius: 7, padding: "2px 8px" }}>
              {selectedRequest.ticket_number}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {selectedRequest.campaign_id ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 9, border: `1px solid ${T.greenBorder}`, background: T.greenBg, padding: "8px 13px", fontSize: 13, fontWeight: 700, color: T.green }}>
                <Rocket size={14} /> Campaign Created
              </span>
            ) : (
              <button
                onClick={handleCreateCampaign}
                disabled={converting}
                title="Create and launch a campaign from this request"
                style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 9, background: T.accent, color: T.accentDark, border: "none", padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: converting ? "not-allowed" : "pointer", opacity: converting ? 0.6 : 1, fontFamily: "inherit" }}
              >
                {converting ? <Loader2 size={14} style={{ animation: "aw-rp-spin .8s linear infinite" }} /> : <Rocket size={14} />}
                {converting ? "Creating…" : "Create Campaign from Request"}
              </button>
            )}
            <button
              onClick={exportUsersCsv}
              disabled={users.length === 0}
              title={users.length === 0 ? "No users available to export" : "Export users as CSV"}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 9, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.04)", padding: "9px 13px", fontSize: 13, fontWeight: 600, color: T.textBody, cursor: users.length === 0 ? "not-allowed" : "pointer", opacity: users.length === 0 ? 0.5 : 1, fontFamily: "inherit" }}
            >
              <Download size={14} /> Export Users
            </button>
            <button
              onClick={() => updateSelectedRequest(null)}
              style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", display: "flex", padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="aw-rp-scroll" style={{ padding: "18px 22px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Conversion readiness — warn when required fields are absent */}
          {(() => {
            if (selectedRequest.campaign_id) return null;
            const missing = missingCampaignFields(selectedRequest);
            if (missing.length === 0) return null;
            return (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, borderRadius: 10, border: `1px solid ${T.goldBorder}`, background: T.goldBg, padding: "12px 14px" }}>
                <AlertTriangle size={15} style={{ color: T.gold, flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: T.textBody }}>
                  <span style={{ fontWeight: 700, color: T.gold }}>Cannot convert yet.</span>{" "}
                  Missing: {missing.join(", ")}.
                </div>
              </div>
            );
          })()}

          {/* ── Execution Setup — Platform Admin completes/fixes before converting ── */}
          {!selectedRequest.campaign_id && (
            <div style={{ borderRadius: 12, border: "1px solid rgba(200,255,0,0.18)", background: "rgba(200,255,0,0.04)", padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <Settings size={15} style={{ color: T.accent }} />
                <h3 style={{ fontSize: 14, fontWeight: 800, color: T.white, margin: 0 }}>Execution Setup</h3>
                <span style={{ fontSize: 11, color: T.textMuted }}>
                  Review and complete before converting — these values are used to launch.
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <div>
                  <label className="aw-rp-label">Campaign Name</label>
                  <input className="aw-rp-input" value={setup.campaign_name} onChange={(e) => setSetup((s) => ({ ...s, campaign_name: e.target.value }))} />
                </div>
                <div>
                  <label className="aw-rp-label">Email Subject</label>
                  <input className="aw-rp-input" value={setup.email_subject} onChange={(e) => setSetup((s) => ({ ...s, email_subject: e.target.value }))} />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="aw-rp-label">Email HTML Body</label>
                  <textarea
                    rows={5}
                    className="aw-rp-input aw-rp-scroll"
                    style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, resize: "vertical" }}
                    value={setup.email_html_body}
                    onChange={(e) => setSetup((s) => ({ ...s, email_html_body: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="aw-rp-label"><Server size={12} /> Sender (SMTP Profile)</label>
                  <select className="aw-rp-input" value={setup.smtp_profile_id} onChange={(e) => setSetup((s) => ({ ...s, smtp_profile_id: e.target.value }))}>
                    <option value="">Platform default sender</option>
                    {smtpProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.is_platform_profile ? "(Platform)" : "(Company)"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="aw-rp-label"><LayoutTemplate size={12} /> Landing Page</label>
                  <select className="aw-rp-input" value={setup.landing_page_id} onChange={(e) => setSetup((s) => ({ ...s, landing_page_id: e.target.value }))}>
                    <option value="">No landing page (use redirect URL)</option>
                    {landingPages.map((lp) => (
                      <option key={lp.id} value={lp.id}>
                        {lp.name} {lp.is_platform_page ? "(Platform)" : "(Company)"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="aw-rp-label"><Globe size={12} /> Sending Domain</label>
                  <select className="aw-rp-input" value={setup.domain_id} onChange={(e) => setSetup((s) => ({ ...s, domain_id: e.target.value }))}>
                    <option value="">Not specified</option>
                    {domainOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.domain_name} {d.is_platform_domain ? "(Platform)" : "(Company)"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="aw-rp-label"><Gauge size={12} /> Sending Rate (emails / min)</label>
                  <input
                    type="number"
                    min={1}
                    className="aw-rp-input"
                    value={setup.emails_per_minute}
                    onChange={(e) => setSetup((s) => ({ ...s, emails_per_minute: Number(e.target.value) }))}
                  />
                </div>

                <div>
                  <label className="aw-rp-label">From Name</label>
                  <input className="aw-rp-input" value={setup.from_name} onChange={(e) => setSetup((s) => ({ ...s, from_name: e.target.value }))} placeholder="AwareOne Security" />
                </div>
                <div>
                  <label className="aw-rp-label">From Address</label>
                  <input className="aw-rp-input" value={setup.from_address} onChange={(e) => setSetup((s) => ({ ...s, from_address: e.target.value }))} placeholder="noreply@your-domain.com" />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="aw-rp-label">Redirect URL (used when no landing page is selected)</label>
                  <input className="aw-rp-input" value={setup.redirect_url} onChange={(e) => setSetup((s) => ({ ...s, redirect_url: e.target.value }))} placeholder="https://www.google.com" />
                </div>

                <div>
                  <label className="aw-rp-label"><Clock size={12} /> Launch</label>
                  <select className="aw-rp-input" value={setup.launch_type} onChange={(e) => setSetup((s) => ({ ...s, launch_type: e.target.value }))}>
                    <option value="IMMEDIATE">Immediately on conversion</option>
                    <option value="SCHEDULED">Scheduled</option>
                  </select>
                </div>
                {setup.launch_type === "SCHEDULED" && (
                  <div>
                    <label className="aw-rp-label">Scheduled At</label>
                    <input
                      type="datetime-local"
                      className="aw-rp-input"
                      value={setup.scheduled_launch_at}
                      onChange={(e) => setSetup((s) => ({ ...s, scheduled_launch_at: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={handleSaveSetup}
                  disabled={savingSetup || converting}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 9, border: "1px solid rgba(200,255,0,0.3)", background: "rgba(200,255,0,0.08)", padding: "9px 15px", fontSize: 13, fontWeight: 700, color: T.accent, cursor: savingSetup || converting ? "not-allowed" : "pointer", opacity: savingSetup || converting ? 0.6 : 1, fontFamily: "inherit" }}
                >
                  {savingSetup ? <Loader2 size={14} style={{ animation: "aw-rp-spin .8s linear infinite" }} /> : <Save size={14} />}
                  {savingSetup ? "Saving…" : "Save Setup"}
                </button>
              </div>
            </div>
          )}

          {/* Summary grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, padding: 16, borderRadius: 12, border: `1px solid ${T.borderFaint}`, background: T.panel }}>
            <SummaryField label="Ticket Number">
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{selectedRequest.ticket_number}</span>
            </SummaryField>
            <SummaryField label="Status">
              <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 700, background: sb.bg, border: `1px solid ${sb.border}`, color: sb.color }}>
                {selectedRequest.status}
              </span>
            </SummaryField>
            <SummaryField label="Company">{selectedRequest.companies?.name}</SummaryField>
            <SummaryField label="Requested By">{selectedRequest.users?.full_name}</SummaryField>
            <SummaryField label="Campaign Name">{selectedRequest.campaign_name || "—"}</SummaryField>
            <SummaryField label="Scenario">{selectedRequest.phishing_scenarios?.name || "N/A"}</SummaryField>
            <SummaryField label="Target Count">{selectedRequest.target_employee_count} employees</SummaryField>
            <SummaryField label="Target Departments">{departments.map((d) => d.name).join(", ") || "—"}</SummaryField>
            <SummaryField label="Priority">{selectedRequest.priority}</SummaryField>
            <SummaryField label="Scheduled Date">
              {selectedRequest.scheduled_date ? new Date(selectedRequest.scheduled_date).toLocaleDateString() : "Not scheduled"}
            </SummaryField>
            <SummaryField label="Sending Domain">{domainName || "Not specified"}</SummaryField>
            <SummaryField label="From">
              {selectedRequest.from_name || selectedRequest.from_address
                ? `${selectedRequest.from_name || ""}${selectedRequest.from_address ? ` <${selectedRequest.from_address}>` : ""}`.trim()
                : "Not specified"}
            </SummaryField>
            <SummaryField label="Sending Method">
              {SENDING_METHOD_LABEL[selectedRequest.sending_method || "PLATFORM_DEFAULT"] || selectedRequest.sending_method || "Platform default sender"}
              {selectedRequest.sending_method === "COMPANY_SMTP" && smtpProfileName ? ` — ${smtpProfileName}` : ""}
            </SummaryField>
            {selectedRequest.reply_to_address && (
              <SummaryField label="Reply-To">{selectedRequest.reply_to_address}</SummaryField>
            )}
            <SummaryField label="Launch">
              {selectedRequest.launch_type === "SCHEDULED" && (selectedRequest.scheduled_launch_at || selectedRequest.scheduled_date)
                ? `Scheduled — ${new Date((selectedRequest.scheduled_launch_at as string) || (selectedRequest.scheduled_date as unknown as string)).toLocaleString()}`
                : "Immediate on conversion"}
            </SummaryField>
            <SummaryField label="Authorisation">
              {selectedRequest.authorization_confirmed ? "Confirmed by requester" : "Not confirmed"}
            </SummaryField>
            <SummaryField label="Email Subject">{selectedRequest.email_subject || "—"}</SummaryField>
            <SummaryField label="Tracking">
              {selectedRequest.track_opens ? "Opens" : "No opens"}{", "}{selectedRequest.track_clicks ? "Clicks" : "No clicks"}
            </SummaryField>
            <SummaryField label="Capture">
              {selectedRequest.capture_credentials ? "Credentials" : "No credentials"}{", "}{selectedRequest.capture_passwords ? "Passwords" : "No passwords"}
            </SummaryField>
            {selectedRequest.redirect_url && (
              <SummaryField label="Redirect URL">{selectedRequest.redirect_url}</SummaryField>
            )}
          </div>

          {/* Email body — sent by the internal campaign engine on conversion */}
          {selectedRequest.email_html_body && (
            <div>
              <div style={sectionLabel}>Email HTML Body</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                <div style={{ borderRadius: 10, border: `1px solid ${T.borderFaint}`, overflow: "hidden" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: T.textMuted, padding: "8px 12px", background: T.panel, borderBottom: `1px solid ${T.borderFaint}` }}>Rendered Preview</div>
                  <div className="aw-rp-scroll" style={{ background: "#ffffff", padding: 14, maxHeight: 280, overflow: "auto" }}>
                    <div style={{ color: "#0f172a", fontSize: 13 }} dangerouslySetInnerHTML={{ __html: sanitizedEmailHtml }} />
                  </div>
                </div>
                <div style={{ borderRadius: 10, border: `1px solid ${T.borderFaint}`, overflow: "hidden" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: T.textMuted, padding: "8px 12px", background: T.panel, borderBottom: `1px solid ${T.borderFaint}` }}>HTML Source</div>
                  <pre className="aw-rp-scroll" style={{ margin: 0, background: "#0d1117", padding: 14, fontSize: 11, color: T.textBody, maxHeight: 280, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                    {selectedRequest.email_html_body}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {selectedRequest.email_text_body && (
            <div>
              <div style={sectionLabel}>Email Plain-Text Body</div>
              <pre className="aw-rp-scroll" style={{ margin: 0, borderRadius: 10, border: `1px solid ${T.borderFaint}`, background: T.panel, padding: 14, fontSize: 13, color: T.textBody, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {selectedRequest.email_text_body}
              </pre>
            </div>
          )}

          {/* Landing page — served by the internal serve-landing-page function */}
          {selectedRequest.landing_page_html && (
            <div>
              <div style={sectionLabel}>Landing Page HTML</div>
              <pre className="aw-rp-scroll" style={{ margin: 0, borderRadius: 10, border: `1px solid ${T.borderFaint}`, background: "#0d1117", padding: 14, fontSize: 11, color: T.textBody, maxHeight: 280, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {selectedRequest.landing_page_html}
              </pre>
            </div>
          )}

          {selectedRequest.notes && (
            <div>
              <div style={sectionLabel}>Notes</div>
              <div style={{ borderRadius: 10, border: `1px solid ${T.borderFaint}`, background: T.panel, padding: "12px 14px", fontSize: 13, color: T.textBody }}>
                {selectedRequest.notes}
              </div>
            </div>
          )}
          {selectedRequest.admin_notes && (
            <div>
              <div style={sectionLabel}>Admin Notes</div>
              <div style={{ borderRadius: 10, border: `1px solid ${T.blueBorder}`, background: T.blueBg, padding: "12px 14px", fontSize: 13, color: T.textBody }}>
                {selectedRequest.admin_notes}
              </div>
            </div>
          )}
          {selectedRequest.rejected_reason && (
            <div>
              <div style={sectionLabel}>Rejected Reason</div>
              <div style={{ borderRadius: 10, border: `1px solid ${T.redBorder}`, background: T.redBg, padding: "12px 14px", fontSize: 13, color: T.textBody }}>
                {selectedRequest.rejected_reason}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestPreview;
