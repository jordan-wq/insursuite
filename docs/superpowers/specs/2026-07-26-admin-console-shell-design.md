# Admin console shell v2: sidebar, client directory, team-wide conversations — Design

## Context

The staff shell (`docs/superpowers/specs/2026-07-24-staff-shell-design.md`) exists and works, but it's minimal: a top-bar with two tabs (Queue, Manage Staff). Queue only shows conversations assigned to the signed-in agent, there's no way to look up a client outside of starting a new conversation, and the whole thing reads as a bare utility screen rather than a real admin tool. This spec redesigns the shell itself: sidebar navigation, an Overview landing page, a team-wide Conversations view with live updates, and a proper Client directory with full per-client detail pages.

This does **not** touch the staff login page (`/staff/login`) — that's a separate, already-scoped follow-up spec.

## Goals

- Sidebar navigation (dark, using the existing `--ink` token) replacing the current top bar.
- `/staff` becomes an **Overview** page: work-queue-health stat tiles (open conversations, urgent/unread, packets pending delivery, unassigned conversations) with quick links into Conversations/Clients.
- `/staff/conversations`: every client conversation, team-wide (not just the signed-in agent's) — claim an unassigned one, reassign to a teammate, reply. Live-updates via Supabase Realtime so a claim or reply from one staff member appears for everyone else watching without a refresh.
- `/staff/clients`: searchable, sortable client directory. `/staff/clients/[id]`: full record — profile, policies (with packet status), conversation history, documents.
- `/staff/knowledge`: the existing "train the chatbot" panel, moved to its own page (it was only ever attached to Queue because Queue was the only page).
- `/staff/team`: Manage Staff, unchanged, moved into the sidebar.
- Extend the existing color/type tokens (`--ink #081738`, `--color-primary #2868d8`, Inter) — no new palette.

## Non-goals

- No role tiers (admin vs. regular agent) — stays flat-trust, matching the existing explicit product decision.
- No change to the staff login page or auth flow.
- No custom real-time infrastructure beyond Supabase Realtime (no websocket server, no polling-interval fallback layer).

## Deliberate access-control change

Today, per-client reads (`/api/agent/policies`) are gated by `isAssignedToAgent(clientId, agentId)` — an agent can only see a client who has a `service_requests` row assigned to them. A full client directory means any staff member can look up *any* client's record, not just their assigned ones. **This replaces `isAssignedToAgent` with a plain `isAgent(user.id)` check on client-data read paths.** This is consistent with the already-flat trust model (any staff account can already grant/revoke other staff — see the 2026-07-24 spec's non-goals) — it is a deliberate widening, confirmed with the user during brainstorming, not an incidental loosening. Write paths (policy packet-status updates, replies, claim/reassign) keep their own explicit checks as described below; this change is about **read** access only.

## Routing & IA

New route tree under `app/staff/(shell)/`:

