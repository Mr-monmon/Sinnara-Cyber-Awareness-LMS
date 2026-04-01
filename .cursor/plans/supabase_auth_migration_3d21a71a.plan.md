---
name: Supabase Auth Migration
overview: Migrate from custom table-based password auth to Supabase Auth, reusing existing users.id as the auth identity, preserving credentials during backfill, and routing all privileged operations through a new Edge Function.
todos:
  - id: edge-function
    content: Create supabase/functions/user-admin Edge Function with createUser, bulkCreate, resetPassword, deleteUser actions
    status: completed
  - id: backfill
    content: Add backfill endpoint/script to migrate existing public.users rows into auth.users with matching IDs
    status: completed
  - id: auth-context
    content: "Refactor AuthContext.tsx: signInWithPassword, onAuthStateChange, remove localStorage session"
    status: completed
  - id: employees-page
    content: "Refactor EmployeesPage.tsx: route create/reset/delete/CSV through Edge Function"
    status: completed
  - id: account-settings
    content: "Refactor AccountSettings.tsx: use supabase.auth.updateUser for self-service password change"
    status: completed
  - id: users-management
    content: "Refactor UsersManagementPage.tsx: route add/reset/delete/bulk through Edge Function, fix re-auth"
    status: completed
  - id: companies-page
    content: "Refactor CompaniesPage.tsx: route company admin creation through Edge Function"
    status: completed
  - id: rls-policies
    content: Re-enable and update RLS policies to use auth.uid() = users.id
    status: pending
  - id: drop-password
    content: Add migration to drop password column from public.users after full verification
    status: pending
isProject: false
---

# Supabase Auth Migration Plan (Revised)

## Goal

Replace the insecure custom auth system (plaintext passwords in `public.users`, localStorage sessions) with Supabase Auth, while keeping `public.users` as the profile/authorization table.

## Key Design Decision: Reuse `users.id` as Auth ID

The Supabase admin API accepts an optional `id` when creating auth users. During backfill, each auth user will be created with `id = existing users.id`. This means:

- `auth.uid()` will equal `users.id` everywhere -- no bridging column needed.
- All existing FK relationships (employee_courses, exam_results, etc.) remain valid.
- RLS policies can use `auth.uid() = users.id` directly.
- The 20+ files that only read from `public.users` need zero changes.

## Files to Edit

### New files

- `supabase/functions/user-admin/index.ts` -- Edge Function handling createUser, bulkCreate, resetPassword, deleteUser via `auth.admin` APIs with service role key. Verifies caller is admin.

### Frontend changes

- `[src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)` -- Replace `.from('users').eq('password')` login with `supabase.auth.signInWithPassword()`. Replace localStorage session with `supabase.auth.onAuthStateChange()` + `getSession()`. Fetch profile from `public.users` by `auth.user.id`.
- `[src/pages/company-admin/EmployeesPage.tsx](src/pages/company-admin/EmployeesPage.tsx)` -- Route create/reset/delete/CSV-bulk-upload through `user-admin` Edge Function instead of direct `users` table inserts.
- `[src/pages/company-admin/AccountSettings.tsx](src/pages/company-admin/AccountSettings.tsx)` -- Replace self-service password change (currently `.eq('password', currentPassword)` then `.update({ password })`) with `supabase.auth.updateUser({ password })`.
- `[src/pages/platform-admin/UsersManagementPage.tsx](src/pages/platform-admin/UsersManagementPage.tsx)` -- Route add/reset/delete/bulk-upload through Edge Function. Replace admin password re-verification with `supabase.auth.signInWithPassword()` check.
- `[src/pages/platform-admin/CompaniesPage.tsx](src/pages/platform-admin/CompaniesPage.tsx)` -- Replace direct `users.insert({ password: 'Admin123!' })` when creating company admin with Edge Function call.
- `[src/lib/types.ts](src/lib/types.ts)` -- Remove any password-related type assumptions from the `User` interface.

### Database migration (late stage)

- `supabase/migrations/` -- Add migration to drop `password` column from `public.users` only after all code paths are verified switched.

## Implementation Order

### Step 1: Create `user-admin` Edge Function

- Actions: `createUser`, `bulkCreate`, `resetPassword`, `deleteUser`
- Uses `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never exposed to client)
- Verifies caller role from JWT before executing
- `createUser`: calls `auth.admin.createUser({ email, password, ... })`, then inserts profile row into `public.users` with matching `id`
- `bulkCreate`: accepts array, loops `createUser` logic, returns success/failure report
- `resetPassword`: calls `auth.admin.updateUserById(id, { password })`
- `deleteUser`: calls `auth.admin.deleteUser(id)`, then deletes profile row

### Step 2: Backfill existing users into Supabase Auth

- One-time Edge Function endpoint or script
- For each row in `public.users`: call `auth.admin.createUser({ id: row.id, email: row.email, password: row.password, email_confirm: true })`
- Since passwords are currently plaintext, they transfer directly -- users keep their existing credentials
- Log failures (duplicate emails, invalid data) for manual review

### Step 3: Refactor `AuthContext.tsx`

- Login: `supabase.auth.signInWithPassword({ email, password })`, then fetch profile by `auth.user.id`
- Session restore: `supabase.auth.getSession()` on mount + `onAuthStateChange` listener
- Logout: `supabase.auth.signOut()`
- Remove all `localStorage.getItem/setItem('sinnara_user')` manual session management

### Step 4: Refactor admin pages (5 files)

- Replace every direct `.from('users').insert([{ password: ... }])` with `supabase.functions.invoke('user-admin', { body: { action, ... } })`
- Replace every `.from('users').update({ password })` with Edge Function `resetPassword`
- Replace every `.from('users').delete()` with Edge Function `deleteUser`
- `AccountSettings.tsx`: use `supabase.auth.updateUser({ password })` for self-service change (no Edge Function needed -- user is already authenticated)
- `UsersManagementPage.tsx`: replace `verifyCurrentUserPassword` with `supabase.auth.signInWithPassword()` re-auth check

### Step 5: Re-enable RLS

- Policies use `auth.uid()` which now equals `users.id` directly
- Example: `CREATE POLICY "users_select" ON public.users FOR SELECT TO authenticated USING (true)`
- Write policies check role via `EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')`

### Step 6: Drop password column

- Only after all code paths confirmed working
- `ALTER TABLE public.users DROP COLUMN password;`

## Risks and Mitigations

- **Backfill email duplicates**: Query `public.users` for duplicate emails before starting; resolve or skip duplicates with a report.
- **Rollback**: Keep `password` column until fully verified. If rollback needed, `AuthContext` can be reverted to table-based login.
- **Bulk upload latency**: `bulkCreate` calls `auth.admin.createUser` per row sequentially. For large CSVs, consider batching with error accumulation.
- **Service role key**: Only in Edge Function environment variables, never in frontend `.env`.

