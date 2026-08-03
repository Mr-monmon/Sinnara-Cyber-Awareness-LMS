/**
 * analyticsFormat — one number/format vocabulary for every analytics surface.
 *
 * The five analytics pages each formatted numbers their own way: one used
 * `toFixed(1)` where the next used `Math.round`, one printed `12480` where
 * another printed `12.5K`, and `tabular-nums` appeared on exactly one chart.
 * Routing every displayed number through these helpers makes the pages read as
 * one product. Display is English-only by deliberate scope; a locale argument
 * can be threaded through later without changing call sites.
 */

/** Thousands-separated integer: 12480 → "12,480". Non-finite → "0". */
export function fmtCount(n: number | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return Math.round(v).toLocaleString("en-US");
}

/** Compact large counts for platform scale: 12480 → "12.5K", 3_200_000 → "3.2M". */
export function fmtCompact(n: number | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${Math.round(v)}`;
}

/**
 * Percentage for on-screen KPIs: whole numbers, no decimals (one canonical rule
 * for headline figures). `null` renders as an em-dash so "not measured" never
 * reads as 0%.
 */
export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  return `${Math.round(Number(n))}%`;
}

/**
 * A RATE from a numerator and denominator, with the "no denominator" rule that
 * caused the phishing "0% vs —" confusion: if nothing was sent/assigned/assessed
 * there is no rate, so return null (→ "—"), never 0%. One decimal optional.
 */
export function rate(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  const d = Number(denominator);
  if (!Number.isFinite(d) || d <= 0) return null;
  const num = Number(numerator) || 0;
  return (num / d) * 100;
}

/** Saudi Riyal, thousands-separated: 12480 → "SAR 12,480". */
export function fmtSAR(n: number | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "SAR 0";
  return `SAR ${Math.round(v).toLocaleString("en-US")}`;
}

/** Hours as a human duration for response-time tiles: 0.5 → "30m", 3.2 → "3.2h", 50 → "2.1d". */
export function fmtHours(h: number | null | undefined): string {
  if (h === null || h === undefined || !Number.isFinite(Number(h))) return "—";
  const hours = Number(h);
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

/**
 * Apply everywhere a number is shown so digits don't shift the layout as values
 * change. Spread into a style object: `style={{ ...tabularNums, ... }}`.
 */
export const tabularNums = { fontVariantNumeric: "tabular-nums" as const };
