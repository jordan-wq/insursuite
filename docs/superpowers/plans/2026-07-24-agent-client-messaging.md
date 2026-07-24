# Agent-Client Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an assigned agent write real, persisted replies on a client's service request (and start new conversations proactively), replacing the fake canned chat in `SupportView` with a real per-request message thread.

**Architecture:** One new table (`service_request_messages`) plus four new/extended API routes, following the exact client-vs-agent trust split already established throughout this codebase (`app/api/service-requests/*` = RLS-scoped client routes; `app/api/agent/*` = admin-client + `isAgent()`-gated staff routes).

**Tech Stack:** Next.js App Router, Supabase (Postgres/RLS), TypeScript.

**Hard prerequisites — do not start this plan until both are true:**
1. `docs/superpowers/plans/2026-07-24-policy-enrichment.md` has been executed at least through its Task 1 (the `notifications` table must exist — this plan inserts into it for the `agent_reply` notification type).
2. `docs/superpowers/plans/2026-07-24-staff-shell.md` has been executed in full — the agent-side work below targets `app/staff/(shell)/page.tsx` (the relocated Agent Console), not the old embedded tab in `app/page.tsx`, which no longer exists after that plan runs.

**Verification convention:** No unit-test framework in this repo (`npm test` = `next build`). Every task's test step is `npm run build` plus a manual browser-preview check.

**Spec:** `docs/superpowers/specs/2026-07-23-agent-client-messaging-design.md`

---

### Task 1: Migration — message table

**Files:**
- Create: `supabase/migrations/0004_service_request_messages.sql`

- [ ] **Step 1: Write the migration**

```sql
create table public.service_request_messages (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('client', 'agent')),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.service_request_messages enable row level security;

create policy "Clients manage messages on their own requests"
  on public.service_request_messages for all
  using (exists (select 1 from public.service_requests sr where sr.id = service_request_id and sr.user_id = auth.uid()))
  with check (exists (select 1 from public.service_requests sr where sr.id = service_request_id and sr.user_id = auth.uid()));
```

(No client policy is needed for agent access — agent routes go through the service-role admin client, same as every other agent-only table in this schema, bypassing RLS entirely after the app-level `isAgent` check.)

- [ ] **Step 2: Push and verify**

Run: `npx supabase db push`
Expected: `Applying migration 0004_service_request_messages.sql...` then success, no errors. Confirm with `npx supabase migration list` that it shows applied.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_service_request_messages.sql
git commit -m "Add service_request_messages table"
```

---

### Task 2: Client-side message API

**Files:**
- Create: `app/api/service-requests/[id]/messages/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { createServerSupabase } from "../../../../lib/supabase/server";
import { getCurrentUser } from "../../../../auth";

const MESSAGE_SELECT = "id, senderId:sender_id, senderRole:sender_role, message, createdAt:created_at";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { id } = await context.params;
  const supabase = await createServerSupabase();
  const { data: owned } = await supabase.from("service_requests").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!owned) return Response.json({ error: "Request not found" }, { status: 404 });

  const { data: messages } = await supabase.from("service_request_messages").select(MESSAGE_SELECT).eq("service_request_id", id).order("created_at", { ascending: true });
  return Response.json({ messages: messages || [] });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json() as { message?: string };
  const message = (body.message || "").trim().slice(0, 4000);
  if (!message) return Response.json({ error: "Message is required" }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data: owned } = await supabase.from("service_requests").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!owned) return Response.json({ error: "Request not found" }, { status: 404 });

  const { data: saved, error } = await supabase
    .from("service_request_messages")
    .insert({ service_request_id: id, sender_id: user.id, sender_role: "client", message })
    .select(MESSAGE_SELECT)
    .single();
  if (error || !saved) return Response.json({ error: "Unable to send message" }, { status: 500 });

  await supabase.from("service_requests").update({ unread_by_agent: true, updated_at: new Date().toISOString() }).eq("id", id);

  return Response.json({ message: saved }, { status: 201 });
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add app/api/service-requests/[id]/messages/route.ts
git commit -m "Add client-side service request messages API"
```

---

### Task 3: Agent-side message API + client search + agent-initiated requests

**Files:**
- Create: `app/api/agent/requests/[id]/messages/route.ts`
- Create: `app/api/agent/clients/route.ts`
- Create: `app/api/agent/requests/route.ts`

- [ ] **Step 1: Agent-side message thread route**

```ts
// app/api/agent/requests/[id]/messages/route.ts
import { createAdminSupabase } from "../../../../../lib/supabase/admin";
import { getCurrentUser } from "../../../../../auth";
import { isAgent } from "../../../../../service-routing";

