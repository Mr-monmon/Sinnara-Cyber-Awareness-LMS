# Phishing Reporting Methodology

All phishing metrics shown in the product (company dashboard, platform monitoring,
CSV exports, and PDF reports) are computed by a **single canonical module** —
`src/lib/phishingMetrics.ts` — so every surface reports identical numbers from the
same definitions. This document is the authoritative description of those
definitions.

> Source of truth: `src/lib/phishingMetrics.ts` (unit-tested in
> `src/lib/phishingMetrics.test.ts`, 14 tests). The in-product methodology footer
> is generated from `methodologyNotes` in that module.

## Core principles

1. **Every rate has an explicitly stated denominator.** A percentage is
   meaningless without one, and mixing denominators is the most common way
   phishing dashboards mislead.
2. **Delivery-funnel rates are a percentage of *sent* emails**, not of *queued*
   or *targeted*. An email that failed to send could never have been opened, so
   including it in the denominator understates real engagement.
3. **Susceptibility is a percentage of *targeted* (unique) users.** This answers
   the question leadership actually asks — "what fraction of our people fell for
   it?" — which is a property of people, not of messages.
4. **Aggregates are weighted, never averaged.** Combining campaigns sums the
   numerators and denominators separately, then divides. Averaging per-campaign
   percentages would let a 2-person campaign distort a 2,000-person one.
5. **Recipients are deduplicated by normalized email** (lowercase + trim) before
   any engagement count is tallied.
6. **Zero denominators yield 0, never `NaN`.** `safePct(n, 0) === 0`.

## Definitions

### Counts

| Field | Meaning |
|-------|---------|
| `targeted` | Unique recipients after dedup by normalized email |
| `queued` | Email-queue rows created for the campaign |
| `sent` | Queue rows successfully sent |
| `failed` | Queue rows that failed to send |
| `pending` | Queue rows not yet processed |
| `skipped` | Queue rows intentionally skipped |
| `opened` / `clicked` / `submitted` / `reported` | Unique targets who reached that funnel stage |

### Delivery-funnel rates — denominator is `sent`

```
openRate    = opened    / sent
clickRate   = clicked   / sent
submitRate  = submitted / sent
reportRate  = reported  / sent
```

### Queue rate — denominator is `queued`

```
failRate = failed / queued
```

Failed emails are **excluded** from the delivery-rate denominators above and
**only** count toward `failRate`.

### Susceptibility — denominator is `targeted` (unique users)

```
susceptibilityRate = (users who clicked OR submitted credentials) / targeted
reportByTargetRate = reported / targeted
```

A user who both clicked and submitted is counted **once** in the susceptibility
numerator (it is a per-user OR, not a sum of events).

## Aggregating across campaigns

`calculateAggregateCampaignMetrics(campaigns)` produces organization-level rates:

```
aggregate.clickRate = Σ(clicked across campaigns) / Σ(sent across campaigns)
aggregate.susceptibilityRate = Σ(susceptible users) / Σ(targeted users)
```

This is a **weighted** rate. It is mathematically *not* the same as
`average(campaign.clickRate)` and the difference is large whenever campaigns
differ in size. The unit tests assert this property explicitly.

## Why opens can over- or under-count (and how we handle it)

- **Tracking-pixel opens** are fired by mail clients and their image proxies
  (Gmail/Outlook/Apple), which pre-fetch and re-fetch images. To avoid inflating
  opens, the tracking endpoint (`phishing-track`) persists **only the first open**
  per recipient; subsequent pixel hits are ignored.
- **Legacy templates** that put the click URL inside an `<img src>` would
  otherwise miscount an open as a click. The endpoint detects image-style
  requests (`Sec-Fetch-Dest: image`, `Accept: image/*`) and records them as
  opens, not clicks.
- Clicks and submits keep full event history; only opens are collapsed.

These behaviors mean reported open rates are conservative lower-bounds on "an
image loaded" but accurate counts of "a distinct recipient's mailbox rendered the
message at least once."

## Surfaces that use this module

| Surface | File | Uses |
|---------|------|------|
| Company dashboard + CSV/PDF export | `src/pages/company-admin/PhishingDashboardPage.tsx` | `calculateCampaignMetrics`, `methodologyNotes` |
| Platform monitoring | `src/pages/platform-admin/PhishingMonitoringPage.tsx` | canonical counts (fixed `head:true` count bug — now counts FAILED across all campaigns) |
| Per-campaign PDF | `src/lib/campaignReport.ts` | `calculateCampaignMetrics`, `summarizeTargets`, `methodologyNotes` |
| Compliance signals | `src/pages/company-admin/ComplianceReportPage.tsx` | `calculateAggregateCampaignMetrics` (susceptibility + report rate feed framework scoring) |

## Reading the numbers

- A **high open rate, low susceptibility** is the healthy state: people read the
  message but recognized it and did not act.
- **Susceptibility** is the headline risk number. Report it as a percentage of
  people, and always alongside the **report rate** — a strong reporting culture
  (people forwarding to security) is as important as a low click rate.
- Treat any single campaign's rates as noisy; trend the **weighted aggregate**
  across campaigns over time.
