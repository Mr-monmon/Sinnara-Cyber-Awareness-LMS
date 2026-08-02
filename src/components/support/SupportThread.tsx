import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Lock, Send } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { captureException } from "../../lib/sentry";

/**
 * SupportThread — the conversation on one support ticket, shared by the
 * requester's screen and the platform admin's.
 *
 * Replies live here rather than in email. The previous flow emailed the reply
 * and stored nothing, so the answer existed only in one inbox: the requester
 * could not see it in the platform, a reply to it reached a mailbox nothing
 * reads, and when the admin who wrote it moved on the answer went with them.
 * Support threads on this product carry phishing detail, employee data and
 * security configuration, so keeping them inside the tenant boundary is the
 * point — email is reduced to a notification with a link.
 *
 * `canPostInternal` distinguishes the two callers: platform admins may add
 * staff-only notes, which RLS never returns to the requester or their company
 * admins. Everything else is identical, deliberately — one component means the
 * two sides cannot drift into showing different things.
 */

export interface SupportMessage {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_name: string | null;
  author_email: string | null;
  is_internal: boolean;
  body: string;
  created_at: string;
}

export interface SupportThreadProps {
  ticketId: string;
  /** The signed-in user, used to place messages left or right. */
  currentUserId: string | undefined;
  /** Platform admins only: allows staff-only notes. */
  canPostInternal?: boolean;
  /** Closed tickets are readable but not writable. */
  readOnly?: boolean;
  /** Fired after a message is posted, so the caller can refresh its list. */
  onPosted?: (message: SupportMessage) => void;
  tokens: {
    bgCard: string;
    bgHover: string;
    border: string;
    text: string;
    textMuted: string;
    textSub: string;
    accent: string;
    accentText: string;
  };
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export const SupportThread = ({
  ticketId,
  currentUserId,
  canPostInternal = false,
  readOnly = false,
  onPosted,
  tokens: T,
}: SupportThreadProps) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [posting, setPosting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from("support_ticket_messages")
        .select("id, ticket_id, author_id, author_name, author_email, is_internal, body, created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (e) throw new Error(e.message);
      setMessages((data ?? []) as SupportMessage[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // An empty thread and a failed read look identical otherwise, and the
      // difference matters: one means "no reply yet", the other means the reply
      // may exist and not be reaching them.
      console.error("[SupportThread] load failed:", message, err);
      captureException(err, { scope: "SupportThread.load", ticketId });
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const post = async () => {
    const text = body.trim();
    if (!text || !currentUserId) return;
    setPosting(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from("support_ticket_messages")
        .insert([{ ticket_id: ticketId, author_id: currentUserId, body: text, is_internal: isInternal }])
        .select("id, ticket_id, author_id, author_name, author_email, is_internal, body, created_at")
        .single();
      if (e) throw new Error(e.message);

      const posted = data as SupportMessage;
      setMessages((prev) => [...prev, posted]);
      setBody("");
      setIsInternal(false);
      onPosted?.(posted);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[SupportThread] post failed:", message, err);
      captureException(err, { scope: "SupportThread.post", ticketId });
      setError(message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.textMuted, fontSize: 13, padding: "8px 0" }}>
          <Loader2 size={14} style={{ animation: "aw-st-spin 0.8s linear infinite" }} />
          Loading conversation…
          <style>{`@keyframes aw-st-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 8, background: "rgba(255,136,0,0.08)", border: "1px solid rgba(255,136,0,0.25)" }}>
          <AlertTriangle size={15} style={{ color: "#ff8800", flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.6 }}>{error}</div>
        </div>
      )}

      {!loading && !error && messages.length === 0 && (
        <div style={{ fontSize: 13, color: T.textMuted, padding: "6px 0" }}>
          No replies yet.
        </div>
      )}

      {messages.map((m) => {
        const mine = Boolean(currentUserId) && m.author_id === currentUserId;
        return (
          <div
            key={m.id}
            style={{
              alignSelf: mine ? "flex-end" : "flex-start",
              maxWidth: "82%",
              background: m.is_internal ? "rgba(255,204,0,0.07)" : mine ? T.bgHover : T.bgCard,
              border: `1px solid ${m.is_internal ? "rgba(255,204,0,0.28)" : T.border}`,
              borderRadius: 12,
              padding: "10px 13px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>
                {m.author_name || m.author_email || "Unknown"}
              </span>
              {m.is_internal && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#ffcc00", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  <Lock size={10} /> Internal note
                </span>
              )}
              <span style={{ fontSize: 11, color: T.textMuted }}>{formatWhen(m.created_at)}</span>
            </div>
            <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {m.body}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />

      {readOnly ? (
        <div style={{ fontSize: 12, color: T.textMuted, paddingTop: 6 }}>
          This request is closed. Open a new one if you still need help.
        </div>
      ) : (
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={canPostInternal ? "Write a reply…" : "Write your reply…"}
            rows={3}
            maxLength={20000}
            style={{
              width: "100%", resize: "vertical", padding: "10px 12px", borderRadius: 9,
              background: T.bgHover, border: `1px solid ${T.border}`, color: T.text,
              fontSize: 13, fontFamily: "inherit", outline: "none", lineHeight: 1.6,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            {canPostInternal && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textSub, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  style={{ accentColor: "#ffcc00", cursor: "pointer" }}
                />
                Internal note — not visible to the customer
              </label>
            )}
            <button
              type="button"
              onClick={() => void post()}
              disabled={posting || !body.trim()}
              style={{
                marginInlineStart: "auto",
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "8px 16px", borderRadius: 9, border: "none",
                background: body.trim() ? T.accent : T.border,
                color: body.trim() ? T.accentText : T.textMuted,
                fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                cursor: posting || !body.trim() ? "not-allowed" : "pointer",
              }}
            >
              {posting ? <Loader2 size={14} style={{ animation: "aw-st-spin 0.8s linear infinite" }} /> : <Send size={14} />}
              {posting ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportThread;
