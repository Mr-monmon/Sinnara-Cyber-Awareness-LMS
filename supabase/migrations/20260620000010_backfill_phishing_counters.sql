-- Backfill two phishing counters that the runtime was not maintaining.
--
-- Both are companions to code fixes in the same change: launch-phishing-campaign
-- now sets total_targets, and phishing-track now sets the per-target
-- credentials_entered flag. This migration corrects the rows created before
-- those fixes so historical campaigns read correctly, not only new ones.
--
-- Neither statement invents data. Each derives the corrected value from a column
-- that was always written correctly — the actual target rows, and submitted_at —
-- so this is reconciliation, not estimation.

-- ============================================================================
-- 1) total_targets = the real number of target rows
-- ============================================================================
-- launch-phishing-campaign set total_queue_size but left total_targets at its
-- 0 default. The true count is simply how many targets the campaign has.
UPDATE public.phishing_campaigns c
SET total_targets = sub.n
FROM (
  SELECT campaign_id, COUNT(*) AS n
  FROM public.phishing_campaign_targets
  GROUP BY campaign_id
) sub
WHERE sub.campaign_id = c.id
  AND c.total_targets IS DISTINCT FROM sub.n;

-- ============================================================================
-- 2) credentials_entered follows submitted_at
-- ============================================================================
-- phishing-track recorded a submission by stamping submitted_at and moving
-- status to SUBMITTED, but never flipped the per-target credentials_entered
-- boolean — which department vulnerability stats and the employee risk view
-- both aggregate. submitted_at is the authoritative record of a submission, so
-- the boolean is aligned to it.
-- The department vulnerability stats are maintained by an AFTER UPDATE trigger
-- on this table that fires specifically when credentials_entered changes, so
-- flipping the boolean below also recomputes those stats for the affected
-- departments — no separate refresh call is needed.
UPDATE public.phishing_campaign_targets
SET credentials_entered = true
WHERE submitted_at IS NOT NULL
  AND credentials_entered IS DISTINCT FROM true;
