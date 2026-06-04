/*
  Phase 5 — Request/Ticketing conversion + quota fixes (sections H, K-core, L, M-requests)

  1. REQUEST COLUMNS (H, K-core)
     Add the operational columns needed to run a campaign directly from a request:
       - campaign_id            → links a request to the campaign it became
       - converted_at           → when the platform admin created the campaign
       - authorization_confirmed→ requester attested they are authorised
       - sending_method         → PLATFORM_DEFAULT | COMPANY_SMTP | REQUEST_ADMIN_CONFIG
       - reply_to_address       → optional reply-to
     (smtp_profile_id, group_ids, landing_page_id, email_template_id, launch_type,
      scheduled_launch_at, timezone already exist from 20260517000002.)

  2. TICKET NUMBERING (L, problem 3)
     generate_ticket_number() was recreated (2025-11-05) to read from demo_requests
     with a YYYYNNNNN format — wrong table for phishing tickets. Introduce a
     dedicated generate_phishing_ticket_number() that reads phishing_campaign_requests
     and returns the stable PHC-###### format. demo_requests numbering is untouched.

  3. QUOTA (L, problems 1 & 2)
     consume_campaign_quota() never existed (the request page called a missing RPC),
     and an AFTER INSERT trigger on phishing_campaigns already consumes campaign quota
     via deduct_campaign_quota(). To avoid double consumption we DELIBERATELY do not
     create consume_campaign_quota: submitting a request consumes NO campaign quota
     (it is only a ticket); quota is consumed exactly once when the actual campaign
     row is created (existing trigger). The request page is updated to stop calling
     the missing RPC. This block only documents the decision; no DDL needed here.

  4. ADMIN-FIELD PROTECTION (M-requests)
     The company RLS policy on phishing_campaign_requests is FOR ALL, which would let
     a company user escalate status or overwrite admin_notes, approved_by/at, or
     rejected_reason.
     Add a BEFORE UPDATE trigger that blocks non-platform-admins from changing
     admin-only fields or setting privileged statuses.
*/

-- ── 1. Request columns ───────────────────────────────────────────────────────
ALTER TABLE phishing_campaign_requests
  ADD COLUMN IF NOT EXISTS campaign_id              uuid REFERENCES phishing_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at             timestamptz,
  ADD COLUMN IF NOT EXISTS authorization_confirmed  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sending_method           text DEFAULT 'PLATFORM_DEFAULT',
  ADD COLUMN IF NOT EXISTS reply_to_address         text;

-- ── 2. Dedicated phishing ticket numbering ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_phishing_ticket_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 5) AS integer)), 0) + 1
  INTO next_num
  FROM public.phishing_campaign_requests
  WHERE ticket_number ~ '^PHC-[0-9]+$';

  RETURN 'PHC-' || LPAD(next_num::text, 6, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_phishing_ticket_number() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.generate_phishing_ticket_number() TO authenticated;

-- ── 4. Protect admin-only request fields from company users ───────────────────
CREATE OR REPLACE FUNCTION public.protect_request_admin_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Platform admins may change anything.
  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  -- Non-platform-admins (company users) may NOT alter admin-managed fields.
  IF NEW.admin_notes     IS DISTINCT FROM OLD.admin_notes
     OR NEW.approved_by      IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at      IS DISTINCT FROM OLD.approved_at
     OR NEW.rejected_reason  IS DISTINCT FROM OLD.rejected_reason
     OR NEW.campaign_id      IS DISTINCT FROM OLD.campaign_id
     OR NEW.converted_at     IS DISTINCT FROM OLD.converted_at THEN
    RAISE EXCEPTION 'Only platform administrators can modify request review fields.';
  END IF;

  -- Company users may not escalate status into a privileged state. They can keep
  -- the current status, return a draft to SUBMITTED, or withdraw to DRAFT/CANCELLED.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('DRAFT', 'SUBMITTED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Only platform administrators can set request status to %.', NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_request_admin_fields ON public.phishing_campaign_requests;
CREATE TRIGGER trg_protect_request_admin_fields
  BEFORE UPDATE ON public.phishing_campaign_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_request_admin_fields();
