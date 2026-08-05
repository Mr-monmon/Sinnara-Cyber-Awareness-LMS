/*
  Per-employee MFA exemption
  ==========================

  Two-factor is already mandatory for every EMPLOYEE by role — `isMfaMandatory`
  in src/contexts/AuthContext.tsx returns true for the role regardless of any
  column. So the existing `mfa_enforced` flag, and the badge the employee list
  drew from it, have never had any effect on an employee: the badge described a
  setting that was not in play.

  What was actually missing is the opposite control — the ability to EXEMPT a
  specific person. A shared operational account, a device-less shift worker, a
  contractor mid-onboarding: today there is no way to let any of them in, and the
  2FA setup screen cannot be dismissed, so an employee who cannot enrol is simply
  locked out of the platform.

  `mfa_exempt` is that escape hatch, and it is deliberately narrow:
    • defaults to false, so the mandate still applies to everyone by default and
      no existing account changes behaviour when this runs;
    • it is an exemption, never a grant — it can only remove a requirement, so a
      mistake here weakens one account rather than the whole tenant;
    • it is separate from `mfa_enforced` rather than overloading it, because that
      column means "require 2FA for a role that would not otherwise need it" and
      a single tri-state column doing both jobs would be read wrongly the first
      time someone new looks at it.
*/

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS mfa_exempt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.mfa_exempt IS
  'Exempts this account from the two-factor mandate. Employees are otherwise required to enrol by role. An exemption only ever removes a requirement — it never grants access — and should be rare and reviewed.';

-- Finding the exempted accounts is an audit question, and there should only ever
-- be a handful of them.
CREATE INDEX IF NOT EXISTS users_mfa_exempt_idx
  ON public.users (company_id) WHERE mfa_exempt;
