/* ============================================================================
   MANUAL CORRECTIVE SQL — run in Supabase SQL Editor
   Date:    2026-06-09
   Scope:   ONLY the three migrations the operator applies manually:
              1. 20260606000001_production_readiness_phase1_2.sql
              2. 20260607000001_smtp_profile_visibility.sql
              3. 20260607000002_employee_risk_insufficient_evidence.sql
   ----------------------------------------------------------------------------
   WHY THIS FILE EXISTS
   ----------------------------------------------------------------------------
   Migrations (1) and (2) were never modified after their original commit, so if
   you applied them manually they are already correct — NO action is required for
   them and this file deliberately contains no SQL for them.

   Migration (3) WAS modified after it was first written:

       ORIGINAL : CREATE OR REPLACE VIEW employee_risk_scores AS ...
       FIXED    : DROP VIEW IF EXISTS employee_risk_scores;
                  CREATE VIEW employee_risk_scores AS ...

   Reason: PostgreSQL's CREATE OR REPLACE VIEW cannot rename or reorder existing
   columns. The previous definition of this view (migration 20260515000002) has a
   DIFFERENT column order, so running the ORIGINAL version of migration (3)
   manually would have FAILED with:

       ERROR: cannot change name of view column "..." to "..."

   If that happened, your live database still holds the OLD view — it is missing
   the new columns (assessed_risk_score, has_course_data, has_exam_data,
   has_phishing_data, assessed) and the new 'INSUFFICIENT_EVIDENCE' risk level.

   This script DROPs and recreates the view with the final, correct definition.
   It is idempotent and safe to run whether your previous manual apply of
   migration (3) SUCCEEDED, FAILED, or was never attempted.

   ----------------------------------------------------------------------------
   DESTRUCTIVE?  NO (non-destructive).
   ----------------------------------------------------------------------------
   A VIEW stores no data — it is a stored query. DROP VIEW removes only the
   definition, not any underlying table rows. No table data is touched. The plain
   DROP (without CASCADE) will fail safely if any other object unexpectedly
   depends on this view; the PRE-CHECK below detects that case before you run it.
   ============================================================================ */


/* ============================================================================
   SECTION A — PRE-CHECK  (read-only; run first, inspect the results)
   ----------------------------------------------------------------------------
   These queries tell you the CURRENT state of the live view so you can confirm
   the fix is needed and that nothing depends on the view.
   ============================================================================ */

-- A1. Does the view exist at all, and is it a VIEW?
SELECT
  c.relname           AS object_name,
  c.relkind           AS kind,        -- 'v' = view
  pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'employee_risk_scores';

-- A2. Current columns of the view, in order. Look for the NEW columns:
--     assessed_risk_score, has_course_data, has_exam_data, has_phishing_data,
--     assessed.  If they are ABSENT, your live view is the OLD version and the
--     fix below is required.
SELECT ordinal_position, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'employee_risk_scores'
ORDER BY ordinal_position;

-- A3. Does anything depend on the view? A plain DROP would fail if so.
--     Expect ZERO rows. If rows are returned, STOP and review before dropping
--     (do NOT blindly add CASCADE — investigate what those dependents are).
--
--     How this works: pg_depend rows where refobjid = the view's OID record
--     objects that REFERENCE the view (i.e., depend ON it). For each such
--     dependency we join pg_rewrite to find the view/rule that holds it, then
--     resolve that to its parent relation via r.ev_class. This correctly
--     surfaces other views whose definitions call employee_risk_scores — it
--     does NOT surface the tables that employee_risk_scores itself queries.
SELECT DISTINCT
  dependent_ns.nspname                        AS dependent_schema,
  dependent_rel.relname                       AS dependent_name,
  CASE dependent_rel.relkind
    WHEN 'v' THEN 'view'
    WHEN 'r' THEN 'table'
    WHEN 'm' THEN 'materialized view'
    ELSE dependent_rel.relkind::text
  END                                         AS dependent_type
FROM pg_depend        d
JOIN pg_rewrite       r              ON r.oid  = d.objid
                                    AND d.classid = 'pg_rewrite'::regclass
