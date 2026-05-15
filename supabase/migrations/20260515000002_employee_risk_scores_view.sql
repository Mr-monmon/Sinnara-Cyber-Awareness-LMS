/*
  Migration: employee_risk_scores VIEW

  Calculates a per-employee cyber risk score (0–100) where
  100 = highest risk, 0 = lowest risk.

  Formula (inverted so higher score = more dangerous):
    - Course incompletion penalty  : up to 40 pts  (40 × (1 - completion_rate))
    - Exam failure penalty         : up to 40 pts  (40 × (1 - avg_exam_pct/100))
    - Phishing susceptibility      : up to 20 pts  (20 × click_rate)

  If an employee has no data for a component, it contributes 0 risk
  (benefit of the doubt — they simply haven't been tested yet).
*/

CREATE OR REPLACE VIEW employee_risk_scores AS
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
    er.employee_id,
    AVG(best.pct)::numeric AS avg_exam_pct
  FROM (
    SELECT
      employee_id,
      exam_id,
      MAX(percentage) AS pct
    FROM exam_results
    GROUP BY employee_id, exam_id
  ) best
  JOIN exam_results er ON er.employee_id = best.employee_id
  GROUP BY er.employee_id
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
    WHEN (c.course_risk + c.exam_risk + c.phishing_risk) >= 70 THEN 'CRITICAL'
    WHEN (c.course_risk + c.exam_risk + c.phishing_risk) >= 40 THEN 'HIGH'
    WHEN (c.course_risk + c.exam_risk + c.phishing_risk) >= 20 THEN 'MEDIUM'
    ELSE 'LOW'
  END                                           AS risk_level

FROM combined c
JOIN users       u ON u.id = c.employee_id
LEFT JOIN departments d ON d.id = u.department_id;
