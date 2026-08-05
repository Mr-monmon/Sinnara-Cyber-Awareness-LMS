/*
  UPDATE privilege on public.users
  ================================

  Every RLS policy on `public.users` — `rls_users_self_update`, `rls_users_ca`,
  and the rest — has been dead code. Postgres checks table privileges BEFORE it
  consults any policy, and the `authenticated` role was never granted UPDATE on
  this table by any migration in this repository. So the writes did not fail an
  RLS check; they never reached one:

      ERROR: 42501: permission denied for table users

  That single missing grant is the shared root cause of three separate bugs we
  chased independently:

    • "Failed to deactivate employee"     — the is_active write was refused.
    • The password-change loop            — clearing `requires_password_change`
                                            from the browser was refused. Moving
                                            that write into a service-role edge
                                            function is what made it work, because
                                            the service role bypasses grants.
    • "Failed to save employee"           — the phone/job-title edit was refused.
                                            (The `department_id = ""` cast error
                                            was real and is fixed, but this was
                                            the wall behind it.)

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
