/*
  Fix: Improve phishing risk component + restore security_invoker
  ================================================================
  Two issues addressed:

  1. Phishing risk component improvement:
     Old formula: phishingRisk = 20 × (clicked / total_targeted)
       — did not differentiate clicking from credential submission.
       Entering credentials is significantly more severe than just clicking.

     New formula:
       click_risk  = 8.0 × (clicked / total_targeted)             [0–8 pts]
       cred_risk   = 12.0 × (creds_entered / total_targeted)      [0–12 pts]
       phishingRisk = click_risk + cred_risk                      [0–20 pts total, unchanged cap]

     This makes credential submission contribute 12 pts vs 8 pts for click-only.
     Total phishing risk cap remains 20 pts.

  2. Restore security_invoker = on:
     A prior ChatGPT-authored change ran:
       ALTER VIEW public.employee_risk_scores RESET (security_invoker);
     This caused the view to run as postgres (owner), bypassing RLS and
     allowing company admins to see ALL companies' risk data through the view.
     This migration recreates the view WITH (security_invoker = on).

  Non-destructive to data: no table changes, only view recreation.
  Run in: Supabase SQL Editor (postgres / service role)
*/

-- ════════════════════════════════════════════════════════════════════════
-- A. PRE-CHECK
-- ════════════════════════════════════════════════════════════════════════

-- A1. Current security_invoker status (expected before fix: 'off' or no row)
SELECT relname, reloptions
FROM pg_class
WHERE relname = 'employee_risk_scores' AND relkind = 'v';

-- A2. Confirm current anon grants are still correct
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'employee_risk_scores'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY grantee, privilege_type;


-- ════════════════════════════════════════════════════════════════════════
-- B. MAIN FIX — recreate view with improved formula + security_invoker
-- ════════════════════════════════════════════════════════════════════════
BEGIN;

DROP VIEW IF EXISTS public.employee_risk_scores;

CREATE VIEW public.employee_risk_scores
  WITH (security_invoker = on)
AS
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
    COUNT(*)                                                        AS total_targeted,
    COUNT(*) FILTER (WHERE pct.clicked_at IS NOT NULL)             AS clicked,
    COUNT(*) FILTER (WHERE pct.credentials_entered = true)         AS creds_entered
  FROM phishing_campaign_targets pct
  WHERE pct.employee_id IS NOT NULL
  GROUP BY pct.employee_id
),

-- 4. Combine
combined AS (
  SELECT
    cs.employee_id,
    cs.company_id,

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
    -- click_risk (0–8): penalises link-clicking behaviour
    -- cred_risk  (0–12): penalises credential submission (more severe)
    CASE
      WHEN ps.total_targeted IS NULL OR ps.total_targeted = 0 THEN 0
      ELSE ROUND(
        8.0  * ps.clicked::numeric     / ps.total_targeted +
        12.0 * ps.creds_entered::numeric / ps.total_targeted,
        2
      )
    END AS phishing_risk,

    -- raw numbers for display
    cs.total_assigned,
    cs.completed,
    COALESCE(es.avg_exam_pct, 0)           AS avg_exam_pct,
    COALESCE(ps.total_targeted, 0)         AS phishing_total,
    COALESCE(ps.clicked, 0)                AS phishing_clicked,
    COALESCE(ps.creds_entered, 0)          AS phishing_creds_entered,

    -- whether any evidence exists for risk assessment
    (
      cs.total_assigned > 0
      OR es.avg_exam_pct IS NOT NULL
      OR (ps.total_targeted IS NOT NULL AND ps.total_targeted > 0)
    ) AS assessed

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
  d.name                                              AS department_name,
  c.course_risk,
  c.exam_risk,
  c.phishing_risk,

  -- assessed_risk_score: the score for employees with data (NULL when unassessed)
  CASE WHEN c.assessed
    THEN ROUND(c.course_risk + c.exam_risk + c.phishing_risk, 2)
    ELSE NULL
  END                                                 AS assessed_risk_score,

  -- risk_score: 0 for unassessed (for backward-compat with code that sums scores)
  ROUND(c.course_risk + c.exam_risk + c.phishing_risk, 2) AS risk_score,

  c.total_assigned,
  c.completed,
  ROUND(
    CASE WHEN c.total_assigned = 0 THEN 0
    ELSE c.completed::numeric * 100 / c.total_assigned END, 1
  )                                                   AS completion_pct,
  ROUND(c.avg_exam_pct, 1)                            AS avg_exam_pct,
  c.phishing_total,
  c.phishing_clicked,
  c.phishing_creds_entered,
  c.assessed,

  CASE
    WHEN NOT c.assessed THEN 'INSUFFICIENT_EVIDENCE'
    WHEN (c.course_risk + c.exam_risk + c.phishing_risk) >= 70 THEN 'CRITICAL'
    WHEN (c.course_risk + c.exam_risk + c.phishing_risk) >= 40 THEN 'HIGH'
    WHEN (c.course_risk + c.exam_risk + c.phishing_risk) >= 20 THEN 'MEDIUM'
    ELSE 'LOW'
  END                                                 AS risk_level

FROM combined c
JOIN users       u ON u.id = c.employee_id
LEFT JOIN departments d ON d.id = u.department_id;

-- Grants: anon BLOCKED, authenticated/service_role can read (RLS enforced via security_invoker)
REVOKE ALL ON public.employee_risk_scores FROM PUBLIC;
REVOKE ALL ON public.employee_risk_scores FROM anon;
REVOKE ALL ON public.employee_risk_scores FROM authenticated;
GRANT SELECT ON public.employee_risk_scores TO authenticated;
GRANT SELECT ON public.employee_risk_scores TO service_role;

COMMIT;


-- ════════════════════════════════════════════════════════════════════════
-- C. POST-CHECK
-- ════════════════════════════════════════════════════════════════════════

-- C1. security_invoker should now be on
SELECT relname, reloptions
FROM pg_class
WHERE relname = 'employee_risk_scores' AND relkind = 'v';

-- C2. Grants: anon should have NO rows, authenticated should have SELECT only
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'employee_risk_scores'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY grantee, privilege_type;

-- C3. Verify phishing risk formula change (compare click-only vs cred-only employees)
--     An employee who only clicked should score up to 8 pts (not 20).
--     An employee who also submitted creds should score up to 20 pts.
SELECT
  employee_id,
  phishing_clicked,
  phishing_creds_entered,
  phishing_total,
  phishing_risk,
  risk_level,
  assessed
FROM public.employee_risk_scores
WHERE phishing_total > 0
ORDER BY phishing_risk DESC
LIMIT 10;

-- C4. Verify INSUFFICIENT_EVIDENCE appears for employees with no training/exam/phishing data
SELECT COUNT(*) AS insufficient_evidence_count
FROM public.employee_risk_scores
WHERE risk_level = 'INSUFFICIENT_EVIDENCE';

-- C5. Confirm no accidental data from other companies leaks
--     (Replace with a real company_id from your test company)
--     SELECT DISTINCT company_id FROM public.employee_risk_scores;


-- ════════════════════════════════════════════════════════════════════════
-- D. ROLLBACK — restores old formula WITHOUT security_invoker
--    (use only if something breaks; NOT recommended)
-- ════════════════════════════════════════════════════════════════════════
/*
DROP VIEW IF EXISTS public.employee_risk_scores;
CREATE VIEW public.employee_risk_scores AS
... (paste the prior view definition from migration 20260607000002) ...
-- Then re-run the grants block above if needed.
*/