JOIN pg_class         dependent_rel  ON dependent_rel.oid = r.ev_class
JOIN pg_namespace     dependent_ns   ON dependent_ns.oid  = dependent_rel.relnamespace
WHERE d.refobjid = 'public.employee_risk_scores'::regclass
  AND dependent_rel.oid <> 'public.employee_risk_scores'::regclass
ORDER BY dependent_schema, dependent_name;


/* ============================================================================
   SECTION B — MAIN FIX  (the corrective SQL)
   ----------------------------------------------------------------------------
   Drops the view (if present) and recreates it with the final definition that
   matches supabase/migrations/20260607000002_employee_risk_insufficient_evidence.sql.
   Wrapped in a transaction so a mid-statement failure rolls back cleanly.
   ============================================================================ */

BEGIN;

DROP VIEW IF EXISTS public.employee_risk_scores;

CREATE VIEW public.employee_risk_scores AS
WITH

-- 1. Course completion per employee
course_stats AS (
  SELECT
    u.id                                           AS employee_id,
    u.company_id,
    COUNT(ec.id)                                   AS total_assigned,
    COUNT(ec.id) FILTER (WHERE ec.status = 'COMPLETED') AS completed
  FROM users u
  LEFT JOIN employee_courses ec ON ec.employee_id = u.id
  WHERE u.role = 'EMPLOYEE'
  GROUP BY u.id, u.company_id
),

-- 2. Exam performance per employee (best attempt per exam)
exam_stats AS (
  SELECT
    best.employee_id,
    AVG(best.pct)::numeric AS avg_exam_pct
  FROM (
    SELECT
      employee_id,
      exam_id,
      MAX(percentage) AS pct
    FROM exam_results
    GROUP BY employee_id, exam_id
  ) best
  GROUP BY best.employee_id
),

-- 3. Phishing susceptibility per employee
phishing_stats AS (
  SELECT
    pct.employee_id,
    COUNT(*)                                                          AS total_targeted,
    COUNT(*) FILTER (WHERE pct.clicked_at IS NOT NULL)               AS clicked,
    COUNT(*) FILTER (WHERE pct.credentials_entered = true)           AS creds_entered
  FROM phishing_campaign_targets pct
  WHERE pct.employee_id IS NOT NULL
  GROUP BY pct.employee_id
),

-- 4. Combine
combined AS (
  SELECT
    cs.employee_id,
    cs.company_id,

    -- Evidence flags: true only if the employee has actual data
    (cs.total_assigned > 0)                         AS has_course_data,
    (es.avg_exam_pct IS NOT NULL)                   AS has_exam_data,
    (ps.total_targeted IS NOT NULL AND ps.total_targeted > 0) AS has_phishing_data,

    -- course component (0–40, higher = more risk)
    CASE
      WHEN cs.total_assigned = 0 THEN 0
      ELSE ROUND(40.0 * (1.0 - cs.completed::numeric / cs.total_assigned), 2)
    END AS course_risk,

    -- exam component (0–40, higher = more risk)
    CASE
      WHEN es.avg_exam_pct IS NULL THEN 0
      ELSE ROUND(40.0 * (1.0 - LEAST(es.avg_exam_pct, 100) / 100.0), 2)
    END AS exam_risk,

    -- phishing component (0–20, higher = more risk)
    CASE
      WHEN ps.total_targeted IS NULL OR ps.total_targeted = 0 THEN 0
      ELSE ROUND(20.0 * ps.clicked::numeric / ps.total_targeted, 2)
    END AS phishing_risk,

    -- raw numbers for display
    cs.total_assigned,
    cs.completed,
    COALESCE(es.avg_exam_pct, 0)             AS avg_exam_pct,
    COALESCE(ps.total_targeted, 0)           AS phishing_total,
    COALESCE(ps.clicked, 0)                  AS phishing_clicked,
    COALESCE(ps.creds_entered, 0)            AS phishing_creds_entered

  FROM course_stats cs
  LEFT JOIN exam_stats    es ON es.employee_id = cs.employee_id
  LEFT JOIN phishing_stats ps ON ps.employee_id = cs.employee_id
)

