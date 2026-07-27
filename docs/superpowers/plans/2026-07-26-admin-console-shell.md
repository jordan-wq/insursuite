# Admin Console Shell v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the staff shell's top-bar-with-two-tabs with a real sidebar app: an Overview landing page, a team-wide Conversations view with live updates, and a full Client directory + detail page — matching the spec at `docs/superpowers/specs/2026-07-26-admin-console-shell-design.md`.

**Architecture:** New route tree under `app/staff/(shell)/` (Overview at `/staff`, plus `/staff/conversations`, `/staff/clients`, `/staff/clients/[id]`, `/staff/knowledge`), each a client component fetching from `isAgent`-gated API routes via the admin Supabase client, matching the existing pattern used by every other agent-facing route. The sidebar chrome reuses the client portal's existing `.app-shell`/`.sidebar`/`.main-content` CSS wholesale (see "Visual style: reuse discovery" below) rather than writing new chrome CSS. Live conversation updates use Supabase Realtime, gated by two new agent-read RLS policies.

**Tech Stack:** Next.js 16 App Router, Supabase (Auth/Postgres/Realtime), TypeScript.

**Verification convention:** No unit-test framework in this repo (`npm test` = `next build`). Every task's test step is `npm run build` plus a manual browser-preview check.

**Spec:** `docs/superpowers/specs/2026-07-26-admin-console-shell-design.md`

---

## Visual style: reuse discovery (read before Task 3)

The spec assumed there were existing `.staff-shell`/`.staff-topbar` CSS rules to extend. There aren't — `app/staff/(shell)/layout.tsx`'s `className="staff-shell"`/`"staff-topbar"`/`"staff-main"` have **zero matching CSS anywhere in the repo** (verified: `grep -rn "staff-shell\|staff-topbar\|staff-main" app/*.css` returns nothing). That's the actual reason the shell "looks very generic" today — it's rendering with no chrome styling at all, just default browser flow; the *content* inside it (`Panel`, `PanelHeader`, `.section-view`, etc.) is already fully styled via `app/sections.css`/`app/globals.css`, shared with the client portal.

Meanwhile, the client portal (`app/page.tsx`) already has a complete, polished dark sidebar — `.app-shell` (`app/globals.css:68`) > `.sidebar` (fixed 258px, navy gradient, box-shadow) > `.brand`/`.brand-mark` (logo) + `nav` (hover/active states using `--ease-out`) + `.main-content` (margin-left: 258px, offset content area), fully responsive (mobile breakpoints already collapse it into a slide-out drawer). This is a better match for the spec's own goal ("dark sidebar using --ink... no new CSS custom properties") than writing bespoke chrome CSS from scratch, and it's the "extend, don't duplicate" move per project convention.

**Task 3 below reuses `.app-shell`/`.sidebar`/`.brand`/`.brand-mark`/`.main-content`/`.topbar` verbatim** for the staff shell, with exactly one additive CSS change: today `.sidebar nav button` is styled but the staff shell needs real `<Link>` navigation (`<a>` tags, not `onClick` view-switching like the client portal), so `.sidebar nav a` needs the same rule. This is purely additive — it doesn't touch the client portal's existing `<button>`-based sidebar.

---

### Task 1: Widen agent read/write access — policies and thread messages

Two small, independent, mechanical edits to existing routes. Does the access-control change from the spec (`isAssignedToAgent` → plain `isAgent`) before anything in the UI depends on it.

**Files:**
- Modify: `app/api/agent/policies/route.ts`
- Modify: `app/api/agent/requests/[id]/messages/route.ts`

- [ ] **Step 1: Remove `isAssignedToAgent` from the policies route**

Current file (`app/api/agent/policies/route.ts`):

```ts
import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

const POLICY_SELECT = "id, policyNumber:policy_number, policyType:policy_type, carrier, packetStatus:packet_status";

async function isAssignedToAgent(clientId: string, agentId: string) {
  const admin = createAdminSupabase();
  const { data } = await admin.from("service_requests").select("id").eq("user_id", clientId).eq("assigned_to", agentId).limit(1).maybeSingle();
  return Boolean(data);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) return Response.json({ error: "clientId is required" }, { status: 400 });
  if (!(await isAssignedToAgent(clientId, user.id))) return Response.json({ error: "Client not found in your assigned queue" }, { status: 404 });

  const admin = createAdminSupabase();
  const { data: policies } = await admin.from("user_policies").select(POLICY_SELECT).eq("user_id", clientId);
  return Response.json({ policies: policies || [] });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const body = await request.json() as { id?: string; packetStatus?: string };
  if (!body.id || !["not_sent", "sent", "delivered"].includes(body.packetStatus || "")) {
    return Response.json({ error: "Valid policy id and status required" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: existing } = await admin.from("user_policies").select("userId:user_id").eq("id", body.id).maybeSingle();
  if (!existing || !(await isAssignedToAgent(existing.userId, user.id))) {
    return Response.json({ error: "Policy not found in your assigned queue" }, { status: 404 });
  }

  const { data: policy, error } = await admin
    .from("user_policies")
    .update({ packet_status: body.packetStatus })
    .eq("id", body.id)
    .select("id, userId:user_id, packetStatus:packet_status")
    .single();

  if (error || !policy) return Response.json({ error: "Policy not found" }, { status: 404 });

  if (body.packetStatus === "delivered") {
    await admin.from("notifications").insert({
      user_id: policy.userId,
      type: "packet_delivered",
      title: "Your policy packet has been delivered",
      message: "Your policy documents are on their way or have arrived — check your mailbox.",
      related_id: policy.id,
    });
  }

  return Response.json({ policy });
}
```

Replace the whole file with:

```ts
import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

const POLICY_SELECT = "id, policyNumber:policy_number, policyType:policy_type, carrier, packetStatus:packet_status";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) return Response.json({ error: "clientId is required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: policies } = await admin.from("user_policies").select(POLICY_SELECT).eq("user_id", clientId);
  return Response.json({ policies: policies || [] });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const body = await request.json() as { id?: string; packetStatus?: string };
  if (!body.id || !["not_sent", "sent", "delivered"].includes(body.packetStatus || "")) {
    return Response.json({ error: "Valid policy id and status required" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: policy, error } = await admin
    .from("user_policies")
    .update({ packet_status: body.packetStatus })
    .eq("id", body.id)
    .select("id, userId:user_id, packetStatus:packet_status")
    .single();

  if (error || !policy) return Response.json({ error: "Policy not found" }, { status: 404 });

  if (body.packetStatus === "delivered") {
    await admin.from("notifications").insert({
      user_id: policy.userId,
      type: "packet_delivered",
      title: "Your policy packet has been delivered",
      message: "Your policy documents are on their way or have arrived — check your mailbox.",
      related_id: policy.id,
    });
  }

  return Response.json({ policy });
}
```

