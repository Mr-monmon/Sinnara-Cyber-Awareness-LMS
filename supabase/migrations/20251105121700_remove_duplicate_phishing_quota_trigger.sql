/*
  # Remove Duplicate Phishing Quota Initialization
  
  1. Issue
    - Two triggers exist on companies table doing the same thing
    - `on_company_created` calls `initialize_company_quota()` (correct columns)
    - `trigger_initialize_phishing_quota` calls `initialize_phishing_quota()` (wrong columns)
    - Both try to insert into phishing_campaign_quotas causing conflicts
    - The second trigger uses old column names: total_quota, used_quota
  
  2. Solution
    - Drop the duplicate trigger and function
    - Keep only `on_company_created` trigger
*/

-- Drop the duplicate trigger
DROP TRIGGER IF EXISTS trigger_initialize_phishing_quota ON public.companies;

-- Drop the outdated function
DROP FUNCTION IF EXISTS public.initialize_phishing_quota();