const MESSAGE_SELECT = "id, senderId:sender_id, senderRole:sender_role, message, createdAt:created_at";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const { id } = await context.params;
  const admin = createAdminSupabase();
  const { data: owned } = await admin.from("service_requests").select("id").eq("id", id).eq("assigned_to", user.id).maybeSingle();
  if (!owned) return Response.json({ error: "Request not found in your assigned queue" }, { status: 404 });

  const { data: messages } = await admin.from("service_request_messages").select(MESSAGE_SELECT).eq("service_request_id", id).order("created_at", { ascending: true });
  return Response.json({ messages: messages || [] });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json() as { message?: string };
  const message = (body.message || "").trim().slice(0, 4000);
  if (!message) return Response.json({ error: "Message is required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: owned } = await admin.from("service_requests").select("id, userId:user_id").eq("id", id).eq("assigned_to", user.id).maybeSingle();
  if (!owned) return Response.json({ error: "Request not found in your assigned queue" }, { status: 404 });

  const { data: saved, error } = await admin
    .from("service_request_messages")
    .insert({ service_request_id: id, sender_id: user.id, sender_role: "agent", message })
    .select(MESSAGE_SELECT)
    .single();
  if (error || !saved) return Response.json({ error: "Unable to send message" }, { status: 500 });

  await admin.from("service_requests").update({ unread_by_agent: false, updated_at: new Date().toISOString() }).eq("id", id);
  await admin.from("notifications").insert({
    user_id: owned.userId,
    type: "agent_reply",
    title: "You have a new reply",
    message: message.slice(0, 200),
    related_id: id,
  });

  return Response.json({ message: saved }, { status: 201 });
}
```

- [ ] **Step 2: Client search route**

```ts
// app/api/agent/clients/route.ts
import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const query = new URL(request.url).searchParams.get("query")?.trim() || "";
  if (query.length < 2) return Response.json({ clients: [] });

  const admin = createAdminSupabase();
  const { data: clients } = await admin
    .from("client_profiles")
    .select("userId:user_id, fullName:full_name, email")
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10);

  return Response.json({ clients: clients || [] });
}
```

- [ ] **Step 3: Agent-initiated request route**

```ts
// app/api/agent/requests/route.ts
import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const body = await request.json() as { clientId?: string; requestType?: string; message?: string };
  const requestType = body.requestType?.trim().slice(0, 120);
  const message = body.message?.trim().slice(0, 4000);
  if (!body.clientId || !requestType || !message) {
    return Response.json({ error: "Client, request type, and an opening message are required" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: saved, error } = await admin
    .from("service_requests")
    .insert({
      user_id: body.clientId,
      request_type: requestType,
      details: message,
      status: "assigned",
      assigned_to: user.id,
      source: "agent",
      unread_by_agent: false,
    })
    .select("id")
    .single();
  if (error || !saved) return Response.json({ error: "Unable to create request" }, { status: 500 });

  await admin.from("service_request_messages").insert({ service_request_id: saved.id, sender_id: user.id, sender_role: "agent", message });
  await admin.from("notifications").insert({
    user_id: body.clientId,
    type: "agent_reply",
    title: "You have a new message",
    message: message.slice(0, 200),
    related_id: saved.id,
  });

  return Response.json({ request: saved }, { status: 201 });
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add app/api/agent/requests app/api/agent/clients
git commit -m "Add agent-side messaging, client search, and agent-initiated requests API"
```

---

### Task 4: Client-side thread UI in `SupportView`

**Files:**
- Modify: `app/page.tsx:427-` (`SupportView`)

- [ ] **Step 1: Fix the existing broken ticket-id display while touching this code**

The `merged-ticket-list` item currently renders the broken `1000 + request.id` expression in **three** places on the same `<article>`: the visible `<small>IS-{1000 + request.id}...</small>` label, the button's `aria-label={\`Open IS-${1000 + request.id}\`}`, and the `notify(...)` call text on click — `request.id` is a uuid string, so `1000 + request.id` is broken string concatenation (a leftover from before this codebase's ids were migrated to uuid; `ticketCode()` was fixed at other call sites earlier but these three were missed). Replace the visible label and the `aria-label` with `ticketCode(request.id)` now. The `notify(...)` call is handled by Step 2 below, which replaces the whole `onClick` (and therefore that broken text) with `openThread(request.id)` — so by the end of this task all three are gone, not just two.

- [ ] **Step 2: Make ticket rows open a real thread instead of a `notify()` placeholder**

Add local state for the selected request and its messages:

```ts
const [openRequestId, setOpenRequestId] = useState<string | null>(null);
const [threadMessages, setThreadMessages] = useState<{ id: string; senderRole: string; message: string; createdAt: string }[]>([]);
const [threadDraft, setThreadDraft] = useState("");
const [threadSending, setThreadSending] = useState(false);

const openThread = async (requestId: string) => {
  setOpenRequestId(requestId);
  const response = await fetch(`/api/service-requests/${requestId}/messages`, { cache: "no-store" });
  if (response.ok) setThreadMessages((await response.json()).messages || []);
};

const sendThreadMessage = async () => {
  const text = threadDraft.trim();
  if (!text || !openRequestId || threadSending) return;
  setThreadSending(true);
  const response = await fetch(`/api/service-requests/${openRequestId}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: text }) });
  if (response.ok) { setThreadDraft(""); openThread(openRequestId); }
  setThreadSending(false);
};
```

Change the ticket row's `onClick` from `() => notify(...)` to `() => openThread(request.id)`. Below the `merged-ticket-list` `<Panel>`, add a conditional thread panel:

```tsx
{openRequestId && <Panel className="request-thread-panel">
  <PanelHeader title={`Request IS-${ticketCode(openRequestId)}`} action="Close" onAction={() => setOpenRequestId(null)} />
  <div className="request-thread">
    {threadMessages.map((m) => (
      <div key={m.id} className={`support-bubble ${m.senderRole === "agent" ? "consultant" : "user"}`}>
        <span>{m.senderRole === "agent" ? "Agent" : "You"}</span>
        <p>{m.message}<small>{new Date(m.createdAt).toLocaleString()}</small></p>
      </div>
    ))}
    {!threadMessages.length && <p className="modal-copy">No messages yet on this request.</p>}
  </div>
  <form className="support-composer" onSubmit={(e) => { e.preventDefault(); sendThreadMessage(); }}>
    <input value={threadDraft} onChange={(e) => setThreadDraft(e.target.value)} placeholder="Reply to this request..." aria-label="Reply to this request" />
    <button type="submit" disabled={!threadDraft.trim() || threadSending} aria-label="Send reply"><Send size={17} /></button>
  </form>
</Panel>}
```

This is deliberately visually distinct from `ConciergeChat`'s bot-only chrome (no "typing" indicator, explicit "Agent"/"You" labels, no quick-reply chips) per the spec's requirement to never blur AI vs. human.

- [ ] **Step 2b: Add minimal CSS for the new wrapper classes**

`.request-thread-panel`/`.request-thread` have no existing styling (unlike the `support-bubble`/`support-composer` classes reused inside them, which are already styled). Add to `app/sections.css`:

```css
.request-thread { display: flex; flex-direction: column; gap: 10px; padding: 10px 0; max-height: 320px; overflow-y: auto; }
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Manual verify**

