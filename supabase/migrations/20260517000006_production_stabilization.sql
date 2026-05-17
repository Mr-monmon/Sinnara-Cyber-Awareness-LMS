/*
  Production Stabilization — phishing platform

  1. Rename phishing_campaigns.campaign_name → name
     Frontend consistently uses `.name`; old column was `campaign_name`
  2. Guard: add `name` TEXT alias only if column rename is needed
*/

-- Rename campaign_name to name (idempotent: skip if already renamed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'phishing_campaigns'
      AND column_name = 'campaign_name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'phishing_campaigns'
      AND column_name = 'name'
  ) THEN
    ALTER TABLE phishing_campaigns RENAME COLUMN campaign_name TO name;
  END IF;
END;
$$;
