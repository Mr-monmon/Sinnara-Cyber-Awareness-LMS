-- Monthly department metrics, stored instead of recomputed.
--
-- The first version of the trend chart recomputed twelve months of history from
-- raw rows on every page load, with correlated subqueries per employee per
-- month. At ten companies and 1500 employees that is tens of thousands of index
-- lookups every time a dashboard opens — a load problem waiting to happen, and
-- it grows with every new customer.
--
-- Metrics are now written once per month per department and read back as a
-- plain indexed table scan. A daily cron job keeps the current month fresh;
-- earlier months are frozen exactly as they stood, which is also more truthful
-- than recomputing them from today's data (see the department-history note in
-- 20260620000004).
--
-- THREE MEASURES, kept separate because they answer different questions:
--
--   course_progress — share of assigned courses completed. "Are they doing the
--                     training?" Unassigned employees count as 0, so a
--                     department is not flattered by never being given work.
--   awareness       — exam performance and phishing resistance combined 2:1,
--                     matching their 40:20 weighting in the risk score. "Do
--                     they actually know it, and do they fall for attacks?"
--   maturity        — 100 minus the full risk score, all three components. The
--                     single headline number.
--
-- All three are 0–100, higher is better, and all three treat missing evidence
-- as the worst case rather than the best (see 20260620000005).

-- ============================================================================
-- 1) Storage
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.department_metric_snapshots (
  company_id         uuid NOT NULL REFERENCES public.companies(id)    ON DELETE CASCADE,
  department_id      uuid NOT NULL REFERENCES public.departments(id)  ON DELETE CASCADE,
  month_start        date NOT NULL,
  course_progress    numeric(5,1) NOT NULL,
  awareness          numeric(5,1) NOT NULL,
  maturity           numeric(5,1) NOT NULL,
  employees          integer NOT NULL,
  measured_employees integer NOT NULL,
  computed_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (department_id, month_start)
);

CREATE INDEX IF NOT EXISTS dept_metric_snapshots_company_month_idx
  ON public.department_metric_snapshots (company_id, month_start);

COMMENT ON TABLE public.department_metric_snapshots IS
  'Monthly per-department course progress, awareness and maturity (0-100, higher is better). Written by cron; read by the dashboards.';
COMMENT ON COLUMN public.department_metric_snapshots.measured_employees IS
  'Employees with at least one course, exam or phishing record that month. The rest are scored as unmeasured, not excluded.';

ALTER TABLE public.department_metric_snapshots ENABLE ROW LEVEL SECURITY;

-- Readable by anyone in the company who can already see department analytics.
-- Writes happen only through the SECURITY DEFINER functions below and cron.
DROP POLICY IF EXISTS dept_metric_snapshots_company_read ON public.department_metric_snapshots;
CREATE POLICY dept_metric_snapshots_company_read
  ON public.department_metric_snapshots
  FOR SELECT TO authenticated
  USING (
    company_id::text = public.get_my_company_id()
    OR public.is_platform_admin()
  );

