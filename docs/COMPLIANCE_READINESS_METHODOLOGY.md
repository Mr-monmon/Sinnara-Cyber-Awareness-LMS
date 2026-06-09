# Compliance Readiness Methodology

The Compliance Readiness Report maps **platform activity evidence** (training
completion, exam results, phishing-simulation outcomes, certificates) to specific
controls in three frameworks. It is an **evidence and engagement report**, not a
certification.

> Source of truth: `src/lib/complianceFrameworks.ts` (unit-tested in
> `src/lib/complianceFrameworks.test.ts`, 13 tests). Rendered by
> `src/pages/company-admin/ComplianceReportPage.tsx`.

## Standard disclaimer (shown in-product and in every PDF)

> This report is generated from platform activity data (training completion, exam
> results, phishing simulations). It reflects engagement evidence only and does
> not constitute a formal audit opinion or regulatory certification.
> Organizations should engage a qualified auditor for formal compliance
> assessment.

## Control statuses and scoring

Each control is assigned one of four statuses from the underlying signals:

| Status | Points | Meaning |
|--------|--------|---------|
| `COMPLIANT` | 100 | Evidence meets the strong threshold |
| `PARTIAL` | 50 | Evidence exists but below the strong threshold |
| `NON_COMPLIANT` | 0 | Evidence exists and is below the minimum threshold |
| `NOT_ASSESSED` | — | No evidence yet (e.g. no employees, or no phishing run) |

**Readiness score** for a framework is the average points of its **assessed**
controls only:

```
score = average(points of controls where status != NOT_ASSESSED)
```

`NOT_ASSESSED` controls are **excluded from the denominator**. This is
deliberate: a brand-new tenant that has run nothing should not be reported as
"0% compliant" (which implies failure) — it should be reported as "not yet
assessed." Scoring an unmeasured control as 0 would be dishonest.

`overallReadiness()` applies the same rule across all controls of all three
frameworks.

## Verified control mappings

Only controls with a defensible, real mapping are included. Mappings that were
inaccurate or non-existent for their claimed purpose were **removed** during
review (see "Mappings explicitly rejected" below).

### ISO/IEC 27001:2022

| Control | Title | Signal → threshold |
|---------|-------|--------------------|
| `A.6.3` | Information Security Awareness, Education and Training | completion ≥90 COMPLIANT, ≥60 PARTIAL |
| `9.1` | Monitoring, Measurement, Analysis and Evaluation | phishing susceptibility ≤10% COMPLIANT, ≤30% PARTIAL |
| `9.2` | Internal Audit | avg exam score ≥80 COMPLIANT, ≥60 PARTIAL |
| `A.5.1` | Policies for Information Security | certificates issued >0 COMPLIANT |
| `10.1` | Continual Improvement | >1 simulation + completion ≥80 COMPLIANT |

### NCA ECC 2-2024 (Saudi Arabia)

Mapped to **ECC-1-10 — Cybersecurity Awareness and Training Program**.

| Control | Title | Signal → threshold |
|---------|-------|--------------------|
| `ECC-1-10-1` | Cybersecurity Awareness and Training Program | completion ≥90 COMPLIANT, ≥60 PARTIAL |
| `ECC-1-10-2` | Training Program Effectiveness Measurement | susceptibility ≤15% **and** report rate ≥20% COMPLIANT; susceptibility ≤35% PARTIAL |

### SAMA CSF (Saudi Central Bank)

| Control | Title | Signal → threshold |
|---------|-------|--------------------|
| `3.1.6` | Cybersecurity Awareness | phishing report rate ≥30% COMPLIANT, ≥10% PARTIAL |
| `3.1.7` | Cybersecurity Training | completion ≥85 **and** avg exam ≥70 COMPLIANT |

## Mappings explicitly rejected during review

To keep the report defensible, the following earlier mappings were removed
because they were inaccurate or did not exist for the stated purpose:

- NCA ECC `1-5-1`, `2-13-3`, `4-1-2` — replaced by the verified `ECC-1-10-x`
  awareness/training controls.
- SAMA CSF `3.3.10` — replaced by the verified `3.1.6` / `3.1.7` awareness and
  training sub-controls.

## Phishing signals feeding compliance

Susceptibility and report rate are taken from the **canonical phishing metrics
module** (see `PHISHING_REPORTING_METHODOLOGY.md`), aggregated with
`calculateAggregateCampaignMetrics` so the compliance report and the phishing
dashboard never disagree.

## How to read the report

- The donut shows the four statuses including a **Not Assessed** slice; the
  center figure is `overallReadiness()`.
- Three per-framework cards show each framework's score and "X of Y controls
  assessed."
- A control in **Not Assessed** is an instruction to *do the activity* (run a
  campaign, assign training), not evidence of non-compliance.
