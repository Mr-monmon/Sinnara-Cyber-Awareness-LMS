-- Monthly security-maturity trend per department.
--
-- The dashboards can already say how mature each department is *today*
-- (`employee_risk_scores`), but not whether it is getting better. This function
-- reconstructs the same score at the end of each of the last N months, so a
-- company admin can see the direction of travel per department rather than a
-- single snapshot.
--
-- MATURITY IS THE INVERSE OF RISK: maturity = 100 - risk_score. The components
-- are deliberately identical to `employee_risk_scores` (course 0–40, exam 0–40,
-- phishing 0–20) so the newest point on the chart equals 100 minus the risk
-- figure shown elsewhere on the same page. If that view's formula changes, this
-- must change with it or the two surfaces will quietly disagree.
--
-- HISTORY IS DERIVED, NOT STORED. There are no monthly snapshots in this schema,
-- so each month is recomputed from the timestamps already on the source rows:
-- `employee_courses.assigned_at/completed_at`, `exam_results.completed_at`, and
-- `phishing_campaign_targets.sent_at/clicked_at`. That gives real back-history
-- from day one instead of starting empty. The trade-off is that it reflects
-- current *membership*: an employee who changed department appears in their
-- present department for every past month, because the schema keeps no history
-- of `users.department_id`. Deleted employees vanish from past months entirely.
-- For a trend line that is honest to within a few points this is acceptable; a
-- materialised monthly snapshot would be the fix if exact historical attribution
-- ever matters.
--
-- UNASSESSED EMPLOYEES ARE EXCLUDED, matching the view's `assessed_risk_score`
-- rule. An employee with no courses, no exams and no phishing exposure has a
-- risk of 0 by default, which would render as 100% mature — so counting them
-- would make a department look perfect precisely when nothing has been measured.
-- A month where a department has no assessed employees yields NULL, which the
-- chart renders as a gap rather than a drop to zero.

CREATE OR REPLACE FUNCTION public.get_department_maturity_trend(
  p_company_id uuid,
  p_months     integer DEFAULT 12
)
RETURNS TABLE (
  month_start         date,
  department_id       uuid,
  department_name     text,
  maturity            numeric,
  assessed_employees  integer,
  total_employees     integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
WITH bounds AS (
  SELECT GREATEST(1, LEAST(COALESCE(p_months, 12), 36)) AS months
),
-- End-of-month cut-offs, oldest first. Each month is evaluated as at its last
-- instant, so a month in progress reflects everything up to now.
months AS (
  SELECT
    date_trunc('month', m)::date                        AS month_start,
    (date_trunc('month', m) + interval '1 month')       AS cutoff
  FROM bounds b,
       generate_series(
         date_trunc('month', now()) - ((b.months - 1) || ' months')::interval,
         date_trunc('month', now()),
         interval '1 month'
       ) AS m
),
-- Employees currently in the company, with their present department.
emp AS (
  SELECT u.id AS employee_id, u.department_id, d.name AS department_name
  FROM public.users u
  JOIN public.departments d ON d.id = u.department_id
  WHERE u.company_id = p_company_id
    AND u.role = 'EMPLOYEE'
    AND u.department_id IS NOT NULL
),
-- Per employee per month: the three risk components as they stood at the cutoff.
per_employee AS (
  SELECT
    mo.month_start,
    e.department_id,
    e.department_name,
    e.employee_id,

    -- course component (0–40): share of then-assigned courses not yet completed
    (SELECT COUNT(*) FROM public.employee_courses ec
      WHERE ec.employee_id = e.employee_id AND ec.assigned_at < mo.cutoff) AS assigned_n,
    (SELECT COUNT(*) FROM public.employee_courses ec
      WHERE ec.employee_id = e.employee_id
        AND ec.assigned_at < mo.cutoff
        AND ec.completed_at IS NOT NULL
        AND ec.completed_at < mo.cutoff)                                   AS completed_n,

    -- exam component (0–40): average of the best attempt per exam so far
    (SELECT AVG(best.pct) FROM (
        SELECT MAX(er.percentage) AS pct
        FROM public.exam_results er
        WHERE er.employee_id = e.employee_id
          AND er.completed_at IS NOT NULL
          AND er.completed_at < mo.cutoff
        GROUP BY er.exam_id
     ) best)                                                              AS avg_exam_pct,

    -- phishing component (0–20): click rate across simulations already sent
    (SELECT COUNT(*) FROM public.phishing_campaign_targets pct
      WHERE pct.employee_id = e.employee_id
        AND pct.sent_at IS NOT NULL AND pct.sent_at < mo.cutoff)           AS targeted_n,
    (SELECT COUNT(*) FROM public.phishing_campaign_targets pct
      WHERE pct.employee_id = e.employee_id
        AND pct.sent_at IS NOT NULL AND pct.sent_at < mo.cutoff
        AND pct.clicked_at IS NOT NULL AND pct.clicked_at < mo.cutoff)     AS clicked_n
  FROM months mo
  CROSS JOIN emp e
),
scored AS (
  SELECT
    pe.month_start,
    pe.department_id,
    pe.department_name,
    pe.employee_id,
    (pe.assigned_n > 0 OR pe.avg_exam_pct IS NOT NULL OR pe.targeted_n > 0) AS assessed,
    CASE WHEN pe.assigned_n = 0 THEN 0
         ELSE 40.0 * (1.0 - pe.completed_n::numeric / pe.assigned_n) END
    + CASE WHEN pe.avg_exam_pct IS NULL THEN 0
           ELSE 40.0 * (1.0 - LEAST(pe.avg_exam_pct, 100) / 100.0) END
    + CASE WHEN pe.targeted_n = 0 THEN 0
           ELSE 20.0 * pe.clicked_n::numeric / pe.targeted_n END           AS risk
  FROM per_employee pe
)
SELECT
  s.month_start,
  s.department_id,
  s.department_name,
  -- NULL (a gap in the line) when nothing has been measured yet, never a
  -- misleading 100.
  ROUND(AVG(100.0 - s.risk) FILTER (WHERE s.assessed), 1)      AS maturity,
  COUNT(*) FILTER (WHERE s.assessed)::integer                  AS assessed_employees,
  COUNT(*)::integer                                            AS total_employees
FROM scored s
GROUP BY s.month_start, s.department_id, s.department_name
ORDER BY s.month_start, s.department_name;
$$;

COMMENT ON FUNCTION public.get_department_maturity_trend(uuid, integer) IS
  'Monthly security maturity (100 - risk) per department, recomputed from source timestamps. NULL maturity = no assessed employees that month.';

-- SECURITY INVOKER: the function reads users, employee_courses, exam_results and
-- phishing_campaign_targets under the caller's own RLS, so it cannot become a
-- way to read another company's data. The p_company_id argument narrows the
-- result; it does not grant anything.
REVOKE ALL ON FUNCTION public.get_department_maturity_trend(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_department_maturity_trend(uuid, integer) TO authenticated;