As a client, open Support Center, click an existing request, confirm the thread panel opens (empty if no messages yet), send a message, confirm it appears and `unread_by_agent` flips true on that request (spot-check via a query, or proceed to Task 5 and confirm from the agent side).

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "Add real per-request message thread to Support Center"
```

---

### Task 5: Agent-side reply UI + "Start a conversation"

**Files:**
- Modify: `app/staff/(shell)/page.tsx` (the relocated Agent Console from the staff-shell plan)

- [ ] **Step 1: Add a reply affordance to each queue item**

Add the same `openRequestId`/`threadMessages`/`threadDraft`/`threadSending` state and `openThread`/`sendThreadMessage` functions from Task 4, but pointed at the agent-side routes: `/api/agent/requests/${id}/messages` for both GET and POST. Add a "Reply" button on each queue `<article>` that calls `openThread(item.id)`, and render the same thread-panel pattern (agent messages labeled "You", client messages labeled with `item.clientName`) below the queue list when `openRequestId` is set. This reused pattern's composer button uses the `Send` icon — `app/staff/(shell)/page.tsx` doesn't import it yet (the staff-shell plan's Task 4 only imports `Panel, PanelHeader, ViewHeading, ticketCode` from `lucide-react`/shared, not `Send`), so add `import { Send } from "lucide-react";` to this file's imports as part of this step, or the build fails on an undefined identifier.

- [ ] **Step 2: Add "Start a conversation"**

Add state for a client-search modal-like inline panel:

```ts
const [showNewConversation, setShowNewConversation] = useState(false);
const [clientQuery, setClientQuery] = useState("");
const [clientResults, setClientResults] = useState<{ userId: string; fullName: string; email: string }[]>([]);
const [selectedClient, setSelectedClient] = useState<{ userId: string; fullName: string } | null>(null);
const [newRequestType, setNewRequestType] = useState("");
const [newMessage, setNewMessage] = useState("");

