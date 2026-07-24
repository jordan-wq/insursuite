# Agent–client messaging

## Context

Today, when a client opens a service request, the assigned agent can only change its *status* (`app/api/agent/queue/route.ts` PATCH) — there is no way for an agent to write a real reply the client can see. The two chat-style surfaces in the product (`ConciergeChat`, `SupportView`'s composer) are canned/bot responses only. This gives agents an actual way to talk to clients, attached to the request system that already exists.

## Goals

- Real, persisted messages on a service request, both directions (client ↔ assigned agent).
- Agent can start a new request/conversation proactively (not just reply to what a client already opened) — requires a client search in Agent Console, which doesn't exist today.
- Client sees agent replies clearly labeled as a person, inside the specific request — never mixed with the AI assistant's canned answers.

## Non-goals

- Not a standalone inbox independent of requests (declined — per-request threads only).
- Not merging AI bot chat and human messages into one feed (declined — kept visibly separate).
- No real-time/websocket delivery — same fetch-on-load pattern as the rest of the app.

## Dependency

This spec's client-facing unread signal relies on the `notifications` table defined in `2026-07-23-policy-enrichment-design.md`, which is not yet implemented. That table's migration must land first (or as part of the same implementation pass) — this spec is not buildable in isolation before it exists. `related_id` on that table is a generic, type-dependent pointer (not policy-specific), so an `agent_reply` notification can set `related_id` to the `service_request_id` without any further schema change.

## Data model

New table, following the same shape/RLS conventions as every other client-owned table in `supabase/migrations/`:

```sql
create table public.service_request_messages (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('client', 'agent')),
  message text not null,
  created_at timestamptz not null default now()
);
```

RLS: clients can select/insert rows where `service_request_id` belongs to a `service_requests` row they own (`user_id = auth.uid()`) — a subquery policy. This is intentionally different from the direct `auth.uid() = user_id` policies on every other table in `0001_init.sql`; it has to be, since a message row has no `user_id` column of its own. Not a pattern to "simplify" back to the direct form. Agent-side reads/writes go through the existing admin (service-role) client, gated by the same `isAgent` check the queue route already uses — no new trust model, reuses what's there.

Two small extensions to `service_requests` behavior (no schema change, both already exist):
- `unread_by_agent` — already flips true on request creation; extend so it also flips true whenever a *client* posts a new message on an existing request (agent needs to know to look again).
- Client-side unread signal reuses the real `notifications` table from the policy-enrichment spec (see Dependency, above) — a new agent message inserts a `type: "agent_reply", related_id: <service_request_id>` notification for the client, same mechanism as packet-delivered/premium-due-soon. No new client-side "unread" column needed.

## Client side (`SupportView`)

- The existing `merged-ticket-list` rows become clickable, opening the selected request's detail: its message thread plus a real composer (`POST /api/service-requests/[id]/messages`), replacing the currently-fake `sendMessage`/composer in that component.
- Messages render with a clear sender label ("Maya (Consultant)" vs. "You") — this is a *different* visual context from `ConciergeChat`'s bot bubbles, so no shared styling that could blur "AI" vs. "person."

## Agent side (`Agent Console`)

- Each queue item gets a reply affordance (expand to show the thread + composer, alongside the existing status `<select>`) — `POST` as `sender_role: "agent"`, admin client, same assigned-to gate the PATCH already enforces.
- New "Start a conversation" action: a client search box (`GET /api/agent/clients?query=` — name/email search over `client_profiles` via the admin client, gated by `isAgent`) → pick a client → choose a request type + write the first message → creates a new `service_requests` row (`source: "agent"`, `assigned_to`: the agent) plus the first message row, and notifies the client the same way any new agent reply does.

## API surface

- `GET /api/service-requests/[id]/messages`, `POST /api/service-requests/[id]/messages` — client-scoped (own request only, via RLS + explicit ownership check).
- `GET /api/agent/requests/[id]/messages`, `POST /api/agent/requests/[id]/messages` — agent-scoped (admin client, `isAgent` + assigned-to check), mirrors the client routes but through the agent trust boundary, same split already used for `/api/service-requests` vs `/api/agent/queue`.
- `GET /api/agent/clients?query=` — client search for starting a new conversation.
- `POST /api/agent/requests` — agent-initiated new request (client id, request type, first message). `priority`/`request_data` take the same table defaults client-created requests normally resolve to (`"normal"` / `{}`). One explicit override: `unread_by_agent: false` on insert — the table default is `true`, which is right for a client-created request (agent needs to look) but wrong here, since the assigned agent is also the author and shouldn't see their own new conversation flagged as needing their own attention.

## Phasing note

Two separable units bolted into one spec: (1) replying on a request the client already opened — one table, two route pairs, thread UI — and (2) agent-initiated new conversations — client search endpoint, new-request UI, new-request endpoint. Both are explicit goals here, but a plan may reasonably sequence (1) before (2) rather than land them as a single change.

## Verification

- `npm run build`.
- Manual pass: client opens a request, agent replies from Agent Console, client sees it labeled correctly and gets a real notification; agent searches for a client with no open requests and starts a new conversation, client sees the new request appear with the first message.
