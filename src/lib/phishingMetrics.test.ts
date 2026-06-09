import { describe, it, expect } from 'vitest';
import {
  safePct,
  summarizeTargets,
  calculateCampaignMetrics,
  calculateAggregateCampaignMetrics,
  type QueueStats,
  type TargetStats,
} from './phishingMetrics';

describe('safePct', () => {
  it('returns 0 for zero denominator', () => {
    expect(safePct(5, 0)).toBe(0);
  });
  it('returns 0 for negative denominator', () => {
    expect(safePct(5, -1)).toBe(0);
  });
  it('returns 0 for NaN denominator', () => {
    expect(safePct(5, NaN)).toBe(0);
  });
  it('computes percentage correctly', () => {
    expect(safePct(1, 4)).toBe(25);
  });
  it('rounds to one decimal', () => {
    expect(safePct(1, 3)).toBe(33.3);
  });
});

describe('summarizeTargets', () => {
  it('deduplicates by email (case-insensitive)', () => {
    const rows: TargetStats[] = [
      { email: 'Alice@example.com', clicked_at: '2024-01-01' },
      { email: 'alice@EXAMPLE.COM', clicked_at: null },
      { email: 'bob@example.com', clicked_at: null },
    ];
    const result = summarizeTargets(rows);
    expect(result).toHaveLength(2);
    expect(result[0].email).toBe('alice@example.com');
  });

  it('drops rows with empty email', () => {
    const rows: TargetStats[] = [
      { email: '', clicked_at: null },
      { email: 'valid@example.com', clicked_at: null },
    ];
    expect(summarizeTargets(rows)).toHaveLength(1);
  });
});

const makeQueue = (overrides: Partial<QueueStats> = {}): QueueStats => ({
  queued: 100, sent: 80, failed: 20, pending: 0, skipped: 0,
  ...overrides,
});

const makeTargets = (n: number, clicked = 0, submitted = 0, reported = 0): TargetStats[] =>
  Array.from({ length: n }, (_, i) => ({
    email: `user${i}@example.com`,
    clicked_at:          i < clicked    ? '2024-01-01' : null,
    credentials_entered: i < submitted  ? true         : null,
    reported_at:         i < reported   ? '2024-01-01' : null,
    opened_at: null,
  }));

describe('calculateCampaignMetrics', () => {
  it('computes clickRate against sent (not queued)', () => {
    // queued=100, sent=80, failed=20, clicked=40 of 100 targeted
    const metrics = calculateCampaignMetrics(makeQueue(), makeTargets(100, 40));
    // clickRate = 40/80 = 50%
    expect(metrics.clickRate).toBe(50);
  });

  it('computes susceptibilityRate against targeted users', () => {
    // 40 clicked of 100 targeted → 40%
    const metrics = calculateCampaignMetrics(makeQueue(), makeTargets(100, 40));
    expect(metrics.susceptibilityRate).toBe(40);
  });

  it('computes failRate against queued', () => {
    const metrics = calculateCampaignMetrics(makeQueue(), makeTargets(10));
    // failed=20, queued=100 → 20%
    expect(metrics.failRate).toBe(20);
  });

  it('returns 0 rates when sent=0', () => {
    const metrics = calculateCampaignMetrics(makeQueue({ sent: 0 }), makeTargets(10, 5));
    expect(metrics.clickRate).toBe(0);
    expect(metrics.openRate).toBe(0);
  });

  it('susceptibility includes submitted-only (no click)', () => {
    // 3 submitted (no clicked_at set), 0 clicked → 3 susceptible of 10
    const targets: TargetStats[] = [
      ...Array.from({ length: 3 }, (_, i) => ({ email: `s${i}@x.com`, credentials_entered: true, clicked_at: null, reported_at: null, opened_at: null })),
      ...Array.from({ length: 7 }, (_, i) => ({ email: `u${i}@x.com`, credentials_entered: null, clicked_at: null, reported_at: null, opened_at: null })),
    ];
    const metrics = calculateCampaignMetrics(makeQueue({ sent: 10 }), targets);
    expect(metrics.susceptibilityRate).toBe(30);
  });
});

describe('calculateAggregateCampaignMetrics', () => {
  it('uses weighted totals, not average of rates', () => {
    // Campaign A: 1000 targeted, 1000 sent, 50 clicked → clickRate 5%
    // Campaign B: 2 targeted, 2 sent, 2 clicked → clickRate 100%
    // Wrong average: (5+100)/2 = 52.5%
    // Correct weighted: 52/1002 ≈ 5.2%
    const mA = calculateCampaignMetrics(
      { queued: 1000, sent: 1000, failed: 0, pending: 0, skipped: 0 },
      makeTargets(1000, 50),
    );
    const mB = calculateCampaignMetrics(
      { queued: 2, sent: 2, failed: 0, pending: 0, skipped: 0 },
      makeTargets(2, 2),
    );
    const agg = calculateAggregateCampaignMetrics([mA, mB]);
    expect(agg.clickRate).toBe(safePct(52, 1002));
    expect(agg.totalTargeted).toBe(1002);
  });

  it('returns zero rates for empty campaign list', () => {
    const agg = calculateAggregateCampaignMetrics([]);
    expect(agg.clickRate).toBe(0);
    expect(agg.totalTargeted).toBe(0);
  });
});
