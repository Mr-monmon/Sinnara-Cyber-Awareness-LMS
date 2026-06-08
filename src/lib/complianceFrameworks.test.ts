import { describe, it, expect } from "vitest";
import {
  buildComplianceControls,
  scoreFramework,
  overallReadiness,
  statusToScore,
  type ComplianceSignals,
} from "./complianceFrameworks";

const base: ComplianceSignals = {
  totalEmployees: 100,
  trainedEmployees: 95,
  completionRate: 95,
  trainingsLast90: 80,
  avgScore: 85,
  hasAssessmentData: true,
  certificatesIssued: 95,
  auditEventsLast90: 500,
  policyAcknowledged: null,
  phishingCampaigns: 2,
  phishingTargeted: 100,
  phishingSent: 100,
  phishingClicked: 8,
  phishingSubmitted: 2,
  phishingReported: 60,
  phishingSusceptibilityRate: 8,
  phishingReportRate: 60,
};

describe("statusToScore", () => {
  it("maps the readiness bands", () => {
    expect(statusToScore("COMPLIANT")).toBe(100);
    expect(statusToScore("PARTIAL")).toBe(50);
    expect(statusToScore("NON_COMPLIANT")).toBe(0);
  });
});

describe("buildComplianceControls", () => {
  it("produces controls for all three frameworks", () => {
    const c = buildComplianceControls(base);
    expect(c.some((x) => x.frameworkId === "ISO_27001_2022")).toBe(true);
    expect(c.some((x) => x.frameworkId === "NCA_ECC_2_2024")).toBe(true);
    expect(c.some((x) => x.frameworkId === "SAMA_CSF")).toBe(true);
  });

  it("does NOT use the removed inaccurate NCA mappings", () => {
    const codes = buildComplianceControls(base).map((c) => c.controlCode);
    expect(codes).not.toContain("ECC 1-5-1");
    expect(codes).not.toContain("ECC 2-13-3");
    expect(codes).not.toContain("ECC 4-1-2");
  });

  it("uses NCA 1-10 and SAMA 3.1.6 / 3.1.7", () => {
    const codes = buildComplianceControls(base).map((c) => c.controlCode);
    expect(codes).toContain("1-10");
    expect(codes).toContain("3.1.6");
    expect(codes).toContain("3.1.7");
  });

  it("every control carries a non-certification disclaimer", () => {
    expect(buildComplianceControls(base).every((c) => c.disclaimer.length > 0)).toBe(true);
  });
});

describe("readiness scoring", () => {
  it("zero employees → training/assessment controls NOT_ASSESSED, excluded from score", () => {
    const c = buildComplianceControls({
      ...base, totalEmployees: 0, trainedEmployees: 0, completionRate: 0,
      trainingsLast90: 0, avgScore: 0, hasAssessmentData: false,
      phishingCampaigns: 0, phishingTargeted: 0, phishingSent: 0,
      phishingClicked: 0, phishingSubmitted: 0, phishingReported: 0,
      phishingSusceptibilityRate: 0, phishingReportRate: 0, auditEventsLast90: 0,
    });
    const iso = scoreFramework(c, "ISO_27001_2022");
    expect(iso.notAssessedControls).toBeGreaterThan(0);
    // No assessed controls anywhere → overall readiness 0 (not NaN).
    expect(Number.isFinite(overallReadiness(c))).toBe(true);
  });

  it("no phishing campaigns → phishing controls NOT_ASSESSED (not low risk)", () => {
    const c = buildComplianceControls({
      ...base, phishingCampaigns: 0, phishingTargeted: 0, phishingSusceptibilityRate: 0,
    });
    const phishingControl = c.find((x) => x.id === "iso-9.1");
    expect(phishingControl?.status).toBe("NOT_ASSESSED");
  });

  it("high training but bad phishing → phishing control NON_COMPLIANT, training COMPLIANT", () => {
    const c = buildComplianceControls({ ...base, phishingSusceptibilityRate: 55 });
    expect(c.find((x) => x.id === "iso-a6.3")?.status).toBe("COMPLIANT");
    expect(c.find((x) => x.id === "iso-9.1")?.status).toBe("NON_COMPLIANT");
  });

  it("low training but good phishing reporting → distinct statuses", () => {
    const c = buildComplianceControls({
      ...base, completionRate: 20, trainedEmployees: 20, trainingsLast90: 5,
      phishingSusceptibilityRate: 5, phishingReportRate: 80,
    });
    expect(c.find((x) => x.id === "iso-a6.3")?.status).toBe("NON_COMPLIANT");
    expect(c.find((x) => x.id === "sama-reporting")?.status).toBe("COMPLIANT");
  });

  it("framework-specific scores are independent and 0–100", () => {
    const c = buildComplianceControls(base);
    for (const id of ["ISO_27001_2022", "NCA_ECC_2_2024", "SAMA_CSF"] as const) {
      const fs = scoreFramework(c, id);
      expect(fs.score).toBeGreaterThanOrEqual(0);
      expect(fs.score).toBeLessThanOrEqual(100);
    }
  });

  it("partial weighting: a PARTIAL control scores 50", () => {
    // completion 70 → PARTIAL on the ISO A.6.3 training control.
    const c = buildComplianceControls({ ...base, completionRate: 70, trainedEmployees: 70 });
    expect(c.find((x) => x.id === "iso-a6.3")?.score).toBe(50);
  });
});
