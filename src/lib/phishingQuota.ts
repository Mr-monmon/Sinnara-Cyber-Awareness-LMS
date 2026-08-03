/**
 * The annual phishing-campaign quota a company gets when it has no explicit
 * `phishing_campaign_quotas` row for the current year.
 *
 * This has to match the column default in
 * `20251104123331_create_phishing_campaigns_schema.sql:42` — `annual_quota integer
 * NOT NULL DEFAULT 4` — because a company without a row for this year is entitled to
 * the same allowance it would get the moment a row is created for it.
 *
 * It lives here because the two screens that show it used to disagree: the companies
 * list assumed 4 while the campaign-requests screen assumed 0, so the same customer
 * appeared to have a full allowance on one page and a blocked, exhausted quota on the
 * other.
 */
export const DEFAULT_ANNUAL_QUOTA = 4;
