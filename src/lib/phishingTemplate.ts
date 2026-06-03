// Pure helpers for phishing email-template rendering and validation.
//
// The authoritative runtime render happens server-side in the process-campaign
// Edge Function; this module mirrors that token syntax so the frontend can show
// an accurate preview and catch common authoring mistakes before a template is
// saved. Keeping it pure (no React/DOM) makes it unit-testable.

// Resolves {{.Token}} / {{ .Token }} / {{token}} placeholders from a map.
// Unknown tokens resolve to an empty string (matching the server renderer).
export function renderTemplate(
  html: string,
  vars: Record<string, string>
): string {
  return html.replace(/\{\{\s*(\.?[A-Za-z_][\w]*)\s*\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : ""
  );
}

// Realistic sample values for previewing a template without a live recipient.
export const PREVIEW_VARS: Record<string, string> = {
  ".FirstName": "Sara",
  ".LastName": "Al-Otaibi",
  ".FullName": "Sara Al-Otaibi",
  ".Email": "sara@example.com",
  ".Position": "Senior Analyst",
  ".Department": "Finance",
  ".Company": "Acme Corp",
  ".From": "IT Support",
  ".URL": "#",
  ".TrackingURL": "#",
  ".LandingURL": "#",
  ".TrackingPixel": "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
  ".ReportURL": "#",
  ".Date": "January 1, 2026",
  ".RId": "preview-rid",
};

export function previewTemplate(html: string): string {
  return renderTemplate(html, PREVIEW_VARS);
}

// Static checks that flag the two mistakes that silently corrupt metrics:
//   1. {{.TrackingURL}} (the CLICK url) used inside an <img src> — an image
//      load would then be counted as a click. Open tracking must use
//      {{.TrackingPixel}}.
//   2. No click/landing link at all — recipients can't "click", so the
//      campaign can never measure click-through.
export function validateEmailTemplate(html: string): string[] {
  const warnings: string[] = [];

  const imgTrackingUrl =
    /<img\b[^>]*\bsrc\s*=\s*["']?\s*\{\{\s*\.TrackingURL\s*\}\}/i;
  if (imgTrackingUrl.test(html)) {
    warnings.push(
      "{{.TrackingURL}} is used inside an image — image loads would be counted as clicks. Use {{.TrackingPixel}} for open tracking instead."
    );
  }

  const hasClickLink =
    /<a\b[^>]*\bhref\s*=\s*["']?\s*\{\{\s*\.(TrackingURL|LandingURL|URL|LoginURL)\s*\}\}/i.test(
      html
    );
  if (!hasClickLink) {
    warnings.push(
      "No click/landing link found. Add a link such as <a href=\"{{.TrackingURL}}\"> so clicks can be tracked."
    );
  }

  return warnings;
}
