-- ════════════════════════════════════════════════════════════════════════
-- Add per-company phishing delivery mode
--
-- Each company operates phishing simulations in one of two modes, set by a
-- platform admin from the "Company Phishing Limits" page:
--
--   • CUSTOM  — self-service. The company builds and launches campaigns itself
--               using the in-platform engine (Dashboard, Campaigns, SMTP
--               Profiles, Target Groups, Landing Pages, Email Templates,
--               Custom Variables, Alerts). This is the current behaviour and
--               therefore the default.
--
--   • TICKET  — the company submits a campaign *request* (a ticket). The
--               platform team runs the actual campaign externally (Gophish)
--               and uploads the results back into the platform, where they
--               appear on the company's phishing dashboard.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE company_phishing_limits
  ADD COLUMN IF NOT EXISTS phishing_mode text NOT NULL DEFAULT 'CUSTOM';

-- Constrain to the two supported modes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_phishing_limits_phishing_mode_check'
  ) THEN
    ALTER TABLE company_phishing_limits
      ADD CONSTRAINT company_phishing_limits_phishing_mode_check
      CHECK (phishing_mode IN ('TICKET', 'CUSTOM'));
  END IF;
END $$;

COMMENT ON COLUMN company_phishing_limits.phishing_mode IS
  'Phishing delivery mode: CUSTOM (self-service in-platform engine) or TICKET (request-based, run externally via Gophish with results uploaded back).';

-- ────────────────────────────────────────────────────────────────────────
-- The frontend reads phishing_mode to decide which phishing pages to show in
-- the sidebar. The existing SELECT policy ("ca_limits_view") only covered
-- COMPANY_ADMIN; broaden read access to the other company-scoped roles so
-- the mode resolves correctly for them too (otherwise it silently falls back
-- to CUSTOM and the ticket-only navigation would not apply).
-- ────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ca_limits_view" ON company_phishing_limits;
CREATE POLICY "ca_limits_view" ON company_phishing_limits FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE id = auth.uid()
        AND role IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'PHISHING_OPERATOR')
    )
  );
