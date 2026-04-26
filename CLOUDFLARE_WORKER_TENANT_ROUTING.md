# Cloudflare Worker Tenant Routing

## Implementation Date

- Updated on `2026-04-10`

## Purpose

This document explains the current hostname-based routing and login behavior for the Sinnara deployment.

The goals are:

- keep tenant access tied to company subdomains such as `client1.domain`
- keep platform-admin access on the reserved admin host `ta7kom-core.domain`
- remove public login links from marketing pages
- keep `/dashboard` protected by hostname-aware browser and Worker logic

## Host Model

### Marketing apex

Examples:

- `https://domain`
- `https://www.domain`
- `http://localhost:5173`

Behavior:

- serves the public marketing site
- `/login` is not available here
- `/dashboard` is redirected to the apex homepage

### Admin host

Examples:

- `https://ta7kom-core.domain`
- `http://ta7kom-core.localhost:5173`

Behavior:

- reserved for `PLATFORM_ADMIN`
- `/` redirects to `/login`
- `/login` is the admin login page
- `/dashboard` is the admin dashboard

### Tenant subdomain

Examples:

- `https://client1.domain`
- `https://acme.domain`
- `http://client1.localhost:5173`

Behavior:

- used for company-specific login and dashboard access
- `/login` is available only on the tenant host itself
- `/dashboard` is tenant-scoped and validated against the resolved company

### Invalid host

Examples under the current tenant pattern:

- `https://client-1.domain`
- `https://test123.domain`
- `https://__.domain`

Behavior:

- invalid protected routes are redirected to the marketing apex homepage
- invalid public routes still load the SPA, but `/login` redirects back to `/`

## Worker Logic

The Cloudflare Worker still runs first only for protected dashboard routes:

- `/dashboard`
- `/dashboard/*`

Worker behavior:

1. Read the request hostname and path.
2. If the path is not protected, serve assets normally.
3. If the hostname is invalid, redirect to the apex homepage.
4. If the hostname is `tenant`, `admin`, or `apex`, allow the SPA request through.

The Worker does not make auth decisions. It only blocks invalid protected hosts early.

## Browser Routing Logic

Shared hostname utilities in `src/lib/tenant.ts` now classify hosts as:

- `apex`
- `admin`
- `tenant`
- `invalid`

The reserved admin subdomain is:

- `ta7kom-core`

Tenant resolution in `src/hooks/useTenantAccess.ts` only queries the `companies` table when the host is a tenant subdomain.

## Login Behavior

### Public marketing hosts

- `/login` redirects to `/`
- public pages no longer show login buttons

### Admin host

- `https://ta7kom-core.domain/` redirects to `https://ta7kom-core.domain/login`
- `https://ta7kom-core.domain/login` renders the login page
- successful `PLATFORM_ADMIN` login navigates to `https://ta7kom-core.domain/dashboard` via React Router

### Tenant host

- `https://client1.domain/login` renders the login page
- successful `COMPANY_ADMIN` or `EMPLOYEE` login navigates to `https://client1.domain/dashboard` via React Router
- wrong-tenant or platform-admin credentials entered on a tenant host are signed out immediately after authentication and redirected to the apex homepage

## Dashboard Authorization

`src/ProtectedRoute.tsx` applies the following rules:

### Invalid host

- redirect to apex homepage

### Tenant host

- if company lookup fails, redirect to apex homepage
- if user is not signed in, go to `/login` on the same tenant host
- `COMPANY_ADMIN` and `EMPLOYEE` are allowed only when `user.company_id` matches the resolved tenant company
- all other users (including stale wrong-tenant sessions and `PLATFORM_ADMIN`) are redirected to the apex homepage

### Admin host

- if user is not signed in, go to `/login` on the same admin host
- only `PLATFORM_ADMIN` is allowed
- other roles are redirected away from the admin host

### Marketing apex

- all `/dashboard` requests are redirected to the apex homepage

## Invitation And Reset Links

Login URLs sent from the app now follow host-specific behavior:

- company-admin invitations sent from the platform admin area use the company tenant login URL
- employee welcome/reset links sent from the company admin area use the current tenant host login URL
- company-admin password-change sign-out now returns the user to `/login` on the same host

## Main Files

- `src/worker.ts`
- `src/lib/tenant.ts`
- `src/lib/browserTenant.ts`
- `src/hooks/useTenantAccess.ts`
- `src/components/HostAwarePublicRoutes.tsx`
- `src/routes.tsx`
- `src/ProtectedRoute.tsx`
- `src/contexts/AuthContext.tsx`

## Route Outcomes


| Host           | Path                              | Result                            |
| -------------- | --------------------------------- | --------------------------------- |
| marketing apex | `/`                               | landing page                      |
| marketing apex | `/login`                          | redirect to `/`                   |
| marketing apex | `/dashboard`                      | redirect to apex homepage         |
| admin host     | `/`                               | redirect to `/login`              |
| admin host     | `/login`                          | admin login page                  |
| admin host     | `/dashboard` unauthenticated      | redirect to `/login`              |
| admin host     | `/dashboard` platform admin       | allowed                           |
| admin host     | `/dashboard` non-platform user    | redirect away                     |
| tenant host    | `/login`                          | tenant login page                 |
| tenant host    | `/login` wrong-tenant sign-in     | sign out, then redirect to apex `/` |
| tenant host    | `/dashboard` unauthenticated      | redirect to same-host `/login`    |
| tenant host    | `/dashboard` matching tenant user | allowed                           |
| tenant host    | `/dashboard` platform admin       | redirect away                     |
| tenant host    | `/dashboard` wrong-tenant user    | redirect away                     |
| invalid host   | `/login`                          | redirect to `/`                   |
| invalid host   | `/dashboard`                      | Worker redirects to apex homepage |


## Notes

- Tenant subdomain validation still accepts only lowercase letters: `^[a-z]+$`
- `run_worker_first` in `wrangler.toml` is still limited to `/dashboard` and `/dashboard/.`
