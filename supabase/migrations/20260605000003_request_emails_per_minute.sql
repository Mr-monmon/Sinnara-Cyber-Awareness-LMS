/*
  Ticket conversion — let the Platform Admin set the sending rate on a request.

  create-campaign-from-request already reads rq.emails_per_minute (defaulting to 10),
  but phishing_campaign_requests had no such column, so the rate could never be set
  per request. Add it so the Platform Admin's conversion screen can persist it.
*/
ALTER TABLE phishing_campaign_requests
  ADD COLUMN IF NOT EXISTS emails_per_minute integer DEFAULT 10;
