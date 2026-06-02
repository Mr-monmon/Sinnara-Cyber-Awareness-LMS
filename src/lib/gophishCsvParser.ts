interface GophishRecord {
  id: string;
  status: string;
  ip: string;
  latitude: string;
  longitude: string;
  send_date: string;
  reported: string;
  modified_date: string;
  email: string;
  first_name: string;
  last_name: string;
  position: string;
}

interface ParsedCampaignData {
  records: GophishRecord[];
  stats: {
    totalRecords: number;
    emailsSent: number;
    emailsOpened: number;
    linksClicked: number;
    dataSubmitted: number;
    emailsReported: number;
  };
}

// The phishing funnel is cumulative: a recipient who reached a later stage
// necessarily passed through every earlier one. Gophish, however, records only
// the LAST stage each recipient reached as a single terminal status string.
// We therefore map each status to a rank and count cumulatively so the invariant
// sent ≥ opened ≥ clicked ≥ submitted always holds.
type FunnelStage = 'NONE' | 'SENT' | 'OPENED' | 'CLICKED' | 'SUBMITTED';

const STAGE_RANK: Record<FunnelStage, number> = {
  NONE: 0,
  SENT: 1,
  OPENED: 2,
  CLICKED: 3,
  SUBMITTED: 4,
};

// Maps a raw Gophish status string to its funnel stage. Non-delivery statuses
// (Scheduled, Sending, Campaign Created, Error/Retrying, …) are NOT counted as
// sent — only a genuinely delivered email advances the funnel.
function funnelStage(rawStatus: string): FunnelStage {
  const s = (rawStatus || '').trim().toLowerCase();
  if (s === 'submitted data') return 'SUBMITTED';
  if (s === 'clicked link') return 'CLICKED';
  if (s === 'email opened' || s === 'opened') return 'OPENED';
  if (s === 'email sent') return 'SENT';
  return 'NONE';
}

// Reporting is independent of the open→click→submit funnel: a recipient can
// report a phishing email whether or not they clicked it. Driven by the
// dedicated `reported` column, never by the funnel status.
function isReported(record: GophishRecord): boolean {
  return (record.reported || '').trim().toLowerCase() === 'true';
}

function parseCSV(csvContent: string): ParsedCampaignData {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must contain headers and at least one data row');
  }

  const headers = lines[0].split('\t');
  const records: GophishRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('\t');
    if (values.length !== headers.length) continue;

    const record: GophishRecord = {
      id: values[0]?.trim() || '',
      status: values[1]?.trim() || '',
      ip: values[2]?.trim() || '',
      latitude: values[3]?.trim() || '',
      longitude: values[4]?.trim() || '',
      send_date: values[5]?.trim() || '',
      reported: values[6]?.trim() || '',
      modified_date: values[7]?.trim() || '',
      email: values[8]?.trim() || '',
      first_name: values[9]?.trim() || '',
      last_name: values[10]?.trim() || '',
      position: values[11]?.trim() || ''
    };

    if (record.id && record.email) {
      records.push(record);
    }
  }

  const counts = aggregateFunnel(records);
  const stats = {
    totalRecords: records.length,
    emailsSent: counts.emails_sent,
    emailsOpened: counts.emails_opened,
    linksClicked: counts.links_clicked,
    dataSubmitted: counts.data_submitted,
    emailsReported: counts.emails_reported,
  };

  return { records, stats };
}

// Single source of truth for cumulative funnel aggregation.
function aggregateFunnel(records: GophishRecord[]) {
  let emails_sent = 0;
  let emails_opened = 0;
  let links_clicked = 0;
  let data_submitted = 0;
  let emails_reported = 0;

  for (const r of records) {
    const rank = STAGE_RANK[funnelStage(r.status)];
    if (rank >= STAGE_RANK.SENT) emails_sent++;
    if (rank >= STAGE_RANK.OPENED) emails_opened++;
    if (rank >= STAGE_RANK.CLICKED) links_clicked++;
    if (rank >= STAGE_RANK.SUBMITTED) data_submitted++;
    if (isReported(r)) emails_reported++;
  }

  return { emails_sent, emails_opened, links_clicked, data_submitted, emails_reported };
}

function calculateCampaignStats(records: GophishRecord[]) {
  return {
    total_targets: records.length,
    ...aggregateFunnel(records),
  };
}

// Returns the per-target funnel status. Independent of `reported` so that a
// recipient who both submitted AND reported is still recorded as SUBMITTED
// (with reporting tracked separately via reported_at). Use isReported() for
// the reporting signal.
function getStatusFromRecord(record: GophishRecord): string {
  const stage = funnelStage(record.status);
  switch (stage) {
    case 'SUBMITTED': return 'SUBMITTED';
    case 'CLICKED':   return 'CLICKED';
    case 'OPENED':    return 'OPENED';
    case 'SENT':      return 'SENT';
    default:          return 'SENT';
  }
}

export {
  parseCSV,
  calculateCampaignStats,
  getStatusFromRecord,
  funnelStage,
  isReported,
  STAGE_RANK,
};
export type { GophishRecord, ParsedCampaignData, FunnelStage };