- `app/staff/(shell)/page.tsx` — Overview (new; replaces today's Queue-as-homepage)
- `app/staff/(shell)/conversations/page.tsx` — global conversations (today's Queue content, moved and rescoped)
- `app/staff/(shell)/clients/page.tsx` — directory
- `app/staff/(shell)/clients/[id]/page.tsx` — client detail
- `app/staff/(shell)/knowledge/page.tsx` — chatbot trainer (moved out of Queue)
- `app/staff/(shell)/team/page.tsx` — Manage Staff (unchanged content, already exists)

`app/staff/(shell)/layout.tsx` changes from a top-bar to a sidebar: same `getCurrentUser()`/`isAgent()` gate it already has (untouched), new nav markup with links to Overview, Conversations, Clients, Knowledge, Manage Staff, using `--ink` as the sidebar background per the chosen mockup direction.

## Overview page

`GET /api/agent/overview` (new): `isAgent`-gated, returns counts only (no row data) — open conversations (`status != 'resolved'`), urgent/unread count (`priority = 'urgent' OR unread_by_agent = true`, excluding resolved), unassigned conversations (`assigned_to is null`, excluding resolved), and packets pending delivery (`user_policies.packet_status != 'delivered'`, count across all clients). Four stat tiles, each linking into the relevant filtered view (Conversations pre-filtered by the corresponding condition, e.g. `/staff/conversations?filter=unassigned`).

## Conversations (team-wide, claim/reassign, live)

`app/api/agent/conversations/route.ts` (new, replaces `app/api/agent/queue/route.ts` — the queue route and its page are deleted once this lands, not kept as a duplicate):

- `GET`: same `REQUEST_SELECT` shape as today's queue route, but drops the `.eq("assigned_to", user.id)` filter — returns every `service_requests` row, still `isAgent`-gated. Adds an `assignedToEmail` field per row using the same `agent_roles` → `client_profiles.email` join pattern already used in `/api/staff/team` (falls back to "(no profile)"; `null` `assigned_to` renders as "Unassigned" in the UI).
- `PATCH`: extends today's body shape with an explicit reassignment path — `{ id, assignedTo }` sets `assigned_to` to any value (including the caller's own id for "claim", or `null` to unclaim), no longer restricted to `.eq("assigned_to", user.id)` on the update (today's guard assumed only the assigned agent could touch their own row; team-wide claiming needs any agent to be able to update any row). Status updates (`{ id, status }`) keep working exactly as today, same relaxed `.eq` scope.
- Thread messages (`app/api/agent/requests/[id]/messages/route.ts`) currently scope both `GET` and `POST` to `.eq("assigned_to", user.id)` when looking up the parent `service_requests` row (404ing with "Request not found in your assigned queue" otherwise) — this needs the same relaxation as the conversations route: drop the `assigned_to` equality check, keep a plain `isAgent` existence check on the parent request. Without this, claim/reassign in the list UI works but replying to a reassigned or newly claimed conversation 404s.

Page UI: same list-plus-side-thread-panel interaction the current Queue page already has (`app/staff/(shell)/page.tsx` today), moved to `app/staff/(shell)/conversations/page.tsx`, with an added "Assigned to" column/badge and a reassign control (dropdown of staff, sourced from `/api/staff/team`) next to the existing status `<select>`. "Start a conversation" panel and the client search it uses (`/api/agent/clients`) carry over unchanged.

**Realtime:** the Conversations page subscribes (via `createClientSupabase()`, the session-scoped browser client — never the admin client) to Postgres changes on `service_requests` and `service_request_messages`, scoped by nothing beyond RLS (see migration below) since every staff member should see every row. On any change event, refetch the affected slice (or the whole list — simplicity over micro-optimization at this scale) rather than trying to hand-patch local state from the raw payload. If the realtime channel disconnects, fall back silently to the existing fetch-on-mount/fetch-after-action behavior — the page must not be broken when offline or when Realtime is misconfigured, just less live.

## Clients directory + detail

`GET /api/agent/clients` (extend existing route, don't duplicate): today, an empty/short query returns `{ clients: [] }` — that behavior is unchanged for a *non-empty* query under 2 characters (the existing typeahead debounce guard). A request with **no `query` param at all** is new: list mode — paginated `client_profiles` (`page`, `pageSize`, default 25), sorted by `full_name`, returning `{ clients, total }`. This is additive: the existing "start a conversation" search box always calls this endpoint with a non-empty typed value, so it never hits the new list-mode branch — no behavior change for that call site.

Directory columns: name, email, onboarding status, joined date. Row click → `/staff/clients/[id]`. List mode must be detected with `searchParams.has("query")` (query param absent entirely), not an empty-string check — the existing short-query guard already collapses `null` and `""` into the same `{ clients: [] }` response, so list mode needs a distinct check from that guard.

`GET /api/agent/clients/[id]` (new): `isAgent`-gated (not assignment-gated, per the access-control change above). Returns:
- Profile: same shape `client-profile` GET already returns for the client themself (top-level fields + the sanitized `profile` jsonb), reusing `sanitizeProfile()`'s existing allow-list — no new fields exposed.
- Policies: same `POLICY_SELECT` shape as `/api/agent/policies`, but that route's `isAssignedToAgent` guard is replaced with a plain `isAgent` check (the access-control change).
- Requests: all `service_requests` for this `user_id` (any status, any assignee) — this client's full conversation history, not just open ones.
- Documents: filename, content type, size, created date (metadata only, not the file body) — `documents` table, `isAgent`-gated read, admin client.

`app/api/documents/[id]/route.ts` gets a second branch: today it's owner-only (`.eq("user_id", user.id)` via the session-scoped client). Add an agent path — if the requester isn't the owner, check `isAgent(user.id)` and if true, fetch via the admin client instead (RLS would otherwise block a non-owner read), same existing filename-sanitization/content-disposition logic untouched (that's the header-injection fix from the prior security review — not being touched here). If neither owner nor agent, 404 exactly as today.

## Realtime & RLS migration

New migration (`supabase/migrations/0006_agent_realtime_read.sql` — `0001` through `0005` are already taken):

```sql
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'service_requests'
      and policyname = 'Agents read all service requests'
  ) then
    create policy "Agents read all service requests"
      on public.service_requests for select
      using (exists (select 1 from public.agent_roles ar where ar.user_id = auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'service_request_messages'
      and policyname = 'Agents read all service request messages'
  ) then
    create policy "Agents read all service request messages"
      on public.service_request_messages for select
      using (exists (select 1 from public.agent_roles ar where ar.user_id = auth.uid()));
  end if;
end $$;

alter publication supabase_realtime add table public.service_requests;
alter publication supabase_realtime add table public.service_request_messages;
```

Both new policies are `for select` only — they run alongside the existing client-owner policies (Postgres OR-combines permissive policies for the same command), so client-facing access is unchanged, and agents still get no direct `insert`/`update`/`delete` via RLS — all writes continue through the admin-client API routes exactly as today. The `alter publication` statements are idempotent in practice (re-adding an already-added table errors; if this migration is ever re-run, that line needs a guard or a manual skip — noted for whoever runs it) and only take effect once, at migration time.

## Visual style

Sidebar background `--ink` (#081738), sidebar text light/muted-light on that background, active nav item highlighted with `--color-primary`. Content area keeps existing `--color-page`/`--color-surface` tokens unchanged. No new CSS custom properties — extend `app/globals.css`'s existing staff-shell rules in place.

## Verification

- `npm run build`.
- Manual: sign in as staff, confirm Overview shows correct counts, confirm Conversations shows every conversation (not just the signed-in agent's), claim an unassigned one, reassign one to a second staff account, confirm both accounts see the change without a manual refresh (Realtime).
- Manual: open a client from the directory who is *not* assigned to the signed-in agent's own conversations, confirm their full profile/policies/documents/requests load (confirms the `isAssignedToAgent` → `isAgent` change).
- Manual: download a client's document from the detail page as staff, confirm it downloads correctly and the filename/content-type are preserved.
- Manual: sign in as a second staff account with no active Realtime connection (e.g. block WebSocket in devtools) and confirm the Conversations page still loads and functions via plain fetch, just without live updates.
