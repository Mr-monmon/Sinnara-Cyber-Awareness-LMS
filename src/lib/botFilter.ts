// NOTE: mirrored into supabase/functions/_shared/botFilter.ts, which is the
// copy the phishing-track edge function actually runs (Deno cannot import from
// src/). This file is the source of truth and carries the tests; change both.

/**
 * Distinguish a real recipient from an automated security scanner.
 *
 * Corporate mail security — Microsoft Defender for Office 365, Proofpoint,
 * Mimecast, Barracuda and the rest — fetches the tracking pixel and *visits the
 * click URL* to inspect it before a human ever sees the message. On Microsoft
 * 365 (Safe Links) this happens to every link in every message. Left uncounted,
 * that turns a phishing simulation's numbers into fiction: a report showing
 * "100% clicked" and forty employees told they failed a test none of them
 * opened.
 *
 * This is a heuristic, not a guarantee. It is deliberately biased toward NOT
 * counting when a hit looks automated: a missed real click understates the
 * result, which is recoverable and honest, while a counted scanner hit invents
 * a failure and destroys trust in the whole exercise. When in doubt, do not
 * count.
 *
 * It never changes what the recipient sees. The click endpoint still redirects
 * every caller, scanner or human, so a real person always lands on the training
 * page; only whether the event is *recorded* depends on this.
 */

/**
 * User-agent fragments that belong to mail-security scanners, link-preview
 * bots, and headless fetchers — never to a person reading email in a browser.
 * Matched case-insensitively as substrings.
 */
const SCANNER_UA_FRAGMENTS: readonly string[] = [
  // Microsoft — Defender / ATP / Safe Links / SharePoint preview
  "microsoft office", "ms-office", "officescan", "safelinks", "microsoftpreview",
  "bingpreview", "skypeuripreview", "msoffice",
  // Major email-security vendors
  "proofpoint", "mimecast", "barracuda", "forcepoint", "fireeye",
  "symantec", "messagelabs", "trendmicro", "sophos", "cisco", "ironport",
  "avira", "kaspersky", "mcafee", "gdata", "bitdefender", "fortinet", "fortimail",
  "zscaler", "netskope", "cloudmark", "spamtitan", "vadesecure", "area1",
  // Link-preview / crawler bots that open URLs from messages or chat
  "slackbot", "slack-imgproxy", "whatsapp", "telegrambot", "facebookexternalhit",
  "twitterbot", "linkedinbot", "discordbot", "googlebot", "bingbot",
  "google-safety", "googleimageproxy", "googledocs", "gmailimageproxy",
  "yahoo", "duckduckbot", "applebot",
  // Generic automation / HTTP libraries — no human drives these
  "curl", "wget", "python-requests", "python-urllib", "go-http-client",
  "java/", "okhttp", "libwww-perl", "axios", "node-fetch", "httpclient",
  "headlesschrome", "phantomjs", "puppeteer", "playwright", "scrapy",
  "apache-httpclient", "guzzlehttp", "postmanruntime", "insomnia",
  // Explicit self-identification
  "bot", "crawler", "spider", "scanner", "preview", "monitor", "validator",
];

/**
 * A hit is treated as automated when its user-agent matches a scanner fragment,
 * is empty, or is implausibly short. Real browsers send long, specific strings;
 * scanners often send a terse token or none at all.
 */
export function isLikelyScanner(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim().toLowerCase();

  // No UA, or a stub too short to be a real browser, is not a person reading mail.
  if (ua.length < 12) return true;

  return SCANNER_UA_FRAGMENTS.some((fragment) => ua.includes(fragment));
}

/**
 * Why a hit was classified as it was — persisted in event metadata so a
 * suspicious result can be audited later ("were these real, or did a scanner
 * change vendor?") without re-deriving the reasoning.
 */
export function scannerReason(userAgent: string | null | undefined): string | null {
  const ua = (userAgent ?? "").trim().toLowerCase();
  if (ua.length < 12) return ua.length === 0 ? "empty_user_agent" : "short_user_agent";
  const hit = SCANNER_UA_FRAGMENTS.find((fragment) => ua.includes(fragment));
  return hit ? `matched:${hit}` : null;
}
