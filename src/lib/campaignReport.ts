import { jsPDF } from 'jspdf';

export interface CampaignReportTarget {
  email: string;
  name?: string;
  status: string;
  opened_at?: string | null;
  clicked_at?: string | null;
  submitted_at?: string | null;
  reported_at?: string | null;
}

export interface CampaignQueueCounts {
  /** Total rows in campaign_email_queue — the true "queued" number. */
  queued: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
}

export interface CampaignReportData {
  name: string;
  companyName?: string;
  status: string;
  launchedAt?: string | null;
  /** Deduplicated unique targets (rows in phishing_campaign_targets). */
  totalTargets: number;
  /** Pass queue breakdown when available; falls back to emailsSent as sent-only denominator. */
  queue?: CampaignQueueCounts;
  /** Legacy field: kept for backward compatibility when queue is not provided. */
  emailsSent: number;
  emailsOpened: number;
  linksClicked: number;
  credentialsSubmitted: number;
  emailsReported: number;
  targets: CampaignReportTarget[];
}

/* ── helpers ── */
const pct = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 100)}%` : '0%');
const pctN = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 100) : 0);

const fmtTimestamp = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'campaign';

/* ── layout constants ── */
const MARGIN   = 44;
const COL_GAP  = 16;
const ROW_H    = 14;
const FOOTER_H = 28;

export function generateCampaignPdf(data: CampaignReportData): void {
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();   // 595.28
  const pageH = doc.internal.pageSize.getHeight();  // 841.89
  const contentW = pageW - MARGIN * 2;
  const bottomLimit = pageH - FOOTER_H - 10;

  // Resolve queue-level numbers (canonical methodology)
  const queuedEmails  = data.queue ? data.queue.queued  : (data.emailsSent ?? 0);
  const sentEmails    = data.queue ? data.queue.sent    : (data.emailsSent ?? 0);
  const failedEmails  = data.queue ? data.queue.failed  : 0;
  const pendingEmails = data.queue ? data.queue.pending : 0;
  const skippedEmails = data.queue ? data.queue.skipped : 0;

  let pageNum = 1;

  const addFooter = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.line(MARGIN, pageH - FOOTER_H, pageW - MARGIN, pageH - FOOTER_H);
    doc.text('AwareOne Phishing Campaign Report — Confidential', MARGIN, pageH - 10);
    doc.text(`Page ${pageNum}`, pageW - MARGIN, pageH - 10, { align: 'right' });
  };

  const newPage = () => {
    addFooter();
    doc.addPage();
    pageNum++;
    return MARGIN + 10;
  };

  const checkBreak = (y: number, needed: number): number =>
    y + needed > bottomLimit ? newPage() : y;

  /* ══════════════════════════════════════════
     PAGE 1 — Cover + Summary
  ══════════════════════════════════════════ */

  // Header band
  doc.setFillColor(18, 20, 10);
  doc.rect(0, 0, pageW, 78, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(200, 255, 0);
  doc.text('Phishing Campaign Results', MARGIN, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  const headerMeta = [
    data.companyName ? `Company: ${truncate(data.companyName, 40)}` : null,
    `Status: ${data.status}`,
    `Launched: ${fmtDate(data.launchedAt)}`,
    `Generated: ${new Date().toLocaleString()}`,
  ].filter(Boolean).join('   |   ');
  doc.text(headerMeta, MARGIN, 54);

  let y = 96;

  // Campaign name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  const nameLines = doc.splitTextToSize(data.name, contentW);
  doc.text(nameLines, MARGIN, y);
  y += nameLines.length * 17 + 8;

  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 20;

  /* ── Executive Summary ── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text('Executive Summary', MARGIN, y);
  y += 16;

  const susceptible = Math.max(data.linksClicked, data.credentialsSubmitted);
  const summaryLines = [
    `This report covers the phishing simulation campaign "${truncate(data.name, 60)}".`,
    `${data.totalTargets} employees were targeted. ${sentEmails} emails were sent successfully.`,
    `${data.linksClicked} employees clicked the simulated phishing link (${pct(data.linksClicked, sentEmails)} of delivered).`,
    `${data.credentialsSubmitted} employees submitted credentials (${pct(data.credentialsSubmitted, sentEmails)} of delivered).`,
    `${data.emailsReported} employees correctly reported the phishing email (${pct(data.emailsReported, data.totalTargets)} reporting rate).`,
    `Target susceptibility rate: ${pct(susceptible, data.totalTargets)} of targeted users clicked or submitted credentials.`,
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  summaryLines.forEach(line => {
    const wrapped = doc.splitTextToSize(`• ${line}`, contentW - 8);
    doc.text(wrapped, MARGIN + 6, y);
    y += wrapped.length * 12;
  });
  y += 10;

  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 18;

  /* ── Email Delivery Summary ── */
  y = checkBreak(y, 120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text('Email Delivery Summary', MARGIN, y);
  y += 14;

  const deliveryItems = [
    { label: 'Targeted Users',      value: data.totalTargets,  note: 'Deduplicated campaign targets' },
    { label: 'Queued Emails',        value: queuedEmails,       note: 'Total rows in email queue' },
    { label: 'Sent Emails',          value: sentEmails,         note: `${pct(sentEmails, queuedEmails)} send success rate` },
    { label: 'Failed Deliveries',    value: failedEmails,       note: `${pct(failedEmails, queuedEmails)} delivery failure rate` },
    ...(pendingEmails > 0 ? [{ label: 'Pending',          value: pendingEmails,  note: 'Not yet processed' }] : []),
    ...(skippedEmails > 0 ? [{ label: 'Skipped',          value: skippedEmails,  note: 'Excluded from sending' }] : []),
  ];

  const halfW = (contentW - COL_GAP) / 2;
  deliveryItems.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    if (col === 0 && row > 0 && i > 0) y = checkBreak(y, 36);
    const x = MARGIN + col * (halfW + COL_GAP);
    if (col === 0) {
      // draw row background alternating
    }
    doc.setFillColor(col === 0 ? 248 : 244, 249, 248);
    doc.rect(x, y, halfW, 30, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(20, 20, 20);
    doc.text(String(item.value), x + 8, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(item.label, x + 8, y + 29);
    // note on right side
    doc.setTextColor(130, 130, 130);
    doc.setFontSize(7.5);
    doc.text(item.note, x + halfW - 4, y + 20, { align: 'right' });
    if (col === 1) y += 36;
  });
  if (deliveryItems.length % 2 !== 0) y += 36;
  y += 14;

  /* ── Engagement Summary ── */
  y = checkBreak(y, 120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text('Engagement Summary', MARGIN, y);
  y += 14;

  const engItems = [
    { label: 'Opened',                value: data.emailsOpened,        note: `${pct(data.emailsOpened, sentEmails)} of sent` },
    { label: 'Clicked Link',          value: data.linksClicked,        note: `${pct(data.linksClicked, sentEmails)} of sent` },
    { label: 'Submitted Credentials', value: data.credentialsSubmitted,note: `${pct(data.credentialsSubmitted, sentEmails)} of sent` },
    { label: 'Reported Phishing',     value: data.emailsReported,      note: `${pct(data.emailsReported, data.totalTargets)} of targeted` },
  ];

  engItems.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    if (col === 0 && row > 0) y = checkBreak(y, 36);
    const x = MARGIN + col * (halfW + COL_GAP);
    doc.setFillColor(col === 0 ? 248 : 244, 249, 248);
    doc.rect(x, y, halfW, 30, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(20, 20, 20);
    doc.text(String(item.value), x + 8, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(item.label, x + 8, y + 29);
    doc.setTextColor(130, 130, 130);
    doc.setFontSize(7.5);
    doc.text(item.note, x + halfW - 4, y + 20, { align: 'right' });
    if (col === 1) y += 36;
  });
  if (engItems.length % 2 !== 0) y += 36;
  y += 14;

  /* ── Rates ── */
  y = checkBreak(y, 80);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text('Key Rates', MARGIN, y);
  y += 14;

  const rates = [
    { label: 'Send Success Rate',          value: pct(sentEmails,               queuedEmails),      note: 'Sent / Queued' },
    { label: 'Delivery Failure Rate',      value: pct(failedEmails,             queuedEmails),      note: 'Failed / Queued' },
    { label: 'Open Rate (by Delivered)',   value: pct(data.emailsOpened,        sentEmails),        note: 'Opened / Sent' },
    { label: 'Click Rate (by Delivered)',  value: pct(data.linksClicked,        sentEmails),        note: 'Clicked / Sent' },
    { label: 'Credential Rate (by Delivered)', value: pct(data.credentialsSubmitted, sentEmails),  note: 'Submitted / Sent' },
    { label: 'Report Rate (by Delivered)', value: pct(data.emailsReported,      sentEmails),        note: 'Reported / Sent' },
    { label: 'Target Susceptibility',      value: pct(susceptible,              data.totalTargets), note: '(Clicked OR Submitted) / Targeted' },
  ];

  rates.forEach(rate => {
    y = checkBreak(y, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(rate.label, MARGIN, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(rate.value, MARGIN + 200, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(rate.note, MARGIN + 240, y);
    y += 14;
  });
  y += 8;

  /* ── Engagement Funnel bars ── */
  y = checkBreak(y, 100);
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text('Engagement Funnel (by Sent)', MARGIN, y);
  y += 14;

  const funnel: Array<{ label: string; value: number; rgb: [number, number, number] }> = [
    { label: 'Opened',     value: data.emailsOpened,        rgb: [167, 139, 250] },
    { label: 'Clicked',    value: data.linksClicked,        rgb: [251, 146, 60]  },
    { label: 'Submitted',  value: data.credentialsSubmitted,rgb: [248, 113, 113] },
    { label: 'Reported',   value: data.emailsReported,      rgb: [52,  211, 153] },
  ];

  const labelW   = 72;
  const barX     = MARGIN + labelW;
  const barMaxW  = contentW - labelW - 68;
  const fBarH    = 12;

  funnel.forEach(f => {
    y = checkBreak(y, fBarH + 8);
    const p = pctN(f.value, sentEmails);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);
    doc.text(f.label, MARGIN, y + fBarH - 2);
    doc.setFillColor(235, 235, 235);
    doc.rect(barX, y, barMaxW, fBarH, 'F');
    const w = Math.max(0, (p / 100) * barMaxW);
    if (w > 0) {
      doc.setFillColor(f.rgb[0], f.rgb[1], f.rgb[2]);
      doc.rect(barX, y, w, fBarH, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    doc.text(`${f.value}  (${p}%)`, barX + barMaxW + 6, y + fBarH - 2);
    y += fBarH + 8;
  });
  y += 12;

  /* ══════════════════════════════════════════
     PER-TARGET TABLE
  ══════════════════════════════════════════ */
  if (data.targets.length > 0) {
    y = checkBreak(y, 36);
    doc.setDrawColor(220, 220, 220);
    doc.line(MARGIN, y, pageW - MARGIN, y);
    y += 16;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(`Target Details (${data.targets.length})`, MARGIN, y);
    y += 14;

    const cols: Array<{ title: string; w: number }> = [
      { title: 'Email / Name', w: 160 },
      { title: 'Status',       w: 62  },
      { title: 'Opened',       w: 74  },
      { title: 'Clicked',      w: 74  },
      { title: 'Submitted',    w: 74  },
      { title: 'Reported',     w: 74  },
    ];

    const drawTableHeader = (): void => {
      y = checkBreak(y, ROW_H + 2);
      doc.setFillColor(30, 30, 30);
      doc.rect(MARGIN, y, contentW, ROW_H, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      let cx = MARGIN + 4;
      cols.forEach(c => {
        doc.text(c.title, cx, y + ROW_H - 3);
        cx += c.w;
      });
      y += ROW_H;
    };

    drawTableHeader();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    data.targets.forEach((t, idx) => {
      if (y + ROW_H > bottomLimit) {
        y = newPage();
        drawTableHeader();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
      }
      if (idx % 2 === 1) {
        doc.setFillColor(246, 248, 246);
        doc.rect(MARGIN, y, contentW, ROW_H, 'F');
      }
      const nameStr = t.name ? truncate(t.name, 18) : '';
      const emailStr = truncate(t.email, 28);
      const displayEmail = nameStr ? `${emailStr} / ${nameStr}` : emailStr;
      const cells = [
        truncate(displayEmail, 36),
        truncate(t.status, 10),
        fmtTimestamp(t.opened_at),
        fmtTimestamp(t.clicked_at),
        fmtTimestamp(t.submitted_at),
        fmtTimestamp(t.reported_at),
      ];
      doc.setTextColor(40, 40, 40);
      let cx = MARGIN + 4;
      cells.forEach((cell, ci) => {
        doc.text(cell, cx, y + ROW_H - 3);
        cx += cols[ci].w;
      });
      y += ROW_H;
    });
    y += 14;
  }

  /* ══════════════════════════════════════════
     METHODOLOGY SECTION
  ══════════════════════════════════════════ */
  y = checkBreak(y, 180);
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text('Measurement Methodology', MARGIN, y);
  y += 16;

  const methodItems = [
    {
      title: 'Targeted Users',
      body: 'Deduplicated count of employees in phishing_campaign_targets. Each employee counted once regardless of how many emails were queued for them.',
    },
    {
      title: 'Queued / Sent / Failed Emails',
      body: 'Queued = total rows in campaign_email_queue. Sent = status SENT. Failed = status FAILED. Pending = not yet processed. Skipped = intentionally excluded.',
    },
    {
      title: 'Delivered Engagement Rates (Open, Click, Credential, Report)',
      body: 'Denominator = Sent Emails. Failed emails are excluded. These rates reflect engagement among recipients who actually received the email.',
    },
    {
      title: 'Target Susceptibility Rate',
      body: 'Denominator = Targeted Users. Numerator = unique employees who clicked OR submitted credentials. Measures human exposure risk regardless of email delivery outcome.',
    },
    {
      title: 'Campaign-Level vs Company-Wide Rates',
      body: 'Company-wide aggregate rates use weighted aggregation: Σ(numerators) / Σ(denominators). Simple averages of per-campaign percentages are not used as they distort results when campaign sizes differ.',
    },
    {
      title: 'Report Disclaimer',
      body: 'This simulation is designed to measure employee security awareness, not to penalise individuals. Results should be used to prioritise targeted training and not as a performance metric.',
    },
  ];

  methodItems.forEach(item => {
    y = checkBreak(y, 36);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(`• ${item.title}`, MARGIN, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(item.body, contentW - 14);
    lines.forEach((line: string) => {
      y = checkBreak(y, 11);
      doc.text(line, MARGIN + 12, y);
      y += 11;
    });
    y += 6;
  });

  /* ── Recommendations ── */
  y = checkBreak(y, 80);
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text('Recommendations', MARGIN, y);
  y += 14;

  const clickPct  = pctN(data.linksClicked,        data.totalTargets);
  const credPct   = pctN(data.credentialsSubmitted, data.totalTargets);
  const reportPct = pctN(data.emailsReported,       data.totalTargets);

  const recs: string[] = [];
  if (clickPct > 30)  recs.push(`High click rate (${clickPct}% of targeted users). Schedule mandatory phishing awareness training for all employees.`);
  if (credPct > 15)   recs.push(`Credential submission rate is elevated (${credPct}%). Reinforce password hygiene and multi-factor authentication awareness.`);
  if (reportPct < 10) recs.push(`Low reporting rate (${reportPct}%). Train employees on how and where to report suspicious emails.`);
  if (failedEmails > queuedEmails * 0.2) recs.push(`Delivery failure rate is high (${pct(failedEmails, queuedEmails)}). Review SMTP configuration and recipient email list validity.`);
  if (recs.length === 0) recs.push('Results are within acceptable benchmarks. Continue regular phishing simulation exercises on a quarterly cadence.');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  recs.forEach(rec => {
    y = checkBreak(y, 24);
    const lines = doc.splitTextToSize(`• ${rec}`, contentW - 8);
    doc.text(lines, MARGIN + 6, y);
    y += lines.length * 12 + 4;
  });

  /* final footer on last page */
  addFooter();

  const filename = `phishing-results-${sanitize(data.name)}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
