import { describe, it, expect } from "vitest";
import { getErrorMessage } from "./errors";

describe("getErrorMessage", () => {
  it("returns the message of an Error instance", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("reads .message from a plain object (PostgREST style)", () => {
    expect(getErrorMessage({ message: "row level security" })).toBe(
      "row level security"
    );
  });

  it("falls back to .error when .message is absent", () => {
    expect(getErrorMessage({ error: "edge function failed" })).toBe(
      "edge function failed"
    );
  });

  it("falls back to .details then .hint", () => {
    expect(getErrorMessage({ details: "duplicate key" })).toBe("duplicate key");
    expect(getErrorMessage({ hint: "check the foreign key" })).toBe(
      "check the foreign key"
    );
  });

  it("prefers message over the other fields", () => {
    expect(
      getErrorMessage({ message: "primary", error: "secondary", hint: "h" })
    ).toBe("primary");
  });

  it("ignores empty-string fields and keeps looking", () => {
    expect(getErrorMessage({ message: "", error: "real reason" })).toBe(
      "real reason"
    );
  });

  it("stringifies an object with no known fields", () => {
    expect(getErrorMessage({ code: 23505 })).toBe('{"code":23505}');
  });

  it("returns a plain string as-is", () => {
    expect(getErrorMessage("just a string")).toBe("just a string");
  });

  it("returns 'Unknown error' for null/undefined", () => {
    expect(getErrorMessage(null)).toBe("Unknown error");
    expect(getErrorMessage(undefined)).toBe("Unknown error");
  });
});
