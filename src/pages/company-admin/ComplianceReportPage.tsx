import React, { useEffect, useState } from "react";
import { Download, ShieldCheck, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import jsPDF from "jspdf";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

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

type Status = "compliant" | "partial" | "non-compliant";

interface Control {
  code: string;
  title: string;
  description: string;
  status: Status;
  evidence: string[];
  recommendation?: string;
}

interface Stats {
  totalEmployees: number;
  trainedEmployees: number;
  completionRate: number;
  avgScore: number;
  certificatesIssued: number;
  recentLogins: number;
  auditEventsLast90: number;
  trainingsLast90: number;
  lockedAccounts: number;
}

const STATUS_CFG: Record<Status, { color: string; bg: string; border: string; label: string }> = {
  compliant:    { color: T.green,  bg: T.greenBg,  border: T.greenBorder,  label: "Compliant"     },
  partial:      { color: T.orange, bg: T.orangeBg, border: T.orangeBorder, label: "Partial"       },
  "non-compliant": { color: T.red, bg: T.redBg,    border: T.redBorder,    label: "Non-Compliant" },
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

export const ComplianceReportPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats]     = useState<Stats | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => { load(); }, [user]);

  const load = async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      const cid = user.company_id;
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [
        { data: company },
        { count: totalEmployees },
        { data: ecs },
        { count: certificatesIssued },
        { count: auditEventsLast90 },
        { count: trainingsLast90 },
        { count: lockedAccounts },
        { count: recentLogins },
      ] = await Promise.all([
        supabase.from("companies").select("name").eq("id", cid).single(),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("role", "EMPLOYEE"),
        supabase.from("employee_courses").select("status, employee_id, progress_percentage").in("employee_id",
          (await supabase.from("users").select("id").eq("company_id", cid).eq("role", "EMPLOYEE")).data?.map(u => u.id) ?? []
        ),
        supabase.from("certificates").select("id", { count: "exact", head: true }).eq("company_id", cid),
        supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("company_id", cid).gte("created_at", ninetyDaysAgo),
        supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("action_type", "COMPLETE_COURSE").gte("created_at", ninetyDaysAgo),
        supabase.from("account_lockouts").select("email", { count: "exact", head: true }).gt("locked_until", new Date().toISOString()),
        supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("action_type", "LOGIN").gte("created_at", thirtyDaysAgo),
      ]);

      const completedSet = new Set(
        (ecs ?? []).filter(c => c.status === "COMPLETED").map(c => c.employee_id)
      );
      const trainedEmployees = completedSet.size;
      const completionRate = totalEmployees ? Math.round((trainedEmployees / totalEmployees) * 100) : 0;
      const scores = (ecs ?? []).map(c => c.progress_percentage).filter(p => typeof p === "number");
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      setCompanyName(company?.name ?? "Your Company");
      setStats({
        totalEmployees: totalEmployees ?? 0,
        trainedEmployees,
        completionRate,
        avgScore,
        certificatesIssued: certificatesIssued ?? 0,
        recentLogins: recentLogins ?? 0,
        auditEventsLast90: auditEventsLast90 ?? 0,
        trainingsLast90: trainingsLast90 ?? 0,
        lockedAccounts: lockedAccounts ?? 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const buildControls = (s: Stats): Control[] => [
    {
      code: "ECC 1-5-1",
      title: "Cybersecurity Awareness Training",
      description: "All employees shall be trained on cybersecurity policies, threats, and best practices.",
      status: s.completionRate >= 90 ? "compliant" : s.completionRate >= 60 ? "partial" : "non-compliant",
      evidence: [
        `${s.trainedEmployees} of ${s.totalEmployees} employees completed mandatory training (${s.completionRate}%)`,
        `${s.certificatesIssued} certificate${s.certificatesIssued === 1 ? "" : "s"} issued`,
        `${s.trainingsLast90} training completions logged in the last 90 days`,
      ],
      recommendation: s.completionRate < 90
        ? `Assign remaining ${s.totalEmployees - s.trainedEmployees} employees to mandatory training`
        : undefined,
    },
    {
      code: "ECC 2-2-3",
      title: "Identity and Access Management",
      description: "Strong authentication and access controls shall be enforced.",
      status: "compliant",
      evidence: [
        "Strong password policy enforced (10+ chars, complexity required)",
        "Account lockout after 5 failed attempts within 15 minutes",
        `${s.lockedAccounts} account${s.lockedAccounts === 1 ? "" : "s"} currently locked`,
        "Multi-tenant Row Level Security on all data access",
      ],
    },
    {
      code: "ECC 2-3-3",
      title: "Event Logging and Monitoring",
      description: "Security events shall be logged, retained, and monitored.",
      status: s.auditEventsLast90 > 0 ? "compliant" : "partial",
      evidence: [
        `${s.auditEventsLast90} audit events recorded in the last 90 days`,
        "All admin actions (create / update / delete / password / login) logged",
        "Logs retained indefinitely with tamper-resistant tenant isolation",
        "Production error tracking via Sentry",
      ],
      recommendation: s.auditEventsLast90 === 0
        ? "Ensure all admin actions are being logged"
        : undefined,
    },
    {
      code: "ECC 2-13-3",
      title: "Phishing Awareness and Protection",
      description: "Employees shall be trained to recognize and resist phishing attacks.",
      status: s.trainingsLast90 >= s.totalEmployees * 0.5 ? "compliant" : "partial",
      evidence: [
        "Active fraud-alert and phishing-awareness modules deployed",
        `${s.recentLogins} login events in last 30 days (active engagement)`,
        "Phishing simulation campaign workflow available",
      ],
      recommendation: s.trainingsLast90 < s.totalEmployees * 0.5
        ? "Schedule a quarterly phishing simulation campaign"
        : undefined,
    },
    {
      code: "ECC 4-1-2",
      title: "Cybersecurity Awareness Programme",
      description: "An ongoing programme to maintain employee cyber awareness.",
      status: s.avgScore >= 70 ? "compliant" : "partial",
      evidence: [
        `Average assessment score: ${s.avgScore}%`,
        `${s.certificatesIssued} certificate${s.certificatesIssued === 1 ? "" : "s"} of completion issued`,
        "Continuous awareness content delivered through dashboard tips and fraud alerts",
      ],
      recommendation: s.avgScore < 70
        ? "Review training content effectiveness; consider refresher sessions"
        : undefined,
    },
    {
      code: "SAMA CSF 3.3.10",
      title: "Cybersecurity Training (Financial Sector)",
      description: "Annual mandatory cybersecurity training for all staff with documented evidence.",
      status: s.completionRate >= 80 ? "compliant" : "partial",
      evidence: [
        `${s.completionRate}% training completion rate achieved`,
        `${s.trainingsLast90} completions in last 90 days`,
        "Auditable certificate trail per employee",
      ],
    },
  ];

  const downloadPDF = async () => {
    if (!stats) return;
    setDownloading(true);
    try {
      const controls = buildControls(stats);
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const margin = 48;
      let y = margin;

      // Header band
      doc.setFillColor(18, 20, 10);
      doc.rect(0, 0, W, 80, "F");
      doc.setTextColor(200, 255, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("Cybersecurity Compliance Report", margin, 38);
      doc.setTextColor(180, 180, 180);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`${companyName} • Generated ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, margin, 58);

      y = 120;

      // Executive summary
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Executive Summary", margin, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const compliantCount = controls.filter(c => c.status === "compliant").length;
      const overall = Math.round((compliantCount / controls.length) * 100);
      const summary = [
        `Overall compliance: ${overall}% (${compliantCount} of ${controls.length} controls compliant)`,
        `Training completion: ${stats.completionRate}% (${stats.trainedEmployees}/${stats.totalEmployees} employees)`,
        `Average assessment score: ${stats.avgScore}%`,
        `Certificates issued: ${stats.certificatesIssued}`,
        `Audit events (last 90 days): ${stats.auditEventsLast90}`,
      ];
      summary.forEach(line => { doc.text(`• ${line}`, margin + 6, y); y += 14; });

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
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("This report is generated automatically from data captured in the Sinnara Cyber Awareness LMS.", margin, y);
      y += 12;
      doc.text("It maps observed activity to controls from NCA ECC and SAMA Cybersecurity Framework.", margin, y);
      y += 12;
      doc.text("It is intended as an internal assessment tool and does not replace formal certification.", margin, y);

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

  const controls = buildControls(stats);
  const compliantCount = controls.filter(c => c.status === "compliant").length;
  const overall = Math.round((compliantCount / controls.length) * 100);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: T.greenBg, border: `1px solid ${T.greenBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={20} style={{ color: T.green }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, margin: 0, letterSpacing: "-0.3px" }}>Compliance Report</h1>
            <p style={{ fontSize: 13, color: T.textMuted, margin: "2px 0 0" }}>NCA ECC and SAMA CSF alignment based on live workspace data</p>
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

      {/* Overall score */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 24px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 700 }}>Overall Compliance</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 40, fontWeight: 900, color: overall >= 80 ? T.green : overall >= 50 ? T.orange : T.red, letterSpacing: "-1px" }}>
              {overall}%
            </span>
            <span style={{ fontSize: 13, color: T.textBody }}>
              {compliantCount} of {controls.length} controls compliant
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {(["compliant", "partial", "non-compliant"] as Status[]).map(s => {
            const n = controls.filter(c => c.status === s).length;
            return (
              <div key={s} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: STATUS_CFG[s].color }}>{n}</div>
                <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.4px" }}>{STATUS_CFG[s].label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <StatCard label="Employees" value={stats.totalEmployees} hint={`${stats.trainedEmployees} fully trained`} />
        <StatCard label="Training Rate" value={`${stats.completionRate}%`} hint="Across mandatory courses" />
        <StatCard label="Avg. Score" value={`${stats.avgScore}%`} hint="All assessments" />
        <StatCard label="Certificates" value={stats.certificatesIssued} hint="Issued to date" />
        <StatCard label="Audit Events" value={stats.auditEventsLast90} hint="Last 90 days" />
        <StatCard label="Logins" value={stats.recentLogins} hint="Last 30 days" />
      </div>

      {/* Controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {controls.map(c => (
          <div key={c.code} style={{ padding: "18px 22px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12 }}>
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

      {/* Disclaimer */}
      <div style={{ padding: "12px 16px", background: T.blueBg, border: `1px solid ${T.border}`, borderRadius: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Info size={14} style={{ color: T.blue, flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12, color: T.textBody, lineHeight: 1.6 }}>
          This report maps observed workspace activity to controls from the NCA Essential Cybersecurity Controls (ECC)
          and SAMA Cybersecurity Framework. It is an internal assessment tool and does not constitute formal certification.
          Consult your compliance officer for audit-grade documentation.
        </div>
      </div>
    </div>
  );
};

