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

// Tokenizes a single delimited-text document into a matrix of cells, honouring
// RFC-4180-style double-quote quoting: quoted fields may contain the delimiter,
// CR/LF newlines, and escaped quotes ("" → "). Works for both comma- and
// tab-separated input — the delimiter is passed in by the caller.
function tokenizeDelimited(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const ch = content[i];

    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      // Consume a CRLF pair as a single line break.
      if (ch === '\r' && content[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Flush the trailing field/row (file may not end with a newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Detects whether the header line is tab- or comma-delimited. Gophish exports
// are TSV, but hand-edited or re-exported files are often CSV, so we pick the
// delimiter that yields more columns on the header line.
function detectDelimiter(headerLine: string): string {
  const tabs = (headerLine.match(/\t/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return tabs >= commas ? '\t' : ',';
}

// Parses a Gophish campaign export. Accepts both CSV and TSV, with quoted
// fields. Columns are matched by header NAME (falling back to Gophish's known
// column order) so re-ordered or partial exports still parse correctly.
function parseCSV(csvContent: string): ParsedCampaignData {
  const content = csvContent.replace(/^\uFEFF/, '').trim();
  if (!content) {
    throw new Error('File is empty.');
  }

  const firstBreak = content.search(/\r\n|\r|\n/);
  const headerLine = firstBreak === -1 ? content : content.slice(0, firstBreak);
  const delimiter = detectDelimiter(headerLine);

  const matrix = tokenizeDelimited(content, delimiter);
  if (matrix.length < 2) {
    throw new Error('File must contain a header row and at least one data row.');
  }

  const headers = matrix[0].map((h) => h.trim().toLowerCase());
  // Map each logical field to its column index by header name, falling back to
  // Gophish's canonical column order when a header is absent.
  const FIELD_ORDER: (keyof GophishRecord)[] = [
    'id', 'status', 'ip', 'latitude', 'longitude', 'send_date',
    'reported', 'modified_date', 'email', 'first_name', 'last_name', 'position',
  ];
  const colIndex = (field: keyof GophishRecord, fallback: number): number => {
    const named = headers.indexOf(field);
    return named === -1 ? fallback : named;
  };
  const indices = FIELD_ORDER.reduce<Record<string, number>>((acc, field, idx) => {
    acc[field] = colIndex(field, idx);
    return acc;
  }, {});

  const cell = (values: string[], field: keyof GophishRecord) =>
    (values[indices[field]] ?? '').trim();

  const records: GophishRecord[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const values = matrix[i];
    // Skip blank lines produced by trailing newlines.
    if (values.length === 1 && values[0].trim() === '') continue;

    const record: GophishRecord = {
      id: cell(values, 'id'),
      status: cell(values, 'status'),
      ip: cell(values, 'ip'),
      latitude: cell(values, 'latitude'),
      longitude: cell(values, 'longitude'),
      send_date: cell(values, 'send_date'),
      reported: cell(values, 'reported'),
      modified_date: cell(values, 'modified_date'),
      email: cell(values, 'email'),
      first_name: cell(values, 'first_name'),
      last_name: cell(values, 'last_name'),
      position: cell(values, 'position'),
    };

    if (record.id && record.email) {
      records.push(record);
    }
  }

  if (records.length === 0) {
    throw new Error('No valid rows found. Each row must include an id and an email.');
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
