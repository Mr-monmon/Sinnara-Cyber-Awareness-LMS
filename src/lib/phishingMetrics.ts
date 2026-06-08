/**
 * phishingMetrics — the single canonical source of truth for phishing campaign
 * reporting figures. Every dashboard, table, PDF, and CSV MUST derive its
 * numbers from this module so the UI, PDF, and CSV always agree.
 *
 * Denominator discipline (read this before adding a metric):
 *   - "Delivered" rates use SENT emails as the denominator. Failed/pending/
 *     skipped emails never deflate delivered-performance rates.
 *   - "Queued" rates (send success / delivery failure) use QUEUED emails.
 *   - "Target" rates (susceptibility / report-by-target) use deduplicated
 *     TARGETED users as the denominator.
 *   - Opened/clicked/submitted/reported are UNIQUE per recipient (deduplicated),
 *     not raw event counts.
 *
 * Never label two different metrics with the same name. "Click Rate" is
 * ambiguous on its own — always say whether it is of delivered emails or of
 * targeted users (see formatMetricLabel / methodologyNotes).
 */

/** Queue-side counts (campaign_email_queue rows by status). */
export interface QueueStats {
  queued: number; // total queue rows
  sent: number; // status SENT
  failed: number; // status FAILED
  pending: number; // status PENDING
  skipped: number; // status SKIPPED
}

/** Target-side counts (deduplicated phishing targets). */
export interface TargetStats {
  targeted: number; // deduplicated targets
  opened: number; // unique targets with opened_at
  clicked: number; // unique targets with clicked_at
  submitted: number; // unique targets with submitted_at / credentials_entered
  reported: number; // unique targets with reported_at
  /** Unique targets that clicked OR submitted (susceptibility numerator). */
  compromised: number;
}

/** Fully-resolved metric set for a campaign or an aggregate. */
export interface CampaignMetrics {
  // Raw counts
  targetedUsers: number;
  queuedEmails: number;
  sentEmails: number;
  failedEmails: number;
  pendingEmails: number;
  skippedEmails: number;
  opened: number;
  clicked: number;
  submitted: number;
  reported: number;
  compromisedUsers: number;
  // Queued-denominator rates (0–100)
  sendSuccessRate: number;
  deliveryFailureRate: number;
  // Delivered-denominator rates (0–100)
  openRateDelivered: number;
  clickRateDelivered: number;
  credentialRateDelivered: number;
  reportRateDelivered: number;
  // Targeted-denominator rates (0–100)
  targetSusceptibilityRate: number;
  reportByTargetRate: number;
}

/**
 * Percentage helper. Returns 0 when the denominator is 0 (or non-finite) so a
 * campaign with no sent/queued/targeted population never produces NaN/Infinity.
 * Rounded to one decimal place.
 */
