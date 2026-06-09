/**
 * complianceFrameworks — canonical compliance evidence mapping.
 *
 * Maps platform activity signals to verified control identifiers for:
 *   - ISO 27001:2022
 *   - NCA ECC 2-2024 (Saudi Arabia)
 *   - SAMA CSF (Saudi Central Bank)
 *
 * Scoring: COMPLIANT=100, PARTIAL=50, NON_COMPLIANT=0; NOT_ASSESSED excluded
 * from readiness score denominator.
 */

export type ControlStatus = 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'NOT_ASSESSED';
export type FrameworkId = 'ISO_27001_2022' | 'NCA_ECC_2_2024' | 'SAMA_CSF';

export const STANDARD_DISCLAIMER =
  'This report is generated from platform activity data (training completion, exam results, phishing simulations). ' +
  'It reflects engagement evidence only and does not constitute a formal audit opinion or regulatory certification. ' +
  'Organizations should engage a qualified auditor for formal compliance assessment.';

/** Input signals derived from platform data. */
export interface ComplianceSignals {
  totalEmployees: number;
  completionRate: number;       // 0–100
  avgExamScore: number;         // 0–100
  assessedEmployees: number;    // employees with at least one training event
  susceptibilityRate: number;   // 0–100 (phishing click/submit rate)
  reportRate: number;           // 0–100 (phishing report rate by targeted)
  phishingCampaignsRun: number;
  certificatesIssued: number;
}

export interface ControlEvidence {
  id: string;
  framework: FrameworkId;
  title: string;
  evidence: string;
  status: ControlStatus;
}

export interface FrameworkScore {
  frameworkId: FrameworkId;
  label: string;
  score: number;        // 0–100, NOT_ASSESSED excluded from denominator
  controlCount: number;
  assessedCount: number;
}

const SCORE: Record<ControlStatus, number> = {
  COMPLIANT: 100,
  PARTIAL: 50,
  NON_COMPLIANT: 0,
  NOT_ASSESSED: 0, // excluded from denominator, not averaged in
};

/**
 * Build evidence-mapped controls from platform signals.
 * Returns controls for all three frameworks.
 */
