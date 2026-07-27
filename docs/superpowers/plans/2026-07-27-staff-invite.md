# Staff Invite-by-Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an agent invite someone who hasn't signed up yet from Manage Staff — Supabase sends a branded set-password email, and the invitee gets `agent_roles` access automatically the moment they complete signup.

**Architecture:** One new table (`staff_invites`, RLS-enabled/zero-policy, same lockdown pattern as `agent_roles`), a fallback path in the existing `POST /api/staff/team` grant flow that calls `admin.auth.admin.inviteUserByEmail` when no `client_profiles` row exists, a new `DELETE /api/staff/invites/[id]` cancel endpoint, an `agent_roles` grant hooked into `app/auth/callback/route.ts` on successful code exchange, and a "Pending invites" panel added to the existing Manage Staff page.

**Tech Stack:** Next.js App Router API routes, Supabase (Postgres + Auth admin API), existing `createAdminSupabase()` service-role client — no new dependencies.

**No test framework:** per `AGENTS.md`/`CLAUDE.md`, this repo has no unit-test framework — `npm run build` (type-check + static generation) is the only automated verification step. Each task below runs `npm run build` instead of a test suite, plus a manual verification note. Don't add a test framework as part of this work.

---

### Task 1: `staff_invites` migration

**Files:**
- Create: `supabase/migrations/0008_staff_invites.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Pending staff invites for people who don't have an account yet. Same
-- lockdown pattern as agent_roles/agent_notifications in 0001_init.sql:
-- RLS enabled, zero client-facing policies. This table is only ever
-- touched through the server-only service-role admin client, gated by
-- an app-level isAgent() check (see app/auth/callback/route.ts for the
-- one narrow exception, documented there).

create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index staff_invites_pending_email_idx
  on public.staff_invites (lower(email)) where status = 'pending';

alter table public.staff_invites enable row level security;
-- No client-facing policies, intentionally -- same pattern as agent_roles/
-- agent_notifications above. This table is only ever touched through the
-- server-only admin client, gated by an app-level isAgent() check.
```

- [ ] **Step 2: Push the migration**