export function safePct(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0 || !Number.isFinite(denominator)) return 0;
  if (!Number.isFinite(numerator) || numerator < 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** First present finite numeric value among the given keys (else fallback). */
function pick(obj: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return fallback;
}

/** A row carrying per-target engagement timestamps. */
export interface TargetRowLike {
  email?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  submitted_at?: string | null;
  data_submitted?: boolean | null;
  credentials_entered?: boolean | null;
  reported_at?: string | null;
}

/**
 * Reduce raw target rows into deduplicated TargetStats. Rows are deduplicated by
 * normalized (lowercased, trimmed) email; a stage counts if ANY row for that
 * recipient recorded it. Rows without an email are each treated as a distinct
 * recipient (cannot be deduplicated) so they are not silently merged.
 */
export function summarizeTargets(rows: TargetRowLike[]): TargetStats {
  const byEmail = new Map<string, { opened: boolean; clicked: boolean; submitted: boolean; reported: boolean }>();
  let anonSeq = 0;

  for (const r of rows ?? []) {
    const email = (r.email ?? "").trim().toLowerCase();
    const key = email || `__anon_${anonSeq++}`;
    const agg = byEmail.get(key) ?? { opened: false, clicked: false, submitted: false, reported: false };
    if (r.opened_at) agg.opened = true;
    if (r.clicked_at) agg.clicked = true;
    if (r.submitted_at || r.data_submitted === true || r.credentials_entered === true) agg.submitted = true;
    if (r.reported_at) agg.reported = true;
    byEmail.set(key, agg);
  }

  let opened = 0, clicked = 0, submitted = 0, reported = 0, compromised = 0;
  for (const a of byEmail.values()) {
    if (a.opened) opened++;
    if (a.clicked) clicked++;
    if (a.submitted) submitted++;
    if (a.reported) reported++;
    if (a.clicked || a.submitted) compromised++;
  }
  return { targeted: byEmail.size, opened, clicked, submitted, reported, compromised };
}

/**
 * Compute the canonical metric set for one campaign.
 *
 * Counts are taken from `queueStats` / `targetStats` when supplied; otherwise
 * they are read from common fields on the `campaign` record (several column
 * aliases are tolerated). `compromised` defaults to max(clicked, submitted)
 * when not explicitly provided (submitted recipients are a subset of clicked).
 */
export function calculateCampaignMetrics(
  campaign: Record<string, unknown> = {},
  queueStats?: Partial<QueueStats>,
  targetStats?: Partial<TargetStats>,
): CampaignMetrics {
  const queuedEmails = queueStats?.queued ?? pick(campaign, ["queued_emails", "queuedEmails", "queue_total", "total_queued"]);
  const sentEmails = queueStats?.sent ?? pick(campaign, ["sent_emails", "emails_sent", "sentEmails", "sent_count", "sent"]);
  const failedEmails = queueStats?.failed ?? pick(campaign, ["failed_emails", "emails_failed", "failedEmails", "failed_count", "failed"]);
  const pendingEmails = queueStats?.pending ?? pick(campaign, ["pending_emails", "pendingEmails", "pending_count", "pending"]);
  const skippedEmails = queueStats?.skipped ?? pick(campaign, ["skipped_emails", "skippedEmails", "skipped_count", "skipped"]);

  const targetedUsers = targetStats?.targeted ?? pick(campaign, ["targeted_users", "totalTargets", "total_targets", "target_count", "targets"]);
  const opened = targetStats?.opened ?? pick(campaign, ["opened", "emails_opened", "opened_count", "open_count"]);
  const clicked = targetStats?.clicked ?? pick(campaign, ["clicked", "links_clicked", "clicked_count", "click_count"]);
  const submitted = targetStats?.submitted ?? pick(campaign, ["submitted", "credentials_submitted", "submitted_count", "data_submitted_count"]);
  const reported = targetStats?.reported ?? pick(campaign, ["reported", "emails_reported", "reported_count", "report_count"]);
  const compromisedUsers = targetStats?.compromised ?? Math.max(clicked, submitted);

  // If queued is unknown but we have sent/failed/pending/skipped, infer it.
  const queuedResolved = queuedEmails > 0 ? queuedEmails : (sentEmails + failedEmails + pendingEmails + skippedEmails);

  return {
    targetedUsers,
    queuedEmails: queuedResolved,
    sentEmails,
    failedEmails,
    pendingEmails,
    skippedEmails,
    opened,
    clicked,
    submitted,
    reported,
    compromisedUsers,
    sendSuccessRate: safePct(sentEmails, queuedResolved),
    deliveryFailureRate: safePct(failedEmails, queuedResolved),
    openRateDelivered: safePct(opened, sentEmails),
    clickRateDelivered: safePct(clicked, sentEmails),
    credentialRateDelivered: safePct(submitted, sentEmails),
    reportRateDelivered: safePct(reported, sentEmails),
    targetSusceptibilityRate: safePct(compromisedUsers, targetedUsers),
    reportByTargetRate: safePct(reported, targetedUsers),
  };
}

/**
 * Weighted aggregate across many campaigns: sum(numerators) / sum(denominators).
 * This is NOT an average of per-campaign percentages (which would over-weight
 * tiny campaigns). Accepts either pre-computed CampaignMetrics or raw inputs.
 */
export function calculateAggregateCampaignMetrics(
  campaigns: Array<CampaignMetrics | Record<string, unknown>>,
): CampaignMetrics {
  const totals = {
    targetedUsers: 0, queuedEmails: 0, sentEmails: 0, failedEmails: 0,
    pendingEmails: 0, skippedEmails: 0, opened: 0, clicked: 0,
    submitted: 0, reported: 0, compromisedUsers: 0,
  };

  for (const c of campaigns ?? []) {
    const m = isCampaignMetrics(c) ? c : calculateCampaignMetrics(c as Record<string, unknown>);
    totals.targetedUsers += m.targetedUsers;
    totals.queuedEmails += m.queuedEmails;
    totals.sentEmails += m.sentEmails;
    totals.failedEmails += m.failedEmails;
    totals.pendingEmails += m.pendingEmails;
    totals.skippedEmails += m.skippedEmails;
    totals.opened += m.opened;
    totals.clicked += m.clicked;
    totals.submitted += m.submitted;
    totals.reported += m.reported;
    totals.compromisedUsers += m.compromisedUsers;
  }

  return {
    ...totals,
    sendSuccessRate: safePct(totals.sentEmails, totals.queuedEmails),
    deliveryFailureRate: safePct(totals.failedEmails, totals.queuedEmails),
    openRateDelivered: safePct(totals.opened, totals.sentEmails),
    clickRateDelivered: safePct(totals.clicked, totals.sentEmails),
    credentialRateDelivered: safePct(totals.submitted, totals.sentEmails),
    reportRateDelivered: safePct(totals.reported, totals.sentEmails),
    targetSusceptibilityRate: safePct(totals.compromisedUsers, totals.targetedUsers),
    reportByTargetRate: safePct(totals.reported, totals.targetedUsers),
  };
}

function isCampaignMetrics(v: unknown): v is CampaignMetrics {
  return !!v && typeof v === "object" && "clickRateDelivered" in (v as Record<string, unknown>)
    && "targetSusceptibilityRate" in (v as Record<string, unknown>);
}

/** Human-readable, denominator-explicit labels for each rate. */
export function formatMetricLabel(key: keyof CampaignMetrics): string {
  const labels: Record<string, string> = {
    targetedUsers: "Targeted Users",
    queuedEmails: "Queued Emails",
    sentEmails: "Sent Emails",
    failedEmails: "Failed Emails",
    pendingEmails: "Pending Emails",
    skippedEmails: "Skipped Emails",
    opened: "Opened (unique)",
    clicked: "Clicked (unique)",
    submitted: "Submitted (unique)",
    reported: "Reported (unique)",
    compromisedUsers: "Compromised Users (clicked or submitted)",
    sendSuccessRate: "Send Success Rate (of queued)",
    deliveryFailureRate: "Delivery Failure Rate (of queued)",
    openRateDelivered: "Open Rate (of delivered)",
    clickRateDelivered: "Click Rate (of delivered)",
    credentialRateDelivered: "Credential Submit Rate (of delivered)",
    reportRateDelivered: "Report Rate (of delivered)",
    targetSusceptibilityRate: "Target Susceptibility Rate (of targeted users)",
    reportByTargetRate: "Report Rate (of targeted users)",
  };
  return labels[key as string] ?? String(key);
}

/** Plain-language methodology notes for inclusion in PDF/CSV/about panels. */
export const methodologyNotes: string[] = [
  "Delivered-performance rates (open, click, credential submit, report) use SENT emails as the denominator — failed, pending, and skipped emails do not deflate them.",
  "Send Success Rate and Delivery Failure Rate use QUEUED emails as the denominator.",
  "Target Susceptibility Rate uses deduplicated TARGETED users as the denominator and counts each user who clicked OR submitted at most once.",
  "Opened, clicked, submitted, and reported counts are deduplicated per recipient — repeated opens or clicks by the same person count once.",
  "Company-wide and multi-campaign figures are weighted aggregates: sum(numerators) / sum(denominators), never an average of per-campaign percentages.",
];
