import { describe, it, expect } from "vitest";
import { redactSubmittedFields, isSensitiveFieldName } from "./redaction";

describe("isSensitiveFieldName", () => {
  it.each([
    "password", "Password", "user_password", "passwd", "pwd",
    "otp", "mfa_code", "token", "api_secret", "PIN", "credential",
  ])("flags %s as sensitive", (name) => {
    expect(isSensitiveFieldName(name)).toBe(true);
  });

  it.each(["email", "username", "first_name", "company"])(
    "does not flag %s",
    (name) => {
      expect(isSensitiveFieldName(name)).toBe(false);
    }
  );
});

describe("redactSubmittedFields", () => {
  it("keeps field names but never the values", () => {
    const result = redactSubmittedFields({
      email: "victim@corp.com",
      password: "hunter2",
      otp: "123456",
    });
    expect(result).toEqual({
      submitted: true,
      field_names: ["email", "password", "otp"],
      redacted_fields: ["password", "otp"],
    });
    // No raw value should appear anywhere in the serialized output.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("123456");
    expect(serialized).not.toContain("victim@corp.com");
  });

  it("handles an empty / missing body", () => {
    expect(redactSubmittedFields({})).toEqual({
      submitted: true,
      field_names: [],
      redacted_fields: [],
    });
    expect(redactSubmittedFields(null)).toEqual({
      submitted: true,
      field_names: [],
      redacted_fields: [],
    });
  });

  it("marks a form with no sensitive fields as fully non-redacted", () => {
    const result = redactSubmittedFields({ email: "a@b.com", name: "A" });
    expect(result.redacted_fields).toEqual([]);
    expect(result.field_names).toEqual(["email", "name"]);
  });
});
