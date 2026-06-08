/**
 * complianceFrameworks — structured, evidence-based compliance READINESS model
 * for ISO/IEC 27001:2022, NCA ECC 2-2024, and SAMA CSF.
 *
 * IMPORTANT FRAMING (do not weaken):
 *   This module produces READINESS indicators and AUDIT EVIDENCE mapped to
 *   selected controls. It is NOT a certification, regulatory approval, or legal
 *   assurance. Control codes reference the public framework structure; exact
 *   sub-control wording should always be verified against the official source
 *   for an audit. Each control carries a disclaimer to that effect.
 *
 * Scoring (readiness, not a compliant-count):
 *   COMPLIANT = 100, PARTIAL = 50, NON_COMPLIANT = 0.
 *   NOT_ASSESSED is EXCLUDED from the score (shown separately) so missing
 *   evidence never silently inflates or deflates readiness.
 */

export type ControlStatus = "COMPLIANT" | "PARTIAL" | "NON_COMPLIANT" | "NOT_ASSESSED";
export type FrameworkId = "ISO_27001_2022" | "NCA_ECC_2_2024" | "SAMA_CSF";

export const FRAMEWORK_NAMES: Record<FrameworkId, string> = {
  ISO_27001_2022: "ISO/IEC 27001:2022",
  NCA_ECC_2_2024: "NCA ECC 2-2024",
  SAMA_CSF: "SAMA Cyber Security Framework",
};

export const STANDARD_DISCLAIMER =
  "This report is generated from platform activity and is intended to support internal compliance readiness and audit evidence. It does not constitute certification, regulatory approval, or legal assurance.";

const CONTROL_DISCLAIMER =
  "Readiness indicator only. Verify exact control wording against the official framework for audit use.";

/** Aggregated signals the readiness model consumes. */
export interface ComplianceSignals {
  totalEmployees: number;
  trainedEmployees: number;
  completionRate: number; // %
  trainingsLast90: number;
  avgScore: number; // %, best-per-employee
  hasAssessmentData: boolean;
  certificatesIssued: number;
  auditEventsLast90: number;
  policyAcknowledged?: number | null; // null/undefined → NOT_ASSESSED
  // Phishing evidence (deduplicated where applicable)
  phishingCampaigns: number;
  phishingTargeted: number;
  phishingSent: number;
  phishingClicked: number;
  phishingSubmitted: number;
  phishingReported: number;
  phishingSusceptibilityRate: number; // % of targeted users
  phishingReportRate: number; // % of targeted users
}

export interface ControlEvidence {
  id: string;
  frameworkId: FrameworkId;
  frameworkName: string;
  controlCode: string;
  controlTitle: string;
  controlObjective: string;
  evidenceType: string;
  dataSignals: string[];
  status: ControlStatus;
  score: number; // 0 | 50 | 100 (meaningless when NOT_ASSESSED — excluded from totals)
  evidence: string[];
  recommendation: string;
  disclaimer: string;
}

export function statusToScore(status: ControlStatus): number {
  switch (status) {
    case "COMPLIANT": return 100;
    case "PARTIAL": return 50;
    case "NON_COMPLIANT": return 0;
    default: return 0;
  }
}

/** Threshold helper → status (with a NOT_ASSESSED escape when evidence is absent). */
function band(value: number, good: number, partial: number, assessed: boolean): ControlStatus {
  if (!assessed) return "NOT_ASSESSED";
  if (value >= good) return "COMPLIANT";
  if (value >= partial) return "PARTIAL";
  return "NON_COMPLIANT";
}

/** Lower-is-better band (e.g. susceptibility): below `good` is best. */
function bandInverse(value: number, good: number, partial: number, assessed: boolean): ControlStatus {
  if (!assessed) return "NOT_ASSESSED";
  if (value <= good) return "COMPLIANT";
  if (value <= partial) return "PARTIAL";
  return "NON_COMPLIANT";
}

