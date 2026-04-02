import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { RequestWithCompany } from "../../lib/types";

type Props = {
  selectedRequest: RequestWithCompany;
  updateSelectedRequest: (request: RequestWithCompany | null) => void;
  getStatusColor: (status: string) => string;
};

const RequestPreview = ({
  selectedRequest,
  updateSelectedRequest,
  getStatusColor,
}: Props) => {
  const [departments, setDepartments] = useState<string[]>([]);
  const loadDepartments = async () => {
    const { data } = await supabase
      .from("departments")
      .select("name")
      .in("id", selectedRequest.target_departments);
    if (data) setDepartments(data.map((d) => d.name));
  };

  useEffect(() => {
    loadDepartments();
  }, [selectedRequest]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              Request Details
            </h2>
            <button
              onClick={() => updateSelectedRequest(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
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
              <div className="font-semibold">{departments.join(", ")}</div>
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
              <div className="text-sm text-slate-600">From</div>
              <div className="font-semibold">
                {selectedRequest.from_name} {"<"}
                {selectedRequest.from_address}
                {">"}
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
