/*
  Phishing Integration — Stabilization Pass

  Strengthens the Employee ↔ Phishing wiring introduced in 20260518000001.

  1. employee_id FK on phishing_events and phishing_alerts (+ indexes)
  2. phishing_risk_score, last_phishing_event_at, last_phishing_result on users
  3. recompute_employee_phishing_risk() — Click=+30, Submit=+70, capped at 100
  4. BEFORE/AFTER triggers on phishing_events: auto-link + update score + last_*
  5. Backfill: link existing targets, events, and alerts to employees by target/email
  6. Recompute risk scores for all affected employees
  7. Extended employee_phishing_summary view (last_event_at, last_clicked_at,
     last_submitted_at, campaign_count, failure_rate)
*/

-- ── 1. EXTEND EVENT / ALERT TABLES ───────────────────────────────────────────
ALTER TABLE phishing_events
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_phishing_events_employee
  ON phishing_events(employee_id)
  WHERE employee_id IS NOT NULL;

ALTER TABLE phishing_alerts
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_phishing_alerts_employee
  ON phishing_alerts(employee_id)
  WHERE employee_id IS NOT NULL;

-- ── 2. EXTEND USERS TABLE WITH RISK COLUMNS ──────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phishing_risk_score    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_phishing_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_phishing_result   text;

-- Bound the score within [0,100]; safe to re-run (skips if constraint exists).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_phishing_risk_score_range'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_phishing_risk_score_range
      CHECK (phishing_risk_score >= 0 AND phishing_risk_score <= 100);
  END IF;
END $$;

