import { describe, expect, it } from "vitest";

import { isLikelyScanner, scannerReason } from "./botFilter";

// A representative real browser UA — long, specific, no scanner tokens.
const REAL_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const REAL_SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

describe("isLikelyScanner", () => {
  it("does not flag a real desktop browser", () => {
    expect(isLikelyScanner(REAL_CHROME)).toBe(false);
  });

  it("does not flag a real mobile browser", () => {
    expect(isLikelyScanner(REAL_SAFARI_IOS)).toBe(false);
  });

  it("flags Microsoft Safe Links / Defender", () => {
    // The pilot company runs Microsoft 365 — this is the case that matters most.
    expect(isLikelyScanner("Mozilla/5.0 (compatible; MSOffice 16.0; SafeLinks)")).toBe(true);
    expect(isLikelyScanner("BingPreview/1.0b")).toBe(true);
  });

  it("flags the major mail-security vendors", () => {
    for (const ua of [
      "Proofpoint-Urlanalysis/1.0",
      "Mimecast Email Security",
      "Barracuda-Link-Protection",
      "Symantec-MessageLabs-Scanner",
    ]) {
      expect(isLikelyScanner(ua), ua).toBe(true);
    }
  });

  it("flags raw HTTP libraries and headless browsers", () => {
    for (const ua of [
      "curl/8.4.0",
      "python-requests/2.31.0",
      "Go-http-client/2.0",
      "Mozilla/5.0 HeadlessChrome/124.0.0.0",
    ]) {
      expect(isLikelyScanner(ua), ua).toBe(true);
    }
  });

  it("treats a missing or stub user-agent as automated", () => {
    // A real person reading mail in a browser always sends a long UA; the absence
    // of one is a fetcher, and the safe default is not to count it as a click.
    expect(isLikelyScanner("")).toBe(true);
    expect(isLikelyScanner(null)).toBe(true);
    expect(isLikelyScanner(undefined)).toBe(true);
    expect(isLikelyScanner("Go")).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(isLikelyScanner("PROOFPOINT-URLANALYSIS")).toBe(true);
  });
});

describe("scannerReason", () => {
  it("returns null for a real browser, so a counted click has no bot reason", () => {
    expect(scannerReason(REAL_CHROME)).toBeNull();
  });

  it("names the matched fragment for auditability", () => {
    expect(scannerReason("Proofpoint-Urlanalysis/1.0")).toBe("matched:proofpoint");
  });

  it("distinguishes an empty UA from a short one", () => {
    expect(scannerReason("")).toBe("empty_user_agent");
    expect(scannerReason("xyz")).toBe("short_user_agent");
    // The length check runs first, so a UA has to clear 12 characters before its
    // fragment is named. A realistic scanner UA is well past that.
    expect(scannerReason("python-requests/2.31.0")).toBe("matched:python-requests");
  });
});