(`isAssignedToAgent` is deleted entirely — no other file imports it, confirmed by it being a private, non-exported function only used within this file.)

- [ ] **Step 2: Remove the `assigned_to` scoping from thread messages**

Current file (`app/api/agent/requests/[id]/messages/route.ts`) has, in `GET` (around line 13):

```ts
const { data: owned } = await admin.from("service_requests").select("id").eq("id", id).eq("assigned_to", user.id).maybeSingle();
if (!owned) return Response.json({ error: "Request not found in your assigned queue" }, { status: 404 });
```

Replace with:

```ts
const { data: owned } = await admin.from("service_requests").select("id").eq("id", id).maybeSingle();
if (!owned) return Response.json({ error: "Request not found" }, { status: 404 });
```

And in `POST` (around line 30):

```ts
const { data: owned } = await admin.from("service_requests").select("id, userId:user_id").eq("id", id).eq("assigned_to", user.id).maybeSingle();
if (!owned) return Response.json({ error: "Request not found in your assigned queue" }, { status: 404 });
```

Replace with:

```ts
const { data: owned } = await admin.from("service_requests").select("id, userId:user_id").eq("id", id).maybeSingle();
if (!owned) return Response.json({ error: "Request not found" }, { status: 404 });
```

Both still require `isAgent(user.id)` (unchanged, at the top of each handler) — this only removes the *assignment* restriction, not the agent gate.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Manual verify**

As an existing staff account, open a conversation that is **not** assigned to you (if none exists, temporarily reassign one via direct SQL/Supabase dashboard for this check, or just confirm no regression on one that *is* assigned to you — full cross-agent verification happens in Task 6's manual pass once the UI exposes other agents' conversations). Confirm replying and viewing the thread still works.

- [ ] **Step 5: Commit**

```bash
git add app/api/agent/policies/route.ts app/api/agent/requests/[id]/messages/route.ts
git commit -m "Widen agent policy and thread-message access from assignment-scoped to isAgent-gated"
```

---

### Task 2: Migration — agent Realtime read policies

**Files:**
- Create: `supabase/migrations/0006_agent_realtime_read.sql`

- [ ] **Step 1: Write the migration**

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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'service_requests'
  ) then
    alter publication supabase_realtime add table public.service_requests;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'service_request_messages'
  ) then
    alter publication supabase_realtime add table public.service_request_messages;
  end if;
end $$;
```

- [ ] **Step 2: Push the migration**

Run: `npx supabase db push`
Expected: exits 0, migration `0006_agent_realtime_read` applied.

- [ ] **Step 3: Manual verify**

In the Supabase dashboard (Database → Replication), confirm `service_requests` and `service_request_messages` now appear under the `supabase_realtime` publication. In Database → Policies, confirm both new `for select` policies exist alongside the existing client-owner policies (not replacing them).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0006_agent_realtime_read.sql
git commit -m "Add agent read-only RLS policies and enable Realtime for service_requests/messages"
```

---

### Task 3: Sidebar shell layout