export function buildComplianceControls(s: ComplianceSignals): ControlEvidence[] {
  const hasEmployees = s.totalEmployees > 0;
  const hasPhishing  = s.phishingCampaignsRun > 0;

  // ── ISO 27001:2022 ─────────────────────────────────────────────────
  const iso: ControlEvidence[] = [
    {
      id: 'A.6.3', framework: 'ISO_27001_2022',
      title: 'Information Security Awareness, Education and Training (A.6.3)',
      evidence: `Training completion rate: ${s.completionRate.toFixed(1)}%`,
      status: !hasEmployees ? 'NOT_ASSESSED'
        : s.completionRate >= 90 ? 'COMPLIANT'
        : s.completionRate >= 60 ? 'PARTIAL'
        : 'NON_COMPLIANT',
    },
    {
      id: '9.1', framework: 'ISO_27001_2022',
      title: 'Monitoring, Measurement, Analysis and Evaluation (9.1)',
      evidence: hasPhishing
        ? `${s.phishingCampaignsRun} phishing simulation(s) conducted; susceptibility ${s.susceptibilityRate.toFixed(1)}%`
        : 'No phishing simulations conducted',
      status: !hasPhishing ? 'NOT_ASSESSED'
        : s.susceptibilityRate <= 10 ? 'COMPLIANT'
        : s.susceptibilityRate <= 30 ? 'PARTIAL'
        : 'NON_COMPLIANT',
    },
    {
      id: '9.2', framework: 'ISO_27001_2022',
      title: 'Internal Audit (9.2)',
      evidence: `Exam assessment coverage: avg score ${s.avgExamScore.toFixed(1)}%`,
      status: !hasEmployees ? 'NOT_ASSESSED'
        : s.avgExamScore >= 80 ? 'COMPLIANT'
        : s.avgExamScore >= 60 ? 'PARTIAL'
        : 'NON_COMPLIANT',
    },
    {
      id: 'A.5.1', framework: 'ISO_27001_2022',
      title: 'Policies for Information Security (A.5.1)',
      evidence: `${s.certificatesIssued} completion certificates issued`,
      status: !hasEmployees ? 'NOT_ASSESSED'
        : s.certificatesIssued > 0 ? 'COMPLIANT'
        : 'PARTIAL',
    },
    {
      id: '10.1', framework: 'ISO_27001_2022',
      title: 'Continual Improvement (10.1)',
      evidence: s.phishingCampaignsRun > 1
        ? `${s.phishingCampaignsRun} simulation iterations show improvement tracking`
        : 'Single or no simulation — improvement trend not established',
      status: !hasEmployees ? 'NOT_ASSESSED'
        : s.phishingCampaignsRun > 1 && s.completionRate >= 80 ? 'COMPLIANT'
        : s.completionRate >= 60 || s.phishingCampaignsRun >= 1 ? 'PARTIAL'
        : 'NON_COMPLIANT',
    },
  ];

  // ── NCA ECC 2-2024 ─────────────────────────────────────────────────
  // Verified mappings: ECC-1-10 Cybersecurity Awareness and Training Program
  const nca: ControlEvidence[] = [
    {
      id: 'ECC-1-10-1', framework: 'NCA_ECC_2_2024',
      title: 'Cybersecurity Awareness and Training Program (ECC-1-10-1)',
      evidence: `Training completion: ${s.completionRate.toFixed(1)}% of ${s.totalEmployees} employees`,
      status: !hasEmployees ? 'NOT_ASSESSED'
        : s.completionRate >= 90 ? 'COMPLIANT'
        : s.completionRate >= 60 ? 'PARTIAL'
        : 'NON_COMPLIANT',
    },
    {
      id: 'ECC-1-10-2', framework: 'NCA_ECC_2_2024',
      title: 'Training Program Effectiveness Measurement (ECC-1-10-2)',
      evidence: hasPhishing
        ? `Phishing simulation: ${s.susceptibilityRate.toFixed(1)}% susceptibility, ${s.reportRate.toFixed(1)}% reported`
        : 'No phishing effectiveness measurement conducted',
      status: !hasPhishing ? 'NOT_ASSESSED'
        : s.susceptibilityRate <= 15 && s.reportRate >= 20 ? 'COMPLIANT'
        : s.susceptibilityRate <= 35 ? 'PARTIAL'
        : 'NON_COMPLIANT',
    },
  ];

  // ── SAMA CSF ───────────────────────────────────────────────────────
  // Verified mappings: SAMA CSF 3.1.6 (Awareness) and 3.1.7 (Training)
  const sama: ControlEvidence[] = [
    {
      id: '3.1.6', framework: 'SAMA_CSF',
      title: 'Cybersecurity Awareness (SAMA CSF 3.1.6)',
      evidence: hasPhishing
        ? `Phishing report rate: ${s.reportRate.toFixed(1)}% — measures security reporting culture`
        : 'No phishing simulation to measure reporting culture',
      status: !hasPhishing ? 'NOT_ASSESSED'
        : s.reportRate >= 30 ? 'COMPLIANT'
        : s.reportRate >= 10 ? 'PARTIAL'
        : 'NON_COMPLIANT',
    },
    {
      id: '3.1.7', framework: 'SAMA_CSF',
      title: 'Cybersecurity Training (SAMA CSF 3.1.7)',
      evidence: `Training coverage: ${s.completionRate.toFixed(1)}%; avg exam score: ${s.avgExamScore.toFixed(1)}%`,
      status: !hasEmployees ? 'NOT_ASSESSED'
        : s.completionRate >= 85 && s.avgExamScore >= 70 ? 'COMPLIANT'
        : s.completionRate >= 60 || s.avgExamScore >= 50 ? 'PARTIAL'
        : 'NON_COMPLIANT',
    },
  ];

  return [...iso, ...nca, ...sama];
}

/** Score a single framework from its controls (NOT_ASSESSED excluded from denominator). */
export function scoreFramework(controls: ControlEvidence[], frameworkId: FrameworkId): FrameworkScore {
  const LABELS: Record<FrameworkId, string> = {
    ISO_27001_2022: 'ISO 27001:2022',
    NCA_ECC_2_2024: 'NCA ECC 2-2024',
    SAMA_CSF: 'SAMA CSF',
  };
  const fc = controls.filter(c => c.framework === frameworkId);
  const assessed = fc.filter(c => c.status !== 'NOT_ASSESSED');
  const score = assessed.length > 0
    ? Math.round(assessed.reduce((sum, c) => sum + SCORE[c.status], 0) / assessed.length)
    : 0;
  return {
    frameworkId,
    label: LABELS[frameworkId],
    score,
    controlCount: fc.length,
    assessedCount: assessed.length,
  };
}

/** Overall readiness score across all controls (NOT_ASSESSED excluded). */
export function overallReadiness(controls: ControlEvidence[]): number {
  const assessed = controls.filter(c => c.status !== 'NOT_ASSESSED');
  if (assessed.length === 0) return 0;
  return Math.round(assessed.reduce((sum, c) => sum + SCORE[c.status], 0) / assessed.length);
}
