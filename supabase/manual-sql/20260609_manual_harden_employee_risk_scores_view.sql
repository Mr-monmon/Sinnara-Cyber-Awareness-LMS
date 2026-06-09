/* ============================================================================
   MANUAL HARDENING SQL — run in Supabase SQL Editor
   Date:    2026-06-09
   Target:  public.employee_risk_scores  (created by migration 20260607000002)
   ----------------------------------------------------------------------------
   WHY THIS FILE EXISTS
   ----------------------------------------------------------------------------
   The post-check (Section C3) of the corrective fix
   (20260609_manual_fix_for_modified_migrations.sql) revealed that
   employee_risk_scores:

     1. Is NOT security_invoker → it runs with its OWNER's privileges (postgres)
        and therefore BYPASSES row-level security on the underlying tables.
     2. Grants SELECT to `anon` (and broad privileges to anon/authenticated),
        inherited from Supabase's default privileges when the view was created.

   Combined, an unauthenticated request to /rest/v1/employee_risk_scores would
   return EVERY employee's PII (full name, email) and risk scores across EVERY
   company; and any authenticated user could read other companies' rows.

   This script hardens the view:
     - Recreates it WITH (security_invoker = on) so the QUERYING user's RLS on
       the underlying tables is enforced (verified: users, departments,
       employee_courses, exam_results, phishing_campaign_targets all have
       company-admin SELECT policies in 20260515000004 / 20260604000004).
     - REVOKEs all access from PUBLIC and anon.
     - GRANTs SELECT to authenticated (the app reads this view with a real
       Supabase JWT) and service_role.

   ----------------------------------------------------------------------------
   DESTRUCTIVE?  NO (non-destructive).
   ----------------------------------------------------------------------------
   A view holds no data. DROP/CREATE VIEW changes only the definition and
   privileges; no table rows are touched.

   ----------------------------------------------------------------------------
   ⚠️  HOW TO VERIFY CORRECTLY  (read before running)
   ----------------------------------------------------------------------------
   The Supabase SQL Editor runs as the `postgres` SUPERUSER, which bypasses RLS
   EVEN WITH security_invoker on. So a `SELECT * FROM employee_risk_scores` in
   the editor will STILL return all rows — that is expected and does NOT mean
   the fix failed. Real verification must be done:
     (a) Through the APP as a company admin → confirm the Risk dashboard still
         loads and shows ONLY that company's employees.
     (b) As anon via the REST API → should return permission denied / empty.
   Section C below covers what you CAN verify in the editor (grants + flag).
   ============================================================================ */


/* ============================================================================
   SECTION A — PRE-CHECK  (read-only; run first)
   ============================================================================ */

-- A1. Current security_invoker flag. Expect reloptions to be NULL or to NOT
--     contain 'security_invoker=on' BEFORE this fix.
SELECT
  c.relname,
  c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'employee_risk_scores';

-- A2. Current grants. Expect to see `anon` with SELECT (the problem) BEFORE the
--     fix. After the fix, anon should disappear from this list.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'employee_risk_scores'
ORDER BY grantee, privilege_type;


/* ============================================================================
   SECTION B — MAIN HARDENING  (recreate as security_invoker + fix grants)
   ----------------------------------------------------------------------------
   The view definition is IDENTICAL to the corrected migration 20260607000002 —
   only `WITH (security_invoker = on)` and the explicit grant block are added.
   ============================================================================ */

BEGIN;

DROP VIEW IF EXISTS public.employee_risk_scores;

CREATE VIEW public.employee_risk_scores
  WITH (security_invoker = on) AS
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

-- Lock down access: no PUBLIC/anon; SELECT only for the app's authenticated
-- role and the server-side service_role.
REVOKE ALL ON public.employee_risk_scores FROM PUBLIC;
REVOKE ALL ON public.employee_risk_scores FROM anon;
REVOKE ALL ON public.employee_risk_scores FROM authenticated;
GRANT SELECT ON public.employee_risk_scores TO authenticated;
GRANT SELECT ON public.employee_risk_scores TO service_role;

COMMIT;


/* ============================================================================
   SECTION C — POST-CHECK  (read-only; run after the fix and confirm results)
   ============================================================================ */

-- C1. security_invoker MUST now be on. Expect reloptions to contain
--     {security_invoker=on}.
SELECT c.relname, c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'employee_risk_scores';

-- C2. Grants MUST now be: authenticated → SELECT, service_role → SELECT.
--     `anon` MUST NOT appear. `postgres` (owner) will still appear — that is
--     normal and expected.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'employee_risk_scores'
ORDER BY grantee, privilege_type;

-- C3. (Editor-side smoke test only) The view is still selectable. NOTE: the SQL
--     Editor runs as postgres/superuser and BYPASSES RLS, so this returns ALL
--     rows regardless of the fix. This only proves the view compiles — it does
--     NOT prove tenant isolation. See the app/anon verification steps below.
SELECT risk_level, COUNT(*) AS employees
FROM public.employee_risk_scores
GROUP BY risk_level
ORDER BY risk_level;

/* ----------------------------------------------------------------------------
   C4 — REAL isolation verification (cannot be done from the SQL Editor):
     (a) In the APP, log in as a COMPANY_ADMIN and open the Risk Score page.
         → It must still load and show ONLY that company's employees.
     (b) (Optional) Call the REST endpoint with the ANON key and no user JWT:
           curl "$SUPABASE_URL/rest/v1/employee_risk_scores?select=email" \
                -H "apikey: $ANON_KEY"
         → Must return [] or a permission error — NOT employee rows.
   Report (a) and (b) back to confirm production-readiness for this view.
---------------------------------------------------------------------------- */


