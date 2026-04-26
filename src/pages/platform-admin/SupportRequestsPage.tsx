import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Mail, MessageSquare } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { brandedEmailLayout } from "../../lib/email";

type TicketStatus = "open" | "pending" | "closed";

interface SupportTicketRow {
  id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  users: {
    email: string;
    full_name: string;
  } | null;
}

interface RawSupportTicketRow {
  id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  users: {
    email: string;
    full_name: string;
  } | null;
}

const statusStyles: Record<TicketStatus, string> = {
  open: "bg-blue-100 text-blue-800 border-blue-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  closed: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const SupportRequestsPage = () => {
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [replyByTicket, setReplyByTicket] = useState<Record<string, string>>(
    {}
  );
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);

  const sortedTickets = useMemo(
    () =>
      [...tickets].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [tickets]
  );

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setIsLoading(true);
    setError("");

    try {
      const { data, error: fetchError } = await supabase
        .from("support_ticket")
        .select(
          "id, user_id, subject, status, created_at, updated_at, users!support_ticket_user_id_fkey(email, full_name)"
        );

      if (fetchError) {
        throw fetchError;
      }

      const normalizedTickets: SupportTicketRow[] = (
        (data || []) as unknown as RawSupportTicketRow[]
      ).map((ticket) => ({
        ...ticket,
        users: Array.isArray(ticket.users)
          ? ticket.users[0] || null
          : ticket.users,
      }));

      setTickets(normalizedTickets);
    } catch (loadError) {
      console.error("Error loading support requests:", loadError);
      setError(
        "Failed to load support requests. Please refresh and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (ticketId: string, status: TicketStatus) => {
    setUpdatingStatusId(ticketId);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("support_ticket")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", ticketId);

      if (updateError) {
        throw updateError;
      }

      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === ticketId
            ? { ...ticket, status, updated_at: new Date().toISOString() }
            : ticket
        )
      );
    } catch (statusError) {
      console.error("Error updating ticket status:", statusError);
      setError("Failed to update ticket status. Please try again.");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const buildReplyHtml = (fullName: string, subject: string, reply: string) =>
    brandedEmailLayout(`
      <div style="padding:32px; background:linear-gradient(135deg, #12140a 0%, #1f2610 100%); color:#ffffff; border-bottom:1px solid rgba(255,255,255,0.10);">
        <p style="margin:0 0 10px; font-size:13px; letter-spacing:1.6px; text-transform:uppercase; color:#c8ff00;">Awareone Support</p>
        <h1 style="margin:0; font-size:28px; line-height:1.3;">Reply to your support request, ${fullName}</h1>
      </div>
      <div style="padding:32px;">
        <p style="margin:0 0 18px; font-size:15px; line-height:1.8; color:#94a3b8;">
          We reviewed your support request: <strong>${subject}</strong>
        </p>
        <p style="margin:0 0 18px; font-size:15px; line-height:1.8; color:#94a3b8;">
          Our reply: <strong>${reply}</strong>
        </p>
        <p style="margin:24px 0 0; font-size:15px; line-height:1.8; color:#94a3b8;">
          If you need more help, reply to this email or create another support request from your dashboard.
        </p>
      </div>
    `);

  const handleSendReply = async (
    event: FormEvent<HTMLFormElement>,
    ticket: SupportTicketRow
  ) => {
    event.preventDefault();

    const reply = (replyByTicket[ticket.id] || "").trim();
    const userEmail = ticket.users?.email;

    if (!reply) {
      setError("Please enter a reply message before sending.");
      return;
    }

    if (!userEmail) {
      setError("This ticket does not have a valid user email.");
      return;
    }

    setSendingReplyId(ticket.id);
    setError("");

    try {
      const { error: emailError } = await supabase.functions.invoke(
        "send-email",
        {
          body: {
            to: userEmail,
            subject: `Support Reply: ${ticket.subject}`,
            html: buildReplyHtml(
              ticket.users?.full_name || "User",
              ticket.subject,
              reply
            ),
          },
        }
      );

      if (emailError) {
        throw emailError;
      }

      setReplyByTicket((current) => ({ ...current, [ticket.id]: "" }));
    } catch (sendError) {
      console.error("Error sending support reply email:", sendError);
      setError("Failed to send email reply. Please try again.");
    } finally {
      setSendingReplyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100/80 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Support Requests
            </h1>
            <p className="text-sm text-slate-600">
              Review all requests, update statuses, and reply to users by email.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
            <div className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading support requests...
            </div>
          </div>
        ) : sortedTickets.length > 0 ? (
          sortedTickets.map((ticket) => {
            return (
              <div
                key={ticket.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {ticket.subject}
                    </h3>
                    <div className="text-sm text-slate-600">
                      <span className="font-medium text-slate-700">User: </span>
                      {ticket.users?.full_name || "Unknown User"}
                    </div>
                    <div className="text-sm text-slate-600">
                      <span className="font-medium text-slate-700">
                        Email:{" "}
                      </span>
                      {ticket.users?.email || "-"}
                    </div>
                    <div className="text-sm text-slate-500">
                      Created: {formatDate(ticket.created_at)} | Updated:{" "}
                      {formatDate(ticket.updated_at)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${
                        statusStyles[ticket.status]
                      }`}
                    >
                      {ticket.status}
                    </span>
                    <select
                      value={ticket.status}
                      disabled={updatingStatusId === ticket.id}
                      onChange={(event) =>
                        handleStatusChange(
                          ticket.id,
                          event.target.value as TicketStatus
                        )
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                    >
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>

                <form
                  onSubmit={(event) => handleSendReply(event, ticket)}
                  className="mt-4 space-y-3"
                >
                  <label className="block text-sm font-medium text-slate-700">
                    Reply message
                  </label>
                  <textarea
                    value={replyByTicket[ticket.id] || ""}
                    onChange={(event) =>
                      setReplyByTicket((current) => ({
                        ...current,
                        [ticket.id]: event.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="Write your support reply..."
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={sendingReplyId === ticket.id}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                    >
                      {sendingReplyId === ticket.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4" />
                          Send Reply
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
            No support requests found.
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportRequestsPage;
