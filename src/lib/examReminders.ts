import { supabase } from "./supabase";

/**
 * Exam reminder throttle — client side of `20260806120000_exam_reminder_throttle.sql`.
 *
 * The limits below are display copies. The database is the only enforcer: every
 * send has to claim a slot through `claim_exam_reminder`, which decides. These
 * constants exist so a button can be greyed out before the round trip, never so
 * the page can decide on its own.
 */
export const REMINDER_MAX_PER_RECIPIENT = 3;
export const REMINDER_INTERVAL_DAYS = 7;

export interface ReminderState {
  examId: string;
  recipientId: string;
  sentCount: number;
  lastSentAt: string | null;
  nextAllowedAt: string | null;
}

export type ClaimVerdict =
  | { allowed: true; logId: string; sentCount: number; max: number }
  | {
      allowed: false;
      reason: "not_signed_in" | "not_permitted" | "unknown_recipient" | "other_tenant" | "max_reached" | "too_soon" | "error";
      sentCount?: number;
      max?: number;
      nextAllowedAt?: string | null;
      message?: string;
    };

/** One key space for both the state map and the lookups against it. */
export function reminderKey(examId: string, recipientId: string): string {
  return `${examId}:${recipientId}`;
}

export async function loadReminderState(): Promise<Map<string, ReminderState>> {
  const { data, error } = await supabase.rpc("get_exam_reminder_state");
  const map = new Map<string, ReminderState>();
  if (error) {
    // A page that cannot read the ledger must not therefore assume "nothing has
    // been sent" and light every button up. It falls back to letting the server
    // refuse, which it will — the claim is the real gate.
    console.error("[reminders] could not load reminder state:", error.message);
    return map;
  }
  for (const row of (data ?? []) as Array<{
    exam_id: string;
    recipient_id: string;
    sent_count: number;
    last_sent_at: string | null;
    next_allowed_at: string | null;
  }>) {
    map.set(reminderKey(row.exam_id, row.recipient_id), {
      examId: row.exam_id,
      recipientId: row.recipient_id,
      sentCount: row.sent_count,
      lastSentAt: row.last_sent_at,
      nextAllowedAt: row.next_allowed_at,
    });
  }
  return map;
}

export async function claimReminder(examId: string, recipientId: string): Promise<ClaimVerdict> {
  const { data, error } = await supabase.rpc("claim_exam_reminder", {
    p_exam_id: examId,
    p_recipient_id: recipientId,
  });
  if (error) {
    return { allowed: false, reason: "error", message: error.message };
  }
  const v = data as {
    allowed: boolean;
    reason?: string;
    log_id?: string;
    sent_count?: number;
    max?: number;
    next_allowed_at?: string | null;
  } | null;

  if (v?.allowed) {
    return {
      allowed: true,
      logId: v.log_id as string,
      sentCount: v.sent_count ?? 0,
      max: v.max ?? REMINDER_MAX_PER_RECIPIENT,
    };
  }
  return {
    allowed: false,
    reason: (v?.reason as "max_reached") ?? "error",
    sentCount: v?.sent_count,
    max: v?.max,
    nextAllowedAt: v?.next_allowed_at ?? null,
  };
}

/**
 * Give a claimed slot back when the email itself failed.
 *
 * Best effort by design: if this call also fails the employee has simply used
 * one of three reminders on a message that never arrived, which is a far better
 * failure than an uncounted send.
 */
export async function releaseReminder(logId: string): Promise<void> {
  const { error } = await supabase.rpc("release_exam_reminder", { p_log_id: logId });
  if (error) console.warn("[reminders] could not release slot", logId, error.message);
}

export function daysUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export interface ReminderAvailability {
  canSend: boolean;
  /** "1 of 3 sent" — always shown, so the admin knows the budget before spending it. */
  countLabel: string;
  /** Why the button is disabled, in the admin's words. Empty when it is enabled. */
  reason: string;
}

/**
 * The single place that turns ledger state into what the button says.
 *
 * Both the per-row button and the Remind-all summary read this, so the count in
 * the tooltip and the count in the confirmation can never drift apart.
 */
export function describeAvailability(state: ReminderState | undefined): ReminderAvailability {
  const sent = state?.sentCount ?? 0;
  const countLabel = `${sent} of ${REMINDER_MAX_PER_RECIPIENT} sent`;

  if (sent >= REMINDER_MAX_PER_RECIPIENT) {
    return { canSend: false, countLabel, reason: `Reminder limit reached (${REMINDER_MAX_PER_RECIPIENT} per exam).` };
  }
  const days = daysUntil(state?.nextAllowedAt);
  if (state?.nextAllowedAt && days > 0) {
    return {
      canSend: false,
      countLabel,
      reason: `Already reminded this week — next reminder available in ${days} day${days === 1 ? "" : "s"}.`,
    };
  }
  return { canSend: true, countLabel, reason: "" };
}
