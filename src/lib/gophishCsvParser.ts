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

/* ─────────────────────────────────────────────────────────────────────────
   Gophish reports a SINGLE furthest-reached status per recipient (e.g. a
   recipient who clicked and then submitted credentials shows only
   "Submitted Data"). A correct funnel must therefore be cumulative:
     submitted ⊆ clicked ⊆ opened ⊆ sent
   Counting each stage by its exact status string under-counts the earlier
   stages and can make clicks < submits, which is impossible. classifyRecord
   normalises every record into cumulative boolean flags so all callers agree.
───────────────────────────────────────────────────────────────────────── */
interface RecordFlags {
  sent: boolean;
  opened: boolean;
  clicked: boolean;
  submitted: boolean;
  reported: boolean;
}

function classifyRecord(r: GophishRecord): RecordFlags {
  const status = (r.status || '').trim().toLowerCase();
  const submitted = status.includes('submitted');
  const clicked = submitted || status.includes('clicked');
  const opened = clicked || status.includes('opened');
  // "Email Sent" and every later stage count as delivered. Pre-send states
  // (scheduled / sending / queued / retrying / error) and empty rows do not.
  const preSend =
    status === '' ||
    status.includes('scheduled') ||
    status.includes('sending') ||
    status.includes('queued') ||
    status.includes('retrying') ||
    status.includes('error');
  const sent = opened || (!preSend && status.length > 0);
  const reported = r.reported?.trim().toLowerCase() === 'true';
  return { sent, opened, clicked, submitted, reported };
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

  return { records, stats: toStats(records) };
}

function toStats(records: GophishRecord[]) {
  const flags = records.map(classifyRecord);
  return {
    totalRecords:   records.length,
    emailsSent:     flags.filter(f => f.sent).length,
    emailsOpened:   flags.filter(f => f.opened).length,
    linksClicked:   flags.filter(f => f.clicked).length,
    dataSubmitted:  flags.filter(f => f.submitted).length,
    emailsReported: flags.filter(f => f.reported).length,
  };
}

function calculateCampaignStats(records: GophishRecord[]) {
  const s = toStats(records);
  return {
    total_targets:   s.totalRecords,
    emails_sent:     s.emailsSent,
    emails_opened:   s.emailsOpened,
    links_clicked:   s.linksClicked,
    data_submitted:  s.dataSubmitted,
    emails_reported: s.emailsReported,
  };
}

/* Furthest funnel stage reached, for per-target display. Reporting is tracked
   independently (a reported email can also have been clicked/submitted), so it
   no longer overrides the funnel stage. */
function getStatusFromRecord(record: GophishRecord): string {
  const f = classifyRecord(record);
  if (f.submitted) return 'SUBMITTED';
  if (f.clicked)   return 'CLICKED';
  if (f.opened)    return 'OPENED';
  if (f.sent)      return 'SENT';
  return 'PENDING';
}

export {
  parseCSV,
  calculateCampaignStats,
  getStatusFromRecord,
  classifyRecord,
};
export type { GophishRecord, ParsedCampaignData, RecordFlags };
