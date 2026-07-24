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

- New route group `app/staff/` with its own `layout.tsx` — a staff-branded top bar/nav (queue, manage staff, knowledge base), nothing shared with the client shell's sidebar/nav.
- `app/staff/login/page.tsx` — same visual pattern as the client login card (`createClientSupabase()`, email/password), different copy/branding ("InsurSuite Staff"), posts through the same Supabase Auth.
- `middleware.ts` gets a `/staff` branch: unauthenticated → redirect to `/staff/login`. Authenticated but `isAgent(user.id)` false → redirect to `/` (their normal client portal, if they have one) with a brief "you don't have staff access" notice — not treated as logged-out, since they are a real authenticated user, just not staff.
- A user who is both a client and staff is unaffected on the client side — signing in at the regular `/login` still lands them in the normal client portal exactly as today. Only visiting `/staff/login` enters the staff shell.

## Moving existing agent surfaces

- The current `AgentConsole` component's content (assigned queue, knowledge-base trainer) moves from being a `NavKey` tab inside `app/page.tsx` into `app/staff/page.tsx` under the new layout. Same data/API calls (`/api/agent/queue`, `/api/knowledge`), new home.
- Once moved, remove `"Agent Console"` from the client shell's `NavKey`/`navItems`/`SectionContent` entirely (including the `agentAccess` plumbing that exists solely to conditionally show that one tab) — it's fully redundant once `/staff` is the real destination.
- The client-search, per-client packet-status panel, and messaging thread/composer described in the other two specs are built directly under this new `/staff` shell — no rework needed there, they just target the new location instead of the old tab.

## Manage Staff screen

- `app/staff/team/page.tsx` (or a section within the staff shell): lists current staff (email, date added, pulled by joining `agent_roles` with `client_profiles.email` — the only place an email currently lives against a user id), a "grant access" form (enter an email → looks up that email's user id via `client_profiles` → inserts an `agent_roles` row), and a revoke action per row (deletes the `agent_roles` row).
- Granting only works for someone who has already signed up (has a `client_profiles`/`auth.users` row) — this does not create new accounts, only elevates an existing one. If the email isn't found, show a clear error rather than silently failing.
- Guard against an agent revoking their own access by accident (confirm dialog, or simply disable the revoke action on your own row).
- API: `GET /api/staff/team`, `POST /api/staff/team` (grant by email), `DELETE /api/staff/team/[userId]` (revoke) — admin client, gated by the same `isAgent` check every other agent-only route already uses.

## Verification

- `npm run build`.
- Manual pass: sign in as a non-staff client at `/staff/login`, confirm redirect back to `/` with the notice. Sign in as an existing agent, confirm the full staff shell loads with no client-portal chrome. Grant a second test account staff access via Manage Staff, confirm they can then reach `/staff`. Revoke it, confirm they're redirected out again.
