import { describe, expect, it } from "vitest";

import {
  REMINDER_MAX_PER_RECIPIENT,
  daysUntil,
  describeAvailability,
  reminderKey,
  type ReminderState,
} from "./examReminders";

const DAY = 86_400_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

const state = (over: Partial<ReminderState>): ReminderState => ({
  examId: "exam-1",
  recipientId: "emp-1",
  sentCount: 1,
  lastSentAt: iso(-DAY),
  nextAllowedAt: iso(6 * DAY),
  ...over,
});

describe("reminderKey", () => {
  it("keeps exam and recipient distinguishable", () => {
    // A naive concatenation would collide for ("ab","c") and ("a","bc").
    expect(reminderKey("ab", "c")).not.toBe(reminderKey("a", "bc"));
  });
});

describe("daysUntil", () => {
  it("rounds up, so a few hours left still reads as a day", () => {
    expect(daysUntil(iso(3 * 3_600_000))).toBe(1);
  });

  it("never goes negative once the window has passed", () => {
    expect(daysUntil(iso(-5 * DAY))).toBe(0);
  });

  it("treats a missing timestamp as no wait", () => {
    expect(daysUntil(null)).toBe(0);
  });
});

describe("describeAvailability", () => {
  it("allows the first reminder when nothing has been sent", () => {
    const r = describeAvailability(undefined);
    expect(r.canSend).toBe(true);
    expect(r.countLabel).toBe(`0 of ${REMINDER_MAX_PER_RECIPIENT} sent`);
    expect(r.reason).toBe("");
  });

  it("blocks while inside the weekly window", () => {
    const r = describeAvailability(state({ sentCount: 1, nextAllowedAt: iso(4 * DAY) }));
    expect(r.canSend).toBe(false);
    expect(r.reason).toContain("4 days");
  });

  it("allows again once the window has lapsed", () => {
    expect(describeAvailability(state({ sentCount: 2, nextAllowedAt: iso(-DAY) })).canSend).toBe(true);
  });

  it("blocks at the ceiling even when the week has lapsed", () => {
    // The two limits are independent: waiting long enough must not restore a
    // reminder to someone who has already had all three.
    const r = describeAvailability(
      state({ sentCount: REMINDER_MAX_PER_RECIPIENT, nextAllowedAt: iso(-30 * DAY) }),
    );
    expect(r.canSend).toBe(false);
    expect(r.reason).toContain("limit reached");
  });

  it("says 'day' not 'days' for a single remaining day", () => {
    expect(describeAvailability(state({ nextAllowedAt: iso(DAY - 1000) })).reason).toContain("in 1 day.");
  });
});