Run: `npx supabase db push`
Expected: migration `0008_staff_invites` applies with no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_staff_invites.sql
git commit -m "Add staff_invites table for invite-by-email"
```

---

### Task 2: `POST /api/staff/team` — fall back to invite when no account exists

**Files:**
- Modify: `app/api/staff/team/route.ts`

- [ ] **Step 1: Replace the `POST` handler**

Current handler 404s when `client_profiles` has no matching row. Replace the whole `POST` export with:

```ts
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const body = await request.json() as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) return Response.json({ error: "Email is required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("client_profiles").select("userId:user_id").eq("email", email).maybeSingle();

  if (profile) {
    const { error } = await admin.from("agent_roles").insert({ user_id: profile.userId });
    if (error) {
      if (error.code === "23505") return Response.json({ error: "That person already has staff access" }, { status: 409 });
      return Response.json({ error: "Unable to grant access" }, { status: 500 });
    }
    return Response.json({ ok: true }, { status: 201 });
  }

  const origin = new URL(request.url).origin;
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?return_to=/staff`,
  });
  if (inviteError) {
    return Response.json({ error: "An invite may already be pending for this email in Supabase — check the Supabase dashboard" }, { status: 500 });
  }

  const { error: insertError } = await admin.from("staff_invites").insert({ email, invited_by: user.id });
  if (insertError) return Response.json({ error: "Invite sent but could not be recorded — check the Supabase dashboard" }, { status: 500 });

  return Response.json({ invited: true }, { status: 201 });
}
```

`GET` stays untouched in this task (Task 3 handles it).

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: builds clean — `admin.auth.admin.inviteUserByEmail` is available on the `@supabase/supabase-js` client with no new import.

- [ ] **Step 3: Commit**

```bash
git add app/api/staff/team/route.ts
git commit -m "Fall back to Supabase invite when granting staff access to a new email"
```

---

### Task 3: `GET /api/staff/team` — include pending invites

**Files:**
- Modify: `app/api/staff/team/route.ts`

- [ ] **Step 1: Replace the `GET` handler**

```ts
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: roles } = await admin.from("agent_roles").select("userId:user_id, createdAt:created_at").order("created_at", { ascending: true });
  const { data: invites } = await admin.from("staff_invites").select("id, email, createdAt:created_at").eq("status", "pending").order("created_at", { ascending: true });
  const pendingInvites = invites || [];

  if (!roles?.length) return Response.json({ staff: [], pendingInvites });

  const { data: profiles } = await admin.from("client_profiles").select("userId:user_id, email").in("user_id", roles.map((r) => r.userId));
  const staff = roles.map((role) => ({ userId: role.userId, createdAt: role.createdAt, email: profiles?.find((p) => p.userId === role.userId)?.email || "(no profile)" }));
  return Response.json({ staff, pendingInvites });
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/staff/team/route.ts
git commit -m "Return pending staff invites from GET /api/staff/team"
```

---

### Task 4: `DELETE /api/staff/invites/[id]` — cancel a pending invite

**Files:**
- Create: `app/api/staff/invites/[id]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { createAdminSupabase } from "../../../../lib/supabase/admin";
import { getCurrentUser } from "../../../../auth";
import { isAgent } from "../../../../service-routing";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const { id } = await context.params;
  const admin = createAdminSupabase();
  await admin.from("staff_invites").update({ status: "cancelled" }).eq("id", id).eq("status", "pending");
  return Response.json({ ok: true });
}
```

Soft cancel only (matches spec) — the underlying Supabase Auth user from `inviteUserByEmail` is left alone; a stale invite link simply won't match a pending row in Task 5's callback logic.

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: builds clean. Confirm the route path resolves as `/api/staff/invites/[id]` (mirrors the existing `/api/staff/team/[userId]` pattern one directory over).

- [ ] **Step 3: Commit**

```bash
git add app/api/staff/invites/[id]/route.ts
git commit -m "Add endpoint to cancel a pending staff invite"
```

---

### Task 5: Grant `agent_roles` on invite acceptance

**Files:**
- Modify: `app/auth/callback/route.ts`

- [ ] **Step 1: Replace the file**

```ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "../../lib/supabase/server";
import { createAdminSupabase } from "../../lib/supabase/admin";
import { hasSupabaseConfig } from "../../lib/supabase/config";

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://insursuite.local");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export async function GET(request: Request) {
  if (!hasSupabaseConfig()) return NextResponse.redirect(new URL("/login", request.url));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnTo = safeReturnTo(url.searchParams.get("return_to"));

  if (code) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    const email = data.user?.email || data.session?.user.email;

    if (!error && email) {
      const admin = createAdminSupabase();
      const { data: invite } = await admin.from("staff_invites").select("id").eq("status", "pending").eq("email", email.toLowerCase()).maybeSingle();
      if (invite && data.user) {
        await admin.from("agent_roles").insert({ user_id: data.user.id });
        await admin.from("staff_invites").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", invite.id);
      }
    }
  }

  return NextResponse.redirect(new URL(returnTo, request.url));
}
```

`createAdminSupabase()` is used here — a deliberate, narrow exception to the "admin client only after an explicit `isAgent()` check" rule (see spec section 5 for why: the whole point of this path is granting access to someone who isn't an agent yet, so an `isAgent()` gate would be circular). Safety instead comes from requiring a genuine, just-completed code exchange plus a matching pending invite row.

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "Grant agent_roles on staff invite acceptance"
```

---

### Task 6: Manage Staff UI — invite confirmation + pending invites panel

**Files:**
- Modify: `app/staff/(shell)/team/page.tsx`

- [ ] **Step 1: Replace the file**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Panel, PanelHeader, ViewHeading } from "../../../components/shared";

type StaffMember = { userId: string; email: string; createdAt: string };
type PendingInvite = { id: string; email: string; createdAt: string };

export default function ManageStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  const load = () => fetch("/api/staff/team", { cache: "no-store" }).then((r) => r.json()).then((d) => { setStaff(d.staff || []); setPendingInvites(d.pendingInvites || []); });
  useEffect(() => { load(); fetch("/api/client-profile").then((r) => r.json()).then((d) => setCurrentUserId(d.user?.id || "")); }, []);

  const grant = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/staff/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Could not grant access");
    else {
      if (result.invited) setNotice(`Invite sent to ${email}`);
      setEmail("");
      load();
    }
    setSaving(false);
  };

  const revoke = async (userId: string) => {
    if (!window.confirm("Revoke staff access for this person?")) return;
    await fetch(`/api/staff/team/${userId}`, { method: "DELETE" });
    load();
  };

  const cancelInvite = async (id: string) => {
    await fetch(`/api/staff/invites/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="section-view">
      <ViewHeading eyebrow="Staff access" title="Manage Staff" description="Grant or revoke agent-console access, or invite someone new." />
      <Panel>
        <PanelHeader title="Grant access" />
        <form className="modal-form" onSubmit={grant}>
          <label>Email address<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="person@example.com" /></label>
          {error && <p className="form-error">{error}</p>}
          {notice && <p className="form-notice">{notice}</p>}
          <button className="primary-button" disabled={saving}>{saving ? "Saving..." : "Grant staff access"}</button>
        </form>
      </Panel>
      <Panel>
        <PanelHeader title={`Current staff (${staff.length})`} />
        <div className="beneficiary-list">
          {staff.map((member) => (
            <div key={member.userId}>
              <span><strong>{member.email}</strong><small>Added {new Date(member.createdAt).toLocaleDateString()}</small></span>
              <button disabled={member.userId === currentUserId} onClick={() => revoke(member.userId)}>{member.userId === currentUserId ? "You" : "Revoke"}</button>
            </div>
          ))}
        </div>
      </Panel>
      {pendingInvites.length > 0 && (
        <Panel>
          <PanelHeader title={`Pending invites (${pendingInvites.length})`} />
          <div className="beneficiary-list">
            {pendingInvites.map((invite) => (
              <div key={invite.id}>
                <span><strong>{invite.email}</strong><small>Invited {new Date(invite.createdAt).toLocaleDateString()}</small></span>
                <button onClick={() => cancelInvite(invite.id)}>Cancel</button>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
```

`form-notice` is a new class. Note: `app/globals.css` already defines `.form-error`/`.form-success` at line 470-471, but both are scoped as `.auth-card .form-error, .auth-card .form-success` — the Manage Staff page is not inside `.auth-card` (it's `.section-view` / `.modal-form`), so those rules don't reach it. `.form-error` on this page today already renders unstyled (pre-existing, unrelated to this plan — don't fix it as part of this task). Don't copy the `.auth-card`-scoped pattern for the new class, or "Invite sent" will be invisible too.

- [ ] **Step 2: Add the `form-notice` CSS rule**

In `app/globals.css`, add a rule scoped to reach `.modal-form` outside `.auth-card` — e.g. right after the `.modal-form` rule at line 214:

```css
.modal-form .form-notice { margin:4px 0 12px; padding:10px 12px; border-radius:12px; font-size:12.5px; line-height:1.45; color:#12673d; background:#eaf8ef; }
```

(Same visual treatment as `.auth-card .form-success`, just scoped so it actually applies on the Manage Staff page.)

- [ ] **Step 3: Build and manually verify**

Run: `npm run build`
Expected: builds clean.

Manual (needs a real Supabase env):
- Invite a brand-new email from Manage Staff → confirm "Invite sent to {email}" shows, a new row appears under "Pending invites", and the invite email arrives.
- Click the invite link, set a password → confirm landing on `/staff` with access already granted, and the row is gone from "Pending invites".
- Invite another email, click "Cancel" before acceptance → confirm it disappears from pending, and confirm the (now-stale) invite link does NOT grant access if clicked afterward.
- Grant access to an email that already has a client account → confirm it still grants instantly with no invite/email involved (unchanged code path).

- [ ] **Step 4: Commit**

```bash
git add app/staff/"(shell)"/team/page.tsx app/globals.css
git commit -m "Add pending invites panel and invite confirmation to Manage Staff"
```

---

## Notes for the implementer

- All six tasks together satisfy the spec's three manual verification scenarios (Task 6, Step 3) — there's no automated coverage for the Auth email round-trip since it depends on a real Supabase project.
- `admin.auth.admin.inviteUserByEmail`'s exact re-invite behavior (clean resend vs. error) for an email that already has a stale unconfirmed Auth user is unverified — if it errors during manual testing, the surfaced message already points at the Supabase dashboard as the fallback, per spec section 2's caveat. No code change needed unless testing reveals Supabase's actual behavior differs from that assumption.
- This repo has no admin/staff role tiering — inviting someone here grants the same full staff/agent access as everyone else (flat trust model, unchanged by this work, matches the spec's explicit out-of-scope note).
