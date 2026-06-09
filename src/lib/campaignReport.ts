import { jsPDF } from 'jspdf';
import {
  calculateCampaignMetrics,
  summarizeTargets,
  methodologyNotes,
  type QueueStats,
  type TargetStats,
} from './phishingMetrics';

export interface CampaignReportTarget {
  email: string;
  name?: string;
  status: string;
  opened_at?: string | null;
  clicked_at?: string | null;
  submitted_at?: string | null;
  reported_at?: string | null;
  credentials_entered?: boolean | null;
  reported?: boolean | null;
}

export interface CampaignReportData {
  name: string;
  companyName?: string;
  status: string;
  launchedAt?: string | null;
  totalTargets: number;
  emailsSent: number;
  emailsOpened: number;
  linksClicked: number;
  credentialsSubmitted: number;
  emailsReported: number;
  // Optional queue detail for canonical metrics
  queuedEmails?: number;
  failedEmails?: number;
  pendingEmails?: number;
  skippedEmails?: number;
  targets: CampaignReportTarget[];
}

const fmtTimestamp = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const fmtDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
};

const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

const sanitize = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'campaign';

export function generateCampaignPdf(data: CampaignReportData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const contentW = pageW - marginX * 2;
  let y = 48;

  // Build canonical metrics from queue stats + deduplicated targets
  const queueStats: QueueStats = {
    queued:  data.queuedEmails  ?? data.emailsSent,
    sent:    data.emailsSent,
    failed:  data.failedEmails  ?? 0,
    pending: data.pendingEmails ?? 0,
    skipped: data.skippedEmails ?? 0,
  };
  const targetRows: TargetStats[] = data.targets.map(t => ({
    email:               t.email,
    opened_at:           t.opened_at,
    clicked_at:          t.clicked_at,
    credentials_entered: t.credentials_entered ?? (t.submitted_at ? true : null),
    reported_at:         t.reported_at,
  }));
  const dedupedTargets = summarizeTargets(targetRows);
  const m = calculateCampaignMetrics(queueStats, dedupedTargets);

  /* ── Header ── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text('Phishing Campaign Results', marginX, y);
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(40, 40, 40);
  doc.text(truncate(data.name, 70), marginX, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const headerLines: string[] = [];
  if (data.companyName) headerLines.push(`Company: ${data.companyName}`);
  headerLines.push(`Status: ${data.status}`);
  headerLines.push(`Launched: ${fmtDate(data.launchedAt)}`);
  headerLines.push(`Generated: ${new Date().toLocaleString()}`);
  doc.text(headerLines.join('    |    '), marginX, y);
  y += 10;

  doc.setDrawColor(220, 220, 220);
  doc.line(marginX, y, pageW - marginX, y);
  y += 22;

  /* ── Summary metrics (8-column) ── */
  const summaryMetrics: Array<{ label: string; value: number; sub: string }> = [
    { label: 'Targets',   value: m.targeted,   sub: 'Unique recipients' },
    { label: 'Queued',    value: m.queued,      sub: 'Emails queued' },
    { label: 'Sent',      value: m.sent,        sub: 'Emails sent' },
    { label: 'Failed',    value: m.failed,      sub: `Fail (${m.failRate}% of queued)` },
    { label: 'Opened',    value: m.opened,      sub: `${m.openRate}% of sent` },
    { label: 'Clicked',   value: m.clicked,     sub: `${m.clickRate}% of sent` },
    { label: 'Submitted', value: m.submitted,   sub: `${m.submitRate}% of sent` },
    { label: 'Reported',  value: m.reported,    sub: `${m.reportRate}% of sent` },
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('Summary', marginX, y);
  y += 14;

  const colW = contentW / summaryMetrics.length;
  summaryMetrics.forEach((sm, i) => {
    const cx = marginX + i * colW;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text(String(sm.value), cx, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);
    doc.text(sm.sub, cx, y + 16);
  });
  y += 34;

  /* ── Susceptibility headline ── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(220, 50, 50);
  doc.text(
    `Susceptibility: ${m.susceptibilityRate}% of targeted users clicked or submitted credentials  |  Reported by ${m.reportByTargetRate}% of targeted users`,
    marginX, y,
  );
  y += 20;

  /* ── Funnel bars (rates of delivered / sent emails) ── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('Engagement Funnel (rates of sent emails)', marginX, y);
  y += 14;

  const funnel: Array<{ label: string; value: number; rate: number; rgb: [number, number, number] }> = [
    { label: 'Opened',    value: m.opened,    rate: m.openRate,   rgb: [167, 139, 250] },
    { label: 'Clicked',   value: m.clicked,   rate: m.clickRate,  rgb: [251, 146, 60] },
    { label: 'Submitted', value: m.submitted, rate: m.submitRate, rgb: [248, 113, 113] },
    { label: 'Reported',  value: m.reported,  rate: m.reportRate, rgb: [52, 211, 153] },
  ];

  const labelW = 70;
  const barX = marginX + labelW;
  const barMaxW = contentW - labelW - 60;
  const barH = 11;
  funnel.forEach((f) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);
    doc.text(f.label, marginX, y + barH - 2);
    doc.setFillColor(235, 235, 235);
    doc.rect(barX, y, barMaxW, barH, 'F');
    const w = Math.max(0, (f.rate / 100) * barMaxW);
    if (w > 0) {
      doc.setFillColor(f.rgb[0], f.rgb[1], f.rgb[2]);
      doc.rect(barX, y, w, barH, 'F');
    }
    doc.setTextColor(70, 70, 70);
    doc.text(`${f.value} (${f.rate}%)`, barX + barMaxW + 6, y + barH - 2);
    y += barH + 6;
  });
  y += 16;

  /* ── Methodology ── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('Methodology', marginX, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(95, 95, 95);
  methodologyNotes.forEach((note) => {
    const lines = doc.splitTextToSize(`•  ${note}`, contentW) as string[];
    lines.forEach((ln) => {
      if (y + 12 > pageH - 40) { doc.addPage(); y = 48; }
      doc.text(ln, marginX, y);
      y += 11;
    });
  });
  y += 14;

  /* ── Per-target table ── */
  const cols: Array<{ title: string; w: number }> = [
    { title: 'Email', w: 130 },
    { title: 'Name', w: 75 },
    { title: 'Status', w: 60 },
    { title: 'Opened', w: 60 },
    { title: 'Clicked', w: 60 },
    { title: 'Submitted', w: 60 },
    { title: 'Reported', w: 60 },
  ];
  const rowH = 14;
  const bottomLimit = pageH - 40;

  const drawTableHeader = (): void => {
    doc.setFillColor(30, 30, 30);
    doc.rect(marginX, y, contentW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    let cx = marginX + 4;
    cols.forEach((c) => {
      doc.text(c.title, cx, y + rowH - 4);
      cx += c.w;
    });
    y += rowH;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(`Targets (${data.targets.length})`, marginX, y);
  y += 14;

  drawTableHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  data.targets.forEach((t, idx) => {
    if (y + rowH > bottomLimit) {
      doc.addPage();
      y = 48;
      drawTableHeader();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }
    if (idx % 2 === 1) {
      doc.setFillColor(245, 245, 245);
      doc.rect(marginX, y, contentW, rowH, 'F');
    }
    const cells = [
      truncate(t.email, 32),
      truncate(t.name || '—', 18),
      truncate(t.status, 12),
      fmtTimestamp(t.opened_at),
      fmtTimestamp(t.clicked_at),
      fmtTimestamp(t.submitted_at),
      fmtTimestamp(t.reported_at),
    ];
    doc.setTextColor(40, 40, 40);
    let cx = marginX + 4;
    cells.forEach((cell, ci) => {
      doc.text(cell, cx, y + rowH - 4);
      cx += cols[ci].w;
    });
    y += rowH;
  });

  /* ── Methodology notes ── */
  y += 10;
  if (y + 80 > pageH - 40) { doc.addPage(); y = 48; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text('Reporting Methodology', marginX, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  methodologyNotes.forEach(note => {
    if (y + 12 > pageH - 40) { doc.addPage(); y = 48; }
    doc.text(`• ${note}`, marginX + 4, y);
    y += 12;
  });

  const filename = `phishing-results-${sanitize(data.name)}-${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;
  doc.save(filename);
}
