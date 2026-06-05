-- Add CAMPAIGN_SCHEDULED to phishing_alerts.alert_type CHECK constraint.
-- launch-phishing-campaign inserts this alert type for scheduled campaigns,
-- but the original constraint (from 20260517000003) omitted it.

ALTER TABLE public.phishing_alerts
  DROP CONSTRAINT IF EXISTS phishing_alerts_alert_type_check;

ALTER TABLE public.phishing_alerts
  ADD CONSTRAINT phishing_alerts_alert_type_check
  CHECK (alert_type IN (
    'LINK_CLICKED',
    'CREDENTIALS_SUBMITTED',
    'CAMPAIGN_COMPLETE',
    'CAMPAIGN_STARTED',
    'CAMPAIGN_SCHEDULED'
  ));
