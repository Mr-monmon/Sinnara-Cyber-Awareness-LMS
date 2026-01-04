/*
  # Fix Phishing Campaign Quota Column Names
  
  1. Issue
    - Functions reference columns 'total_quota' and 'used_quota'
    - Actual columns are 'annual_quota' and 'used_campaigns'
    - This causes errors when creating companies or campaigns
  
  2. Solution
    - Drop and recreate functions with correct column names
    - Use 'annual_quota' instead of 'total_quota'
    - Use 'used_campaigns' instead of 'used_quota'
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS public.initialize_company_quota() CASCADE;
DROP FUNCTION IF EXISTS public.deduct_campaign_quota() CASCADE;

-- Recreate initialize_company_quota with correct column names
CREATE OR REPLACE FUNCTION public.initialize_company_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO phishing_campaign_quotas (company_id, annual_quota, used_campaigns)
  VALUES (NEW.id, 4, 0);
  RETURN NEW;
END;
$$;

-- Recreate deduct_campaign_quota with correct column names
CREATE OR REPLACE FUNCTION public.deduct_campaign_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE phishing_campaign_quotas
  SET 
    used_campaigns = used_campaigns + 1,
    updated_at = NOW()
  WHERE company_id = NEW.company_id;
  
  RETURN NEW;
END;
$$;

-- Recreate triggers
DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_company_quota();

DROP TRIGGER IF EXISTS on_campaign_created ON public.phishing_campaigns;
CREATE TRIGGER on_campaign_created
  AFTER INSERT ON public.phishing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_campaign_quota();