function control(
  c: Omit<ControlEvidence, "frameworkName" | "score" | "disclaimer"> & { disclaimer?: string },
): ControlEvidence {
  return {
    ...c,
    frameworkName: FRAMEWORK_NAMES[c.frameworkId],
    score: statusToScore(c.status),
    disclaimer: c.disclaimer ?? CONTROL_DISCLAIMER,
  };
}

/**
 * Build the full evidence-mapped control set across all three frameworks from
 * the supplied signals. Phishing controls use ACTUAL campaign evidence, not
 * merely "training completed".
 */
export function buildComplianceControls(s: ComplianceSignals): ControlEvidence[] {
  const hasEmployees = s.totalEmployees > 0;
  const hasPhishing = s.phishingCampaigns > 0 && s.phishingTargeted > 0;
  const recentTrainingPct = hasEmployees ? Math.round((s.trainingsLast90 / s.totalEmployees) * 100) : 0;

  const trainingStatus = band(s.completionRate, 90, 60, hasEmployees);
  const recentStatus = band(recentTrainingPct, 50, 1, hasEmployees);
  const assessmentStatus = band(s.avgScore, 70, 50, s.hasAssessmentData);
  const phishingResilience = bandInverse(s.phishingSusceptibilityRate, 10, 30, hasPhishing);
  const reportingStatus = band(s.phishingReportRate, 50, 15, hasPhishing);
  const policyStatus: ControlStatus = s.policyAcknowledged == null
    ? "NOT_ASSESSED"
    : band(hasEmployees ? Math.round((s.policyAcknowledged / s.totalEmployees) * 100) : 0, 90, 60, hasEmployees);
  const auditStatus: ControlStatus = s.auditEventsLast90 > 0 ? "COMPLIANT" : (hasEmployees ? "PARTIAL" : "NOT_ASSESSED");

  const trainingEvidence = [
    `${s.trainedEmployees} of ${s.totalEmployees} employees completed mandatory training (${s.completionRate}%)`,
    `${s.trainingsLast90} training completion(s) in the last 90 days (${recentTrainingPct}% of staff)`,
    `${s.certificatesIssued} certificate(s) of completion issued`,
  ];
  const phishingEvidence = hasPhishing
    ? [
        `${s.phishingCampaigns} phishing simulation campaign(s); ${s.phishingTargeted} users targeted, ${s.phishingSent} delivered`,
        `${s.phishingSusceptibilityRate}% susceptibility (clicked or submitted), ${s.phishingSubmitted} credential submission(s)`,
        `${s.phishingReportRate}% of targeted users reported the simulated phish`,
      ]
    : ["No phishing simulation campaigns have been run yet — phishing resilience is unassessed."];

  return [
    // ─────────── ISO/IEC 27001:2022 ───────────
    control({
      id: "iso-a6.3",
      frameworkId: "ISO_27001_2022",
      controlCode: "A.6.3",
      controlTitle: "Information security awareness, education and training",
      controlObjective: "Personnel receive appropriate awareness education and training and regular updates of policies and procedures relevant to their role.",
      evidenceType: "Training completion & certificates",
      dataSignals: ["completionRate", "trainingsLast90", "certificatesIssued"],
      status: trainingStatus,
      evidence: trainingEvidence,
      recommendation: trainingStatus === "COMPLIANT"
        ? "Maintain the annual training cycle and keep certificate evidence current."
        : `Assign the remaining ${Math.max(0, s.totalEmployees - s.trainedEmployees)} employee(s) to mandatory training.`,
    }),
    control({
      id: "iso-9.1",
      frameworkId: "ISO_27001_2022",
      controlCode: "9.1",
      controlTitle: "Monitoring, measurement, analysis and evaluation",
      controlObjective: "The effectiveness of awareness controls is measured. Simulated phishing provides objective measurement of human-layer risk.",
      evidenceType: "Phishing simulation metrics",
      dataSignals: ["phishingSusceptibilityRate", "phishingReportRate"],
      status: phishingResilience,
      evidence: phishingEvidence,
      recommendation: hasPhishing
        ? (phishingResilience === "COMPLIANT" ? "Sustain quarterly simulations to keep susceptibility low." : "Increase simulation frequency and target repeat clickers with focused training.")
        : "Run a baseline phishing simulation to establish a measurable human-risk metric.",
    }),
    control({
      id: "iso-9.2",
      frameworkId: "ISO_27001_2022",
      controlCode: "9.2",
      controlTitle: "Internal audit (evidence trail)",
      controlObjective: "Activity is logged to support internal audit of the awareness programme.",
      evidenceType: "Audit logs",
      dataSignals: ["auditEventsLast90"],
      status: auditStatus,
      evidence: [`${s.auditEventsLast90} audit event(s) recorded in the last 90 days.`],
      recommendation: auditStatus === "COMPLIANT" ? "Retain audit logs per your retention policy." : "Ensure platform audit logging is enabled and retained.",
    }),
    control({
      id: "iso-a5.1",
      frameworkId: "ISO_27001_2022",
      controlCode: "A.5.1",
      controlTitle: "Policies for information security (acknowledgement)",
      controlObjective: "Personnel acknowledge information security policies relevant to their role.",
      evidenceType: "Policy acknowledgement logs",
      dataSignals: ["policyAcknowledged"],
      status: policyStatus,
      evidence: s.policyAcknowledged == null
        ? ["Policy acknowledgement tracking is not yet configured on the platform."]
        : [`${s.policyAcknowledged} of ${s.totalEmployees} employees acknowledged security policies.`],
      recommendation: s.policyAcknowledged == null
        ? "Enable policy acknowledgement to capture this evidence."
        : "Follow up with employees who have not yet acknowledged policies.",
    }),
    control({
      id: "iso-10.1",
      frameworkId: "ISO_27001_2022",
      controlCode: "10.1",
      controlTitle: "Continual improvement",
      controlObjective: "Assessment performance and simulation trends are used to improve the awareness programme.",
      evidenceType: "Assessment scores & trend",
      dataSignals: ["avgScore", "hasAssessmentData"],
      status: assessmentStatus,
      evidence: s.hasAssessmentData
        ? [`Average best assessment score: ${s.avgScore}%.`]
        : ["No assessment results recorded yet."],
      recommendation: assessmentStatus === "COMPLIANT"
        ? "Continue refreshing assessment content periodically."
        : "Review training content effectiveness; schedule refresher assessments.",
    }),

    // ─────────── NCA ECC 2-2024 ───────────
    control({
      id: "ecc-1-10-program",
      frameworkId: "NCA_ECC_2_2024",
      controlCode: "1-10",
      controlTitle: "Cybersecurity Awareness and Training Program",
      controlObjective: "A documented cybersecurity awareness and training program is implemented for all personnel.",
      evidenceType: "Training completion & recency",
      dataSignals: ["completionRate", "trainingsLast90"],
      status: trainingStatus === "NOT_ASSESSED" ? "NOT_ASSESSED" : (recentStatus === "NON_COMPLIANT" ? "PARTIAL" : trainingStatus),
      evidence: trainingEvidence,
      recommendation: trainingStatus === "COMPLIANT"
        ? "Maintain documented annual awareness training with completion evidence."
        : "Raise training completion and ensure recurring (at least annual) delivery.",
    }),
    control({
      id: "ecc-1-10-phishing",
      frameworkId: "NCA_ECC_2_2024",
      controlCode: "1-10",
      controlTitle: "Awareness Program Effectiveness — Simulated Phishing",
      controlObjective: "The effectiveness of the awareness program is evaluated, including the ability of personnel to recognise and report phishing.",
      evidenceType: "Phishing simulation evidence",
      dataSignals: ["phishingSusceptibilityRate", "phishingReportRate"],
      status: phishingResilience,
      evidence: phishingEvidence,
      recommendation: hasPhishing
        ? "Track susceptibility and reporting trends across recurring simulations."
        : "Run periodic phishing simulations to evidence program effectiveness.",
    }),

    // ─────────── SAMA CSF ───────────
    control({
      id: "sama-3.1.6",
      frameworkId: "SAMA_CSF",
      controlCode: "3.1.6",
      controlTitle: "Cyber Security Awareness",
      controlObjective: "A cyber security awareness program raises staff awareness, evidenced by participation and simulated-phishing resilience.",
      evidenceType: "Awareness participation & phishing resilience",
      dataSignals: ["completionRate", "phishingSusceptibilityRate", "phishingReportRate"],
      status: hasPhishing ? phishingResilience : trainingStatus,
      evidence: [...trainingEvidence.slice(0, 1), ...phishingEvidence],
      recommendation: hasPhishing && phishingResilience !== "COMPLIANT"
        ? "Reduce susceptibility through targeted follow-up training for repeat clickers."
        : "Sustain awareness communications and simulations.",
    }),
    control({
      id: "sama-3.1.7",
      frameworkId: "SAMA_CSF",
      controlCode: "3.1.7",
      controlTitle: "Cyber Security Training",
      controlObjective: "Role-appropriate cyber security training is delivered and its outcomes are measured.",
      evidenceType: "Training completion & assessment",
      dataSignals: ["completionRate", "avgScore"],
      status: trainingStatus === "NOT_ASSESSED" ? "NOT_ASSESSED"
        : (assessmentStatus === "NON_COMPLIANT" && s.hasAssessmentData ? "PARTIAL" : trainingStatus),
      evidence: [
        ...trainingEvidence,
        s.hasAssessmentData ? `Average assessment score: ${s.avgScore}%.` : "No assessment results recorded yet.",
      ],
      recommendation: trainingStatus === "COMPLIANT"
        ? "Maintain documented training with measurable assessment outcomes."
        : "Increase completion and capture assessment outcomes as evidence.",
    }),

    // Cross-framework reporting culture (kept under SAMA awareness)
    control({
      id: "sama-reporting",
      frameworkId: "SAMA_CSF",
      controlCode: "3.1.6",
      controlTitle: "Incident Reporting Culture",
      controlObjective: "Personnel report suspected phishing, evidencing a healthy reporting culture.",
      evidenceType: "Phishing report rate",
      dataSignals: ["phishingReportRate"],
      status: reportingStatus,
      evidence: hasPhishing
        ? [`${s.phishingReportRate}% of targeted users reported the simulated phishing email.`]
        : ["No simulation data to evidence reporting behaviour yet."],
      recommendation: hasPhishing && reportingStatus !== "COMPLIANT"
        ? "Promote the report button and recognise employees who report."
        : "Maintain easy reporting channels and positive reinforcement.",
    }),
  ];
}

