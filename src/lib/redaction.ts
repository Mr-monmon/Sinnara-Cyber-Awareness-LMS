// Privacy guard for phishing-simulation form submissions.
//
// When a recipient submits a simulated login/landing form we must record THAT
// they submitted and WHICH fields were present — never the secret values
// themselves. Storing raw passwords/OTPs/tokens would turn an awareness
// exercise into a credential database, so this helper reduces an arbitrary
// submitted payload to a safe, value-free summary.

// A field whose (lower-cased) name contains any of these substrings is treated
// as sensitive and its value is never stored.
const SENSITIVE_PATTERNS = [
  "password",
  "pass",
  "pwd",
  "token",
  "secret",
  "otp",
  "mfa",
  "code",
  "pin",
  "credential",
];

export function isSensitiveFieldName(name: string): boolean {
  const n = name.toLowerCase();
  return SENSITIVE_PATTERNS.some((p) => n.includes(p));
}

export interface RedactedSubmission {
  submitted: true;
  field_names: string[];
  redacted_fields: string[];
}

// Reduces a submitted form payload to field names only. No values — sensitive
// or otherwise — are retained, which is the safest default for an awareness
// platform. `redacted_fields` lists the subset whose names looked sensitive so
// reports can show "a password field was captured" without the password.
export function redactSubmittedFields(
  body: Record<string, unknown> | null | undefined
): RedactedSubmission {
  const field_names = body ? Object.keys(body) : [];
  const redacted_fields = field_names.filter(isSensitiveFieldName);
  return { submitted: true, field_names, redacted_fields };
}
