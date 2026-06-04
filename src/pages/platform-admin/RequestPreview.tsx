import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Download, Rocket, Loader2, Settings, Save,
  Server, LayoutTemplate, Globe, Clock, Gauge,
} from "lucide-react";
import DOMPurify from "dompurify";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { missingCampaignFields } from "../../lib/requestCompleteness";
import { RequestWithCompany, User } from "../../lib/types";

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
  getStatusColor,
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-900">
              Request Details
            </h2>
            <div className="flex items-center gap-3">
              {selectedRequest.campaign_id ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                  <Rocket className="h-4 w-4" />
                  Campaign Created
                </span>
              ) : (
                <button
                  onClick={handleCreateCampaign}
                  disabled={converting}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Create and launch a campaign from this request"
                >
                  {converting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                  {converting ? "Creating…" : "Create Campaign from Request"}
                </button>
              )}
              <button
                onClick={exportUsersCsv}
                disabled={users.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                title={
                  users.length === 0
                    ? "No users available to export"
                    : "Export users as CSV"
                }
              >
                <Download className="h-4 w-4" />
                Export Users
              </button>
              <button
                onClick={() => updateSelectedRequest(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* Conversion readiness — warn when required fields are absent */}
          {(() => {
            if (selectedRequest.campaign_id) return null;
            const missing = missingCampaignFields(selectedRequest);
            if (missing.length === 0) return null;
            return (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="text-sm text-amber-800">
                  <span className="font-semibold">Cannot convert yet.</span>{" "}
                  Missing: {missing.join(", ")}.
                </div>
              </div>
            );
          })()}

          {/* ── Execution Setup — Platform Admin completes/fixes before converting ── */}
          {!selectedRequest.campaign_id && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-emerald-900">
                  Execution Setup
                </h3>
                <span className="text-xs text-emerald-700">
                  Review and complete before converting — these values are used to launch.
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Campaign Name
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    value={setup.campaign_name}
                    onChange={(e) =>
                      setSetup((s) => ({ ...s, campaign_name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Email Subject
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    value={setup.email_subject}
                    onChange={(e) =>
                      setSetup((s) => ({ ...s, email_subject: e.target.value }))
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Email HTML Body
                  </label>
                  <textarea
                    rows={5}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900"
                    value={setup.email_html_body}
                    onChange={(e) =>
                      setSetup((s) => ({ ...s, email_html_body: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                    <Server className="h-3 w-3" /> Sender (SMTP Profile)
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    value={setup.smtp_profile_id}
                    onChange={(e) =>
                      setSetup((s) => ({ ...s, smtp_profile_id: e.target.value }))
                    }
                  >
                    <option value="">Platform default sender</option>
                    {smtpProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.is_platform_profile ? "(Platform)" : "(Company)"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                    <LayoutTemplate className="h-3 w-3" /> Landing Page
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    value={setup.landing_page_id}
                    onChange={(e) =>
                      setSetup((s) => ({ ...s, landing_page_id: e.target.value }))
                    }
                  >
                    <option value="">No landing page (use redirect URL)</option>
                    {landingPages.map((lp) => (
                      <option key={lp.id} value={lp.id}>
                        {lp.name} {lp.is_platform_page ? "(Platform)" : "(Company)"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                    <Globe className="h-3 w-3" /> Sending Domain
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    value={setup.domain_id}
                    onChange={(e) =>
                      setSetup((s) => ({ ...s, domain_id: e.target.value }))
                    }
                  >
                    <option value="">Not specified</option>
                    {domainOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.domain_name} {d.is_platform_domain ? "(Platform)" : "(Company)"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                    <Gauge className="h-3 w-3" /> Sending Rate (emails / min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    value={setup.emails_per_minute}
                    onChange={(e) =>
                      setSetup((s) => ({
                        ...s,
                        emails_per_minute: Number(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    From Name
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    value={setup.from_name}
                    onChange={(e) =>
                      setSetup((s) => ({ ...s, from_name: e.target.value }))
                    }
                    placeholder="AwareOne Security"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    From Address
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    value={setup.from_address}
                    onChange={(e) =>
                      setSetup((s) => ({ ...s, from_address: e.target.value }))
                    }
                    placeholder="noreply@your-domain.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Redirect URL (used when no landing page is selected)
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    value={setup.redirect_url}
                    onChange={(e) =>
                      setSetup((s) => ({ ...s, redirect_url: e.target.value }))
                    }
                    placeholder="https://www.google.com"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                    <Clock className="h-3 w-3" /> Launch
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    value={setup.launch_type}
                    onChange={(e) =>
                      setSetup((s) => ({ ...s, launch_type: e.target.value }))
                    }
                  >
                    <option value="IMMEDIATE">Immediately on conversion</option>
                    <option value="SCHEDULED">Scheduled</option>
                  </select>
                </div>
                {setup.launch_type === "SCHEDULED" && (
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Scheduled At
                    </label>
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      value={setup.scheduled_launch_at}
                      onChange={(e) =>
                        setSetup((s) => ({
                          ...s,
                          scheduled_launch_at: e.target.value,
                        }))
                      }
                    />
                  </div>
                )}
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleSaveSetup}
                  disabled={savingSetup || converting}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingSetup ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {savingSetup ? "Saving…" : "Save Setup"}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-slate-600">Ticket Number</div>
              <div className="font-mono font-semibold">
                {selectedRequest.ticket_number}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Status</div>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                  selectedRequest.status
                )}`}
              >
                {selectedRequest.status}
              </span>
            </div>
            <div>
              <div className="text-sm text-slate-600">Company</div>
              <div className="font-semibold">
                {selectedRequest.companies?.name}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Requested By</div>
              <div className="font-semibold">
                {selectedRequest.users?.full_name}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Campaign Name</div>
              <div className="font-semibold">
                {selectedRequest.campaign_name}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Scenario</div>
              <div className="font-semibold">
                {selectedRequest.phishing_scenarios?.name || "N/A"}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Target Count</div>
              <div className="font-semibold">
                {selectedRequest.target_employee_count} employees
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Target Departments</div>
              <div className="font-semibold">
                {departments.map((department) => department.name).join(", ")}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Priority</div>
              <div className="font-semibold">{selectedRequest.priority}</div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Scheduled Date</div>
              <div className="font-semibold">
                {selectedRequest.scheduled_date
                  ? new Date(
                      selectedRequest.scheduled_date
                    ).toLocaleDateString()
                  : "Not scheduled"}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Sending Domain</div>
              <div className="font-semibold break-all">
                {domainName || "Not specified"}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">From</div>
              <div className="font-semibold break-all">
                {selectedRequest.from_name || selectedRequest.from_address
                  ? `${selectedRequest.from_name || ""}${
                      selectedRequest.from_address
                        ? ` <${selectedRequest.from_address}>`
                        : ""
                    }`.trim()
                  : "Not specified"}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Sending Method</div>
              <div className="font-semibold">
                {SENDING_METHOD_LABEL[selectedRequest.sending_method || "PLATFORM_DEFAULT"] ||
                  selectedRequest.sending_method ||
                  "Platform default sender"}
                {selectedRequest.sending_method === "COMPANY_SMTP" && smtpProfileName
                  ? ` — ${smtpProfileName}`
                  : ""}
              </div>
            </div>
            {selectedRequest.reply_to_address && (
              <div>
                <div className="text-sm text-slate-600">Reply-To</div>
                <div className="font-semibold break-all">
                  {selectedRequest.reply_to_address}
                </div>
              </div>
            )}
            <div>
              <div className="text-sm text-slate-600">Launch</div>
              <div className="font-semibold">
                {selectedRequest.launch_type === "SCHEDULED" &&
                (selectedRequest.scheduled_launch_at || selectedRequest.scheduled_date)
                  ? `Scheduled — ${new Date(
                      (selectedRequest.scheduled_launch_at as string) ||
                        (selectedRequest.scheduled_date as unknown as string)
                    ).toLocaleString()}`
                  : "Immediate on conversion"}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Authorisation</div>
              <div className="font-semibold">
                {selectedRequest.authorization_confirmed
                  ? "Confirmed by requester"
                  : "Not confirmed"}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Email Subject</div>
              <div className="font-semibold">
                {selectedRequest.email_subject}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Tracking</div>
              <div className="font-semibold">
                {selectedRequest.track_opens ? "Opens" : "No opens"}
                {", "}
                {selectedRequest.track_clicks ? "Clicks" : "No clicks"}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Capture</div>
              <div className="font-semibold">
                {selectedRequest.capture_credentials
                  ? "Credentials"
                  : "No credentials"}
                {", "}
                {selectedRequest.capture_passwords
                  ? "Passwords"
                  : "No passwords"}
              </div>
            </div>
            {selectedRequest.redirect_url && (
              <div>
                <div className="text-sm text-slate-600">Redirect URL</div>
                <div className="font-semibold break-all">
                  {selectedRequest.redirect_url}
                </div>
              </div>
            )}
          </div>

          {/* Email body — sent by the internal campaign engine on conversion */}
          {selectedRequest.email_html_body && (
            <div>
              <div className="text-sm text-slate-600 mb-1">Email HTML Body</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-3 overflow-auto max-h-64">
                  <div className="mb-1 text-xs font-medium text-slate-400">
                    Preview
                  </div>
                  <div
                    className="text-sm text-slate-900"
                    dangerouslySetInnerHTML={{ __html: sanitizedEmailHtml }}
                  />
                </div>
                <pre className="rounded-lg border border-slate-200 bg-slate-900 p-3 text-xs text-slate-200 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                  {selectedRequest.email_html_body}
                </pre>
              </div>
            </div>
          )}

          {selectedRequest.email_text_body && (
            <div>
              <div className="text-sm text-slate-600 mb-1">
                Email Plain-Text Body
              </div>
              <pre className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap break-words">
                {selectedRequest.email_text_body}
              </pre>
            </div>
          )}

          {/* Landing page — served by the internal serve-landing-page function */}
          {selectedRequest.landing_page_html && (
            <div>
              <div className="text-sm text-slate-600 mb-1">
                Landing Page HTML
              </div>
              <pre className="rounded-lg border border-slate-200 bg-slate-900 p-3 text-xs text-slate-200 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                {selectedRequest.landing_page_html}
              </pre>
            </div>
          )}

          {selectedRequest.notes && (
            <div>
              <div className="text-sm text-slate-600 mb-1">Notes</div>
              <div className="p-3 bg-slate-50 rounded-lg text-sm">
                {selectedRequest.notes}
              </div>
            </div>
          )}
          {selectedRequest.admin_notes && (
            <div>
              <div className="text-sm text-slate-600 mb-1">Admin Notes</div>
              <div className="p-3 bg-blue-50 rounded-lg text-sm">
                {selectedRequest.admin_notes}
              </div>
            </div>
          )}

          {selectedRequest.rejected_reason && (
            <div>
              <div className="text-sm text-slate-600 mb-1">Rejected Reason</div>
              <div className="p-3 bg-red-50 rounded-lg text-sm">
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
