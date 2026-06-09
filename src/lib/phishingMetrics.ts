/**
 * Canonical phishing metrics module.
 *
 * All phishing rate calculations MUST go through this module to ensure
 * consistent denominators across all pages, PDFs, and CSV exports.
 *
 * Denominator rules:
 *   - "Delivered" rates  → use sentEmails   (emails that left the queue)
 *   - "Susceptibility"   → use targetedUsers (deduplicated campaign targets)
 *   - "Send success/fail"→ use queuedEmails  (total rows in campaign_email_queue)
 *   - Aggregate/company-wide → weighted sum: Σ(numerator) / Σ(denominator)
 */

export interface QueueCounts {
  /** Total rows in campaign_email_queue — the canonical "queued" number. */
  queued: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
}

export interface CampaignEngagement {
  opened: number;
  clicked: number;
  credentialsSubmitted: number;
  reported: number;
}

export interface PhishingMetrics {
  // Raw counts
  targetedUsers: number;
  queuedEmails: number;
  sentEmails: number;
  failedEmails: number;
  pendingEmails: number;
  skippedEmails: number;
  opened: number;
  clicked: number;
  credentialsSubmitted: number;
  reported: number;

  // Delivery rates (denominator = queuedEmails)
  sendSuccessRate: number;       // sent / queued
  deliveryFailureRate: number;   // failed / queued

  // Delivered engagement rates (denominator = sentEmails)
  openRateDelivered: number;     // opened / sent
  clickRateDelivered: number;    // clicked / sent
  credRateDelivered: number;     // creds / sent
  reportRateDelivered: number;   // reported / sent

  // Target susceptibility (denominator = targetedUsers)
  targetSusceptibilityRate: number; // unique (clicked OR submitted) / targeted
}

/** Build all derived rate fields. */
export function buildMetrics(
  targetedUsers: number,
  queue: QueueCounts,
  engagement: CampaignEngagement,
  uniqueSusceptible?: number,
): PhishingMetrics {
  const { queued, sent, failed, pending, skipped } = queue;
  const { opened, clicked, credentialsSubmitted, reported } = engagement;

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  return {
    targetedUsers,
    queuedEmails: queued,
    sentEmails: sent,
    failedEmails: failed,
    pendingEmails: pending,
    skippedEmails: skipped,
    opened,
    clicked,
    credentialsSubmitted,
    reported,

    sendSuccessRate:      pct(sent,   queued),
    deliveryFailureRate:  pct(failed, queued),

    openRateDelivered:  pct(opened,               sent),
    clickRateDelivered: pct(clicked,              sent),
    credRateDelivered:  pct(credentialsSubmitted, sent),
    reportRateDelivered:pct(reported,             sent),

    // If uniqueSusceptible not provided, fall back to (clicked + submitted) count
    // — note this over-counts if someone did both; callers should pass real unique count
    targetSusceptibilityRate: pct(
      uniqueSusceptible ?? Math.max(clicked, credentialsSubmitted),
      targetedUsers,
    ),
  };
}

/**
 * Compute weighted aggregate rates across multiple campaigns.
 * Uses Σ(numerator)/Σ(denominator) — not the average of per-campaign rates.
 */
export interface AggregatePhishingMetrics {
  totalTargeted: number;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalCreds: number;
  totalReported: number;

  /** Click rate by targeted users (weighted). */
  clickRateByTargets: number;
  /** Credential submission rate by targeted users (weighted). */
  credRateByTargets: number;
  /** Report rate by targeted users (weighted). */
  reportRateByTargets: number;
  /** Click rate by sent emails (weighted). */
  clickRateDelivered: number;
  /** Credential rate by sent emails (weighted). */
  credRateDelivered: number;
  /** Report rate by sent emails (weighted). */
  reportRateDelivered: number;
  /** Open rate by sent emails (weighted). */
  openRateDelivered: number;
}

export interface CampaignSummary {
  totalTargets: number;  // denominator for target-based rates
  emailsSent: number;    // denominator for delivered rates
  emailsOpened: number;
  linksClicked: number;
  credentialsSubmitted: number;
  emailsReported: number;
}

export function aggregatePhishingMetrics(campaigns: CampaignSummary[]): AggregatePhishingMetrics {
  const totals = campaigns.reduce(
    (acc, c) => ({
      targeted:  acc.targeted  + (c.totalTargets         ?? 0),
      sent:      acc.sent      + (c.emailsSent           ?? 0),
      opened:    acc.opened    + (c.emailsOpened         ?? 0),
      clicked:   acc.clicked   + (c.linksClicked         ?? 0),
      creds:     acc.creds     + (c.credentialsSubmitted ?? 0),
      reported:  acc.reported  + (c.emailsReported       ?? 0),
    }),
    { targeted: 0, sent: 0, opened: 0, clicked: 0, creds: 0, reported: 0 },
  );

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  return {
    totalTargeted: totals.targeted,
    totalSent:     totals.sent,
    totalOpened:   totals.opened,
    totalClicked:  totals.clicked,
    totalCreds:    totals.creds,
    totalReported: totals.reported,

    clickRateByTargets:  pct(totals.clicked,  totals.targeted),
    credRateByTargets:   pct(totals.creds,    totals.targeted),
    reportRateByTargets: pct(totals.reported, totals.targeted),

    clickRateDelivered:  pct(totals.clicked,  totals.sent),
    credRateDelivered:   pct(totals.creds,    totals.sent),
    reportRateDelivered: pct(totals.reported, totals.sent),
    openRateDelivered:   pct(totals.opened,   totals.sent),
  };
}
