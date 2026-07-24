# Staff shell: separate login, separate area, staff management

## Context

Today "agent" is just a row in `agent_roles` checked at request time — the Agent Console itself is one more tab inside the same client-facing page tree (`app/page.tsx`), reached through the same `/login` page as clients. This spec gives staff their own dedicated area: separate login page, separate shell with no client-portal chrome, and a screen to grant/revoke staff access without needing a manual SQL insert every time.

Still one Supabase project and one Auth system (per direction — no separate identity backend). "Separate login" means a separate page, URL, and branding, not separate credentials: a client who navigates to `/staff/login` and signs in with their own account is authenticated the same as anywhere else in the app, then denied at the staff gate exactly like today's `isAgent` check — there is no new security boundary being introduced, just a properly separated UI.

## Goals

- `/staff/login` — a dedicated, staff-branded login page, distinct from the client `/login`.
- `/staff/*` — a real separate app shell (own layout, own top-level nav) with no client-portal UI in it at all — not a tab.
- A "Manage Staff" screen so an existing agent can grant/revoke `agent_roles` access to other users without a manual SQL insert.
- Remove the now-redundant embedded "Agent Console" tab from the client shell once its content has a real home.

## Non-goals

- No separate Supabase Auth instance / no MFA (both declined — same email/password flow underneath).
- No role tiers (admin vs. regular agent) — any current agent can grant/revoke staff access, matching the existing flat single-role model. A tiered permission system is a real future option, not requested now.
- Does not itself build the client-search / packet-status / messaging UI from the other two pending specs — this spec is the shell those features get built into, not a re-do of them.

## Routing & auth

- Route layout must keep the login page chrome-free: `app/staff/login/page.tsx` sits *outside* the nav'd shell, while the authenticated pages live in a nested group — e.g. `app/staff/login/page.tsx` plain, and `app/staff/(shell)/layout.tsx` wrapping `app/staff/(shell)/page.tsx` (queue + knowledge-base trainer, the same two-panel layout `AgentConsole` already renders today, just relocated) and `app/staff/(shell)/team/page.tsx` (Manage Staff), both resolving to `/staff` and `/staff/team` since route groups don't affect the URL. Only the shell layout renders the staff top bar/nav — the login page must not inherit it.
- `app/staff/login/page.tsx` — same visual pattern as the client login card (`createClientSupabase()`, email/password), different copy/branding ("InsurSuite Staff"), posts through the same Supabase Auth. Any already-authenticated user visiting `/staff/login` redirects to `/staff` (mirroring how `/login` already behaves for a signed-in user) — an agent lands in the shell as normal, a non-agent client gets bounced straight back out to `/?notice=staff_access_denied` by the same `isAgent` gate described below.
- `middleware.ts` gets a `/staff` branch, and `/staff/login` must be added to `isPublicPath()`'s allowance — today's generic rule (redirect any unauthenticated non-public/non-`/api` request straight to `/login`) would otherwise intercept `/staff/login` itself before the new branch ever runs, sending staff to the client login and defeating the whole point. That same generic rule also covers `/staff` and `/staff/team` (any unauthenticated, non-public, non-`/api` path) — its redirect target must special-case any `/staff/*` pathname to `/staff/login` instead of the hardcoded `/login`, or an unauthenticated visit to `/staff` directly (not just `/staff/login`) lands on the wrong login page. The new branch beyond that mirrors the existing `user && pathname === "/login"` redirect-when-already-signed-in block (today's `middleware.ts`), added as a `/staff/login` analog: authenticated → redirect to `/staff`, where the existing `isAgent(user.id)` false case → redirect to `/?notice=staff_access_denied` (client `page.tsx` reads that param on mount and shows it via the existing `toast` state, then clears it from the URL) — not treated as logged-out, since they are a real authenticated user, just not staff. Note: this puts a Supabase round-trip (`isAgent`) on every `/staff/*` request, a new usage pattern — today `isAgent` is only called from within API routes, not middleware. Acceptable given expected staff traffic volume; not something to optimize preemptively. Also note `isAgent()` calls `createAdminSupabase()`, which throws if `SUPABASE_SERVICE_ROLE_KEY` is unset — that failure now surfaces as broken *page* routing for `/staff/*`, not just an API error, so it's worth a sanity check that the env var is actually set wherever this deploys.
- A user who is both a client and staff is unaffected on the client side — signing in at the regular `/login` still lands them in the normal client portal exactly as today. Only visiting `/staff/login` enters the staff shell.

## Moving existing agent surfaces

- The current `AgentConsole` component's content (assigned queue, knowledge-base trainer) moves from being a `NavKey` tab inside `app/page.tsx` into `app/staff/page.tsx` under the new layout. Same data/API calls (`/api/agent/queue`, `/api/knowledge`), new home.
- `AgentConsole` and the shared UI it's built from (`Panel`, `PanelHeader`, `ticketCode()`, and any other primitive it uses) are private, unexported functions living inside `app/page.tsx` today — a separate route tree under `app/staff/` cannot import them as-is. These get extracted into a shared module (e.g. `app/components/shared.tsx`) that both the client shell and the new staff shell import from, rather than duplicated. This is a real prerequisite step, not a copy-paste.
- Once moved, remove `"Agent Console"` from the client shell's `NavKey`/`navItems`/`SectionContent` entirely (including the `agentAccess` plumbing that exists solely to conditionally show that one tab) — it's fully redundant once `/staff` is the real destination.
- The client-search, per-client packet-status panel, and messaging thread/composer described in the other two specs are built directly under this new `/staff` shell — no rework needed there, they just target the new location instead of the old tab.

## Manage Staff screen

- `app/staff/team/page.tsx`: lists current staff (email, date added, pulled by joining `agent_roles` with `client_profiles.email` — the only place an email currently lives against a user id), a "grant access" form (enter an email → looks up that email's user id via `client_profiles` → inserts an `agent_roles` row), and a revoke action per row (deletes the `agent_roles` row).
- Granting only works for someone who has already signed up (has a `client_profiles`/`auth.users` row) — this does not create new accounts, only elevates an existing one. If the email isn't found, show a clear error rather than silently failing.
- Guard against an agent revoking their own access by accident (confirm dialog, or simply disable the revoke action on your own row).
- API: `GET /api/staff/team`, `POST /api/staff/team` (grant by email), `DELETE /api/staff/team/[userId]` (revoke) — admin client, gated by the same `isAgent` check every other agent-only route already uses.

## Verification

- `npm run build`.
- Manual pass: sign in as a non-staff client at `/staff/login`, confirm redirect back to `/` with the notice. Sign in as an existing agent, confirm the full staff shell loads with no client-portal chrome. Grant a second test account staff access via Manage Staff, confirm they can then reach `/staff`. Revoke it, confirm they're redirected out again.
