/**
 * phishingMetrics — canonical phishing campaign metrics module.
 *
 * Denominator discipline:
 *   - Delivery rates (open, click, submit, report) use SENT emails as denominator
 *   - Queue rates (queued, failed) use QUEUED emails as denominator
 *   - Susceptibility (click, submit) uses TARGETED users (deduplicated recipients) as denominator
 *
 * Aggregate calculations use weighted Σ(numerators) / Σ(denominators), never
 * the average of per-campaign percentages, to prevent small campaigns from
 * skewing results.
 */

/** Zero-denominator safe percentage. Returns 0 (never NaN/Infinity). */
export function safePct(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0 || !Number.isFinite(denominator)) return 0;
  if (!Number.isFinite(numerator) || numerator < 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** Email queue status totals for a campaign. */
export interface QueueStats {
  queued: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
}

/** Per-target engagement stats from phishing_campaign_targets rows. */
export interface TargetStats {
  employee_id?: string | null;
  email: string;
  clicked_at?: string | null;
  opened_at?: string | null;
  credentials_entered?: boolean | null;
  reported_at?: string | null;
}

/** Fully-computed canonical metrics for a single campaign. */
export interface CampaignMetrics {
  // Counts
  targeted: number;        // deduplicated recipients
  queued: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  opened: number;
  clicked: number;
  submitted: number;
  reported: number;

  // Rates — delivery rates use SENT as denominator
  openRate: number;        // % of sent
  clickRate: number;       // % of sent
  submitRate: number;      // % of sent
  reportRate: number;      // % of sent

  // Queue rates — use QUEUED as denominator
  failRate: number;        // % of queued

  // Susceptibility — use TARGETED users as denominator
  susceptibilityRate: number;   // (clicked OR submitted) / targeted
  reportByTargetRate: number;   // reported / targeted
}

/**
 * Deduplicate target rows by normalized email (lowercase + trim).
 * First occurrence wins. Rows with an empty email are dropped.
 */
export function summarizeTargets(rows: TargetStats[]): TargetStats[] {
  const seen = new Set<string>();
  const out: TargetStats[] = [];
  for (const row of rows) {
    const email = (row.email ?? '').trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ ...row, email });
  }
  return out;
}

/**
 * Compute canonical metrics from queue stats + deduplicated target rows.
 * Call summarizeTargets() on target rows before passing here.
 */
export function calculateCampaignMetrics(
  queue: QueueStats,
  targets: TargetStats[],
): CampaignMetrics {
  const targeted = targets.length;
  const opened   = targets.filter(t => t.opened_at).length;
  const clicked  = targets.filter(t => t.clicked_at).length;
  const submitted = targets.filter(t => t.credentials_entered).length;
  const reported  = targets.filter(t => t.reported_at).length;

  const susceptible = targets.filter(t => t.clicked_at || t.credentials_entered).length;

  return {
    targeted,
    queued:   queue.queued,
    sent:     queue.sent,
    failed:   queue.failed,
    pending:  queue.pending,
    skipped:  queue.skipped,
    opened,
    clicked,
    submitted,
    reported,

    openRate:   safePct(opened,    queue.sent),
    clickRate:  safePct(clicked,   queue.sent),
    submitRate: safePct(submitted, queue.sent),
    reportRate: safePct(reported,  queue.sent),

    failRate:   safePct(queue.failed, queue.queued),

    susceptibilityRate:  safePct(susceptible, targeted),
    reportByTargetRate:  safePct(reported,    targeted),
  };
}

/** Weighted aggregate across multiple campaigns. */
export interface AggregateCampaignMetrics {
  totalTargeted: number;
  totalQueued: number;
  totalSent: number;
  totalFailed: number;
  totalOpened: number;
  totalClicked: number;
  totalSubmitted: number;
  totalReported: number;
  // Weighted rates (Σnumerators / Σdenominators)
  openRate: number;
  clickRate: number;
  submitRate: number;
  reportRate: number;
  susceptibilityRate: number;
  reportByTargetRate: number;
}

/**
 * Weighted aggregate: sums numerators and denominators separately before
 * dividing — never averages per-campaign percentages.
 */
export function calculateAggregateCampaignMetrics(
  campaigns: CampaignMetrics[],
): AggregateCampaignMetrics {
  let totalTargeted = 0, totalQueued = 0, totalSent = 0, totalFailed = 0;
  let totalOpened = 0, totalClicked = 0, totalSubmitted = 0, totalReported = 0;
  let totalSusceptible = 0;

  for (const m of campaigns) {
    totalTargeted  += m.targeted;
    totalQueued    += m.queued;
    totalSent      += m.sent;
    totalFailed    += m.failed;
    totalOpened    += m.opened;
    totalClicked   += m.clicked;
    totalSubmitted += m.submitted;
    totalReported  += m.reported;
    // Recover susceptible count from rate × targeted (integer, so safe)
    totalSusceptible += Math.round((m.susceptibilityRate / 100) * m.targeted);
  }

  return {
    totalTargeted,
    totalQueued,
    totalSent,
    totalFailed,
    totalOpened,
    totalClicked,
    totalSubmitted,
    totalReported,
    openRate:            safePct(totalOpened,      totalSent),
    clickRate:           safePct(totalClicked,     totalSent),
    submitRate:          safePct(totalSubmitted,   totalSent),
    reportRate:          safePct(totalReported,    totalSent),
    susceptibilityRate:  safePct(totalSusceptible, totalTargeted),
    reportByTargetRate:  safePct(totalReported,    totalTargeted),
  };
}

/** Plain-language methodology notes for PDF/CSV export. */
export const methodologyNotes: string[] = [
  'Open, click, submit, and report rates are calculated as a percentage of successfully sent emails.',
  'Susceptibility rate (click or credential submission) is calculated as a percentage of targeted users (unique recipients).',
  'Aggregate rates use weighted totals (sum of numerators / sum of denominators), not averages of per-campaign percentages.',
  'Failed emails are excluded from delivery rate denominators; they count toward the fail rate (% of queued).',
  'Recipients are deduplicated by email address before engagement counts are tallied.',
];