export interface FrameworkScore {
  frameworkId: FrameworkId;
  frameworkName: string;
  score: number; // 0–100 readiness (excludes NOT_ASSESSED)
  assessedControls: number;
  notAssessedControls: number;
  totalControls: number;
}

/** Readiness score for one framework: mean of assessed control scores. */
export function scoreFramework(controls: ControlEvidence[], frameworkId: FrameworkId): FrameworkScore {
  const all = controls.filter((c) => c.frameworkId === frameworkId);
  const assessed = all.filter((c) => c.status !== "NOT_ASSESSED");
  const score = assessed.length
    ? Math.round(assessed.reduce((sum, c) => sum + c.score, 0) / assessed.length)
    : 0;
  return {
    frameworkId,
    frameworkName: FRAMEWORK_NAMES[frameworkId],
    score,
    assessedControls: assessed.length,
    notAssessedControls: all.length - assessed.length,
    totalControls: all.length,
  };
}

/** Overall readiness across all assessed controls (every framework). */
export function overallReadiness(controls: ControlEvidence[]): number {
  const assessed = controls.filter((c) => c.status !== "NOT_ASSESSED");
  if (!assessed.length) return 0;
  return Math.round(assessed.reduce((sum, c) => sum + c.score, 0) / assessed.length);
}

export function allFrameworkScores(controls: ControlEvidence[]): FrameworkScore[] {
  return (Object.keys(FRAMEWORK_NAMES) as FrameworkId[]).map((id) => scoreFramework(controls, id));
}
