import { describe, it, expect } from "vitest";
import { renderTemplate, validateEmailTemplate, previewTemplate } from "./phishingTemplate";

describe("renderTemplate", () => {
  it("resolves dotted and braced tokens with optional whitespace", () => {
    expect(renderTemplate("Hi {{.FirstName}} ({{ .Email }})", {
      ".FirstName": "Sara",
      ".Email": "s@co.com",
    })).toBe("Hi Sara (s@co.com)");
  });

  it("renders unknown tokens as empty string", () => {
    expect(renderTemplate("a{{.Missing}}b", {})).toBe("ab");
  });

  it("substitutes pixel and link URLs independently", () => {
    const html = '<a href="{{.TrackingURL}}">go</a><img src="{{.TrackingPixel}}">';
    const out = renderTemplate(html, {
      ".TrackingURL": "https://t/click",
      ".TrackingPixel": "https://t/open",
    });
    expect(out).toContain('href="https://t/click"');
    expect(out).toContain('src="https://t/open"');
  });
});

describe("validateEmailTemplate", () => {
  it("warns when TrackingURL is used inside an image", () => {
    const html = '<a href="{{.TrackingURL}}">x</a><img src="{{.TrackingURL}}" />';
    const warnings = validateEmailTemplate(html);
    expect(warnings.some((w) => /image loads would be counted as clicks/i.test(w))).toBe(true);
  });

  it("warns when there is no click/landing link", () => {
    const html = '<p>Hello</p><img src="{{.TrackingPixel}}" />';
    const warnings = validateEmailTemplate(html);
    expect(warnings.some((w) => /no click\/landing link/i.test(w))).toBe(true);
  });

  it("passes a correctly-authored template", () => {
    const html = '<a href="{{.TrackingURL}}">Verify</a><img src="{{.TrackingPixel}}" width="1" height="1" />';
    expect(validateEmailTemplate(html)).toEqual([]);
  });
});

describe("previewTemplate", () => {
  it("fills sample recipient values", () => {
    expect(previewTemplate("Dear {{.FirstName}} {{.LastName}}")).toBe(
      "Dear Sara Al-Otaibi"
    );
  });
});
