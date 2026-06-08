/**
 * zepto — shared helpers for the ZeptoMail (Zoho) transactional API.
 *
 * Centralises the Authorization-header construction and a safe, secret-free
 * send-error formatter so every caller builds the header identically and never
 * double-prefixes the API key.
 */

const ZEPTO_PREFIX = "Zoho-enczapikey";

/**
 * Build the ZeptoMail Authorization header value from a stored token.
 *
 * Accepts either a bare key (`wSsV…`) or a value that already carries the
 * `Zoho-enczapikey ` prefix (case-insensitive, possibly surrounded by
 * whitespace). Returns the already-prefixed value as-is so the prefix is never
 * applied twice.
 */
export function buildZeptoAuthHeader(token: string): string {
  const trimmed = (token ?? "").trim();
  if (trimmed.toLowerCase().startsWith(ZEPTO_PREFIX.toLowerCase())) {
    return trimmed;
  }
  return `${ZEPTO_PREFIX} ${trimmed}`;
}

/**
 * Turn a failed ZeptoMail send (HTTP status + raw response body) into a safe,
 * generic operator-facing message. The provider's body can contain request
 * echoes, so it is summarised rather than surfaced verbatim.
 */
export function parseSendError(status: number, body: string): string {
  const snippet = (body ?? "").trim().slice(0, 300);
  if (status === 401 || status === 403) {
    return "Platform email sender rejected the request (authentication/authorisation failed). Verify the ZeptoMail token.";
  }
  if (status === 400) {
    return "Platform email sender rejected the message as invalid (check the sender address and message content).";
  }
  if (status === 429) {
    return "Platform email sender is rate-limiting requests. Try again shortly.";
  }
  if (status >= 500) {
    return "Platform email sender is temporarily unavailable. Try again later.";
  }
  return snippet
    ? `Platform sender rejected the message (status ${status}): ${snippet}`
    : `Platform sender rejected the message (status ${status}).`;
}
