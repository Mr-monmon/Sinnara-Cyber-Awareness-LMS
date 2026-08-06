/*
  UPDATE privilege on public.users
  ================================

  Postgres checks table privileges BEFORE it consults any policy, so an UPDATE
  the `authenticated` role has no privilege for never reaches RLS at all:

      ERROR: 42501: permission denied for table users

  A production snapshot of `information_schema.column_privileges` showed the
  grant was not missing outright — it was column-scoped and stale. Before this
  migration `authenticated` could UPDATE:

      company_id, department, department_id, employee_id, full_name, phone,
      policy_accepted, policy_accepted_at, updated_at

  and could not UPDATE `job_title`, `is_active`, `requires_password_change`,
  `mfa_exempt`, `email` or `role`. Those are the columns added after whoever set
  the original grants stopped maintaining them; a new column inherits nothing.

  A single ungranted column rejects the WHOLE statement, which is what made the
  symptoms so confusing — and explains three bugs chased independently:

    • "Failed to save employee"           — the edit form writes `job_title`, so
                                            the `phone` in the same statement was
                                            never saved either. (The
                                            `department_id = ""` cast error was
                                            real and is fixed, but this was the
                                            wall behind it.)
    • "Failed to deactivate employee"     — `is_active` was not granted.
    • The password-change loop            — clearing `requires_password_change`
                                            from the browser was refused. Moving
                                            that write into a service-role edge
                                            function is what made it work, because
                                            the service role bypasses grants.

  The grant is column-scoped, not blanket
  ---------------------------------------
  `GRANT UPDATE ON public.users TO authenticated` would be unsafe. RLS decides
  WHICH ROWS you may write, never WHICH COLUMNS — and `rls_users_self_update`
  lets every signed-in user write their own row. A blanket grant therefore hands
  each employee:

      update users set role = 'PLATFORM_ADMIN' where id = auth.uid();
      update users set mfa_exempt = true       where id = auth.uid();
      update users set is_active  = true       where id = auth.uid();  -- undo a deactivation

  Column-level grants close that by construction. `role`, `company_id`, `email`,
  `mfa_enforced`, `mfa_exempt` and `requires_password_change` are simply not
  writable through the anon key at all, by anyone, for any row. They remain
  writable by the service role — i.e. only through the `user-admin` edge
  function, which authenticates the caller and checks their role first.

  The listed columns are exactly the ones the application writes from the
  browser today:
    full_name, phone, employee_id, job_title  — company-admin employee edit
    department_id                             — employee edit, DepartmentsPage,
                                                DepartmentAssign, bulk import
    is_active                                 — activate / deactivate employee
    policy_accepted, policy_accepted_at       — the acceptable-use prompt on
                                                first dashboard load

  Reversal (there is no snapshot to restore from):
      REVOKE UPDATE ON public.users FROM authenticated;
      DROP TRIGGER IF EXISTS trg_users_guard_self_update ON public.users;
      DROP FUNCTION IF EXISTS public.guard_users_self_update();
  That returns the table to exactly its present state — which is to say, back to
  the three bugs above. Nothing else in the schema is touched.
*/

GRANT UPDATE (
  full_name,
  phone,
  employee_id,
  job_title,
  department_id,
  is_active,
  policy_accepted,
  policy_accepted_at
) ON public.users TO authenticated;

/*
  The same snapshot turned up two privileges that were never needed and are
  actively dangerous, both almost certainly Supabase's default blanket grant on
  the public schema that was never narrowed for this table.

  1. `anon` held INSERT, UPDATE and REFERENCES on EVERY column of users —
     including `role`, `company_id` and `mfa_exempt`. `anon` is the publishable
     key shipped in the browser bundle to every visitor BEFORE they sign in. RLS
     was the only thing standing between an anonymous visitor and
     `update users set role = 'PLATFORM_ADMIN'`. The application never writes to
     users unauthenticated — there is no self-service signup, accounts are only
     ever created by the `user-admin` edge function — so this grant bought
     nothing and staked the whole tenant model on no one ever adding a `TO
     public` policy by mistake. SELECT is left in place; RLS governs it and a
     revoke there risks unauthenticated pages that read a name.

  2. `authenticated` held UPDATE on `company_id`. Combined with
     `rls_users_self_update` (which permits writing your own row) that is a
     tenant escape: an employee could move themselves into another company and
     inherit its scoping. Nothing in the front end writes `company_id`.

  Both are revoked below. Reversal is `GRANT INSERT, UPDATE ON public.users TO
  anon;` and `GRANT UPDATE (company_id), INSERT ON public.users TO
  authenticated;`.
*/
REVOKE INSERT, UPDATE, REFERENCES ON public.users FROM anon;
REVOKE UPDATE (company_id) ON public.users FROM authenticated;
REVOKE INSERT ON public.users FROM authenticated;

/*
  `is_active` is the one granted column that is also a security control, because
  deactivation is how a company admin locks someone out. The grant has to include
  it (the admin's own write needs it) but nothing in the grant distinguishes
  "admin deactivating an employee" from "employee reactivating themselves" —
  both are UPDATEs on `is_active`, and `rls_users_self_update` allows the second
  one's row.

  SECURITY INVOKER is deliberate and load-bearing: the function must run as the
  caller so `auth.uid()` is the caller. A SECURITY DEFINER version would run as
  the table owner, and the comparison below would be against the wrong identity.

  The service role is not exempted by name here because it does not need to be —
  `auth.uid()` is null for a service-role connection, and `null = OLD.id` is
  null, not true, so the branch never fires for the edge functions.
*/
CREATE OR REPLACE FUNCTION public.guard_users_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.id = auth.uid()
     AND NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'You cannot change the active status of your own account.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_users_self_update() IS
  'Blocks a user from flipping is_active on their own row. The column-level GRANT above already prevents self-service changes to role, company_id, mfa_exempt and requires_password_change; is_active is the one granted column that also gates access, so it needs this.';

DROP TRIGGER IF EXISTS trg_users_guard_self_update ON public.users;
CREATE TRIGGER trg_users_guard_self_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_users_self_update();
