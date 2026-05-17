-- Fix: increment_campaign_stat was missing the 'emails_sent' case.
-- process-campaign logs EMAIL_SENT events but never called this RPC,
-- so phishing_campaigns.emails_sent was always 0 in the dashboard.

CREATE OR REPLACE FUNCTION increment_campaign_stat(p_campaign_id uuid, p_field text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_field = 'emails_sent' THEN
    UPDATE phishing_campaigns SET emails_sent = emails_sent + 1 WHERE id = p_campaign_id;
  ELSIF p_field = 'emails_opened' THEN
    UPDATE phishing_campaigns SET emails_opened = emails_opened + 1 WHERE id = p_campaign_id;
  ELSIF p_field = 'links_clicked' THEN
    UPDATE phishing_campaigns SET links_clicked = links_clicked + 1 WHERE id = p_campaign_id;
  ELSIF p_field = 'data_submitted' THEN
    UPDATE phishing_campaigns
    SET data_submitted     = data_submitted + 1,
        credentials_entered = credentials_entered + 1
    WHERE id = p_campaign_id;
  ELSIF p_field = 'emails_reported' THEN
    UPDATE phishing_campaigns SET emails_reported = emails_reported + 1 WHERE id = p_campaign_id;
  END IF;
END;
$$;
