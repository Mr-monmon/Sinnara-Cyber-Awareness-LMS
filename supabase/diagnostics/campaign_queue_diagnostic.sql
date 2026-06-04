-- ════════════════════════════════════════════════════════════════════════
--  Campaign email-queue diagnostic
--  Run the whole thing in the Supabase SQL Editor and share the output.
--  It is READ-ONLY — it changes nothing.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Most recent campaigns + their queue breakdown ------------------------
SELECT
  c.name,
  c.status                                                AS campaign_status,
  c.emails_per_minute,
  count(q.*)                                              AS total_in_queue,
  count(q.*) FILTER (WHERE q.status = 'PENDING')          AS pending,
  count(q.*) FILTER (WHERE q.status = 'SENDING')          AS sending,
  count(q.*) FILTER (WHERE q.status = 'SENT')             AS sent,
  count(q.*) FILTER (WHERE q.status = 'FAILED')           AS failed,
  min(q.scheduled_at)                                     AS earliest_scheduled,
  now()                                                   AS server_now
FROM phishing_campaigns c
LEFT JOIN campaign_email_queue q ON q.campaign_id = c.id
GROUP BY c.id
ORDER BY c.created_at DESC
LIMIT 5;

-- 2. Is the per-minute cron job scheduled and active? ---------------------
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'process-campaign';

-- 3. Did the cron actually run, and what did it return? -------------------
SELECT jobid, status, return_message, start_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;

-- 4. Are the Vault secrets the cron needs present? -----------------------
--    (BOTH names must appear; values are not shown.)
SELECT name FROM vault.secrets
WHERE name IN ('project_url', 'service_role_key');

-- 5. Per-row queue detail: status, retries, and any failure reason -------
SELECT recipient_email, status, retry_count, failure_reason,
       scheduled_at, sent_at
FROM campaign_email_queue
ORDER BY created_at DESC
LIMIT 15;