-- ── 3. RISK RECOMPUTE FUNCTION ───────────────────────────────────────────────
-- Click = +30, Submit = +70, capped at 100. Aggregates all historical events.
CREATE OR REPLACE FUNCTION recompute_employee_phishing_risk(p_employee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clicks  integer;
  v_submits integer;
  v_score   integer;
BEGIN
  IF p_employee_id IS NULL THEN RETURN; END IF;

  SELECT
    COUNT(*) FILTER (WHERE event_type = 'LINK_CLICKED'),
    COUNT(*) FILTER (WHERE event_type = 'FORM_SUBMITTED')
  INTO v_clicks, v_submits
  FROM phishing_events
  WHERE employee_id = p_employee_id;

  v_score := LEAST(100, COALESCE(v_clicks, 0) * 30 + COALESCE(v_submits, 0) * 70);

  UPDATE users
  SET phishing_risk_score = v_score,
      updated_at          = now()
  WHERE id = p_employee_id;
END;
$$;

COMMENT ON FUNCTION recompute_employee_phishing_risk IS
  'Recomputes phishing_risk_score for an employee. Click=+30, Submit=+70, capped at 100.';

-- ── 4. EVENT TRIGGERS: LINK + UPDATE SCORE ───────────────────────────────────
-- BEFORE INSERT: auto-link employee_id via target_id, fallback to email match
CREATE OR REPLACE FUNCTION on_phishing_event_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id uuid;
BEGIN
  IF NEW.employee_id IS NULL AND NEW.target_id IS NOT NULL THEN
    SELECT employee_id INTO v_employee_id
    FROM phishing_campaign_targets WHERE id = NEW.target_id;
    NEW.employee_id := v_employee_id;
  END IF;

  IF NEW.employee_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT u.id INTO v_employee_id
    FROM users u
    WHERE lower(u.email) = lower(NEW.email)
      AND u.company_id   = NEW.company_id
      AND u.role         = 'EMPLOYEE'
    LIMIT 1;
    NEW.employee_id := v_employee_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_phishing_event_before_insert ON phishing_events;
CREATE TRIGGER trigger_phishing_event_before_insert
  BEFORE INSERT ON phishing_events
  FOR EACH ROW EXECUTE FUNCTION on_phishing_event_before_insert();

-- AFTER INSERT: update last_phishing_* fields and recompute risk score
CREATE OR REPLACE FUNCTION on_phishing_event_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS NULL THEN RETURN NEW; END IF;

  -- Record last event timestamp + type
  UPDATE users
  SET last_phishing_event_at = NEW.created_at,
      last_phishing_result   = NEW.event_type,
      updated_at             = now()
  WHERE id = NEW.employee_id;

  -- Only re-score on risk-bearing events
  IF NEW.event_type IN ('LINK_CLICKED','FORM_SUBMITTED') THEN
    PERFORM recompute_employee_phishing_risk(NEW.employee_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_phishing_event_after_insert ON phishing_events;
CREATE TRIGGER trigger_phishing_event_after_insert
  AFTER INSERT ON phishing_events
  FOR EACH ROW EXECUTE FUNCTION on_phishing_event_after_insert();

-- ── 5. ALERT LINK TRIGGER ────────────────────────────────────────────────────
-- Auto-link alerts to employees via target_id
CREATE OR REPLACE FUNCTION on_phishing_alert_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS NULL AND NEW.target_id IS NOT NULL THEN
    SELECT employee_id INTO NEW.employee_id
    FROM phishing_campaign_targets WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_phishing_alert_before_insert ON phishing_alerts;
CREATE TRIGGER trigger_phishing_alert_before_insert
  BEFORE INSERT ON phishing_alerts
  FOR EACH ROW EXECUTE FUNCTION on_phishing_alert_before_insert();

-- ── 6. BACKFILL HISTORICAL DATA ──────────────────────────────────────────────
-- Step 1: link existing campaign targets to employees by email
UPDATE phishing_campaign_targets tgt
SET employee_id = u.id
FROM phishing_campaigns c, users u
WHERE c.id            = tgt.campaign_id
  AND lower(u.email)  = lower(tgt.email)
  AND u.company_id    = c.company_id
  AND u.role          = 'EMPLOYEE'
  AND tgt.employee_id IS NULL;

-- Step 2: link existing events via target_id
UPDATE phishing_events ev
SET employee_id = tgt.employee_id
FROM phishing_campaign_targets tgt
WHERE tgt.id           = ev.target_id
  AND tgt.employee_id  IS NOT NULL
  AND ev.employee_id   IS NULL;

-- Step 3: link remaining events directly by email
UPDATE phishing_events ev
SET employee_id = u.id
FROM users u
WHERE lower(u.email) = lower(ev.email)
  AND u.company_id   = ev.company_id
  AND u.role         = 'EMPLOYEE'
  AND ev.employee_id IS NULL;

-- Step 4: link existing alerts via target_id
UPDATE phishing_alerts a
SET employee_id = tgt.employee_id
FROM phishing_campaign_targets tgt
WHERE tgt.id          = a.target_id
  AND tgt.employee_id IS NOT NULL
  AND a.employee_id   IS NULL;

-- Step 5: recompute risk scores + last_phishing_* for every affected employee
DO $$
DECLARE
  emp record;
BEGIN
  FOR emp IN
    SELECT
      ev.employee_id,
      MAX(ev.created_at) AS last_at,
      (ARRAY_AGG(ev.event_type ORDER BY ev.created_at DESC))[1] AS last_type
    FROM phishing_events ev
    WHERE ev.employee_id IS NOT NULL
    GROUP BY ev.employee_id
  LOOP
    UPDATE users
    SET last_phishing_event_at = emp.last_at,
        last_phishing_result   = emp.last_type
    WHERE id = emp.employee_id;

    PERFORM recompute_employee_phishing_risk(emp.employee_id);
  END LOOP;
END $$;

-- ── 7. EXTENDED employee_phishing_summary VIEW ───────────────────────────────
DROP VIEW IF EXISTS employee_phishing_summary;

CREATE OR REPLACE VIEW employee_phishing_summary AS
WITH event_stats AS (
  SELECT
    employee_id,
    MAX(created_at) AS last_event_at,
    MAX(created_at) FILTER (WHERE event_type = 'LINK_CLICKED')   AS ev_last_clicked,
    MAX(created_at) FILTER (WHERE event_type = 'FORM_SUBMITTED') AS ev_last_submitted
  FROM phishing_events
  WHERE employee_id IS NOT NULL
  GROUP BY employee_id
)
SELECT
  u.id                                  AS employee_id,
  u.company_id,
  u.full_name,
  u.email,
  u.job_title,
  u.department_id,
  d.name                                AS department_name,
  u.manager_name,
  u.office_location,
  u.employment_type,
  u.phishing_risk_score,
  u.last_phishing_event_at,
  u.last_phishing_result,

  -- Campaign aggregates
  COUNT(DISTINCT t.campaign_id)                            AS campaign_count,
  COUNT(t.id)                                              AS total_targets,
  COUNT(t.id) FILTER (WHERE t.sent_at IS NOT NULL)         AS emails_sent,
  COUNT(t.id) FILTER (WHERE t.opened_at IS NOT NULL)       AS emails_opened,
  COUNT(t.id) FILTER (WHERE t.clicked_at IS NOT NULL)      AS links_clicked,
  COUNT(t.id) FILTER (WHERE t.submitted_at IS NOT NULL)    AS forms_submitted,
  COUNT(t.id) FILTER (WHERE t.reported_at IS NOT NULL)     AS emails_reported,
  COUNT(t.id) FILTER (WHERE t.credentials_entered = true)  AS credentials_entered,

  -- Last activity (prefer event-table, fallback to target columns)
  COALESCE(es.last_event_at,     MAX(GREATEST(
    t.opened_at, t.clicked_at, t.submitted_at, t.reported_at))) AS last_event_at,
  COALESCE(es.ev_last_clicked,   MAX(t.clicked_at))             AS last_clicked_at,
  COALESCE(es.ev_last_submitted, MAX(t.submitted_at))           AS last_submitted_at,

  -- Failure rate = (clicked OR submitted) / sent
  CASE
    WHEN COUNT(t.id) FILTER (WHERE t.sent_at IS NOT NULL) = 0 THEN 0
    ELSE ROUND(
      100.0 * COUNT(t.id) FILTER (WHERE t.clicked_at IS NOT NULL OR t.submitted_at IS NOT NULL)
            / COUNT(t.id) FILTER (WHERE t.sent_at IS NOT NULL),
      1
    )
  END                                   AS failure_rate,

  -- Click-rate (kept for backward compatibility with earlier consumers)
  CASE
    WHEN COUNT(t.id) FILTER (WHERE t.sent_at IS NOT NULL) = 0 THEN 0
    ELSE ROUND(
      100.0 * COUNT(t.id) FILTER (WHERE t.clicked_at IS NOT NULL)
            / COUNT(t.id) FILTER (WHERE t.sent_at IS NOT NULL),
      1
    )
  END                                   AS click_rate_pct,

  u.created_at,
  u.updated_at

FROM users u
LEFT JOIN departments d                ON d.id = u.department_id
LEFT JOIN phishing_campaign_targets t  ON t.employee_id = u.id
LEFT JOIN event_stats es               ON es.employee_id = u.id
WHERE u.role = 'EMPLOYEE'
GROUP BY
  u.id, u.company_id, u.full_name, u.email, u.job_title,
  u.department_id, d.name, u.manager_name, u.office_location,
  u.employment_type, u.phishing_risk_score, u.last_phishing_event_at,
  u.last_phishing_result, u.created_at, u.updated_at,
  es.last_event_at, es.ev_last_clicked, es.ev_last_submitted;

GRANT SELECT ON employee_phishing_summary TO authenticated;
