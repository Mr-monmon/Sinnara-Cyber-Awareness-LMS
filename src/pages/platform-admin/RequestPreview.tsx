import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Rocket, Loader2 } from "lucide-react";
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
  }, [selectedRequest]);

  const handleCreateCampaign = async () => {
    if (converting) return;
    if (
      !confirm(
        `Create and launch a campaign from request ${selectedRequest.ticket_number}? This will queue emails to the requested targets.`
      )
    )
      return;
    setConverting(true);
    try {
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
              <div className="text-sm text-slate-600">Template</div>
              <div className="font-semibold">
                {selectedRequest.phishing_templates?.name || "N/A"}
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

          {/* Email body — needed to build the Gophish email template */}
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

          {/* Landing page — needed to build the Gophish landing page */}
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
