/*
  Per-campaign credential-capture control
  =======================================

  The campaign builder had a "Capture Credentials" toggle that did nothing: it
  was never sent to the launcher, and there was no column on phishing_campaigns
  to store it. This adds the column so the toggle can become a real control.

  What it governs: whether a submission on the landing page is RECORDED. When
  true (the default, matching today's behaviour), serve-landing-page injects the
  interceptor that logs a FORM_SUBMITTED event — field names only, never the
  values, unchanged. When false, the landing page still shows and still
  redirects, but a submit records nothing. Some awareness campaigns want
  click-through measured without logging any form interaction, and until now the
  platform could not express that.

  Defaulted to true so no existing campaign changes behaviour when this runs.

  Reversal:
      ALTER TABLE public.phishing_campaigns DROP COLUMN IF EXISTS capture_credentials;
*/

ALTER TABLE public.phishing_campaigns
  ADD COLUMN IF NOT EXISTS capture_credentials boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.phishing_campaigns.capture_credentials IS
  'When false, a submit on the campaign''s landing page is not recorded (no FORM_SUBMITTED event). Field values are never stored regardless; this only controls whether the submission event is logged at all.';