SELECT
  c.employee_id,
  c.company_id,
  u.full_name,
  u.email,
  u.department_id,
  d.name                                        AS department_name,
  c.course_risk,
  c.exam_risk,
  c.phishing_risk,
  ROUND(c.course_risk + c.exam_risk + c.phishing_risk, 2) AS risk_score,

  -- assessed_risk_score is NULL for employees with no evidence;
  -- callers should exclude NULLs when calculating company averages.
  CASE
    WHEN NOT (c.has_course_data OR c.has_exam_data OR c.has_phishing_data) THEN NULL
    ELSE ROUND(c.course_risk + c.exam_risk + c.phishing_risk, 2)
  END                                           AS assessed_risk_score,

  c.has_course_data,
  c.has_exam_data,
  c.has_phishing_data,
  (c.has_course_data OR c.has_exam_data OR c.has_phishing_data) AS assessed,

  c.total_assigned,
  c.completed,
  ROUND(
    CASE WHEN c.total_assigned = 0 THEN 0
    ELSE c.completed::numeric * 100 / c.total_assigned END, 1
  )                                             AS completion_pct,
  ROUND(c.avg_exam_pct, 1)                      AS avg_exam_pct,
  c.phishing_total,
  c.phishing_clicked,
  c.phishing_creds_entered,
  CASE
    WHEN NOT (c.has_course_data OR c.has_exam_data OR c.has_phishing_data) THEN 'INSUFFICIENT_EVIDENCE'
    WHEN (c.course_risk + c.exam_risk + c.phishing_risk) >= 70 THEN 'CRITICAL'
    WHEN (c.course_risk + c.exam_risk + c.phishing_risk) >= 40 THEN 'HIGH'
    WHEN (c.course_risk + c.exam_risk + c.phishing_risk) >= 20 THEN 'MEDIUM'
    ELSE 'LOW'
  END                                           AS risk_level

FROM combined c
JOIN users       u ON u.id = c.employee_id
LEFT JOIN departments d ON d.id = u.department_id;

COMMIT;


/* ============================================================================
   SECTION C — POST-CHECK  (read-only; run after the fix and confirm results)
   ----------------------------------------------------------------------------
   These confirm the new view is in place. Send me these results to confirm.
   ============================================================================ */

-- C1. The 5 new columns MUST now be present. Expect 5 rows.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'employee_risk_scores'
  AND column_name IN
    ('assessed_risk_score','has_course_data','has_exam_data','has_phishing_data','assessed')
ORDER BY column_name;

-- C2. The view must be selectable and the new risk level must be reachable.
--     This returns the distribution of risk levels. 'INSUFFICIENT_EVIDENCE'
--     will appear only if you have employees with no training/exam/phishing data.
SELECT risk_level, COUNT(*) AS employees
FROM public.employee_risk_scores
GROUP BY risk_level
ORDER BY risk_level;

-- C3. Confirm anon/authenticated cannot directly read it unless intended
--     (sanity check — this view is read by the frontend via the API role).
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'employee_risk_scores';


/* ============================================================================
   SECTION D — ROLLBACK  (only if you must revert to the OLD view)
   ----------------------------------------------------------------------------
   Restores the previous definition from migration 20260515000002. This REMOVES
   the INSUFFICIENT_EVIDENCE behaviour and the new columns — the frontend risk
   pages that expect assessed_risk_score will degrade. Use only if the new view
   causes a problem. Non-destructive (no table data touched).
   ============================================================================ */

