-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: Quota counter goes negative when campaigns are deleted or when used_campaigns
-- exceeds annual_quota due to test campaigns.
--
-- Problems fixed:
-- 1. No decrement trigger on phishing_campaigns DELETE
-- 2. used_campaigns can be higher than actual campaign count (e.g. after deletes)
-- 3. Sync current counts to match reality
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add decrement trigger on campaign DELETE
CREATE OR REPLACE FUNCTION public.refund_quota_on_campaign_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.phishing_campaign_quotas
  SET used_campaigns = GREATEST(0, used_campaigns - 1),
      updated_at     = NOW()
  WHERE company_id = OLD.company_id
    AND quota_year  = EXTRACT(YEAR FROM OLD.created_at)::int;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_refund_quota_on_campaign_delete ON public.phishing_campaigns;
CREATE TRIGGER trg_refund_quota_on_campaign_delete
  AFTER DELETE ON public.phishing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.refund_quota_on_campaign_delete();

-- 2. Sync used_campaigns to match actual count (fixes negative / over-inflated values)
UPDATE public.phishing_campaign_quotas q
SET used_campaigns = (
  SELECT COUNT(*)::int
  FROM public.phishing_campaigns c
  WHERE c.company_id = q.company_id
    AND EXTRACT(YEAR FROM c.created_at)::int = q.quota_year
),
updated_at = NOW();
