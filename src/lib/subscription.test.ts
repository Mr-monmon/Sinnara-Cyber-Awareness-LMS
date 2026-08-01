import { describe, it, expect } from 'vitest';
import {
  resolveSubscriptionState,
  type CompanySubscriptionRow,
  type LegacySubscriptionRow,
} from './subscription';

const COMPANY_ID = 'c0000000-0000-0000-0000-000000000001';

/** Reference "now": 15 Jun 2026, 09:00 local. */
const NOW = new Date('2026-06-15T09:00:00').getTime();

const company = (over: Partial<CompanySubscriptionRow> = {}): CompanySubscriptionRow => ({
  subscription_type: 'YEARLY_1',
  subscription_start: '2026-01-01',
  subscription_end: '2027-01-01',
  license_limit: 250,
  is_active: true,
  ...over,
});

const legacy = (over: Partial<LegacySubscriptionRow> = {}): LegacySubscriptionRow => ({
  id: 's0000000-0000-0000-0000-000000000001',
  status: 'ACTIVE',
  subscription_type: 'POC_3M',
  start_date: '2025-01-01',
  end_date: '2025-04-01',
  license_count: 10,
  ...over,
});

describe('resolveSubscriptionState — the extended-subscription regression', () => {
  it('is NOT expired when companies was extended but the legacy row is stale', () => {
    // This is the exact production bug: the platform admin extended
    // companies.subscription_end to 2027, while subscriptions.end_date still
    // held the original 2025 date. The old code read only the legacy row and
    // showed "Your subscription has expired" forever.
    const res = resolveSubscriptionState(COMPANY_ID, company(), legacy(), NOW);
    expect(res).not.toBeNull();
    expect(res!.expired).toBe(false);
    expect(res!.status).toBe('ACTIVE');
    expect(res!.end_date).toBe('2027-01-01');
    expect(res!.source).toBe('company');
  });

  it('takes the most generous end date in either direction', () => {
    // legacy further ahead than companies → legacy wins
    const res = resolveSubscriptionState(
      COMPANY_ID,
      company({ subscription_end: '2026-07-01' }),
      legacy({ end_date: '2028-01-01' }),
      NOW,
    );
    expect(res!.end_date).toBe('2028-01-01');
    expect(res!.source).toBe('subscriptions');
    expect(res!.expired).toBe(false);
  });

  it('reports expired only when BOTH stores are in the past', () => {
    const res = resolveSubscriptionState(
      COMPANY_ID,
      company({ subscription_end: '2026-01-01' }),
      legacy({ end_date: '2025-04-01' }),
      NOW,
    );
    expect(res!.expired).toBe(true);
    expect(res!.status).toBe('EXPIRED');
  });
});

describe('resolveSubscriptionState — inclusive final day', () => {
  it('is still valid on the last day of the subscription', () => {
    // Ends today. Date-only values are stored at midnight UTC, so the old
    // `days_remaining <= 0` check marked the whole final day as expired.
    const res = resolveSubscriptionState(
      COMPANY_ID,
      company({ subscription_end: '2026-06-15' }),
      null,
      NOW,
    );
    expect(res!.expired).toBe(false);
    expect(res!.days_remaining).toBe(1);
  });

  it('is expired the day after it ends', () => {
    const res = resolveSubscriptionState(
      COMPANY_ID,
      company({ subscription_end: '2026-06-14' }),
      null,
      NOW,
    );
    expect(res!.expired).toBe(true);
  });

  it('accepts full timestamptz values, not just date-only strings', () => {
    const res = resolveSubscriptionState(
      COMPANY_ID,
      company({ subscription_end: '2026-06-15T00:00:00+00:00' }),
      null,
      NOW,
    );
    expect(res!.expired).toBe(false);
  });
});

describe('resolveSubscriptionState — fail-safe behaviour', () => {
  it('returns null when neither store could be read (renders no banner)', () => {
    expect(resolveSubscriptionState(COMPANY_ID, null, null, NOW)).toBeNull();
  });

  it('returns null when no end date exists anywhere', () => {
    const res = resolveSubscriptionState(
      COMPANY_ID,
      company({ subscription_end: null }),
      null,
      NOW,
    );
    expect(res).toBeNull();
  });

  it('falls back to the legacy row when the company row is unreadable', () => {
    const res = resolveSubscriptionState(COMPANY_ID, null, legacy({ end_date: '2027-01-01' }), NOW);
    expect(res!.expired).toBe(false);
    expect(res!.license_count).toBe(10);
    expect(res!.source).toBe('subscriptions');
  });
});

describe('resolveSubscriptionState — status, licences and warnings', () => {
  it('marks a deactivated company as PENDING rather than expired', () => {
    const res = resolveSubscriptionState(COMPANY_ID, company({ is_active: false }), legacy(), NOW);
    expect(res!.expired).toBe(false);
    expect(res!.is_active).toBe(false);
    expect(res!.status).toBe('PENDING');
  });

  it('prefers the company licence limit over the legacy count', () => {
    const res = resolveSubscriptionState(COMPANY_ID, company(), legacy(), NOW);
    expect(res!.license_count).toBe(250);
  });

  it('flags expires_soon inside the 30-day window only', () => {
    const soon = resolveSubscriptionState(COMPANY_ID, company({ subscription_end: '2026-07-01' }), null, NOW);
    expect(soon!.expires_soon).toBe(true);
    expect(soon!.expired).toBe(false);

    const far = resolveSubscriptionState(COMPANY_ID, company({ subscription_end: '2026-12-01' }), null, NOW);
    expect(far!.expires_soon).toBe(false);
  });

  it('surfaces the subscription type and start date for the overview panel', () => {
    const res = resolveSubscriptionState(COMPANY_ID, company(), legacy(), NOW);
    expect(res!.subscription_type).toBe('YEARLY_1');
    expect(res!.start_date).toBe('2026-01-01');
  });
});
