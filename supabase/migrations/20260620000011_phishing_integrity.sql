-- Phishing integrity fixes (companions to code changes in the same PR).
--
-- 1) campaign_email_queue.sending_at — lets process-campaign reap rows stranded
--    in SENDING. A row is flipped to SENDING before the send; if the function
--    dies between the claim and the final SENT/PENDING write (SMTP hang, or the
--    invocation exceeding its wall-clock limit mid-batch), the row had no way
--    back: the batch query only selects PENDING, so it was never retried, and
--    the completion check counts SENDING as in-flight, so the campaign hung in
--    RUNNING forever. The worker now stamps sending_at at claim time and returns
--    any SENDING row older than the timeout to PENDING.
--
-- 2) Backfill any rows already stuck in SENDING from before this shipped, so the
--    reaper's first run (which only touches rows with a sending_at older than
--    its window) doesn't leave the pre-existing stuck rows behind.

ALTER TABLE public.campaign_email_queue
  ADD COLUMN IF NOT EXISTS sending_at timestamptz;

-- Rows sitting in SENDING today were stranded by the old code path. Return them
-- to PENDING so they are retried on the next worker run. Safe: nothing is
-- actively sending them (the old path that set them SENDING is gone), and the
-- atomic claim prevents a double-send if one somehow still were.
UPDATE public.campaign_email_queue
SET status = 'PENDING'
WHERE status = 'SENDING';
