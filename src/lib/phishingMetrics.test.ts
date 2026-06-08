import { describe, it, expect } from "vitest";
import {
  safePct,
  calculateCampaignMetrics,
  calculateAggregateCampaignMetrics,
  summarizeTargets,
  formatMetricLabel,
  methodologyNotes,
} from "./phishingMetrics";

describe("safePct", () => {
  it("returns 0 for a zero denominator (no NaN/Infinity)", () => {
    expect(safePct(5, 0)).toBe(0);
    expect(safePct(0, 0)).toBe(0);
  });
  it("returns 0 for negative or non-finite inputs", () => {
    expect(safePct(-1, 10)).toBe(0);
    expect(safePct(Number.NaN, 10)).toBe(0);
    expect(safePct(5, Number.POSITIVE_INFINITY)).toBe(0);
  });
  it("computes a rounded percentage to one decimal", () => {
    expect(safePct(1, 3)).toBe(33.3);
    expect(safePct(40, 80)).toBe(50);
  });
});

describe("calculateCampaignMetrics", () => {
  it("uses sent (not queued) as the denominator for delivered rates", () => {
    // queued=100, sent=80, failed=20, clicked=40
    const m = calculateCampaignMetrics(
      {},
      { queued: 100, sent: 80, failed: 20, pending: 0, skipped: 0 },
      { targeted: 100, clicked: 40, opened: 0, submitted: 0, reported: 0, compromised: 40 },
    );
    expect(m.clickRateDelivered).toBe(50); // 40 / 80
    expect(m.targetSusceptibilityRate).toBe(40); // 40 / 100 targeted
    expect(m.sendSuccessRate).toBe(80); // 80 / 100 queued
    expect(m.deliveryFailureRate).toBe(20); // 20 / 100 queued
  });

  it("does not let failed emails inflate or deflate delivered rates", () => {
    const noFail = calculateCampaignMetrics({}, { queued: 80, sent: 80, failed: 0, pending: 0, skipped: 0 }, { targeted: 80, clicked: 40, opened: 40, submitted: 0, reported: 0, compromised: 40 });
    const withFail = calculateCampaignMetrics({}, { queued: 100, sent: 80, failed: 20, pending: 0, skipped: 0 }, { targeted: 100, clicked: 40, opened: 40, submitted: 0, reported: 0, compromised: 40 });
    // Same sent (80) and same clicked (40) → identical delivered click rate.
    expect(noFail.clickRateDelivered).toBe(withFail.clickRateDelivered);
    expect(withFail.clickRateDelivered).toBe(50);
  });

  it("defaults compromised to max(clicked, submitted) when not supplied", () => {
    const m = calculateCampaignMetrics({}, { queued: 100, sent: 100, failed: 0, pending: 0, skipped: 0 }, { targeted: 100, clicked: 30, submitted: 10, opened: 0, reported: 0 } as never);
    expect(m.compromisedUsers).toBe(30);
    expect(m.targetSusceptibilityRate).toBe(30);
  });

  it("infers queued from sent+failed+pending+skipped when queued is absent", () => {
    const m = calculateCampaignMetrics({}, { sent: 70, failed: 10, pending: 15, skipped: 5 } as never, { targeted: 100 } as never);
    expect(m.queuedEmails).toBe(100);
    expect(m.deliveryFailureRate).toBe(10);
  });

  it("reads counts from campaign fields when stats are not provided", () => {
    const m = calculateCampaignMetrics({
      total_targets: 50, emails_sent: 50, failed_emails: 0,
      links_clicked: 25, emails_opened: 40, credentials_submitted: 5, emails_reported: 10,
    });
    expect(m.clickRateDelivered).toBe(50); // 25/50
    expect(m.reportByTargetRate).toBe(20); // 10/50
  });
});

describe("summarizeTargets", () => {
  it("deduplicates by normalized email and counts each stage once", () => {
    const stats = summarizeTargets([
      { email: "A@x.io", opened_at: "t", clicked_at: "t" },
      { email: "a@x.io", clicked_at: "t2" }, // same person, lowercased
      { email: "b@x.io", opened_at: "t", clicked_at: "t", submitted_at: "t" },
      { email: "c@x.io", reported_at: "t" },
    ]);
    expect(stats.targeted).toBe(3); // a, b, c
    expect(stats.clicked).toBe(2); // a, b
    expect(stats.submitted).toBe(1); // b
    expect(stats.compromised).toBe(2); // a, b (clicked or submitted)
    expect(stats.reported).toBe(1); // c
  });

  it("treats data_submitted / credentials_entered flags as submitted", () => {
    const stats = summarizeTargets([
      { email: "a@x.io", data_submitted: true },
      { email: "b@x.io", credentials_entered: true },
    ]);
    expect(stats.submitted).toBe(2);
    expect(stats.compromised).toBe(2);
  });
});

describe("calculateAggregateCampaignMetrics", () => {
  it("is a weighted aggregate (sum numerators / sum denominators), not an average of percentages", () => {
    // Campaign A: sent 10, clicked 1 (10%). Campaign B: sent 90, clicked 45 (50%).
    // Unweighted average = 30%. Weighted = 46/100 = 46%.
    const agg = calculateAggregateCampaignMetrics([
      calculateCampaignMetrics({}, { queued: 10, sent: 10, failed: 0, pending: 0, skipped: 0 }, { targeted: 10, clicked: 1, compromised: 1, opened: 0, submitted: 0, reported: 0 }),
      calculateCampaignMetrics({}, { queued: 90, sent: 90, failed: 0, pending: 0, skipped: 0 }, { targeted: 90, clicked: 45, compromised: 45, opened: 0, submitted: 0, reported: 0 }),
    ]);
    expect(agg.sentEmails).toBe(100);
    expect(agg.clicked).toBe(46);
    expect(agg.clickRateDelivered).toBe(46);
  });

  it("handles an empty list without NaN", () => {
    const agg = calculateAggregateCampaignMetrics([]);
    expect(agg.clickRateDelivered).toBe(0);
    expect(agg.sentEmails).toBe(0);
  });
});

describe("labels & methodology", () => {
  it("labels distinguish delivered vs targeted denominators", () => {
    expect(formatMetricLabel("clickRateDelivered")).toContain("delivered");
    expect(formatMetricLabel("targetSusceptibilityRate")).toContain("targeted");
  });
  it("ships methodology notes", () => {
    expect(methodologyNotes.length).toBeGreaterThan(3);
  });
});
