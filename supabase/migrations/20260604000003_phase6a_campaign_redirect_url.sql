/*
  Phase 6a — Open-redirect hardening (section N, problem 1)

  The phishing-track click/submit endpoints redirected to a URL taken straight
  from the query string (atob of ?url=, or ?redirect=), which is a classic open
  redirect. The fix resolves the destination server-side from the campaign
  record instead of trusting the query parameter.

  This adds a campaign-level redirect_url column so the worker / launch functions
  can persist the intended post-click / post-submit destination, and phishing-track
  can resolve it from the database (falling back to the company landing page or a
  safe default). The query parameter is only honoured when it matches a
  server-derived allowlist (our own functions origin or the stored redirect origin).
*/

ALTER TABLE phishing_campaigns
  ADD COLUMN IF NOT EXISTS redirect_url text;
