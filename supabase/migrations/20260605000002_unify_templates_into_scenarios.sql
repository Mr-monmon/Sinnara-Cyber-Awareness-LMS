/*
  Unify phishing_templates into phishing_scenarios (Phishing Scenarios = the primary entity)

  Product decision: "Phishing Template" is deprecated and folded into the richer
  "Phishing Scenario" bundle (email + landing page + category/difficulty). Email
  Templates (phishing_company_email_templates) and Landing Pages remain separate
  reusable building blocks; the scenario is the ready-made package companies pick.

  This migration:
    1. Copies every phishing_templates row into phishing_scenarios, PRESERVING the id
       so existing template_id references remain valid as scenario ids.
    2. Adds scenario_id to phishing_campaign_requests and backfills it from template_id.
    3. Backfills phishing_campaigns.scenario_id (column already exists) from template_id.

  phishing_templates and the legacy *template_id* columns are LEFT IN PLACE (deprecated)
  so the change is reversible and no data is lost; nothing in the app reads them afterward.
*/

-- ── 1. Fold legacy templates into scenarios (preserve id; skip if already present) ──
INSERT INTO phishing_scenarios
  (id, name, description, category, difficulty, email_subject, email_html,
   landing_page_html, capture_credentials, redirect_url, is_active, created_at, updated_at)
SELECT
  t.id,
  t.name,
  COALESCE(t.description, ''),
  COALESCE(NULLIF(t.category, ''), 'GENERAL'),
  COALESCE(NULLIF(t.difficulty_level, ''), 'MEDIUM'),
  t.subject,
  t.html_content,
  '',                          -- legacy templates carried no landing page
  false,
  'https://www.google.com',
  COALESCE(t.is_active, true),
  COALESCE(t.created_at, now()),
  COALESCE(t.updated_at, now())
FROM phishing_templates t
ON CONFLICT (id) DO NOTHING;

-- ── 2. phishing_campaign_requests.scenario_id (+ backfill from template_id) ──
ALTER TABLE phishing_campaign_requests
  ADD COLUMN IF NOT EXISTS scenario_id uuid REFERENCES phishing_scenarios(id);

UPDATE phishing_campaign_requests
  SET scenario_id = template_id
  WHERE scenario_id IS NULL
    AND template_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM phishing_scenarios s WHERE s.id = template_id);

CREATE INDEX IF NOT EXISTS idx_phishing_campaign_requests_scenario
  ON phishing_campaign_requests (scenario_id);

-- ── 3. phishing_campaigns.scenario_id backfill (column already exists) ──
UPDATE phishing_campaigns
  SET scenario_id = template_id
  WHERE scenario_id IS NULL
    AND template_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM phishing_scenarios s WHERE s.id = template_id);

-- ── 4. Deprecation marker ──
COMMENT ON TABLE phishing_templates IS
  'DEPRECATED (2026-06): folded into phishing_scenarios. Kept for backward compatibility; not read by the app.';
