-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Backfill company_phishing_limits + quota deduction on campaign insert
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Backfill: create a company_phishing_limits row for every company that
--    was created before the auto-init trigger existed.
INSERT INTO public.company_phishing_limits (company_id)
SELECT id
FROM public.companies
WHERE id NOT IN (
  SELECT company_id FROM public.company_phishing_limits
)
ON CONFLICT DO NOTHING;

-- 2. Deduct from phishing_campaign_quotas when a campaign row is inserted.
--    Upserts the quota row (in case it was never seeded) then increments used_campaigns.
CREATE OR REPLACE FUNCTION public.deduct_quota_on_campaign_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.phishing_campaign_quotas (company_id, quota_year, annual_quota, used_campaigns)
  VALUES (
    NEW.company_id,
    EXTRACT(YEAR FROM CURRENT_DATE)::int,
    4,  -- default annual quota
    1
  )
  ON CONFLICT (company_id, quota_year) DO UPDATE
    SET used_campaigns = phishing_campaign_quotas.used_campaigns + 1,
        updated_at     = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduct_quota_on_campaign_insert ON public.phishing_campaigns;
CREATE TRIGGER trg_deduct_quota_on_campaign_insert
  AFTER INSERT ON public.phishing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_quota_on_campaign_insert();
