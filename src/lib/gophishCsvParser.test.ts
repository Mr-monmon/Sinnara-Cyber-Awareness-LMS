import { describe, it, expect } from "vitest";
import { parseCSV } from "./gophishCsvParser";

const HEADER = [
  "id", "status", "ip", "latitude", "longitude", "send_date",
  "reported", "modified_date", "email", "first_name", "last_name", "position",
];

function tsvRow(values: Partial<Record<string, string>>): string {
  return HEADER.map((h) => values[h] ?? "").join("\t");
}

describe("parseCSV (gophish import)", () => {
  it("parses a tab-separated export", () => {
    const content = [
      HEADER.join("\t"),
      tsvRow({ id: "1", status: "Email Sent", email: "a@co.com", reported: "false" }),
      tsvRow({ id: "2", status: "Clicked Link", email: "b@co.com", reported: "false" }),
      tsvRow({ id: "3", status: "Submitted Data", email: "c@co.com", reported: "true" }),
    ].join("\n");

    const { records, stats } = parseCSV(content);
    expect(records).toHaveLength(3);
    // Cumulative funnel: submitted ⊆ clicked ⊆ opened ⊆ sent.
    expect(stats.emailsSent).toBe(3);
    expect(stats.linksClicked).toBe(2); // clicked + submitted
    expect(stats.dataSubmitted).toBe(1);
    expect(stats.emailsReported).toBe(1);
  });

  it("parses a comma-separated export", () => {
    const content = [
      HEADER.join(","),
      ["1", "Email Sent", "", "", "", "", "false", "", "a@co.com", "", "", ""].join(","),
    ].join("\n");
    const { records } = parseCSV(content);
    expect(records).toHaveLength(1);
    expect(records[0].email).toBe("a@co.com");
  });

  it("honours quoted fields containing the delimiter", () => {
    const content = [
      HEADER.join(","),
      ['1', 'Email Sent', '', '', '', '', 'false', '', 'a@co.com', '"Smith, Jr."', 'John', '"VP, Sales"'].join(","),
    ].join("\n");
    const { records } = parseCSV(content);
    expect(records[0].first_name).toBe("Smith, Jr.");
    expect(records[0].position).toBe("VP, Sales");
  });

  it("matches columns by header name even when re-ordered", () => {
    const content = [
      ["email", "id", "status", "reported"].join("\t"),
      ["z@co.com", "9", "Email Opened", "false"].join("\t"),
    ].join("\n");
    const { records, stats } = parseCSV(content);
    expect(records[0].email).toBe("z@co.com");
    expect(records[0].id).toBe("9");
    expect(stats.emailsOpened).toBe(1);
  });

  it("throws a clear error on empty input", () => {
    expect(() => parseCSV("   ")).toThrow(/empty/i);
  });

  it("throws when there is only a header row", () => {
    expect(() => parseCSV(HEADER.join("\t"))).toThrow(/data row/i);
  });

  it("throws when no row has both id and email", () => {
    const content = [HEADER.join("\t"), tsvRow({ status: "Email Sent" })].join("\n");
    expect(() => parseCSV(content)).toThrow(/no valid rows/i);
  });
});