-- ============================================================================
-- 2) Compute one company's departments as at a point in time
-- ============================================================================
-- Set-based on purpose: one pass over each source table per call, rather than
-- the per-employee subqueries this replaces.
CREATE OR REPLACE FUNCTION public.compute_department_metrics_at(
  p_company_id uuid,
  p_cutoff     timestamptz
)
RETURNS TABLE (
  department_id      uuid,
  course_progress    numeric,
  awareness          numeric,
  maturity           numeric,
  employees          integer,
  measured_employees integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
WITH emp AS (
  SELECT u.id AS employee_id, u.department_id
  FROM public.users u
  WHERE u.company_id = p_company_id
    AND u.role = 'EMPLOYEE'
    AND u.department_id IS NOT NULL
    AND u.created_at < p_cutoff
),
courses AS (
  SELECT ec.employee_id,
         COUNT(*)                                                       AS assigned_n,
         COUNT(*) FILTER (WHERE ec.completed_at IS NOT NULL
                            AND ec.completed_at < p_cutoff)             AS completed_n
  FROM public.employee_courses ec
  JOIN emp e ON e.employee_id = ec.employee_id
  WHERE ec.assigned_at < p_cutoff
  GROUP BY ec.employee_id
),
exams AS (
  SELECT best.employee_id, AVG(best.pct) AS avg_pct
  FROM (
    SELECT er.employee_id, er.exam_id, MAX(er.percentage) AS pct
    FROM public.exam_results er
    JOIN emp e ON e.employee_id = er.employee_id
    WHERE er.completed_at IS NOT NULL AND er.completed_at < p_cutoff
    GROUP BY er.employee_id, er.exam_id
  ) best
  GROUP BY best.employee_id
),
phish AS (
  SELECT pt.employee_id,
         COUNT(*)                                                   AS targeted_n,
         COUNT(*) FILTER (WHERE pt.clicked_at IS NOT NULL
                            AND pt.clicked_at < p_cutoff)           AS clicked_n
  FROM public.phishing_campaign_targets pt
  JOIN emp e ON e.employee_id = pt.employee_id
  WHERE pt.sent_at IS NOT NULL AND pt.sent_at < p_cutoff
  GROUP BY pt.employee_id
),
scored AS (
  SELECT
    e.department_id,
    -- Course progress: no assignment counts as 0% done, never as "nothing to do".
    COALESCE(
      CASE WHEN c.assigned_n > 0
           THEN 100.0 * c.completed_n::numeric / c.assigned_n END, 0) AS course_pct,
    -- Exam knowledge: never assessed scores 0, the same as answering nothing right.
    COALESCE(LEAST(x.avg_pct, 100), 0)                                AS exam_pct,
    -- Phishing resistance: never simulated scores 0 — untested, not safe.
    COALESCE(
      CASE WHEN p.targeted_n > 0
           THEN 100.0 * (1.0 - p.clicked_n::numeric / p.targeted_n) END, 0) AS phish_pct,
    (c.assigned_n IS NOT NULL OR x.avg_pct IS NOT NULL OR p.targeted_n IS NOT NULL) AS measured
  FROM emp e
  LEFT JOIN courses c ON c.employee_id = e.employee_id
  LEFT JOIN exams   x ON x.employee_id = e.employee_id
  LEFT JOIN phish   p ON p.employee_id = e.employee_id
)
SELECT
  s.department_id,
  ROUND(AVG(s.course_pct), 1)                                   AS course_progress,
  -- Exams and phishing weighted 2:1, mirroring their 40:20 share of the risk score.
  ROUND(AVG(s.exam_pct * 2.0 + s.phish_pct) / 3.0, 1)           AS awareness,
  -- The headline: 100 - risk, using the same 40/40/20 split.
  ROUND(AVG(s.course_pct * 0.40 + s.exam_pct * 0.40 + s.phish_pct * 0.20), 1) AS maturity,
  COUNT(*)::integer                                             AS employees,
  COUNT(*) FILTER (WHERE s.measured)::integer                   AS measured_employees
FROM scored s
GROUP BY s.department_id;
$$;

REVOKE ALL ON FUNCTION public.compute_department_metrics_at(uuid, timestamptz) FROM PUBLIC;

-- ============================================================================
-- 3) Write one month's snapshot
-- ============================================================================
CREATE OR REPLACE FUNCTION public.snapshot_department_metrics(
  p_company_id uuid,
  p_month      date DEFAULT date_trunc('month', now())::date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cutoff timestamptz;
  v_rows   integer;
BEGIN
  -- A finished month is measured at its end; the month in progress is measured
  -- as of now, so today's activity shows up straight away.
  v_cutoff := LEAST(
    (date_trunc('month', p_month) + interval '1 month')::timestamptz,
    now()
  );

  INSERT INTO public.department_metric_snapshots AS s (
    company_id, department_id, month_start,
    course_progress, awareness, maturity,
    employees, measured_employees, computed_at
  )
  SELECT
    p_company_id, m.department_id, date_trunc('month', p_month)::date,
    m.course_progress, m.awareness, m.maturity,
    m.employees, m.measured_employees, now()
  FROM public.compute_department_metrics_at(p_company_id, v_cutoff) m
  ON CONFLICT (department_id, month_start) DO UPDATE
    SET course_progress    = EXCLUDED.course_progress,
        awareness          = EXCLUDED.awareness,
        maturity           = EXCLUDED.maturity,
        employees          = EXCLUDED.employees,
        measured_employees = EXCLUDED.measured_employees,
        computed_at        = now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_department_metrics(uuid, date) FROM PUBLIC;

-- ============================================================================
-- 4) Backfill history, so the chart is useful on day one
-- ============================================================================
-- Starts at the company's subscription start where there is one — the customer
-- asked to see progress "from when they joined" — and falls back to the first
-- month with any activity.
CREATE OR REPLACE FUNCTION public.backfill_department_snapshots(
  p_company_id uuid,
  p_max_months integer DEFAULT 36
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start date;
  v_month date;
  v_total integer := 0;
BEGIN
  SELECT date_trunc('month', MIN(s.start_date))::date
    INTO v_start
  FROM public.subscriptions s
  WHERE s.company_id = p_company_id;

  IF v_start IS NULL THEN
    SELECT date_trunc('month', MIN(ec.assigned_at))::date
      INTO v_start
    FROM public.employee_courses ec
    JOIN public.users u ON u.id = ec.employee_id
    WHERE u.company_id = p_company_id;
  END IF;

  IF v_start IS NULL THEN
    v_start := date_trunc('month', now())::date;
  END IF;

  -- Never walk back further than the cap, however old the subscription is.
  v_start := GREATEST(
    v_start,
    (date_trunc('month', now()) - (GREATEST(p_max_months, 1) || ' months')::interval)::date
  );

  v_month := v_start;
  WHILE v_month <= date_trunc('month', now())::date LOOP
    v_total := v_total + public.snapshot_department_metrics(p_company_id, v_month);
    v_month := (v_month + interval '1 month')::date;
  END LOOP;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_department_snapshots(uuid, integer) FROM PUBLIC;

-- ============================================================================
-- 5) Refresh every company's current month
-- ============================================================================
CREATE OR REPLACE FUNCTION public.snapshot_all_department_metrics()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company uuid;
  v_total   integer := 0;
