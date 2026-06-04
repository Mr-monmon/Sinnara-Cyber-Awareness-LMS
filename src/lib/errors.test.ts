import { describe, it, expect } from "vitest";
import { getErrorMessage, getEdgeFunctionError } from "./errors";

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

describe("getEdgeFunctionError", () => {
  // Mimics supabase-js FunctionsHttpError: a generic message plus a `context`
  // Response holding the real JSON body the function returned.
  const makeHttpError = (body: string) => ({
    message: "Edge Function returned a non-2xx status code",
    context: new Response(body, { status: 500 }),
  });

  it("extracts the specific { error } from the response body", async () => {
    const err = makeHttpError(JSON.stringify({ success: false, error: "Selected groups have no members." }));
    expect(await getEdgeFunctionError(err)).toBe("Selected groups have no members.");
  });

  it("extracts { message } from the response body", async () => {
    const err = makeHttpError(JSON.stringify({ message: "duplicate key value" }));
    expect(await getEdgeFunctionError(err)).toBe("duplicate key value");
  });

  it("returns a plain-text (non-JSON) body verbatim", async () => {
    const err = makeHttpError("EDGE_FUNCTION_ERROR");
    expect(await getEdgeFunctionError(err)).toBe("EDGE_FUNCTION_ERROR");
  });

  it("falls back to getErrorMessage when there is no context", async () => {
    expect(await getEdgeFunctionError(new Error("plain error"))).toBe("plain error");
  });
});