**Files:**
- Modify: `app/staff/(shell)/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Add the one additive CSS rule for `<a>` nav items**

In `app/globals.css`, immediately after the existing `.sidebar nav button b { ... }` rule (line 80, end of the base sidebar block), add:

```css
.sidebar nav a { width: 100%; min-height: 43px; display: flex; align-items: center; gap: 12px; padding: 0 12px; border-radius: 7px; color: #fff; text-decoration: none; font-size: 14px; transition: .18s var(--ease-out); }
.sidebar nav a:hover { background: rgba(255,255,255,.075); transform: translateX(2px); }
.sidebar nav a.active { background: linear-gradient(90deg, #1764e5, #1e55c7); box-shadow: 0 9px 22px rgba(0, 77, 209, .3); }
.sidebar nav a span { flex: 1; }
```

This mirrors `.sidebar nav button`/`:hover`/`.active`/`span` exactly (same values), just targeting `<a>` instead of `<button>` — the client portal's sidebar is unaffected since it only ever renders `<button>` nav items.

- [ ] **Step 2: Rewrite the shell layout**

Replace `app/staff/(shell)/layout.tsx` entirely:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, MessagesSquare, Users, BookOpen, UserCog, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "../../auth";
import { isAgent } from "../../service-routing";

export default async function StaffShellLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) redirect("/?notice=staff_access_denied");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><ShieldCheck size={25} /></div><div><strong>Insur<span>Suite</span></strong><small>Admin Console</small></div></div>
        <nav aria-label="Staff navigation">
          <Link href="/staff"><LayoutDashboard size={20} /><span>Overview</span></Link>
          <Link href="/staff/conversations"><MessagesSquare size={20} /><span>Conversations</span></Link>
          <Link href="/staff/clients"><Users size={20} /><span>Clients</span></Link>
          <Link href="/staff/knowledge"><BookOpen size={20} /><span>Knowledge</span></Link>
          <Link href="/staff/team"><UserCog size={20} /><span>Manage Staff</span></Link>
        </nav>
        <form action="/auth/signout" method="post"><button type="submit" className="text-button" style={{ color: "#cfe0fb", marginTop: "auto" }}>Sign out</button></form>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
```

This drops the old `.staff-topbar`/`.staff-main` markup entirely in favor of the reused `.app-shell`/`.sidebar`/`.main-content` structure from Task 3's discovery note. The `isAgent`/`redirect` gate is unchanged from today's file. Active-link highlighting (the `.active` class) is intentionally left for a later pass — Next.js needs `usePathname()` from a client component to know the current route, and none of the nav items are functionally broken without it; this is a pure polish item, not in scope for this task (note it doesn't block the goal: a working, navigable sidebar shell).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0. (This task alone doesn't yet create `/staff/conversations`, `/staff/clients`, or `/staff/knowledge` — those links will 404 until Tasks 6, 9, and 11 land. That's expected for this task; don't stub empty pages just to silence a 404, later tasks create the real ones.)

- [ ] **Step 4: Manual verify**

Sign in as staff, confirm `/staff` (still showing today's old Queue content — untouched until Task 6) now renders inside the dark sidebar shell with the InsurSuite brand mark, Overview/Conversations/Clients/Knowledge/Manage Staff links, and a working sign-out button. Confirm `/staff/team` still works and now also shows the sidebar.

- [ ] **Step 5: Commit**

```bash
git add app/staff/\(shell\)/layout.tsx app/globals.css
git commit -m "Replace staff top-bar with the reused app-shell/sidebar chrome"
```

---

### Task 4: Overview page

**Files:**
- Create: `app/api/agent/overview/route.ts`

Note: `app/staff/(shell)/page.tsx` (the `/staff` route) is still today's Queue content until Task 6 replaces it with the Overview UI. This task only adds the API the Overview page will call — it deliberately does not touch `page.tsx` yet, since `/staff/conversations` (the Overview page's main link target) doesn't exist until Task 6 either. Building the API first and wiring it into the UI in the same task that creates Conversations avoids a broken intermediate state.

- [ ] **Step 1: Write the Overview API route**

```ts
// app/api/agent/overview/route.ts
import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const admin = createAdminSupabase();
  const [open, urgent, unassigned, pendingPackets] = await Promise.all([
    admin.from("service_requests").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    admin.from("service_requests").select("id", { count: "exact", head: true }).neq("status", "resolved").or("priority.eq.urgent,unread_by_agent.eq.true"),
    admin.from("service_requests").select("id", { count: "exact", head: true }).neq("status", "resolved").is("assigned_to", null),
    admin.from("user_policies").select("id", { count: "exact", head: true }).neq("packet_status", "delivered"),
  ]);

  return Response.json({
    openConversations: open.count || 0,
    urgentUnread: urgent.count || 0,
    unassigned: unassigned.count || 0,
    packetsPending: pendingPackets.count || 0,
  });
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Manual verify**

`curl` (or visit in-browser while signed in as staff) `http://localhost:3000/api/agent/overview` — the exact port depends on what's already running locally; check the running dev server's printed port first — confirm a JSON object with the four numeric fields comes back, roughly matching what's actually in the database (e.g. compare `unassigned` against a manual count of unassigned, non-resolved rows in the Supabase dashboard).

- [ ] **Step 4: Commit**

```bash
git add app/api/agent/overview/route.ts
git commit -m "Add agent overview stats API"
```

---

### Task 5: Conversations API (team-wide, replaces queue route)

**Files:**
- Create: `app/api/agent/conversations/route.ts`
- Delete: `app/api/agent/queue/route.ts`

- [ ] **Step 1: Write the new route**

```ts
// app/api/agent/conversations/route.ts
import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgentEditableRequestStatus } from "../../../service-request-model";
import { isAgent } from "../../../service-routing";

const REQUEST_SELECT = "id, userId:user_id, requestType:request_type, details, requestData:request_data, status, assignedTo:assigned_to, source, priority, unreadByAgent:unread_by_agent, createdAt:created_at, updatedAt:updated_at";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const admin = createAdminSupabase();
  const [{ data: requests }, { data: notifications }] = await Promise.all([
    admin.from("service_requests").select(REQUEST_SELECT).order("created_at", { ascending: false }),
    admin.from("agent_notifications").select("id, agentId:agent_id, clientId:client_id, serviceRequestId:service_request_id, title, message, read, createdAt:created_at").eq("agent_id", user.id).order("created_at", { ascending: false }).limit(30),
  ]);

  const clientIds = [...new Set((requests || []).map((item) => item.userId))];
  const assignedAgentIds = [...new Set((requests || []).map((item) => item.assignedTo).filter((id): id is string => Boolean(id)))];

  const [{ data: clients }, { data: assignedAgentProfiles }] = await Promise.all([
    clientIds.length
      ? admin.from("client_profiles").select("userId:user_id, fullName:full_name").in("user_id", clientIds)
      : Promise.resolve({ data: [] as { userId: string; fullName: string }[] }),
    assignedAgentIds.length
      ? admin.from("client_profiles").select("userId:user_id, email").in("user_id", assignedAgentIds)
      : Promise.resolve({ data: [] as { userId: string; email: string }[] }),
  ]);

  return Response.json({
    requests: (requests || []).map((item) => ({
      ...item,
      clientName: clients?.find((client) => client.userId === item.userId)?.fullName || item.userId,
      assignedToEmail: item.assignedTo ? (assignedAgentProfiles?.find((p) => p.userId === item.assignedTo)?.email || "(no profile)") : null,
    })),
    notifications: notifications || [],
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const body = await request.json() as { id?: string; status?: string; assignedTo?: string | null };
  if (!body.id) return Response.json({ error: "Request id required" }, { status: 400 });

  const update: Record<string, unknown> = { unread_by_agent: false, updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    if (!isAgentEditableRequestStatus(body.status)) return Response.json({ error: "Invalid status" }, { status: 400 });
    update.status = body.status;
  }
  if (body.assignedTo !== undefined) {
    update.assigned_to = body.assignedTo;
  }
  if (body.status === undefined && body.assignedTo === undefined) return Response.json({ error: "status or assignedTo required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: saved, error } = await admin
    .from("service_requests")
    .update(update)
    .eq("id", body.id)
    .select(REQUEST_SELECT)
    .single();

  if (error || !saved) return Response.json({ error: "Request not found" }, { status: 404 });
  return Response.json({ request: saved });
}
```

(`assignedToEmail` reuses the same `client_profiles.email` fallback pattern as `/api/staff/team` — an agent identity is looked up by joining `client_profiles` on their user id, falling back to `"(no profile)"` if the agent has no client-side profile row. `PATCH`'s `unread_by_agent: false` on every update matches today's behavior of clearing the unread flag whenever a request is touched.)

- [ ] **Step 2: Delete the old queue route**

```bash
rm app/api/agent/queue/route.ts
rmdir app/api/agent/queue 2>/dev/null || true
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0. (The old Queue *page* still calls `/api/agent/queue` at this point and will start failing — that's fixed in Task 6, which replaces the page in the same PR-equivalent unit of work. If your workflow requires green-at-every-commit, do Task 5 and Task 6 as one combined commit instead of two — see the note at the top of Task 6.)

- [ ] **Step 4: Commit**

Hold this commit — combine with Task 6's commit so the repo is never left with a page calling a deleted route. Proceed directly to Task 6.

---

### Task 6: Conversations page (moved, rescoped, realtime)

This task must be committed together with Task 5 (not built/committed separately) — Task 5 deletes `/api/agent/queue`, and this task is what stops anything from calling it.

**Files:**
- Create: `app/staff/(shell)/conversations/page.tsx`
- Modify: `app/staff/(shell)/page.tsx` (becomes Overview)
- Delete: (none — `page.tsx` is rewritten, not deleted, since `/staff` still needs to resolve to something)

- [ ] **Step 1: Write the Conversations page**

```tsx
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";
import { Panel, PanelHeader, ViewHeading, ticketCode } from "../../../components/shared";
import { createClientSupabase } from "../../../lib/supabase/client";

type ServiceRequest = { id: string; requestType: string; details: string; status: string; createdAt: string; assignedTo?: string; source?: string; requestDataJson?: string; priority?: string };
type QueueItem = ServiceRequest & { clientName: string; userId: string; unreadByAgent: boolean; requestData?: Record<string, string | boolean>; assignedToEmail: string | null };
type ClientPolicy = { id: string; policyNumber: string; carrier: string; packetStatus: string };
type StaffMember = { userId: string; email: string };

export default function ConversationsPage() {
  // useSearchParams() requires a Suspense boundary in the App Router (same pattern already used by app/login/page.tsx)
  return <Suspense fallback={<div className="section-view"><p className="modal-copy">Loading...</p></div>}><ConversationsView /></Suspense>;
}

function ConversationsView() {
  const filter = useSearchParams().get("filter"); // "urgent" | "unassigned" | null, set by Overview tile links
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [clientPolicies, setClientPolicies] = useState<Record<string, ClientPolicy[]>>({});
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<{ id: string; senderRole: string; message: string; createdAt: string }[]>([]);
  const [threadDraft, setThreadDraft] = useState("");
  const [threadSending, setThreadSending] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<{ userId: string; fullName: string; email: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState<{ userId: string; fullName: string } | null>(null);
  const [newRequestType, setNewRequestType] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const load = async () => {
    const response = await fetch("/api/agent/conversations", { cache: "no-store" });
    if (response.ok) setQueue((await response.json()).requests || []);
  };
  useEffect(() => {
    load();
    fetch("/api/staff/team", { cache: "no-store" }).then((r) => r.json()).then((d) => setStaff(d.staff || []));
  }, []);

  // openRequestId changes after this effect's single run (user opens a thread later), so the
  // postgres_changes callback below reads it through a ref, not the closed-over state variable —
  // otherwise it would always see the initial `null` and never refresh an open thread.
  const openRequestIdRef = useRef<string | null>(null);
  useEffect(() => { openRequestIdRef.current = openRequestId; }, [openRequestId]);

  useEffect(() => {
    const supabase = createClientSupabase();
    const channel = supabase
      .channel("staff-conversations")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_requests" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "service_request_messages" }, () => {
        load();
        if (openRequestIdRef.current) openThread(openRequestIdRef.current);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = async (id: string, status: string) => { await fetch("/api/agent/conversations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) }); load(); };
  const reassign = async (id: string, assignedTo: string | null) => { await fetch("/api/agent/conversations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, assignedTo }) }); load(); };

  const toggleClient = async (clientId: string) => {
    if (expandedClient === clientId) { setExpandedClient(null); return; }
    setExpandedClient(clientId);
    setPolicyError(null);
    if (!clientPolicies[clientId]) {
      const response = await fetch(`/api/agent/policies?clientId=${clientId}`);
      if (response.ok) { const result = await response.json(); setClientPolicies((current) => ({ ...current, [clientId]: result.policies })); }
      else setPolicyError("Could not load policies for this client.");
    }
  };
  const updatePacketStatus = async (policyId: string, clientId: string, packetStatus: string) => {
    const response = await fetch("/api/agent/policies", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: policyId, packetStatus }) });
    if (response.ok) {
      setClientPolicies((current) => ({ ...current, [clientId]: current[clientId].map((p) => p.id === policyId ? { ...p, packetStatus } : p) }));
    } else {
      setPolicyError("Could not update packet status — please try again.");
    }
  };
  const openThread = async (requestId: string) => {
    setOpenRequestId(requestId);
    const response = await fetch(`/api/agent/requests/${requestId}/messages`, { cache: "no-store" });
    if (response.ok) setThreadMessages((await response.json()).messages || []);
  };
  const sendThreadMessage = async () => {
    const text = threadDraft.trim();
    if (!text || !openRequestId || threadSending) return;
    setThreadSending(true);
    const response = await fetch(`/api/agent/requests/${openRequestId}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: text }) });
    if (response.ok) { setThreadDraft(""); openThread(openRequestId); load(); }
    setThreadSending(false);
  };
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
  const activeThreadItem = queue.find((item) => item.id === openRequestId);
  const visibleQueue = filter === "urgent" ? queue.filter((item) => item.priority === "urgent" || item.unreadByAgent)
    : filter === "unassigned" ? queue.filter((item) => !item.assignedTo)
    : queue;

  return <div className="section-view"><ViewHeading eyebrow="Customer service operations" title="Conversations" description="Every client conversation across the team. Claim, reassign, or reply." /><div className="agent-console-grid"><Panel><PanelHeader title={`Open conversations (${queue.filter((item) => item.status !== "resolved").length})${filter ? ` — filtered: ${filter}` : ""}`} action={showNewConversation ? "Close" : "Start a conversation"} onAction={() => setShowNewConversation((current) => !current)} />{showNewConversation && <div className="new-conversation-panel"><input value={clientQuery} onChange={(e) => searchClients(e.target.value)} placeholder="Search clients by name or email..." aria-label="Search clients" />{!selectedClient && clientResults.length > 0 && <div className="client-search-results">{clientResults.map((client) => <button type="button" key={client.userId} onClick={() => { setSelectedClient({ userId: client.userId, fullName: client.fullName }); setClientResults([]); setClientQuery(client.fullName); }}><strong>{client.fullName}</strong><small>{client.email}</small></button>)}</div>}{selectedClient && <form className="knowledge-form" onSubmit={(e) => { e.preventDefault(); startConversation(); }}><span>Starting a conversation with <strong>{selectedClient.fullName}</strong> · <button type="button" className="text-button" onClick={() => setSelectedClient(null)}>Change</button></span><label>Request type<input value={newRequestType} onChange={(e) => setNewRequestType(e.target.value)} placeholder="e.g. Policy update" /></label><label>Opening message<textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Write the first message to the client..." /></label><button className="primary-button" type="submit" disabled={!newRequestType.trim() || !newMessage.trim()}>Start conversation</button></form>}</div>}{policyError && <p className="form-error">{policyError}</p>}<div className="agent-queue">{visibleQueue.map((item) => <article key={item.id} className={item.unreadByAgent ? "unread" : ""}><div><button type="button" className="text-button agent-client-name" onClick={() => toggleClient(item.userId)}><strong>{item.clientName}</strong></button><span>{item.requestType} · IS-{ticketCode(item.id)}{item.priority === "urgent" ? " · URGENT" : ""} · {item.assignedToEmail ? `Assigned to ${item.assignedToEmail}` : "Unassigned"}</span><p>{item.details}</p>{item.requestData && <dl className="agent-intake-details">{Object.entries(item.requestData).filter(([, value]) => value && value !== "on").map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, " $1")}</dt><dd>{String(value)}</dd></div>)}</dl>}<small>{item.source === "chatbot" ? "Escalated by chatbot" : "Submitted by client form"}</small>{expandedClient === item.userId && <div className="agent-client-policies"><strong>Policies</strong>{clientPolicies[item.userId]?.length ? clientPolicies[item.userId].map((policy) => <div key={policy.id}><span>{policy.carrier || "Carrier needs review"} · #{policy.policyNumber}</span><select value={policy.packetStatus} onChange={(e) => updatePacketStatus(policy.id, item.userId, e.target.value)}><option value="not_sent">Not Sent</option><option value="sent">Sent</option><option value="delivered">Delivered</option></select></div>) : <p>No saved policies for this client yet.</p>}</div>}</div><div className="agent-queue-actions"><select value={item.assignedTo || ""} onChange={(e) => reassign(item.id, e.target.value || null)} aria-label="Reassign conversation"><option value="">Unassigned</option>{staff.map((member) => <option key={member.userId} value={member.userId}>{member.email}</option>)}</select><button type="button" className="secondary-button" onClick={() => openThread(item.id)}>Reply</button><select value={item.status} onChange={(e) => update(item.id, e.target.value)}><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="waiting_on_client">Waiting on client</option><option value="resolved">Resolved</option></select></div></article>)}{!visibleQueue.length && <div className="empty-state"><CheckCircle2 size={28} /><strong>No conversations</strong><p>{filter ? "Nothing matches this filter right now." : "New tickets will appear here."}</p></div>}</div></Panel>{openRequestId && <Panel className="request-thread-panel"><PanelHeader title={`Request IS-${ticketCode(openRequestId)}`} action="Close" onAction={() => setOpenRequestId(null)} /><div className="request-thread">{threadMessages.map((m) => <div key={m.id} className={`support-bubble ${m.senderRole === "agent" ? "consultant" : "user"}`}><span>{m.senderRole === "agent" ? "You" : activeThreadItem?.clientName || "Client"}</span><p>{m.message}<small>{new Date(m.createdAt).toLocaleString()}</small></p></div>)}{!threadMessages.length && <p className="modal-copy">No messages yet on this request.</p>}</div><form className="support-composer" onSubmit={(e) => { e.preventDefault(); sendThreadMessage(); }}><input value={threadDraft} onChange={(e) => setThreadDraft(e.target.value)} placeholder="Reply to this request..." aria-label="Reply to this request" /><button type="submit" disabled={!threadDraft.trim() || threadSending} aria-label="Send reply"><Send size={17} /></button></form></Panel>}</div></div>;
}
```

Notable deltas from the old Queue page (besides the route rename and dropped `assigned_to` filter that the API already handles):
- `updatePacketStatus` now checks `response.ok` before applying the optimistic update (the bug flagged in spec review) and surfaces `policyError` inline on failure instead of silently showing a stale/wrong value.
- Each row shows an "Assigned to" reassign `<select>` (sourced from `/api/staff/team`, `""` = unassigned) next to the existing status `<select>`.
- The header count now reads "Open conversations" instead of "My assigned queue" and the empty state copy no longer implies personal ownership.
- The "Train the chatbot" panel is **removed** — it moves to its own page in Task 11, not duplicated here.
- Reads an optional `?filter=urgent` or `?filter=unassigned` query param (set by the Overview tile links in this task's Step 2) and client-side-filters the displayed list accordingly — no new API parameter, since the full list is already fetched. `useSearchParams()` requires wrapping the page in `<Suspense>`, matching the existing pattern in `app/login/page.tsx`.
- A Realtime subscription refetches the list on any `service_requests` change, and refetches the open thread too on `service_request_messages` changes (reading the currently-open thread id through a ref, since the effect only runs once on mount — see the comment in the code above). No error handling around `.subscribe()` — if the channel never connects, the page still works via the initial `load()` call and any post-action `load()` calls, just without live updates, per the spec's explicit fallback requirement.

- [ ] **Step 2: Rewrite `app/staff/(shell)/page.tsx` as Overview**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, AlertTriangle, UserX, PackageX } from "lucide-react";
import { Panel, PanelHeader, ViewHeading } from "../../components/shared";

type Stats = { openConversations: number; urgentUnread: number; unassigned: number; packetsPending: number };

export default function StaffOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { fetch("/api/agent/overview", { cache: "no-store" }).then((r) => r.json()).then(setStats); }, []);

  const tiles: { label: string; value: number | string; icon: typeof Inbox; href: string }[] = [
    { label: "Open conversations", value: stats?.openConversations ?? "—", icon: Inbox, href: "/staff/conversations" },
    { label: "Urgent / unread", value: stats?.urgentUnread ?? "—", icon: AlertTriangle, href: "/staff/conversations?filter=urgent" },
    { label: "Unassigned", value: stats?.unassigned ?? "—", icon: UserX, href: "/staff/conversations?filter=unassigned" },
    { label: "Packets pending delivery", value: stats?.packetsPending ?? "—", icon: PackageX, href: "/staff/clients" },
  ];

  return <div className="section-view"><ViewHeading eyebrow="Admin console" title="Overview" description="What needs attention across the team right now." /><div className="agent-console-grid">{tiles.map((tile) => <Link key={tile.label} href={tile.href} className="stat-card" style={{ textDecoration: "none", color: "inherit" }}><div><span className="eyebrow-row"><tile.icon size={16} />{tile.label}</span><strong className="stat-value">{tile.value}</strong></div></Link>)}</div><Panel style={{ marginTop: 16 }}><PanelHeader title="Quick links" /><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Link href="/staff/conversations" className="secondary-button">View all conversations</Link><Link href="/staff/clients" className="secondary-button">Browse clients</Link></div></Panel></div>;
}
```

(`.stat-card` is the same class already used elsewhere for dashboard tiles, per the "reuse, don't duplicate" note — no new tile CSS needed. `.agent-console-grid` is reused for the tile row layout; it's a generic 2-column grid, not conversations-specific despite the name.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Manual verify**

Visit `/staff` — confirm Overview tiles load real counts and each links correctly, including that "Urgent / unread" and "Unassigned" land on `/staff/conversations` pre-filtered to the matching subset (and "filtered: ..." shows in the panel title). Visit `/staff/conversations` directly (no filter) — confirm every conversation shows (not just ones assigned to you), confirm claiming an unassigned one via the reassign dropdown works, confirm replying works, confirm the packet-status dropdown still updates correctly for a client whether or not they're "yours." Open a second browser (or incognito) signed in as a second staff account, claim/reassign a conversation in one, confirm the other's Conversations list updates within a few seconds without a manual refresh (Realtime). Then block WebSocket connections in devtools (Network conditions → offline, or block the `realtime` websocket domain) and confirm the page still loads and functions via plain fetch.

- [ ] **Step 5: Commit (combines Task 5 and Task 6)**

```bash
git add app/api/agent/conversations app/api/agent/queue app/staff/\(shell\)/page.tsx app/staff/\(shell\)/conversations
git commit -m "Add team-wide Conversations page with claim/reassign and Realtime; Overview replaces old Queue homepage"
```

---

### Task 7: Clients directory API (list mode)

**Files:**
- Modify: `app/api/agent/clients/route.ts`

- [ ] **Step 1: Add list mode**

Current file:

```ts
import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  // Strip characters that are syntactically meaningful in a PostgREST
  // .or() filter string (",", "(", ")") so a search term can't break out
  // of the intended two-column filter into an arbitrary one.
  const query = (new URL(request.url).searchParams.get("query") || "").trim().replace(/[,()]/g, "");
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

Replace with:

```ts
import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

const LIST_SELECT = "userId:user_id, fullName:full_name, email, onboardingStatus:onboarding_status, createdAt:created_at";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const url = new URL(request.url);
  const admin = createAdminSupabase();

  if (!url.searchParams.has("query")) {
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 25));
    const from = (page - 1) * pageSize;
    const { data: clients, count } = await admin
      .from("client_profiles")
      .select(LIST_SELECT, { count: "exact" })
      .order("full_name", { ascending: true })
      .range(from, from + pageSize - 1);
    return Response.json({ clients: clients || [], total: count || 0 });
  }

  // Strip characters that are syntactically meaningful in a PostgREST
  // .or() filter string (",", "(", ")") so a search term can't break out
  // of the intended two-column filter into an arbitrary one.
  const query = (url.searchParams.get("query") || "").trim().replace(/[,()]/g, "");
  if (query.length < 2) return Response.json({ clients: [] });

  const { data: clients } = await admin
    .from("client_profiles")
    .select("userId:user_id, fullName:full_name, email")
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10);

  return Response.json({ clients: clients || [] });
}
```

(`url.searchParams.has("query")` distinguishes "no query param at all" from `query=""`, per the spec's explicit callout — the existing "start a conversation" search box always sends a non-empty `query`, so it only ever hits the second branch, unchanged behavior.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Manual verify**

`curl 'http://localhost:PORT/api/agent/clients'` (no query string) while signed in as staff via browser session — or just visit it directly in a browser tab where you're already signed in as staff — confirm `{ clients: [...], total: N }` comes back with up to 25 clients sorted by name. Confirm the existing typeahead in "Start a conversation" (Task 6's Conversations page) still works unchanged.

- [ ] **Step 4: Commit**

```bash
git add app/api/agent/clients/route.ts
git commit -m "Add paginated list mode to the agent clients API"
```

---

### Task 8: Client detail API + document agent access

**Files:**
- Create: `app/api/agent/clients/[id]/route.ts`
- Modify: `app/api/documents/[id]/route.ts`

- [ ] **Step 1: Write the client detail route**

```ts
// app/api/agent/clients/[id]/route.ts
import { createAdminSupabase } from "../../../../lib/supabase/admin";
import { getCurrentUser } from "../../../../auth";
import { isAgent } from "../../../../service-routing";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POLICY_SELECT = "id, policyNumber:policy_number, policyType:policy_type, carrier, packetStatus:packet_status";
const REQUEST_SELECT = "id, requestType:request_type, details, status, assignedTo:assigned_to, source, priority, createdAt:created_at, updatedAt:updated_at";
const DOCUMENT_SELECT = "id, fileName:file_name, contentType:content_type, fileSize:file_size, processingStatus:processing_status, createdAt:created_at";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return Response.json({ error: "Valid client id required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id, fullName:full_name, email, phone, dateOfBirth:date_of_birth, onboardingStatus:onboarding_status, onboardingStep:onboarding_step, profile, createdAt:created_at, updatedAt:updated_at")
    .eq("user_id", id)
    .maybeSingle();
  if (!profile) return Response.json({ error: "Client not found" }, { status: 404 });

  const [{ data: policies }, { data: requests }, { data: documents }] = await Promise.all([
    admin.from("user_policies").select(POLICY_SELECT).eq("user_id", id),
    admin.from("service_requests").select(REQUEST_SELECT).eq("user_id", id).order("created_at", { ascending: false }),
    admin.from("documents").select(DOCUMENT_SELECT).eq("user_id", id).order("created_at", { ascending: false }),
  ]);

  return Response.json({ profile, policies: policies || [], requests: requests || [], documents: documents || [] });
}
```

- [ ] **Step 2: Add the agent branch to the documents download route**

Current file (`app/api/documents/[id]/route.ts`):

```ts
import { createServerSupabase } from "../../../lib/supabase/server";
import { getCurrentUser } from "../../../auth";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const params = await context.params;
  if (!UUID_PATTERN.test(params.id)) return Response.json({ error: "Valid document id required" }, { status: 400 });
  const download = new URL(request.url).searchParams.get("download") === "1";

  const supabase = await createServerSupabase();
  const { data: document } = await supabase
    .from("documents")
    .select("id, storageKey:storage_key, fileName:file_name, contentType:content_type, fileSize:file_size")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!document) return Response.json({ error: "Document not found" }, { status: 404 });

  const { data: blob, error } = await supabase.storage.from("documents").download(document.storageKey);
  if (error || !blob) return Response.json({ error: "Stored file not found" }, { status: 404 });

  const safeFileName = document.fileName.replace(/[\x00-\x1f\x7f"]/g, "");
  const disposition = `${download ? "attachment" : "inline"}; filename="${safeFileName}"`;
  return new Response(blob, {
    headers: {
      "content-type": document.contentType || "application/octet-stream",
      "content-length": String(document.fileSize),
      "content-disposition": disposition,
      "cache-control": "private, max-age=60",
    },
  });
}
```

Replace with:

```ts
import { createServerSupabase } from "../../../lib/supabase/server";
import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOCUMENT_SELECT = "id, storageKey:storage_key, fileName:file_name, contentType:content_type, fileSize:file_size";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const params = await context.params;
  if (!UUID_PATTERN.test(params.id)) return Response.json({ error: "Valid document id required" }, { status: 400 });
  const download = new URL(request.url).searchParams.get("download") === "1";

  const supabase = await createServerSupabase();
  let document = (
    await supabase.from("documents").select(DOCUMENT_SELECT).eq("id", params.id).eq("user_id", user.id).maybeSingle()
  ).data;
  let storage = supabase.storage;

  if (!document && (await isAgent(user.id))) {
    const admin = createAdminSupabase();
    document = (await admin.from("documents").select(DOCUMENT_SELECT).eq("id", params.id).maybeSingle()).data;
    storage = admin.storage;
  }
  if (!document) return Response.json({ error: "Document not found" }, { status: 404 });

  const { data: blob, error } = await storage.from("documents").download(document.storageKey);
  if (error || !blob) return Response.json({ error: "Stored file not found" }, { status: 404 });

  const safeFileName = document.fileName.replace(/[\x00-\x1f\x7f"]/g, "");
  const disposition = `${download ? "attachment" : "inline"}; filename="${safeFileName}"`;
  return new Response(blob, {
    headers: {
      "content-type": document.contentType || "application/octet-stream",
      "content-length": String(document.fileSize),
      "content-disposition": disposition,
      "cache-control": "private, max-age=60",
    },
  });
}
```

(Tries the owner path first with the cheap session-scoped client; only calls `isAgent` — an extra round-trip — and falls back to the admin client if the owner lookup misses. This keeps the common case, a client downloading their own document, exactly as fast as today. The filename-sanitization/content-disposition logic is untouched, as the spec requires.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Manual verify**

As staff, `curl`/browser-visit `/api/agent/clients/<a real client's user id>` — confirm profile/policies/requests/documents all come back. As staff, download a client's document via `/api/documents/<id>?download=1` for a client that isn't yours — confirm it downloads with the correct filename and content type. As that client themself, confirm they can still download their own document normally (owner path unaffected).

- [ ] **Step 5: Commit**

```bash
git add app/api/agent/clients/\[id\] app/api/documents/\[id\]/route.ts
git commit -m "Add agent client-detail API and agent read access to client documents"
```

---

### Task 9: Clients directory page

**Files:**
- Create: `app/staff/(shell)/clients/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel, PanelHeader, ViewHeading } from "../../../components/shared";

type ClientRow = { userId: string; fullName: string; email: string; onboardingStatus: string; createdAt: string };

export default function ClientsDirectoryPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    fetch(`/api/agent/clients?page=${page}&pageSize=${pageSize}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setClients(d.clients || []); setTotal(d.total || 0); });
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return <div className="section-view"><ViewHeading eyebrow="Client directory" title="Clients" description={`${total} client${total === 1 ? "" : "s"}.`} /><Panel><PanelHeader title="All clients" /><div className="beneficiary-list">{clients.map((client) => <Link key={client.userId} href={`/staff/clients/${client.userId}`} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 10, padding: 11, border: "1px solid var(--line)", borderRadius: 9, textDecoration: "none", color: "inherit" }}><span><strong style={{ display: "block" }}>{client.fullName || "(no name on file)"}</strong><small style={{ display: "block", marginTop: 3, color: "var(--muted)" }}>{client.email}</small></span><small style={{ textTransform: "capitalize" }}>{client.onboardingStatus.replace("_", " ")}</small><small>Joined {new Date(client.createdAt).toLocaleDateString()}</small></Link>)}{!clients.length && <p className="modal-copy">No clients yet.</p>}</div>{totalPages > 1 && <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}><button className="secondary-button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span style={{ alignSelf: "center", fontSize: 12, color: "var(--muted)" }}>Page {page} of {totalPages}</span><button className="secondary-button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button></div>}</Panel></div>;
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Manual verify**

Visit `/staff/clients`, confirm the roster loads sorted by name, confirm pagination controls work if there are more than 25 clients (fine if there aren't — just confirm no pagination UI shows when everything fits on one page), confirm clicking a row navigates toward `/staff/clients/[id]` (404 is expected until Task 11 lands — don't treat that as a failure of this task).

- [ ] **Step 4: Commit**

```bash
git add app/staff/\(shell\)/clients/page.tsx
git commit -m "Add client directory page"
```

---

### Task 10: Client detail page

**Files:**
- Create: `app/staff/(shell)/clients/[id]/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Panel, PanelHeader, ViewHeading } from "../../../../components/shared";

type ClientDetail = {
  profile: { fullName: string; email: string; phone: string; onboardingStatus: string; profile: Record<string, unknown> } | null;
  policies: { id: string; policyNumber: string; carrier: string; packetStatus: string }[];
  requests: { id: string; requestType: string; details: string; status: string; createdAt: string }[];
  documents: { id: string; fileName: string; contentType: string; fileSize: number; createdAt: string }[];
};

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ClientDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/agent/clients/${params.id}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [params.id]);

  if (error) return <div className="section-view"><div className="empty-state"><strong>Client not found</strong></div></div>;
  if (!data || !data.profile) return <div className="section-view"><p className="modal-copy">Loading...</p></div>;

  const { profile, policies, requests, documents } = data;

  return <div className="section-view">
    <ViewHeading eyebrow="Client record" title={profile.fullName || "(no name on file)"} description={profile.email} />
    <div className="agent-console-grid">
      <Panel><PanelHeader title="Profile" /><div className="detail-grid"><div><small>Phone</small><strong>{profile.phone || "Not provided"}</strong></div><div><small>Onboarding</small><strong style={{ textTransform: "capitalize" }}>{profile.onboardingStatus.replace("_", " ")}</strong></div></div></Panel>
      <Panel><PanelHeader title={`Policies (${policies.length})`} /><div className="beneficiary-list">{policies.map((policy) => <div key={policy.id}><span><strong>{policy.carrier || "Carrier needs review"}</strong><small>#{policy.policyNumber}</small></span><small style={{ textTransform: "capitalize" }}>{policy.packetStatus.replace("_", " ")}</small></div>)}{!policies.length && <p className="modal-copy">No policies on file.</p>}</div></Panel>
      <Panel><PanelHeader title={`Conversation history (${requests.length})`} /><div className="beneficiary-list">{requests.map((r) => <div key={r.id}><span><strong>{r.requestType}</strong><small>{r.details}</small></span><small style={{ textTransform: "capitalize" }}>{r.status.replace("_", " ")}</small></div>)}{!requests.length && <p className="modal-copy">No conversations yet.</p>}</div></Panel>
      <Panel><PanelHeader title={`Documents (${documents.length})`} /><div className="beneficiary-list">{documents.map((doc) => <div key={doc.id}><span><strong>{doc.fileName}</strong><small>{Math.round(doc.fileSize / 1024)} KB</small></span><a className="text-button" href={`/api/documents/${doc.id}?download=1`}>Download</a></div>)}{!documents.length && <p className="modal-copy">No documents uploaded.</p>}</div></Panel>
    </div>
  </div>;
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Manual verify**

From the Clients directory (Task 9), click into a client who is **not** assigned to any of your conversations. Confirm their profile, policies, conversation history, and documents all load (this is the direct confirmation of the `isAssignedToAgent` → `isAgent` access-control change from Task 1). Click "Download" on a document and confirm it downloads correctly.

- [ ] **Step 4: Commit**

```bash
git add app/staff/\(shell\)/clients/\[id\]/page.tsx
git commit -m "Add client detail page"
```

---

### Task 11: Knowledge page (chatbot trainer, extracted)

**Files:**
- Create: `app/staff/(shell)/knowledge/page.tsx`

- [ ] **Step 1: Write the page**

This is the "Train the chatbot" panel from the old Queue page, unchanged in behavior, now standalone (it no longer shares state/load calls with conversations data):

```tsx
"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Panel, PanelHeader, ViewHeading } from "../../../components/shared";

type KnowledgeItem = { id: string; question: string };

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeItem[]>([]);
  const [notice, setNotice] = useState("");

  const load = () => fetch("/api/knowledge", { cache: "no-store" }).then((r) => r.json()).then((d) => setEntries(d.entries || []));
  useEffect(() => { load(); }, []);

  const addKnowledge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/knowledge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: form.get("question"), keywords: form.get("keywords"), answer: form.get("answer") }) });
    setNotice(response.ok ? "Training answer published." : "Could not publish answer.");
    if (response.ok) { event.currentTarget.reset(); load(); }
  };

  return <div className="section-view"><ViewHeading eyebrow="Chatbot training" title="Knowledge" description="Answers the client-facing chatbot is allowed to use." /><Panel><PanelHeader title="Train the chatbot" /><form className="knowledge-form" onSubmit={addKnowledge}><label>Customer question<input name="question" required placeholder="How do I change a beneficiary?" /></label><label>Keywords<input name="keywords" placeholder="beneficiary, change, update" /></label><label>Approved answer<textarea name="answer" required placeholder="Write the exact safe answer the bot should use..." /></label><button className="primary-button">Publish answer</button>{notice && <small>{notice}</small>}</form><div className="knowledge-list"><strong>{entries.length} approved answers</strong>{entries.map((entry) => <p key={entry.id}>{entry.question}</p>)}</div></Panel></div>;
}
```

(One intentional behavior change from the original: shows all entries, not just `.slice(0,5)` — the old 5-item cap existed because this panel shared cramped grid space with the queue; it has its own full page now, so there's no reason to truncate. If the list gets long enough to want pagination, that's a future concern, not blocking here.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Manual verify**

Visit `/staff/knowledge`, confirm existing trained answers list, publish a new one, confirm it appears and the client-facing chatbot picks it up (spot check via the client portal's chat if convenient, not required for this task).

- [ ] **Step 4: Commit**

```bash
git add app/staff/\(shell\)/knowledge/page.tsx
git commit -m "Add standalone Knowledge page for chatbot training"
```

---

## Final verification (whole plan)

- [ ] `npm run build` passes with zero errors.
- [ ] Full manual pass per the spec's Verification section (`docs/superpowers/specs/2026-07-26-admin-console-shell-design.md`):
  - Overview shows correct counts; Conversations shows every conversation team-wide; claim/reassign works; a second staff account sees changes live without refresh.
  - A client not assigned to you loads fully from the directory (profile/policies/documents/requests).
  - Document download works from the client detail page.
  - Conversations page still functions (via plain fetch) with Realtime blocked.
- [ ] Update `docs/superpowers/ACTIVE.md`: move the `admin-console-shell` row to `phase: executed` or remove it once merged to `main`, per the session-coordination convention.
- [ ] Merge `feature/admin-console-shell` to `main` (or open a PR, per user preference) and remove the worktree (`git worktree remove .worktrees/admin-console-shell`).
