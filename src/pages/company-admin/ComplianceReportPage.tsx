import React, { useCallback, useEffect, useState } from "react";
import { Download, ShieldCheck, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import jsPDF from "jspdf";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import {
  buildComplianceControls,
  scoreFramework,
  overallReadiness,
  STANDARD_DISCLAIMER,
  type ComplianceSignals,
  type ControlEvidence,
  type ControlStatus,
} from "../../lib/complianceFrameworks";
import { calculateAggregateCampaignMetrics, type CampaignMetrics } from "../../lib/phishingMetrics";

const T = {
  bg:           "#12140a",
  bgCard:       "#1a1e0e",
  accent:       "#c8ff00",
  accentDark:   "#12140a",
  white:        "#ffffff",
  textBody:     "#94a3b8",
  textLabel:    "#cbd5e1",
  textMuted:    "#64748b",
  border:       "rgba(255,255,255,0.09)",
  borderFaint:  "rgba(255,255,255,0.05)",
  green:        "#34d399",
  greenBg:      "rgba(52,211,153,0.10)",
  greenBorder:  "rgba(52,211,153,0.30)",
  orange:       "#fb923c",
  orangeBg:     "rgba(251,146,60,0.10)",
  orangeBorder: "rgba(251,146,60,0.30)",
  red:          "#f87171",
  redBg:        "rgba(248,113,113,0.10)",
  redBorder:    "rgba(248,113,113,0.30)",
  blue:         "#60a5fa",
  blueBg:       "rgba(96,165,250,0.10)",
} as const;

type Status = "compliant" | "partial" | "non-compliant" | "not-assessed";

interface Control {
  code: string;
  title: string;
  description: string;
  status: Status;
  evidence: string[];
  recommendation?: string;
  framework: string;       // human framework name
  frameworkId: string;     // FrameworkId
  disclaimer: string;
}

interface Stats {
  totalEmployees: number;
  trainedEmployees: number;
  completionRate: number;
  avgScore: number;
  hasAssessmentData: boolean;
  certificatesIssued: number;
  recentLogins: number;
  auditEventsLast90: number;
  trainingsLast90: number;
  phishingCampaignsRun: number;
  susceptibilityRate: number;
  reportRate: number;
}

const STATUS_CFG: Record<Status, { color: string; bg: string; border: string; label: string }> = {
  compliant:        { color: T.green,  bg: T.greenBg,  border: T.greenBorder,  label: "Compliant"     },
  partial:          { color: T.orange, bg: T.orangeBg, border: T.orangeBorder, label: "Partial"       },
  "non-compliant":  { color: T.red,    bg: T.redBg,    border: T.redBorder,    label: "Non-Compliant" },
  "not-assessed":   { color: "#94a3b8", bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.25)", label: "Not Assessed" },
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div style={{ padding: "14px 16px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10 }}>
      <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: T.white, marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CFG[status];
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
}

interface Slice { value: number; color: string; label: string }

function DonutChart({ slices, size = 160, stroke = 22, centerLabel }: { slices: Slice[]; size?: number; stroke?: number; centerLabel?: { value: string; sub: string } }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      {slices.map((s, i) => {
        if (s.value === 0) return null;
        const length = (s.value / total) * circumference;
        const dasharray = `${length} ${circumference - length}`;
        const dashoffset = -offset;
        offset += length;
        return (
          <circle
            key={i}
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={dasharray}
            strokeDashoffset={dashoffset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
      {centerLabel && (
        <>
          <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontSize={size / 6} fontWeight={900} fill="#ffffff" fontFamily="Inter">{centerLabel.value}</text>
          <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fontSize={size / 14} fill="#64748b" fontFamily="Inter">{centerLabel.sub}</text>
        </>
      )}
    </svg>
  );
}

export const ComplianceReportPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats]     = useState<Stats | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      const cid = user.company_id;
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch employees first — their IDs/emails are needed for dependent queries
      const { data: employees } = await supabase
        .from("users")
        .select("id, email")
        .eq("company_id", cid)
        .eq("role", "EMPLOYEE");

      const employeeIds    = employees?.map(e => e.id)    ?? [];
      const employeeEmails = employees?.map(e => e.email) ?? [];

      const none = { data: null, count: 0, error: null };

      const [
        { data: company },
        { data: ecs },
        { data: examResults },
        { count: certificatesIssued },
        { count: auditEventsLast90 },
        { count: trainingsLast90 },
        { count: recentLogins },
      ] = await Promise.all([
        supabase.from("companies").select("name").eq("id", cid).single(),
        employeeIds.length
          ? supabase.from("employee_courses").select("employee_id, completed_at").in("employee_id", employeeIds).not("completed_at", "is", null)
          : Promise.resolve({ data: [] as { employee_id: string; completed_at: string | null }[], error: null }),
        employeeIds.length
          ? supabase.from("exam_results").select("employee_id, percentage, passed").in("employee_id", employeeIds)
          : Promise.resolve({ data: [] as { employee_id: string; percentage: number | null; passed: boolean }[], error: null }),
        employeeIds.length
          ? supabase.from("certificates").select("id", { count: "exact", head: true }).in("user_id", employeeIds)
          : Promise.resolve(none),
        supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("company_id", cid).gte("created_at", ninetyDaysAgo),
        employeeIds.length
          ? supabase.from("employee_courses").select("id", { count: "exact", head: true }).in("employee_id", employeeIds).not("completed_at", "is", null).gte("completed_at", ninetyDaysAgo)
          : Promise.resolve(none),
        employeeEmails.length
          ? supabase.from("auth_attempts").select("id", { count: "exact", head: true }).in("email", employeeEmails).eq("success", true).gte("attempted_at", thirtyDaysAgo)
          : Promise.resolve(none),
      ]);

      // An employee is "trained" if they completed a course OR passed an exam (matches dashboard logic)
      const completedSet = new Set<string>([
        ...((ecs ?? []).map(c => c.employee_id)),
        ...((examResults ?? []).filter(r => r.passed).map(r => r.employee_id)),
      ]);
      const trainedEmployees = completedSet.size;
      const totalEmployees   = employeeIds.length;
      const completionRate   = totalEmployees ? Math.round((trainedEmployees / totalEmployees) * 100) : 0;
      // Use each employee's best (highest) score rather than a raw attempt average.
      // Raw attempt average over-weights employees who re-took the exam multiple times.
      const bestByEmployee = new Map<string, number>();
      (examResults ?? []).forEach(r => {
        if (typeof r.percentage === "number") {
          const cur = bestByEmployee.get(r.employee_id);
          if (cur === undefined || r.percentage > cur) bestByEmployee.set(r.employee_id, r.percentage);
        }
      });
      const empScores = Array.from(bestByEmployee.values());
      const avgScore = empScores.length ? Math.round(empScores.reduce((a, b) => a + b, 0) / empScores.length) : 0;

      // Fetch phishing campaign metrics for compliance evidence
      const { data: campaigns } = await supabase
        .from("phishing_campaigns")
        .select("id, total_targets, emails_sent, emails_opened, links_clicked, credentials_entered, emails_reported")
        .eq("company_id", cid)
        .eq("status", "COMPLETED");

      const phishingCampaignsRun = (campaigns ?? []).length;
      let susceptibilityRate = 0;
      let reportRate = 0;
      if (phishingCampaignsRun > 0) {
        const campaignMetrics: CampaignMetrics[] = (campaigns ?? []).map(c => ({
          targeted:    c.total_targets ?? 0,
          queued:      c.emails_sent ?? 0,
          sent:        c.emails_sent ?? 0,
          failed:      0,
          pending:     0,
          skipped:     0,
          opened:      c.emails_opened ?? 0,
          clicked:     c.links_clicked ?? 0,
          submitted:   c.credentials_entered ?? 0,
          reported:    c.emails_reported ?? 0,
          openRate:    0,
          clickRate:   0,
          submitRate:  0,
          reportRate:  0,
          failRate:    0,
          susceptibilityRate:  c.total_targets > 0 ? Math.round(((c.links_clicked ?? 0) / c.total_targets) * 100 * 10) / 10 : 0,
          reportByTargetRate:  c.total_targets > 0 ? Math.round(((c.emails_reported ?? 0) / c.total_targets) * 100 * 10) / 10 : 0,
        }));
        const agg = calculateAggregateCampaignMetrics(campaignMetrics);
        susceptibilityRate = agg.susceptibilityRate;
        reportRate         = agg.reportByTargetRate;
      }

      setCompanyName(company?.name ?? "Your Company");
      setStats({
        totalEmployees,
        trainedEmployees,
        completionRate,
        avgScore,
        hasAssessmentData: bestByEmployee.size > 0,
        certificatesIssued: certificatesIssued ?? 0,
        recentLogins: recentLogins ?? 0,
        auditEventsLast90: auditEventsLast90 ?? 0,
        trainingsLast90: trainingsLast90 ?? 0,
        phishingCampaignsRun,
        susceptibilityRate,
        reportRate,
      });
    } finally {
      setLoading(false);
    }
  }, [user?.company_id]);

  useEffect(() => { load(); }, [load]);

  const statsToSignals = (s: Stats): ComplianceSignals => ({
    totalEmployees:       s.totalEmployees,
    completionRate:       s.completionRate,
    avgExamScore:         s.avgScore,
    assessedEmployees:    s.trainedEmployees,
    susceptibilityRate:   s.susceptibilityRate,
    reportRate:           s.reportRate,
    phishingCampaignsRun: s.phishingCampaignsRun,
    certificatesIssued:   s.certificatesIssued,
  });

  const mapToLocal = (ev: ControlEvidence[]): Control[] =>
    ev.map(c => {
      const statusMap: Record<ControlStatus, Status> = {
        COMPLIANT:     'compliant',
        PARTIAL:       'partial',
        NON_COMPLIANT: 'non-compliant',
        NOT_ASSESSED:  'not-assessed',
      };
      return {
        code:        c.id,
        title:       c.title,
        description: c.evidence,
        status:      statusMap[c.status],
        evidence:    [c.evidence],
      };
    });

  const downloadPDF = async () => {
    if (!stats) return;
    setDownloading(true);
    try {
      const controls = mapToLocal(buildComplianceControls(statsToSignals(stats)));
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const margin = 48;
      let y = margin;

      // Compute canonical evidence from the canonical module
      const canonicalControls = buildComplianceControls(statsToSignals(stats));
      const fwScores = [
        scoreFramework(canonicalControls, 'ISO_27001_2022'),
        scoreFramework(canonicalControls, 'NCA_ECC_2_2024'),
        scoreFramework(canonicalControls, 'SAMA_CSF'),
      ];
      const canonicalOverall = overallReadiness(canonicalControls);

      // Header band
      doc.setFillColor(18, 20, 10);
      doc.rect(0, 0, W, 80, "F");
      doc.setTextColor(200, 255, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("Cybersecurity Compliance Readiness Report", margin, 38);
      doc.setTextColor(180, 180, 180);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`${companyName} • Generated ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, margin, 58);

      y = 120;

      // Compliance donut chart (rendered via canvas)
      const compliantN = controls.filter(c => c.status === "compliant").length;
      const partialN   = controls.filter(c => c.status === "partial").length;
      const nonN       = controls.filter(c => c.status === "non-compliant").length;
      const notAssessedN = controls.filter(c => c.status === "not-assessed").length;
      const overall = canonicalOverall;

      const chartCanvas = document.createElement("canvas");
      const dpi = 2;
      chartCanvas.width = 220 * dpi;
      chartCanvas.height = 220 * dpi;
      const ctx = chartCanvas.getContext("2d")!;
      ctx.scale(dpi, dpi);
      const cx = 110, cy = 110, outerR = 90, innerR = 64;
      const totalSlices = compliantN + partialN + nonN + notAssessedN || 1;
      const slices = [
        { value: compliantN,   color: "#22c55e" },
        { value: partialN,     color: "#fb923c" },
        { value: nonN,         color: "#f87171" },
        { value: notAssessedN, color: "#64748b" },
      ];
      let startAngle = -Math.PI / 2;
      slices.forEach(s => {
        if (s.value === 0) return;
        const angle = (s.value / totalSlices) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, startAngle, startAngle + angle);
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
        startAngle += angle;
      });
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#1a1e0e";
      ctx.font = "bold 28px Helvetica";
      ctx.textAlign = "center";
      ctx.fillText(`${overall}%`, cx, cy + 4);
      ctx.font = "10px Helvetica";
      ctx.fillStyle = "#64748b";
      ctx.fillText("readiness", cx, cy + 20);

      const chartDataUrl = chartCanvas.toDataURL("image/png");
      doc.addImage(chartDataUrl, "PNG", margin, y, 110, 110);

      // Legend next to chart
      const legendX = margin + 130;
      let legendY = y + 18;
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Compliance Breakdown", legendX, legendY);
      legendY += 18;
      const legend = [
        { label: "Compliant",      n: compliantN,   color: [34, 197, 94] as [number, number, number] },
        { label: "Partial",        n: partialN,     color: [251, 146, 60] as [number, number, number] },
        { label: "Non-Compliant",  n: nonN,         color: [248, 113, 113] as [number, number, number] },
        { label: "Not Assessed",   n: notAssessedN, color: [100, 116, 139] as [number, number, number] },
      ];
      legend.forEach(l => {
        doc.setFillColor(l.color[0], l.color[1], l.color[2]);
        doc.rect(legendX, legendY - 7, 9, 9, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.text(l.label, legendX + 14, legendY);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(20, 20, 20);
        const pct = controls.length ? Math.round((l.n / controls.length) * 100) : 0;
        doc.text(`${l.n}  (${pct}%)`, legendX + 110, legendY);
        legendY += 16;
      });

      y += 130;

      // Executive summary
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Executive Summary", margin, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const summary = [
        `Overall readiness: ${overall}% (${compliantN} compliant, ${partialN} partial, ${nonN} non-compliant, ${notAssessedN} not assessed)`,
        `Training completion: ${stats.completionRate}% (${stats.trainedEmployees}/${stats.totalEmployees} employees)`,
        `Average assessment score: ${stats.avgScore}%`,
        `Certificates issued: ${stats.certificatesIssued}`,
        `Phishing simulations run: ${stats.phishingCampaignsRun}`,
      ];
      summary.forEach(line => { doc.text(`• ${line}`, margin + 6, y); y += 14; });
      y += 6;
      // Per-framework scores
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      fwScores.forEach(fs => {
        doc.text(`${fs.label}: ${fs.score}% (${fs.assessedCount}/${fs.controlCount} controls assessed)`, margin + 6, y);
        y += 14;
      });

      // Scoring methodology note.
      y += 4;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text("Readiness scoring: COMPLIANT=100, PARTIAL=50, NON_COMPLIANT=0; NOT_ASSESSED excluded from the score.", margin + 6, y);
      y += 12;
      doc.setFont("helvetica", "normal");

      y += 10;
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, W - margin, y);
      y += 18;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Control Assessment", margin, y);
      y += 20;

      controls.forEach((c) => {
        // Page break if needed
        if (y > H - 140) {
          doc.addPage();
          y = margin;
        }

        // Status pill
        const statusColors: Record<Status, [number, number, number]> = {
          compliant:       [34, 197, 94],
          partial:         [251, 146, 60],
          "non-compliant": [248, 113, 113],
          "not-assessed":  [148, 163, 184],
        };
        const [r, g, b] = statusColors[c.status];
        doc.setFillColor(r, g, b);
        doc.roundedRect(margin, y, 70, 16, 4, 4, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(STATUS_CFG[c.status].label.toUpperCase(), margin + 35, y + 11, { align: "center" });

        // Control code
        doc.setTextColor(80, 80, 80);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(c.code, margin + 80, y + 11);

        y += 24;

        // Title
        doc.setTextColor(20, 20, 20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(c.title, margin, y);
        y += 14;

        // Description
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 90);
        const descLines = doc.splitTextToSize(c.description, W - margin * 2);
        doc.text(descLines, margin, y);
        y += descLines.length * 11 + 6;

        // Evidence
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        doc.text("Evidence:", margin, y);
        y += 12;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 40, 40);
        c.evidence.forEach((e) => {
          const lines = doc.splitTextToSize(`• ${e}`, W - margin * 2 - 12);
          if (y + lines.length * 11 > H - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(lines, margin + 12, y);
          y += lines.length * 11;
        });

        if (c.recommendation) {
          y += 4;
          doc.setFillColor(255, 247, 224);
          doc.rect(margin, y - 8, W - margin * 2, 24, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(120, 80, 0);
          doc.text("Recommendation:", margin + 8, y + 6);
          doc.setFont("helvetica", "normal");
          const recLines = doc.splitTextToSize(c.recommendation, W - margin * 2 - 100);
          doc.text(recLines, margin + 92, y + 6);
          y += 22;
        }

        y += 14;
      });

      // Footer note on last page
      if (y > H - 80) { doc.addPage(); y = margin; }
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, W - margin, y);
      y += 16;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text("Scoring Methodology", margin, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("COMPLIANT = 100 pts, PARTIAL = 50 pts, NON_COMPLIANT = 0 pts. NOT_ASSESSED controls are excluded from the readiness denominator.", margin, y);
      y += 16;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      const disclaimerLines = doc.splitTextToSize(STANDARD_DISCLAIMER, W - margin * 2);
      doc.text(disclaimerLines, margin, y);

      const fileName = `compliance-report-${companyName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
    } finally {
      setDownloading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.06)", borderTopColor: T.accent, animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  const controls = mapToLocal(buildComplianceControls(statsToSignals(stats)));
  const compliantCount = controls.filter(c => c.status === "compliant").length;
  const notAssessedCount = controls.filter(c => c.status === "not-assessed").length;
  const canonicalFwScores = [
    scoreFramework(buildComplianceControls(statsToSignals(stats)), 'ISO_27001_2022'),
    scoreFramework(buildComplianceControls(statsToSignals(stats)), 'NCA_ECC_2_2024'),
    scoreFramework(buildComplianceControls(statsToSignals(stats)), 'SAMA_CSF'),
  ];
  const overall = overallReadiness(buildComplianceControls(statsToSignals(stats)));

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: T.greenBg, border: `1px solid ${T.greenBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={20} style={{ color: T.green }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, margin: 0, letterSpacing: "-0.3px" }}>Compliance Readiness Report</h1>
            <p style={{ fontSize: 13, color: T.textMuted, margin: "2px 0 0" }}>Mapped evidence for ISO 27001, NCA ECC 2-2024, and SAMA CSF</p>
          </div>
        </div>
        <button
          onClick={downloadPDF}
          disabled={downloading}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 10, border: "none", background: T.accent, color: T.accentDark, fontSize: 13, fontWeight: 800, cursor: downloading ? "wait" : "pointer", fontFamily: "inherit", boxShadow: "0 0 16px rgba(200,255,0,0.2)" }}
        >
          <Download size={15} /> {downloading ? "Generating PDF…" : "Download PDF Report"}
        </button>
      </div>

      {/* Overall score with donut chart */}
      <div style={{ display: "flex", alignItems: "center", gap: 28, padding: "22px 28px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, flexWrap: "wrap" }}>
        <DonutChart
          size={180}
          stroke={26}
          slices={[
            { value: controls.filter(c => c.status === "compliant").length,     color: T.green,   label: "Compliant" },
            { value: controls.filter(c => c.status === "partial").length,       color: T.orange,  label: "Partial" },
            { value: controls.filter(c => c.status === "non-compliant").length, color: T.red,     label: "Non-Compliant" },
            { value: notAssessedCount,                                           color: "#64748b", label: "Not Assessed" },
          ]}
          centerLabel={{ value: `${overall}%`, sub: "readiness" }}
        />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 700 }}>Overall Readiness</div>
          <div style={{ fontSize: 14, color: T.textBody, marginTop: 4, marginBottom: 16 }}>
            {compliantCount} of {controls.length} controls compliant · {notAssessedCount} not assessed
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(["compliant", "partial", "non-compliant", "not-assessed"] as Status[]).map(s => {
              const n = controls.filter(c => c.status === s).length;
              const pct = controls.length ? Math.round((n / controls.length) * 100) : 0;
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_CFG[s].color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: T.textLabel, flex: 1 }}>{STATUS_CFG[s].label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{n}</span>
                  <span style={{ fontSize: 12, color: T.textMuted, width: 38, textAlign: "right" }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Per-framework score cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {canonicalFwScores.map(fs => (
          <div key={fs.frameworkId} style={{ padding: "14px 16px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>{fs.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: T.white, marginTop: 4 }}>{fs.score}%</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{fs.assessedCount} of {fs.controlCount} controls assessed</div>
          </div>
        ))}
      </div>

      {/* Stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <StatCard label="Employees" value={stats.totalEmployees} hint={`${stats.trainedEmployees} fully trained`} />
        <StatCard label="Training Rate" value={`${stats.completionRate}%`} hint="Across mandatory courses" />
        <StatCard label="Avg. Score" value={`${stats.avgScore}%`} hint="All assessments" />
        <StatCard label="Certificates" value={stats.certificatesIssued} hint="Issued to date" />
        <StatCard label="Phishing Campaigns" value={stats.phishingCampaignsRun} hint="Completed simulations" />
      </div>

      {/* Evidence cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <StatCard label="Training Coverage" value={`${stats.completionRate}%`} hint={`${stats.trainedEmployees}/${stats.totalEmployees} employees`} />
        <StatCard label="Phishing Resilience" value={stats.phishingCampaigns > 0 ? `${100 - stats.phishingSusceptibilityRate}%` : "—"} hint={stats.phishingCampaigns > 0 ? `${stats.phishingSusceptibilityRate}% susceptibility` : "no campaigns yet"} />
        <StatCard label="Assessment" value={stats.hasAssessmentData ? `${stats.avgScore}%` : "—"} hint={stats.hasAssessmentData ? "avg best score" : "no results yet"} />
        <StatCard label="Certificates" value={stats.certificatesIssued} hint="Issued to date" />
        <StatCard label="Audit Evidence" value={stats.auditEventsLast90} hint="events · last 90 days" />
      </div>

      {/* Controls grouped by framework */}
      {Object.entries(byFramework).map(([framework, list]) => (
      <div key={framework} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.white, letterSpacing: "0.3px", marginTop: 6 }}>{framework}</div>
        {list.map((c, idx) => (
          <div key={`${c.frameworkId}-${c.code}-${idx}`} style={{ padding: "18px 22px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <StatusBadge status={c.status} />
              <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.5px" }}>{c.code}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.white }}>{c.title}</span>
            </div>
            <p style={{ fontSize: 13, color: T.textBody, margin: "0 0 10px", lineHeight: 1.6 }}>{c.description}</p>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: 6 }}>Evidence</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {c.evidence.map((e, i) => (
                <li key={i} style={{ fontSize: 13, color: T.textLabel, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <CheckCircle2 size={13} style={{ color: T.green, flexShrink: 0, marginTop: 3 }} />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
            {c.recommendation && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, borderRadius: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
                <AlertTriangle size={14} style={{ color: T.orange, flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12, color: T.textLabel, lineHeight: 1.5 }}>
                  <strong style={{ color: T.orange }}>Recommendation: </strong>{c.recommendation}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      ))}

      {/* Disclaimer */}
      <div style={{ padding: "12px 16px", background: T.blueBg, border: `1px solid ${T.border}`, borderRadius: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Info size={14} style={{ color: T.blue, flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12, color: T.textBody, lineHeight: 1.6 }}>
          {STANDARD_DISCLAIMER}
        </div>
      </div>
    </div>
  );
};

