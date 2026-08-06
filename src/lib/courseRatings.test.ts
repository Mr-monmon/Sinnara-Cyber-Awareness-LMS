import { describe, expect, it } from "vitest";

import { THIN_SAMPLE_THRESHOLD, isThinSample } from "./courseRatings";

describe("isThinSample", () => {
  it("does not flag a course nobody has rated", () => {
    // No ratings is "no data", not "a weak average" — the caller renders nothing
    // at all in that case, and a caveat here would be a caveat about nothing.
    expect(isThinSample(0)).toBe(false);
  });

  it("flags a handful of ratings", () => {
    expect(isThinSample(1)).toBe(true);
    expect(isThinSample(THIN_SAMPLE_THRESHOLD - 1)).toBe(true);
  });

  it("stops flagging at the threshold", () => {
    expect(isThinSample(THIN_SAMPLE_THRESHOLD)).toBe(false);
    expect(isThinSample(40)).toBe(false);
  });
});