/* ============================================================================
   SECTION D — ROLLBACK  (revert to the prior, non-security_invoker view)
   ----------------------------------------------------------------------------
   Use only if security_invoker unexpectedly breaks the dashboard (e.g. an
   underlying-table RLS policy you rely on was changed). This restores the view
   WITHOUT security_invoker and re-grants the previous broad access. Note this
   re-opens the exposure described above — use only as a temporary measure.
   Non-destructive (no table data touched).
   ============================================================================ */

/*  -- Uncomment to roll back.

BEGIN;

DROP VIEW IF EXISTS public.employee_risk_scores;

-- Recreate WITHOUT security_invoker (matches the state right after the
-- corrective fix 20260609_manual_fix_for_modified_migrations.sql).
CREATE VIEW public.employee_risk_scores AS
WITH
course_stats AS (
  SELECT u.id AS employee_id, u.company_id,
    COUNT(ec.id) AS total_assigned,
    COUNT(ec.id) FILTER (WHERE ec.status = 'COMPLETED') AS completed
  FROM users u
  LEFT JOIN employee_courses ec ON ec.employee_id = u.id
  WHERE u.role = 'EMPLOYEE'
  GROUP BY u.id, u.company_id
),
exam_stats AS (
  SELECT best.employee_id, AVG(best.pct)::numeric AS avg_exam_pct
  FROM (SELECT employee_id, exam_id, MAX(percentage) AS pct
        FROM exam_results GROUP BY employee_id, exam_id) best
  GROUP BY best.employee_id
),
phishing_stats AS (
  SELECT pct.employee_id,
    COUNT(*) AS total_targeted,
    COUNT(*) FILTER (WHERE pct.clicked_at IS NOT NULL) AS clicked,
    COUNT(*) FILTER (WHERE pct.credentials_entered = true) AS creds_entered
  FROM phishing_campaign_targets pct
  WHERE pct.employee_id IS NOT NULL
  GROUP BY pct.employee_id
),
combined AS (
  SELECT cs.employee_id, cs.company_id,
    (cs.total_assigned > 0) AS has_course_data,
    (es.avg_exam_pct IS NOT NULL) AS has_exam_data,
    (ps.total_targeted IS NOT NULL AND ps.total_targeted > 0) AS has_phishing_data,
    CASE WHEN cs.total_assigned = 0 THEN 0
      ELSE ROUND(40.0 * (1.0 - cs.completed::numeric / cs.total_assigned), 2) END AS course_risk,
    CASE WHEN es.avg_exam_pct IS NULL THEN 0
      ELSE ROUND(40.0 * (1.0 - LEAST(es.avg_exam_pct, 100) / 100.0), 2) END AS exam_risk,
    CASE WHEN ps.total_targeted IS NULL OR ps.total_targeted = 0 THEN 0
      ELSE ROUND(20.0 * ps.clicked::numeric / ps.total_targeted, 2) END AS phishing_risk,
    cs.total_assigned, cs.completed,
    COALESCE(es.avg_exam_pct, 0) AS avg_exam_pct,
    COALESCE(ps.total_targeted, 0) AS phishing_total,
    COALESCE(ps.clicked, 0) AS phishing_clicked,
    COALESCE(ps.creds_entered, 0) AS phishing_creds_entered
  FROM course_stats cs
  LEFT JOIN exam_stats es ON es.employee_id = cs.employee_id
  LEFT JOIN phishing_stats ps ON ps.employee_id = cs.employee_id
)
SELECT
  c.employee_id, c.company_id, u.full_name, u.email, u.department_id,
  d.name AS department_name, c.course_risk, c.exam_risk, c.phishing_risk,
  ROUND(c.course_risk + c.exam_risk + c.phishing_risk, 2) AS risk_score,
  CASE WHEN NOT (c.has_course_data OR c.has_exam_data OR c.has_phishing_data) THEN NULL
    ELSE ROUND(c.course_risk + c.exam_risk + c.phishing_risk, 2) END AS assessed_risk_score,
  c.has_course_data, c.has_exam_data, c.has_phishing_data,
  (c.has_course_data OR c.has_exam_data OR c.has_phishing_data) AS assessed,
  c.total_assigned, c.completed,
  ROUND(CASE WHEN c.total_assigned = 0 THEN 0
    ELSE c.completed::numeric * 100 / c.total_assigned END, 1) AS completion_pct,
  ROUND(c.avg_exam_pct, 1) AS avg_exam_pct,
  c.phishing_total, c.phishing_clicked, c.phishing_creds_entered,
  CASE
    WHEN NOT (c.has_course_data OR c.has_exam_data OR c.has_phishing_data) THEN 'INSUFFICIENT_EVIDENCE'
    WHEN (c.course_risk + c.exam_risk + c.phishing_risk) >= 70 THEN 'CRITICAL'
    WHEN (c.course_risk + c.exam_risk + c.phishing_risk) >= 40 THEN 'HIGH'
    WHEN (c.course_risk + c.exam_risk + c.phishing_risk) >= 20 THEN 'MEDIUM'
    ELSE 'LOW'
  END AS risk_level
FROM combined c
JOIN users u ON u.id = c.employee_id
LEFT JOIN departments d ON d.id = u.department_id;

COMMIT;

*/

/* ============================================================================
   SEPARATE, OUT-OF-SCOPE NOTE (not fixed here)
   ----------------------------------------------------------------------------
   Legacy migration 20251105113702 created `FOR ALL TO anon USING (true)`
   policies DIRECTLY on exam_results and phishing_campaign_targets. If those
   policies still exist in the live DB, those TABLES are readable by anon
   independently of this view. That is a separate exposure outside the three
   migrations in scope — flag for a follow-up review; not changed by this file.
   ============================================================================ */
