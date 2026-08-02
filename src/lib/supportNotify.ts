import { supabase } from "./supabase";
import { brandedEmailLayout } from "./email";
import { captureException } from "./sentry";

/**
 * supportNotify — tells a requester a reply is waiting, without carrying it.
 *
 * Support threads on this platform contain phishing campaign detail, employee
 * data and security configuration. The old flow emailed the reply text itself,
 * which put all of that outside the tenant isolation the schema enforces: not
 * auditable, not access-controlled, and forwardable anywhere. The reply now
 * lives in `support_ticket_messages`; this email says only that one exists and
 * links to it.
 *
 * The subject line deliberately carries no ticket detail either — it is the
 * part most visible on a lock screen.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildNotificationHtml(recipientName: string, subject: string, link: string): string {
  return brandedEmailLayout(`
    <div style="padding:32px; background:linear-gradient(135deg, #12140a 0%, #1f2610 100%); color:#ffffff; border-bottom:1px solid rgba(255,255,255,0.10);">
      <p style="margin:0 0 10px; font-size:13px; letter-spacing:1.6px; text-transform:uppercase; color:#c8ff00;">Awareone Support</p>
      <h1 style="margin:0; font-size:26px; line-height:1.3;">You have a new reply, ${escapeHtml(recipientName)}</h1>
    </div>
    <div style="padding:32px; color:#cbd5e1; font-size:15px; line-height:1.7;">
      <p style="margin:0 0 18px;">
        Our support team has replied to your request
        <strong style="color:#ffffff;">&ldquo;${escapeHtml(subject)}&rdquo;</strong>.
      </p>
      <p style="margin:0 0 26px;">
        The reply is in the platform. Sign in to read it and continue the conversation there.
      </p>
      <a href="${escapeHtml(link)}"
         style="display:inline-block; padding:13px 26px; background:#c8ff00; color:#12140a; font-weight:700; font-size:15px; text-decoration:none; border-radius:9px;">
        Open the conversation
      </a>
      <p style="margin:26px 0 0; font-size:13px; color:#64748b;">
        For your security the reply itself is not included in this email &mdash; support
        conversations can contain details about your organisation, so they stay inside
        the platform. Replying to this message will not reach the support team.
      </p>
    </div>
  `);
}

export interface SupportReplyNotification {
  toEmail: string;
  recipientName: string;
  ticketSubject: string;
  /** Where the requester should land. Defaults to the app's support page. */
  link?: string;
}

/**
 * Queue the notification. Never throws: the reply is already saved in the
 * thread, so a mail failure must not present as a failed reply — but it is
 * reported, because a support team that thinks customers were notified when
 * they were not is worse than one that knows the mail is broken.
 */
export async function notifySupportReply(args: SupportReplyNotification): Promise<{ ok: boolean; error?: string }> {
  const link =
    args.link ?? (typeof window !== "undefined" ? `${window.location.origin}/dashboard` : "");

  try {
    const { error } = await supabase.functions.invoke("send-email", {
      body: {
        to: args.toEmail,
        subject: "New reply to your support request",
        html: buildNotificationHtml(args.recipientName, args.ticketSubject, link),
      },
    });

    if (error) {
      console.error("[supportNotify] send-email failed:", error.message, error);
      captureException(error, { scope: "supportNotify", to: args.toEmail });
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[supportNotify] send-email threw:", message, err);
    captureException(err, { scope: "supportNotify", to: args.toEmail });
    return { ok: false, error: message };
  }
}
