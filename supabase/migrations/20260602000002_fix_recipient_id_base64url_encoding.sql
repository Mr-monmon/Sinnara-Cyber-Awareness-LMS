-- Fix: PostgreSQL encode() does not support the 'base64url' encoding.
--
-- The recipient_id column on phishing_campaign_targets was created with a default of
--   encode(gen_random_bytes(12), 'base64url')
-- which is invalid: encode() only accepts 'base64', 'hex', and 'escape'. Every INSERT
-- into phishing_campaign_targets (e.g. uploading Gophish results) therefore failed with
--   ERROR: unrecognized encoding: "base64url"
-- causing target rows to never persist (and, downstream, department vulnerability stats
-- to stay empty).
--
-- recipient_id is embedded directly in tracking URLs (?r=<recipient_id>), so it must be
-- URL-safe. We reproduce base64url with a supported expression:
--   translate(encode(...,'base64'), '+/=', '-_')
-- which maps '+'->'-', '/'->'_', and drops '=' padding.

ALTER TABLE phishing_campaign_targets
  ALTER COLUMN recipient_id
  SET DEFAULT translate(encode(gen_random_bytes(12), 'base64'), '+/=', '-_');

-- Backfill any rows that ended up without a recipient_id.
UPDATE phishing_campaign_targets
SET recipient_id = translate(encode(gen_random_bytes(12), 'base64'), '+/=', '-_')
WHERE recipient_id IS NULL OR recipient_id = '';