BEGIN
  FOR v_company IN SELECT id FROM public.companies LOOP
    BEGIN
      v_total := v_total + public.snapshot_department_metrics(v_company);
    EXCEPTION WHEN OTHERS THEN
      -- One bad company must not stop the rest of the run. The message reaches
      -- the Postgres log, where a silent partial run would not.
      RAISE WARNING 'snapshot_department_metrics failed for company %: %', v_company, SQLERRM;
    END;
  END LOOP;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_all_department_metrics() FROM PUBLIC;

-- ============================================================================
-- 6) Read side — what the dashboards call
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_department_metric_trend(
  p_company_id uuid,
  p_months     integer DEFAULT 12
)
RETURNS TABLE (
  month_start        date,
  department_id      uuid,
  department_name    text,
  course_progress    numeric,
  awareness          numeric,
  maturity           numeric,
  employees          integer,
  measured_employees integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    s.month_start,
    s.department_id,
    d.name,
    s.course_progress,
    s.awareness,
    s.maturity,
    s.employees,
    s.measured_employees
  FROM public.department_metric_snapshots s
  JOIN public.departments d ON d.id = s.department_id
  WHERE s.company_id = p_company_id
    AND s.month_start >= (date_trunc('month', now())
                          - (GREATEST(LEAST(COALESCE(p_months, 12), 36), 1) - 1 || ' months')::interval)::date
  ORDER BY s.month_start, d.name;
$$;

REVOKE ALL ON FUNCTION public.get_department_metric_trend(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_department_metric_trend(uuid, integer) TO authenticated;

-- The old per-request calculator is superseded by the snapshot table.
DROP FUNCTION IF EXISTS public.get_department_maturity_trend(uuid, integer);

-- ============================================================================
-- 7) Schedule + seed
-- ============================================================================
-- Daily rather than monthly: the current month must reflect this morning's
-- course completions, not last month's close.
SELECT cron.unschedule('snapshot-department-metrics')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'snapshot-department-metrics');

SELECT cron.schedule(
  'snapshot-department-metrics',
  '20 1 * * *',
  'SELECT public.snapshot_all_department_metrics()'
);

-- Seed history for companies that already exist, so the chart is not empty on
-- the day this ships.
DO $$
DECLARE v_company uuid;
BEGIN
  FOR v_company IN SELECT id FROM public.companies LOOP
    BEGIN
      PERFORM public.backfill_department_snapshots(v_company, 24);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'backfill_department_snapshots failed for company %: %', v_company, SQLERRM;
    END;
  END LOOP;
END $$;
