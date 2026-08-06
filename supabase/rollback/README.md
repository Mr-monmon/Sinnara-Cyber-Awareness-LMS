# Rollback scripts

Scripts here are **emergency runbooks**, not migrations. Nothing in this
directory is applied by `supabase db push`, and nothing in it should be.

They exist to be read first and then run deliberately, by a person who has
decided the trade-off is worth it — never as a step in a deployment.

## `rls_restore_permissive_state.sql`

Undoes the tenant isolation added in
`migrations/20260515000004_rls_proper_policies.sql` and returns the database to
"any authenticated user can do anything":

- drops every `rls_*` policy in `public`;
- drops `is_platform_admin()`, `get_my_company_id()` and `get_my_role()`, which
  most later policies and several `SECURITY DEFINER` functions now call;
- creates `FOR ALL TO authenticated USING (true) WITH CHECK (true)` on 37
  tables, including `users`, `companies`, `subscriptions` and `invoices`.

After running it, **every signed-in user of every customer can read and write
every other customer's data.** For a multi-tenant platform holding phishing
results and employee records, that is the worst outcome the schema can produce.

### Why it moved out of `migrations/`

It was written as a break-glass runbook — its own header says "paste this
entire file and run it" — and then filed among the migrations. On an ordered
apply the damage is short-lived, because `20260515000004` runs immediately
after and re-creates the proper policies. The real exposure is someone opening
the migrations folder, following the instructions in the file, and running it
on its own. Moving it costs nothing and removes that possibility entirely.

### If you ever do need it

Prefer fixing the policy that is actually blocking you. If you run this
anyway, treat it as an incident: apply
`migrations/20260515000004_rls_proper_policies.sql` and
`migrations/20260606000001_production_readiness_phase1_2.sql` to restore the
helpers and policies as soon as the investigation is done, and re-check the
grants on `public.users` — see
`migrations/20260805130000_users_update_grant.sql`, which documents what the
column-level privileges there are supposed to be.
