/**
 * csv — one CSV export path for every analytics table.
 *
 * The same ~15-line `downloadCSV` was copy-pasted into a dozen pages, each free
 * to drift on quoting or escaping. A CSV that a customer opens in Excel has to
 * quote correctly every time, so it is defined once here and imported.
 */

/** Escape one cell: quote when it contains a comma, quote, or newline. */
function escapeCell(value: unknown): string {
  const v = String(value ?? "").replace(/"/g, '""');
  return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v}"` : v;
}

/**
 * Build a CSV string from an array of row objects. Column order follows the
 * keys of the first row. Returns "" for an empty array.
 */
export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.map(escapeCell).join(","),
    ...rows.map((r) => headers.map((h) => escapeCell(r[h])).join(",")),
  ].join("\n");
}

/**
 * Serialise rows to CSV and trigger a browser download. No-op on empty input.
 *
 * The leading U+FEFF byte-order mark is not decoration: without it Excel decodes
 * the file in the system codepage rather than UTF-8, and every Arabic company or
 * employee name opens as mojibake. Numbers survive; names do not — so the damage
 * is easy to miss until a customer opens the export.
 */
export function downloadCSV(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const blob = new Blob(["﻿", toCSV(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
