-- Fix update_department_vulnerability_stats(): writes a nonexistent column and
-- stops populating the per-stage counters.
--
-- The table department_vulnerability_stats has columns:
--   total_targets, emails_opened, links_clicked, credentials_entered,
--   emails_reported, vulnerability_score, calculated_at   (NO updated_at)
--
-- Migration 20251105111244 ("fix security issues part 3") replaced the original
-- trigger function with a version that:
--   1. INSERTs/UPDATEs a column "updated_at" that does not exist -> every fire raises
--        ERROR: column "updated_at" of relation "department_vulnerability_stats" does not exist
--   2. only stores vulnerability_score, leaving total_targets / emails_opened /
--      links_clicked / credentials_entered / emails_reported permanently at 0.
--
-- This restores the full aggregation and uses the real calculated_at column. The
-- helper calculate_department_vulnerability(dept_id, camp_id) keeps its current
-- (department, campaign) argument order as deployed by 20251105111244.

CREATE OR REPLACE FUNCTION public.update_department_vulnerability_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_dept_id     uuid;
  v_company_id  uuid;
  v_campaign_id uuid;
BEGIN
  v_campaign_id := COALESCE(NEW.campaign_id, OLD.campaign_id);
  v_dept_id     := COALESCE(NEW.department_id, OLD.department_id);

  -- Nothing to aggregate by if the target has no department.
  IF v_dept_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT company_id INTO v_company_id
  FROM phishing_campaigns
  WHERE id = v_campaign_id;

  INSERT INTO department_vulnerability_stats (
    company_id,
    department_id,
    campaign_id,
    total_targets,
    emails_opened,
    links_clicked,
    credentials_entered,
    emails_reported,
    vulnerability_score,
    calculated_at
  )
  SELECT
    v_company_id,
    v_dept_id,
    v_campaign_id,
    COUNT(*),
    SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN credentials_entered THEN 1 ELSE 0 END),
    SUM(CASE WHEN reported_at IS NOT NULL THEN 1 ELSE 0 END),
    calculate_department_vulnerability(v_dept_id, v_campaign_id),
    now()
  FROM phishing_campaign_targets
  WHERE campaign_id = v_campaign_id
    AND department_id = v_dept_id
  ON CONFLICT (campaign_id, department_id)
  DO UPDATE SET
    total_targets       = EXCLUDED.total_targets,
    emails_opened       = EXCLUDED.emails_opened,
    links_clicked       = EXCLUDED.links_clicked,
    credentials_entered = EXCLUDED.credentials_entered,
    emails_reported     = EXCLUDED.emails_reported,
    vulnerability_score = EXCLUDED.vulnerability_score,
    calculated_at       = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Ensure the trigger fires on INSERT as well as UPDATE (20251105111244 had regressed
-- it to AFTER UPDATE only, so the upload INSERT never triggered a recompute).
DROP TRIGGER IF EXISTS trigger_update_dept_vulnerability_stats ON phishing_campaign_targets;
CREATE TRIGGER trigger_update_dept_vulnerability_stats
  AFTER INSERT OR UPDATE ON phishing_campaign_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_department_vulnerability_stats();
