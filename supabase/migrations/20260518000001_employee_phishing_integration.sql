/*
  Employee ↔ Phishing Integration

  1. Extend users table with employee profile fields used in template variable resolution
  2. Add employee_id FK to phishing_group_members for bi-directional linking
  3. sync_employees_to_group RPC: push company employees into a phishing group
  4. link_targets_to_employees RPC: retroactively link existing targets to users by email
*/

-- ── 1. EXTEND USERS TABLE ─────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS manager_name     text DEFAULT '',
  ADD COLUMN IF NOT EXISTS office_location  text DEFAULT '',
  ADD COLUMN IF NOT EXISTS employment_type  text DEFAULT 'FULL_TIME'
    CHECK (employment_type IN ('FULL_TIME','PART_TIME','CONTRACTOR','INTERN',''));

-- job_title already exists on public_assessments but not users — add it safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'job_title'
  ) THEN
    ALTER TABLE users ADD COLUMN job_title text DEFAULT '';
  END IF;
END $$;

-- ── 2. LINK phishing_group_members → users ────────────────────────────────────
ALTER TABLE phishing_group_members
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pgm_employee ON phishing_group_members(employee_id)
  WHERE employee_id IS NOT NULL;

-- Unique: one employee per group (ignore if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'phishing_group_members' AND indexname = 'idx_pgm_group_employee_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_pgm_group_employee_unique
      ON phishing_group_members(group_id, employee_id)
      WHERE employee_id IS NOT NULL;
  END IF;
END $$;

-- ── 3. sync_employees_to_group ────────────────────────────────────────────────
-- Inserts or updates group members from the users table.
-- If p_department_id is NULL, syncs the entire company.
-- Skips employees already in the group (by employee_id).
-- Returns the count of rows inserted.
CREATE OR REPLACE FUNCTION sync_employees_to_group(
  p_group_id      uuid,
  p_department_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id  uuid;
  v_inserted    integer := 0;
BEGIN
  -- Verify group exists and get company_id
  SELECT company_id INTO v_company_id
  FROM phishing_groups
  WHERE id = p_group_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Group not found');
  END IF;

  -- Insert employees not yet in the group
  WITH employees AS (
    SELECT
      u.id            AS employee_id,
      u.email,
      split_part(u.full_name, ' ', 1)                    AS first_name,
      NULLIF(substring(u.full_name FROM position(' ' IN u.full_name) + 1), '') AS last_name,
      COALESCE(u.job_title, '')                           AS position,
      COALESCE(d.name, '')                                AS department,
      jsonb_build_object(
        'manager_name',    COALESCE(u.manager_name, ''),
        'office_location', COALESCE(u.office_location, ''),
        'employment_type', COALESCE(u.employment_type, ''),
        'phone',           COALESCE(u.phone, '')
      )                                                   AS custom_data
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE u.company_id  = v_company_id
      AND u.role        = 'EMPLOYEE'
      AND (p_department_id IS NULL OR u.department_id = p_department_id)
      -- Skip already-synced
      AND NOT EXISTS (
        SELECT 1 FROM phishing_group_members m
        WHERE m.group_id = p_group_id AND m.employee_id = u.id
      )
  ),
  ins AS (
    INSERT INTO phishing_group_members
      (group_id, employee_id, first_name, last_name, email, position, department, custom_data)
    SELECT
      p_group_id, employee_id, first_name, COALESCE(last_name,''),
      email, position, department, custom_data
    FROM employees
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM ins;

  RETURN jsonb_build_object('success', true, 'inserted', v_inserted);
END;
$$;

COMMENT ON FUNCTION sync_employees_to_group IS
  'Syncs employees from users table into a phishing group. '
  'Skips employees already in the group. Pass p_department_id to filter by department.';

-- ── 4. link_targets_to_employees ─────────────────────────────────────────────
-- Back-fills employee_id on phishing_campaign_targets by matching email
-- within the same company. Safe to run multiple times (idempotent).
CREATE OR REPLACE FUNCTION link_targets_to_employees(
  p_campaign_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  WITH matched AS (
    SELECT t.id AS target_id, u.id AS user_id
    FROM phishing_campaign_targets t
    JOIN phishing_campaigns c ON c.id = t.campaign_id
    JOIN users u
      ON lower(u.email) = lower(t.email)
     AND u.company_id   = c.company_id
     AND u.role         = 'EMPLOYEE'
    WHERE t.employee_id IS NULL
      AND (p_campaign_id IS NULL OR t.campaign_id = p_campaign_id)
  ),
  upd AS (
    UPDATE phishing_campaign_targets tgt
    SET employee_id = matched.user_id
    FROM matched
    WHERE tgt.id = matched.target_id
    RETURNING tgt.id
  )
  SELECT COUNT(*) INTO v_updated FROM upd;

  RETURN jsonb_build_object('success', true, 'updated', v_updated);
END;
$$;

COMMENT ON FUNCTION link_targets_to_employees IS
  'Back-fills employee_id on phishing_campaign_targets by matching email to users. '
  'Pass p_campaign_id to scope to one campaign, or NULL for all.';

-- ── 5. Trigger: auto-link new targets on INSERT ───────────────────────────────
CREATE OR REPLACE FUNCTION auto_link_target_to_employee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT u.id INTO NEW.employee_id
    FROM phishing_campaigns c
    JOIN users u
      ON lower(u.email) = lower(NEW.email)
     AND u.company_id   = c.company_id
     AND u.role         = 'EMPLOYEE'
    WHERE c.id = NEW.campaign_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_link_target ON phishing_campaign_targets;
CREATE TRIGGER trigger_auto_link_target
  BEFORE INSERT ON phishing_campaign_targets
  FOR EACH ROW EXECUTE FUNCTION auto_link_target_to_employee();

-- ── 6. employee_phishing_summary VIEW ────────────────────────────────────────
-- Unified per-employee view: LMS progress + phishing exposure.
CREATE OR REPLACE VIEW employee_phishing_summary AS
SELECT
  u.id                                AS employee_id,
  u.company_id,
  u.full_name,
  u.email,
  u.job_title,
  u.department_id,
  d.name                              AS department_name,
  u.manager_name,
  u.office_location,
  u.employment_type,

  -- Phishing stats
  COUNT(DISTINCT t.campaign_id)       AS campaigns_targeted,
  COUNT(t.id)                         AS total_targets,
  COUNT(t.id) FILTER (WHERE t.sent_at IS NOT NULL)         AS emails_sent,
  COUNT(t.id) FILTER (WHERE t.opened_at IS NOT NULL)       AS emails_opened,
  COUNT(t.id) FILTER (WHERE t.clicked_at IS NOT NULL)      AS links_clicked,
  COUNT(t.id) FILTER (WHERE t.submitted_at IS NOT NULL)    AS forms_submitted,
  COUNT(t.id) FILTER (WHERE t.reported_at IS NOT NULL)     AS emails_reported,
  COUNT(t.id) FILTER (WHERE t.credentials_entered = true)  AS credentials_entered,

  -- Last phishing result
  MAX(t.campaign_id) FILTER (WHERE t.clicked_at IS NOT NULL) AS last_click_campaign_id,
  MAX(t.clicked_at)                   AS last_clicked_at,

  -- Click-through rate
  CASE
    WHEN COUNT(t.id) FILTER (WHERE t.sent_at IS NOT NULL) = 0 THEN 0
    ELSE ROUND(
      100.0 * COUNT(t.id) FILTER (WHERE t.clicked_at IS NOT NULL)
            / COUNT(t.id) FILTER (WHERE t.sent_at IS NOT NULL),
      1
    )
  END                                 AS click_rate_pct,

  u.created_at,
  u.updated_at

FROM users u
LEFT JOIN departments d ON d.id = u.department_id
LEFT JOIN phishing_campaign_targets t ON t.employee_id = u.id
WHERE u.role = 'EMPLOYEE'
GROUP BY
  u.id, u.company_id, u.full_name, u.email, u.job_title,
  u.department_id, d.name, u.manager_name, u.office_location,
  u.employment_type, u.created_at, u.updated_at;

-- Grant SELECT to authenticated role (same pattern as other views)
GRANT SELECT ON employee_phishing_summary TO authenticated;
