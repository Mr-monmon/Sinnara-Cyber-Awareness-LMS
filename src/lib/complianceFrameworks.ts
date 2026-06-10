export type ComplianceStatus = "compliant" | "partial" | "non-compliant";

export interface ComplianceControl {
  code: string;
  title: string;
  description: string;
  status: ComplianceStatus;
  evidence: string[];
  recommendation?: string;
}

export interface ComplianceStats {
  totalEmployees: number;
  trainedEmployees: number;
  completionRate: number;
  avgScore: number;
  certificatesIssued: number;
  recentLogins: number;
  auditEventsLast90: number;
  trainingsLast90: number;
  // Real phishing campaign data
  phishingCampaignsRun: number;
  phishingEmployeesTargeted: number;
  phishingClicked: number;
  phishingReported: number;
}

export function buildControls(s: ComplianceStats): ComplianceControl[] {
  const phishingCoverage =
    s.totalEmployees > 0
      ? Math.round((s.phishingEmployeesTargeted / s.totalEmployees) * 100)
      : 0;

  const phishingStatus: ComplianceStatus =
    s.phishingCampaignsRun >= 1 && phishingCoverage >= 50
      ? "compliant"
      : s.phishingCampaignsRun >= 1
      ? "partial"
      : "non-compliant";

  return [
    {
      code: "ECC 1-5-1",
      title: "Cybersecurity Awareness Training",
      description:
        "All employees shall be trained on cybersecurity policies, threats, and best practices.",
      status:
        s.completionRate >= 90
          ? "compliant"
          : s.completionRate >= 60
          ? "partial"
          : "non-compliant",
      evidence: [
        `${s.trainedEmployees} of ${s.totalEmployees} employees completed mandatory training (${s.completionRate}%)`,
        `${s.certificatesIssued} certificate${s.certificatesIssued === 1 ? "" : "s"} issued`,
        `${s.trainingsLast90} training completions logged in the last 90 days`,
      ],
      recommendation:
        s.completionRate < 90
          ? `Assign remaining ${s.totalEmployees - s.trainedEmployees} employees to mandatory training`
          : undefined,
    },
    {
      code: "ECC 2-13-3",
      title: "Phishing Awareness and Protection",
      description:
        "Employees shall be trained to recognize and resist phishing attacks through regular simulation campaigns.",
      status: phishingStatus,
      evidence: [
        `${s.phishingCampaignsRun} phishing simulation campaign${s.phishingCampaignsRun === 1 ? "" : "s"} conducted`,
        `${s.phishingEmployeesTargeted} employee${s.phishingEmployeesTargeted === 1 ? "" : "s"} targeted (${phishingCoverage}% workforce coverage)`,
        `${s.phishingReported} phishing email${s.phishingReported === 1 ? "" : "s"} reported by employees`,
        `${s.phishingClicked} click${s.phishingClicked === 1 ? "" : "s"} recorded (lower is better)`,
      ],
      recommendation:
        phishingStatus === "non-compliant"
          ? "Launch a phishing simulation campaign to meet this control"
          : phishingStatus === "partial"
          ? `Expand campaigns to cover at least 50% of employees (currently ${phishingCoverage}%)`
          : undefined,
    },
    {
      code: "ECC 4-1-2",
      title: "Cybersecurity Awareness Programme",
      description:
        "An ongoing programme to maintain employee cyber awareness through assessments and continuous learning.",
      status: s.avgScore >= 70 ? "compliant" : "partial",
      evidence: [
        `Average assessment score: ${s.avgScore}%`,
        `${s.certificatesIssued} certificate${s.certificatesIssued === 1 ? "" : "s"} of completion issued`,
        "Continuous awareness content delivered through dashboard tips and fraud alerts",
      ],
      recommendation:
        s.avgScore < 70
          ? "Review training content effectiveness; consider refresher sessions"
          : undefined,
    },
    {
      code: "SAMA CSF 3.3.10",
      title: "Cybersecurity Training (Financial Sector)",
      description:
        "Annual mandatory cybersecurity training for all staff with documented evidence.",
      status: s.completionRate >= 80 ? "compliant" : "partial",
      evidence: [
        `${s.completionRate}% training completion rate achieved`,
        `${s.trainingsLast90} completions in last 90 days`,
        "Auditable certificate trail per employee",
      ],
    },
  ];
}
