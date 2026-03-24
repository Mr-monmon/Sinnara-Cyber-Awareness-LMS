import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

type TicketStatus = "open" | "pending" | "closed";

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
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

export const SupportRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
  }, [user?.id]);

  const loadTickets = async () => {
    if (!user?.id) {
      setTickets([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const { data, error: fetchError } = await supabase
        .from("support_ticket")
        .select("id, user_id, subject, status, created_at, updated_at")
        .eq("user_id", user.id);

      if (fetchError) {
        throw fetchError;
      }

      setTickets((data || []) as SupportTicket[]);
    } catch (loadError) {
      console.error("Error loading support tickets:", loadError);
      setError("Failed to load support requests. Please refresh and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user?.id) {
      setError("Unable to identify the current user. Please sign in again.");
      return;
    }

    const subject = newSubject.trim();
    if (!subject) {
      setError("Please enter a subject for your support request.");
      return;
    }

    if (subject.length < 5) {
      setError("Subject should be at least 5 characters.");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const { data, error: createError } = await supabase
        .from("support_ticket")
        .insert([{ user_id: user.id, subject }])
        .select("id, user_id, subject, status, created_at, updated_at")
        .single();

      if (createError) {
        throw createError;
      }

      if (data) {
        setTickets((current) => [data as SupportTicket, ...current]);
      }
      setNewSubject("");
    } catch (submitError) {
      console.error("Error creating support ticket:", submitError);
      setError("Failed to create support request. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!user?.id) {
      setError("Unable to identify the current user. Please sign in again.");
      return;
    }

    if (!window.confirm("Delete this support request?")) {
      return;
    }

    setDeletingId(ticketId);
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("support_ticket")
        .delete()
        .eq("id", ticketId)
        .eq("user_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      setTickets((current) => current.filter((ticket) => ticket.id !== ticketId));
    } catch (deleteTicketError) {
      console.error("Error deleting support ticket:", deleteTicketError);
      setError("Failed to delete support request. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100/70 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Support Requests
            </h1>
            <p className="text-sm text-slate-600">
              Review your tickets, open new requests, and delete requests when no
              longer needed.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleCreateTicket}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="w-full">
            <label
              htmlFor="support-subject"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              New request subject
            </label>
            <input
              id="support-subject"
              type="text"
              value={newSubject}
              onChange={(event) => setNewSubject(event.target.value)}
              placeholder="Describe what you need help with"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              maxLength={250}
              disabled={isCreating}
            />
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Updated
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading support requests...
                  </div>
                </td>
              </tr>
            ) : sortedTickets.length > 0 ? (
              sortedTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {ticket.subject}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[ticket.status]}`}
                    >
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {formatDate(ticket.created_at)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {formatDate(ticket.updated_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDeleteTicket(ticket.id)}
                      disabled={deletingId === ticket.id}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === ticket.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                  No support requests yet. Create your first ticket above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};