const searchClients = async (q: string) => {
  setClientQuery(q);
  if (q.trim().length < 2) { setClientResults([]); return; }
  const response = await fetch(`/api/agent/clients?query=${encodeURIComponent(q)}`);
  if (response.ok) setClientResults((await response.json()).clients || []);
};

const startConversation = async () => {
  if (!selectedClient || !newRequestType.trim() || !newMessage.trim()) return;
  const response = await fetch("/api/agent/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: selectedClient.userId, requestType: newRequestType, message: newMessage }) });
  if (response.ok) { setShowNewConversation(false); setSelectedClient(null); setNewRequestType(""); setNewMessage(""); setClientQuery(""); setClientResults([]); load(); }
};
```

Add a "Start a conversation" button near the queue's `PanelHeader` that toggles `showNewConversation`. When true, render: a text input wired to `searchClients`, a results list (`clientResults.map(...)`, each a button calling `setSelectedClient`), and once a client is selected, a request-type input + message textarea + a submit button calling `startConversation`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Manual verify**

As staff: reply to an existing client-opened request, sign in as that client and confirm the reply is visible with a real notification. Then, as staff, search for a client with no open requests, start a new conversation, sign in as that client and confirm the new request and its first message both appear in Support Center.

- [ ] **Step 5: Commit**

```bash
git add app/staff
git commit -m "Add agent reply UI and proactive conversation starter to staff shell"
```

---

## Final verification (whole plan)

- [ ] `npm run build` passes with zero errors.
- [ ] Full manual pass per the spec's Verification section.
- [ ] `git push origin main`.
