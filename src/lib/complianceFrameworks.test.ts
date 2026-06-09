import { describe, it, expect } from 'vitest';
import {
  buildComplianceControls,
  scoreFramework,
  overallReadiness,
  type ComplianceSignals,
} from './complianceFrameworks';

const defaultSignals: ComplianceSignals = {
  totalEmployees: 100,
  completionRate: 90,
  avgExamScore: 85,
  assessedEmployees: 90,
  susceptibilityRate: 10,
  reportRate: 25,
  phishingCampaignsRun: 2,
  certificatesIssued: 80,
};

describe('buildComplianceControls — verified control IDs present', () => {
  it('includes ISO 27001:2022 A.6.3, 9.1, 9.2, A.5.1, 10.1', () => {
    const controls = buildComplianceControls(defaultSignals);
    const isoIds = controls.filter(c => c.framework === 'ISO_27001_2022').map(c => c.id);
    expect(isoIds).toContain('A.6.3');
    expect(isoIds).toContain('9.1');
    expect(isoIds).toContain('9.2');
    expect(isoIds).toContain('A.5.1');
    expect(isoIds).toContain('10.1');
  });

  it('includes NCA ECC-1-10-1 and ECC-1-10-2 (not ECC 1-5-1 or 2-13-3)', () => {
    const controls = buildComplianceControls(defaultSignals);
    const ncaIds = controls.filter(c => c.framework === 'NCA_ECC_2_2024').map(c => c.id);
    expect(ncaIds).toContain('ECC-1-10-1');
    expect(ncaIds).toContain('ECC-1-10-2');
    expect(ncaIds).not.toContain('ECC-1-5-1');
    expect(ncaIds).not.toContain('ECC-2-13-3');
    expect(ncaIds).not.toContain('ECC-4-1-2');
  });

  it('includes SAMA CSF 3.1.6 and 3.1.7 (not 3.3.10)', () => {
    const controls = buildComplianceControls(defaultSignals);
    const samaIds = controls.filter(c => c.framework === 'SAMA_CSF').map(c => c.id);
    expect(samaIds).toContain('3.1.6');
    expect(samaIds).toContain('3.1.7');
    expect(samaIds).not.toContain('3.3.10');
  });
});

describe('buildComplianceControls — status logic', () => {
  it('zero employees → all training controls NOT_ASSESSED', () => {
    const controls = buildComplianceControls({ ...defaultSignals, totalEmployees: 0, assessedEmployees: 0 });
    const trainingControls = controls.filter(c => ['A.6.3', 'ECC-1-10-1', '3.1.7'].includes(c.id));
    trainingControls.forEach(c => expect(c.status).toBe('NOT_ASSESSED'));
  });

  it('no phishing campaigns → simulation controls NOT_ASSESSED', () => {
    const controls = buildComplianceControls({ ...defaultSignals, phishingCampaignsRun: 0 });
    const phishingControls = controls.filter(c => ['9.1', 'ECC-1-10-2', '3.1.6'].includes(c.id));
    phishingControls.forEach(c => expect(c.status).toBe('NOT_ASSESSED'));
  });

  it('high completion + good phishing → mostly COMPLIANT', () => {
    const controls = buildComplianceControls(defaultSignals);
    const compliant = controls.filter(c => c.status === 'COMPLIANT');
    expect(compliant.length).toBeGreaterThan(3);
  });

  it('high susceptibility rate → phishing control NON_COMPLIANT or PARTIAL', () => {
    const controls = buildComplianceControls({ ...defaultSignals, susceptibilityRate: 60 });
    const phishingCtrl = controls.find(c => c.id === '9.1');
    expect(['NON_COMPLIANT', 'PARTIAL']).toContain(phishingCtrl?.status);
  });

  it('70% completion → PARTIAL for training controls', () => {
    const controls = buildComplianceControls({ ...defaultSignals, completionRate: 70 });
    const a63 = controls.find(c => c.id === 'A.6.3');
    expect(a63?.status).toBe('PARTIAL');
  });

  it('distinct statuses: high training + bad phishing → different controls can differ', () => {
    const controls = buildComplianceControls({
      ...defaultSignals,
      completionRate: 95,
      susceptibilityRate: 65,
    });
    const a63 = controls.find(c => c.id === 'A.6.3');
    const iso91 = controls.find(c => c.id === '9.1');
    expect(a63?.status).toBe('COMPLIANT');
    expect(iso91?.status).toBe('NON_COMPLIANT');
  });
});

describe('scoreFramework', () => {
  it('excludes NOT_ASSESSED from denominator', () => {
    const controls = buildComplianceControls({ ...defaultSignals, totalEmployees: 0, phishingCampaignsRun: 0 });
    const score = scoreFramework(controls, 'ISO_27001_2022');
    // All controls are NOT_ASSESSED → assessedCount=0 → score=0 (no division by zero)
    expect(score.score).toBe(0);
    expect(score.assessedCount).toBe(0);
  });

  it('returns 0–100 for all frameworks', () => {
    const controls = buildComplianceControls(defaultSignals);
    (['ISO_27001_2022', 'NCA_ECC_2_2024', 'SAMA_CSF'] as const).forEach(f => {
      const s = scoreFramework(controls, f);
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    });
  });
});

describe('overallReadiness', () => {
  it('returns 0 for empty controls', () => {
    expect(overallReadiness([])).toBe(0);
  });

  it('excludes NOT_ASSESSED from calculation', () => {
    const controls = buildComplianceControls({ ...defaultSignals, phishingCampaignsRun: 0 });
    const allNA = controls.every(c => c.status === 'NOT_ASSESSED');
    if (!allNA) {
      const score = overallReadiness(controls);
      expect(score).toBeGreaterThan(0);
    }
  });
});
