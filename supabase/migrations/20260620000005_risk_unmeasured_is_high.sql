-- Unmeasured employees are HIGH risk, not low risk.
--
-- The scoring was inverted in effect. Each component contributed 0 when there
-- was no evidence: no courses assigned scored 0 course risk, no exam taken
-- scored 0 exam risk, never phished scored 0 phishing risk. An employee nobody
-- had trained or tested therefore scored 0 — the safest possible score — and a
-- department of such employees read as 100% mature.
--
-- The visible symptom was a maturity chart that fell as training began: a
-- department sat at 100 while nothing was happening, then "declined" the moment
-- courses were assigned and had not yet been completed. Exactly backwards for a
-- product whose job is to show awareness improving.
--
-- Missing evidence now scores the MAXIMUM for its component, so a brand-new
-- employee starts at risk 100 / awareness 0 and improves as they complete
-- courses, pass assessments and resist phishing. That is the direction of travel
-- a customer expects to see, and it is also the honest reading: an untested
-- employee is an unknown, and an unknown in security is a risk, not a pass.
--
-- 20260607000002 recognised the same problem and introduced INSUFFICIENT_EVIDENCE,
-- but resolved it by excluding those employees from averages rather than scoring
-- them. Excluding them hides the very population the customer most needs to act
-- on. They are now scored, and the evidence flags are kept so any screen that
-- wants to say "assumed, not measured" still can.
--
-- Consequence to expect: existing risk scores rise, in some cases sharply. That
-- is the correction, not a regression — the previous figures understated risk
-- for every employee with gaps in their record.

DROP VIEW IF EXISTS employee_risk_scores;

CREATE VIEW employee_risk_scores AS
WITH

course_stats AS (
  SELECT
    u.id                                                AS employee_id,
    u.company_id,
    COUNT(ec.id)                                        AS total_assigned,
    COUNT(ec.id) FILTER (WHERE ec.status = 'COMPLETED') AS completed
  FROM users u
  LEFT JOIN employee_courses ec ON ec.employee_id = u.id
  WHERE u.role = 'EMPLOYEE'
  GROUP BY u.id, u.company_id
),

exam_stats AS (
  SELECT best.employee_id, AVG(best.pct)::numeric AS avg_exam_pct
  FROM (
    SELECT employee_id, exam_id, MAX(percentage) AS pct
    FROM exam_results
    GROUP BY employee_id, exam_id
  ) best
  GROUP BY best.employee_id
),

phishing_stats AS (
  SELECT
    pct.employee_id,
    COUNT(*)                                                AS total_targeted,
    COUNT(*) FILTER (WHERE pct.clicked_at IS NOT NULL)      AS clicked,
    COUNT(*) FILTER (WHERE pct.credentials_entered = true)  AS creds_entered
  FROM phishing_campaign_targets pct
  WHERE pct.employee_id IS NOT NULL
  GROUP BY pct.employee_id
),

combined AS (
  SELECT
    cs.employee_id,
    cs.company_id,

    (cs.total_assigned > 0)                                   AS has_course_data,
    (es.avg_exam_pct IS NOT NULL)                             AS has_exam_data,
    (ps.total_targeted IS NOT NULL AND ps.total_targeted > 0) AS has_phishing_data,

    -- course component (0–40). No courses assigned is untrained, which is the
    -- worst case, not a neutral one.
    CASE
      WHEN cs.total_assigned = 0 THEN 40.0
      ELSE ROUND(40.0 * (1.0 - cs.completed::numeric / cs.total_assigned), 2)
    END AS course_risk,

    -- exam component (0–40). Never assessed scores as badly as scoring zero:
    -- in both cases there is no evidence the employee knows the material.
    CASE
      WHEN es.avg_exam_pct IS NULL THEN 40.0
      ELSE ROUND(40.0 * (1.0 - LEAST(es.avg_exam_pct, 100) / 100.0), 2)
    END AS exam_risk,

    -- phishing component (0–20). Never simulated means untested against the
    -- attack this platform exists to defend against.
    CASE
      WHEN ps.total_targeted IS NULL OR ps.total_targeted = 0 THEN 20.0
      ELSE ROUND(20.0 * ps.clicked::numeric / ps.total_targeted, 2)
    END AS phishing_risk,

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
  d.name AS department_name,
  c.course_risk,
  c.exam_risk,
  c.phishing_risk,
  ROUND(c.course_risk + c.exam_risk + c.phishing_risk, 2) AS risk_score,

  -- Kept for compatibility with callers that still read it, but it is no longer
  -- ever NULL: every employee now carries a real score. Excluding the
  -- unmeasured from company averages is what made those averages flattering.
  ROUND(c.course_risk + c.exam_risk + c.phishing_risk, 2) AS assessed_risk_score,

  c.has_course_data,
  c.has_exam_data,
  c.has_phishing_data,
  (c.has_course_data OR c.has_exam_data OR c.has_phishing_data) AS assessed,

  c.total_assigned,
  c.completed,
  ROUND(CASE WHEN c.total_assigned = 0 THEN 0
             ELSE c.completed::numeric * 100 / c.total_assigned END, 1) AS completion_pct,
  ROUND(c.avg_exam_pct, 1) AS avg_exam_pct,
  c.phishing_total,
  c.phishing_clicked,
  c.phishing_creds_entered,

  -- INSUFFICIENT_EVIDENCE is retained as a *label*: the employee is scored
  -- (and scored badly), but the screen can still say the score rests on
  -- assumption rather than measurement.
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

ALTER VIEW public.employee_risk_scores SET (security_invoker = on);
