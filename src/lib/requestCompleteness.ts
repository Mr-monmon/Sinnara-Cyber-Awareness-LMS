/**
 * Mirrors the completeness check in create-campaign-from-request Edge Function.
 * Returns an array of human-readable missing-field labels.
 * Empty array means the request can be converted to a campaign.
 */
export interface RequestFields {
  campaign_name?: string | null;
  email_subject?: string | null;
  email_html_body?: string | null;
  group_ids?: string[] | null;
  target_departments?: string[] | null;
}

export function missingCampaignFields(r: RequestFields): string[] {
  const missing: string[] = [];
  if (!r.campaign_name?.trim())   missing.push("campaign name");
  if (!r.email_subject?.trim())   missing.push("email subject");
  if (!r.email_html_body?.trim()) missing.push("email HTML body");
  const hasGroups = Array.isArray(r.group_ids) && r.group_ids.length > 0;
  const hasDepts  = Array.isArray(r.target_departments) && r.target_departments.length > 0;
  if (!hasGroups && !hasDepts)    missing.push("target group or department");
  return missing;
}

export const isRequestComplete = (r: RequestFields): boolean =>
  missingCampaignFields(r).length === 0;