/*  -- Uncomment the block below to roll back.

BEGIN;

DROP VIEW IF EXISTS public.employee_risk_scores;

CREATE VIEW public.employee_risk_scores AS
WITH
course_stats AS (
  SELECT
    u.id                                           AS employee_id,
    u.company_id,
    COUNT(ec.id)                                   AS total_assigned,
    COUNT(ec.id) FILTER (WHERE ec.status = 'COMPLETED') AS completed
  FROM users u
  LEFT JOIN employee_courses ec ON ec.employee_id = u.id
  WHERE u.role = 'EMPLOYEE'
  GROUP BY u.id, u.company_id
),
exam_stats AS (
  SELECT
    er.employee_id,
    AVG(best.pct)::numeric AS avg_exam_pct
  FROM (
    SELECT employee_id, exam_id, MAX(percentage) AS pct
    FROM exam_results
    GROUP BY employee_id, exam_id
  ) best
  JOIN exam_results er ON er.employee_id = best.employee_id
  GROUP BY er.employee_id
),
phishing_stats AS (
  SELECT
    pct.employee_id,
    COUNT(*)                                                AS total_targeted,
    COUNT(*) FILTER (WHERE pct.clicked_at IS NOT NULL)     AS clicked,
    COUNT(*) FILTER (WHERE pct.credentials_entered = true) AS creds_entered
  FROM phishing_campaign_targets pct
  WHERE pct.employee_id IS NOT NULL
  GROUP BY pct.employee_id
),
combined AS (
  SELECT
    cs.employee_id,
    cs.company_id,
    CASE WHEN cs.total_assigned = 0 THEN 0
      ELSE ROUND(40.0 * (1.0 - cs.completed::numeric / cs.total_assigned), 2) END AS course_risk,
    CASE WHEN es.avg_exam_pct IS NULL THEN 0
      ELSE ROUND(40.0 * (1.0 - LEAST(es.avg_exam_pct, 100) / 100.0), 2) END AS exam_risk,
    CASE WHEN ps.total_targeted IS NULL OR ps.total_targeted = 0 THEN 0
      ELSE ROUND(20.0 * ps.clicked::numeric / ps.total_targeted, 2) END AS phishing_risk,
    cs.total_assigned,
    cs.completed,
    COALESCE(es.avg_exam_pct, 0)   AS avg_exam_pct,
    COALESCE(ps.total_targeted, 0) AS phishing_total,
    COALESCE(ps.clicked, 0)        AS phishing_clicked,
    COALESCE(ps.creds_entered, 0)  AS phishing_creds_entered
  FROM course_stats cs
  LEFT JOIN exam_stats     es ON es.employee_id = cs.employee_id
  LEFT JOIN phishing_stats ps ON ps.employee_id = cs.employee_id
)
SELECT
  c.employee_id,
  c.company_id,
  u.full_name,
  u.email,
  u.department_id,
  d.name                                        AS department_name,
  c.course_risk,
  c.exam_risk,
  c.phishing_risk,
  ROUND(c.course_risk + c.exam_risk + c.phishing_risk, 2) AS risk_score,
  c.total_assigned,
  c.completed,
  ROUND(CASE WHEN c.total_assigned = 0 THEN 0
    ELSE c.completed::numeric * 100 / c.total_assigned END, 1) AS completion_pct,
  ROUND(c.avg_exam_pct, 1)                      AS avg_exam_pct,
  c.phishing_total,
  c.phishing_clicked,
  c.phishing_creds_entered,
  CASE
    WHEN (c.course_risk + c.exam_risk + c.phishing_risk) >= 70 THEN 'CRITICAL'
    WHEN (c.course_risk + c.exam_risk + c.phishing_risk) >= 40 THEN 'HIGH'
    WHEN (c.course_risk + c.exam_risk + c.phishing_risk) >= 20 THEN 'MEDIUM'
    ELSE 'LOW'
  END                                           AS risk_level
FROM combined c
JOIN users       u ON u.id = c.employee_id
LEFT JOIN departments d ON d.id = u.department_id;

COMMIT;

*/

/* ============================================================================
   END
   ----------------------------------------------------------------------------
   Migrations (1) 20260606000001 and (2) 20260607000001 require NO corrective
   SQL — they were never changed after their first version, so your manual apply
   of them is already current. Only the employee_risk_scores view above needed a
   fix.  Production-readiness remains BLOCKED until you run Sections A→C and
   confirm the POST-CHECK (Section C) results.
   ============================================================================ */
