/*
  Migration: phishing_domains — platform domain support

  Changes:
  - Make company_id nullable (platform-wide domains don't belong to one company)
  - Add is_platform_domain flag to distinguish platform vs company domains
  - Update unique constraint to allow multiple companies + platform entries
*/

-- Make company_id nullable
ALTER TABLE phishing_domains
  ALTER COLUMN company_id DROP NOT NULL;

-- Add platform domain flag
ALTER TABLE phishing_domains
  ADD COLUMN IF NOT EXISTS is_platform_domain boolean NOT NULL DEFAULT false;

-- Add domain_id to phishing_campaign_requests
ALTER TABLE phishing_campaign_requests
  ADD COLUMN IF NOT EXISTS domain_id uuid REFERENCES phishing_domains(id) ON DELETE SET NULL;

-- Drop old unique constraint (company_id + domain_name) and replace
ALTER TABLE phishing_domains
  DROP CONSTRAINT IF EXISTS phishing_domains_company_id_domain_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS phishing_domains_platform_unique
  ON phishing_domains (domain_name)
  WHERE is_platform_domain = true;

CREATE UNIQUE INDEX IF NOT EXISTS phishing_domains_company_unique
  ON phishing_domains (company_id, domain_name)
  WHERE is_platform_domain = false AND company_id IS NOT NULL;

-- Index for fast lookup of verified platform domains
CREATE INDEX IF NOT EXISTS idx_phishing_domains_platform_verified
  ON phishing_domains (is_platform_domain, is_verified)
  WHERE is_platform_domain = true AND is_verified = true;
