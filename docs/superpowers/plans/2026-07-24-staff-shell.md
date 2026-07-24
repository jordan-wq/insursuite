# Staff Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give staff a separate `/staff` app shell with its own login page, move the existing embedded Agent Console out of the client portal into it, and add a Manage Staff screen for granting/revoking `agent_roles` access.

**Architecture:** New Next.js route tree under `app/staff/` (route-group split so the login page stays chrome-free), a new shared-components module so both shells can use the same UI primitives, and a `middleware.ts` extension that redirects staff-area traffic to `/staff/login` instead of the client `/login`. No new Supabase Auth mechanism — same session, same `agent_roles` gate already in place.

**Tech Stack:** Next.js 16 App Router, Supabase Auth/Postgres, TypeScript.

**Verification convention:** No unit-test framework in this repo (`npm test` = `next build`). Every task's test step is `npm run build` plus a manual browser-preview check.

**Spec:** `docs/superpowers/specs/2026-07-24-staff-shell-design.md`

---

### Task 1: Extract shared UI primitives

**Files:**
- Create: `app/components/shared.tsx`
- Modify: `app/page.tsx:252-` (`Panel`), `:256-` (`PanelHeader`), `:101-` (`ticketCode`), `:377-` (`ViewHeading`)

- [ ] **Step 1: Move the four primitives verbatim into the new file**

Cut `Panel` (line 252), `PanelHeader` (line 256), `ticketCode` (line 101), and `ViewHeading` (line 377) out of `app/page.tsx` and into `app/components/shared.tsx`, each with `export` added. `Panel`/`PanelHeader`/`ViewHeading` need `"use client"` at the top of the new file (they use no hooks themselves today, but are rendered from client components — add it to be safe and match `app/page.tsx`'s own top-of-file directive). Bring along whatever imports they need (check each function body — `Panel`/`PanelHeader` are presentational only; `ViewHeading` takes a `React.ReactNode` action prop, needs `import type { ReactNode } from "react"` or reuse the existing `React` import style already used in `app/page.tsx`).

- [ ] **Step 2: Re-import them in `app/page.tsx`**

At the top of `app/page.tsx`, add:
```ts
import { Panel, PanelHeader, ticketCode, ViewHeading } from "./components/shared";
```
Remove the four now-duplicated local definitions from `app/page.tsx` (the ones just cut in Step 1 — don't leave both a local and imported copy).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0. Every existing call site of `Panel`/`PanelHeader`/`ticketCode`/`ViewHeading` in `app/page.tsx` should resolve via the new import with no signature changes, so this should be a mechanical move with no behavior change.

- [ ] **Step 4: Manual verify**

Load the client dashboard in the browser preview, confirm it renders identically to before (panels, headers, ticket codes on service requests all still show correctly) — this task must be a pure refactor with zero visible change.

- [ ] **Step 5: Commit**

```bash
git add app/components/shared.tsx app/page.tsx
git commit -m "Extract Panel, PanelHeader, ViewHeading, ticketCode into a shared module"
```

---

### Task 2: Middleware — staff routing branch

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Add `/staff/login` to `isPublicPath`**

```ts
function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/staff/login" ||
    pathname.startsWith("/auth/") ||
    pathname === "/signin-with-chatgpt" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/file.svg") ||
    pathname.startsWith("/globe.svg") ||
    pathname.startsWith("/window.svg")
  );
}
```

- [ ] **Step 2: Add a helper for picking the right login target**

Add near the top of `middleware.ts`:

```ts
function loginPathFor(pathname: string) {
  return pathname.startsWith("/staff") ? "/staff/login" : "/login";
}
```

- [ ] **Step 3: Use it in both existing unauthenticated-redirect spots**

There are **two** places today that hardcode `loginUrl.pathname = "/login"` for an unauthenticated user — the `catch` block (line 66-69, when the Supabase call itself throws) and the main check (line 72-79). Both must redirect `/staff/*` traffic to `/staff/login`, not `/login`, or the whole point of a separate staff login breaks. Change both:

```ts
// in the catch block (was: loginUrl.pathname = "/login";)
loginUrl.pathname = loginPathFor(pathname);
```
```ts
// in the main unauthenticated check (was: loginUrl.pathname = "/login";)
loginUrl.pathname = loginPathFor(pathname);
```

- [ ] **Step 4: Add the authenticated-at-`/staff/login` redirect + staff-gate check**

After the existing `if (user && pathname === "/login") { ... }` block, add:

```ts
if (user && pathname === "/staff/login") {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/staff";
  redirectUrl.search = "";
  const redirect = NextResponse.redirect(redirectUrl);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

if (user && pathname.startsWith("/staff") && pathname !== "/staff/login") {
  const { isAgent } = await import("./app/service-routing");
  const allowed = await isAgent(user.id);
  if (!allowed) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "?notice=staff_access_denied";
    const redirect = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
}
```

(Dynamic `import("./app/service-routing")` here, not a static top-level import — `service-routing.ts` pulls in `createAdminSupabase`, and keeping it dynamic avoids loading the admin-client module into the middleware bundle for every request path that never touches `/staff`.)

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 6: Manual verify**

In the browser preview: visit `/staff` while signed out → land on `/staff/login`, not `/login`. Visit `/staff` while signed in as a non-agent client → redirected to `/?notice=staff_access_denied`. (The toast for that notice isn't wired yet — Task 5 does that — for now just confirm the redirect and query param land correctly.)

- [ ] **Step 7: Commit**

```bash
git add middleware.ts
git commit -m "Route /staff traffic to a separate staff login and gate on agent_roles"
```

---

### Task 3: Staff login page

**Files:**
- Create: `app/staff/login/page.tsx`

- [ ] **Step 1: Write the page**

Base this closely on `app/login/page.tsx`'s structure (same `createClientSupabase()` sign-in call, same form shape) but sign-in only — no "Create account" tab, since staff accounts are granted via Manage Staff (Task 7), not self-service signup. Staff-specific copy/branding ("InsurSuite Staff", a distinct kicker like "Staff access only"). On success, redirect to `/staff` (not `/`, and no `return_to` handling needed since there's exactly one destination).

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClientSupabase } from "../../lib/supabase/client";

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const supabase = createClientSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (signInError) throw signInError;
      router.replace("/staff");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="marketing-page login-page staff-login-page">
      <section className="marketing-hero login-hero">
        <div className="hero-copy">
          <span className="market-kicker"><LockKeyhole size={15} />Staff access only</span>
          <h1>InsurSuite Staff</h1>
          <p>Sign in to your agent console.</p>
        </div>
        <div className="auth-panel-wrap">
          <form className="auth-card" onSubmit={submit}>
            <span className="form-icon"><ShieldCheck size={23} /></span>
            <h2>Staff sign in</h2>
            <label>Email address<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required /></label>
            <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button full" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Manual verify**

Visit `/staff/login` directly, confirm it renders with staff branding and no client-portal sidebar/nav.

- [ ] **Step 4: Commit**

```bash
git add app/staff/login/page.tsx
git commit -m "Add dedicated staff login page"
```

---

### Task 4: Staff shell layout + relocated Agent Console

**Files:**
- Create: `app/staff/(shell)/layout.tsx`
- Create: `app/staff/(shell)/page.tsx`
- Modify: `app/page.tsx:511-` (remove `AgentConsole` — its content moves out in this task)

- [ ] **Step 1: Write the shell layout**

A minimal top bar (staff branding + sign-out), no client-portal sidebar:

```tsx
// app/staff/(shell)/layout.tsx
import Link from "next/link";
import { ShieldCheck, Users } from "lucide-react";

export default function StaffShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="staff-shell">
      <header className="staff-topbar">
        <Link href="/staff" className="gate-brand"><ShieldCheck size={22} /><strong>InsurSuite <span>Staff</span></strong></Link>
        <nav>
          <Link href="/staff">Queue</Link>
          <Link href="/staff/team"><Users size={16} />Manage Staff</Link>
        </nav>
        <form action="/auth/signout" method="post"><button type="submit" className="text-button">Sign out</button></form>
      </header>
      <main className="staff-main">{children}</main>
    </div>
  );
}
```

(`/auth/signout` already exists as a real route (`app/auth/signout/route.ts`) handling POST — reused as-is, no change needed there.)

- [ ] **Step 2: Move `AgentConsole`'s content into `app/staff/(shell)/page.tsx`**

Copy the current `AgentConsole` function body (`app/page.tsx:511`) into a new default-exported page component, importing `Panel`/`PanelHeader` from `../../components/shared` (relative path from `app/staff/(shell)/page.tsx`) instead of from `app/page.tsx`. Add `"use client"` at the top (the original relies on `useState`/`useEffect`). No changes to its internal logic — same `/api/agent/queue` and `/api/knowledge` calls, same JSX.

- [ ] **Step 3: Remove `AgentConsole` from `app/page.tsx`**

Delete the `AgentConsole` function definition (line 511) from `app/page.tsx` entirely — it has no more callers once Task 5 removes the `SectionContent` branch that renders it (do this deletion together with Task 5, not before, so the file isn't left in a broken intermediate state with a dangling reference — see Task 5 Step 1).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: exits 0 (after Task 5's `SectionContent` cleanup removes the last reference — if building this task in isolation before Task 5, the removed `AgentConsole` will still be referenced at `app/page.tsx:560` and fail; do Tasks 4 and 5 in the same working session before committing either, or keep `AgentConsole` in place until Task 5 removes both the function and its call site together).

- [ ] **Step 5: Manual verify**

Sign in as an existing staff account at `/staff/login`, confirm `/staff` shows the same queue + knowledge-base trainer content the old embedded tab used to show, and `/staff/team` link is visible in the nav (page itself built in Task 7).

- [ ] **Step 6: Commit** (combined with Task 5's changes — see that task's commit step)

---

### Task 5: Remove the embedded Agent Console tab from the client shell

**Files:**
- Modify: `app/page.tsx` — `NavKey` type (line 65), `navItems` array (line 118), `SectionContent` branch (line 560), `agentAccess` state + its setter call (lines 744, 808), nav-filter line (934)

- [ ] **Step 1: Remove `"Agent Console"` from `NavKey`**

Delete the `| "Agent Console"` line from the `NavKey` union type (line 65).

- [ ] **Step 2: Remove the nav entry**

Delete `{ label: "Agent Console", icon: Headphones },` from `navItems` (line 118).

- [ ] **Step 3: Remove the `SectionContent` branch**

Delete `if (active === "Agent Console") return <AgentConsole />;` (line 560). This is the point where `AgentConsole`'s deletion from `app/page.tsx` (Task 4, Step 3) becomes safe — do this step in the same pass.

- [ ] **Step 4: Remove `agentAccess` state and its setter**

Delete `const [agentAccess, setAgentAccess] = useState(false);` (line 744) and `setAgentAccess(Boolean(result.isAgent));` (line 808) — the `client-profile` API response's `isAgent` field is no longer consumed anywhere in the client shell (staff status is now only relevant on the `/staff` side, where middleware already checks it directly). Leave the API response field itself alone — removing it from the API is out of scope and other things may still reasonably return it.

- [ ] **Step 5: Simplify the nav-render filter**

Change `{navItems.filter((item) => item.label !== "Agent Console" || agentAccess).map(...)}` (line 934) to `{navItems.map(...)}` — the filter existed solely to conditionally show the now-removed Agent Console entry.

- [ ] **Step 6: Wire the `staff_access_denied` notice toast**

Add a `useEffect` in `HomePage` (near where `toast`/`notify` are defined) that reads the notice once on mount:

```ts
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("notice") === "staff_access_denied") {
    notify("Your account doesn't have staff access.");
    const url = new URL(window.location.href);
    url.searchParams.delete("notice");
    window.history.replaceState({}, "", url.toString());
  }
}, []);
```

(Place this after `notify` is defined, since it's referenced inside — check `notify`'s definition location and add this effect after it, not before, to avoid a use-before-declaration issue with `const`.)

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: exits 0, no unused-variable issues from the removed `agentAccess`/`AgentConsole`.

- [ ] **Step 8: Manual verify**

Client dashboard sidebar no longer shows "Agent Console" for any account (staff or not). Visit `/staff` as a non-agent client (triggers Task 2's redirect) and confirm the toast "Your account doesn't have staff access." appears once, then the `?notice=` param is gone from the URL on refresh.

- [ ] **Step 9: Commit** (Tasks 4 + 5 together, since Task 4 leaves the file in a temporarily-broken state until this task's Step 3)

```bash
git add app/page.tsx app/staff
git commit -m "Move Agent Console to the staff shell, remove it from the client portal"
```

---

### Task 6: Manage Staff API

**Files:**
- Create: `app/api/staff/team/route.ts`
- Create: `app/api/staff/team/[userId]/route.ts`

- [ ] **Step 1: List + grant route**

```ts
// app/api/staff/team/route.ts
import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: roles } = await admin.from("agent_roles").select("userId:user_id, createdAt:created_at").order("created_at", { ascending: true });
  if (!roles?.length) return Response.json({ staff: [] });

  const { data: profiles } = await admin.from("client_profiles").select("userId:user_id, email").in("user_id", roles.map((r) => r.userId));
  const staff = roles.map((role) => ({ userId: role.userId, createdAt: role.createdAt, email: profiles?.find((p) => p.userId === role.userId)?.email || "(no profile)" }));
  return Response.json({ staff });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const body = await request.json() as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) return Response.json({ error: "Email is required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("client_profiles").select("userId:user_id").eq("email", email).maybeSingle();
  if (!profile) return Response.json({ error: "No account found for that email — they need to sign up first" }, { status: 404 });

  const { error } = await admin.from("agent_roles").insert({ user_id: profile.userId });
  if (error) {
    if (error.code === "23505") return Response.json({ error: "That person already has staff access" }, { status: 409 });
    return Response.json({ error: "Unable to grant access" }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 201 });
}
```

- [ ] **Step 2: Revoke route**

```ts
// app/api/staff/team/[userId]/route.ts
import { createAdminSupabase } from "../../../../lib/supabase/admin";
import { getCurrentUser } from "../../../../auth";
import { isAgent } from "../../../../service-routing";

export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const { userId } = await context.params;
  if (userId === user.id) return Response.json({ error: "You cannot revoke your own access" }, { status: 400 });

  const admin = createAdminSupabase();
  await admin.from("agent_roles").delete().eq("user_id", userId);
  return Response.json({ ok: true });
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add app/api/staff/team
git commit -m "Add Manage Staff API: list, grant, revoke agent_roles"
```

---

### Task 7: Manage Staff page

**Files:**
- Create: `app/staff/(shell)/team/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Panel, PanelHeader, ViewHeading } from "../../../components/shared";

type StaffMember = { userId: string; email: string; createdAt: string };

export default function ManageStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  const load = () => fetch("/api/staff/team", { cache: "no-store" }).then((r) => r.json()).then((d) => setStaff(d.staff || []));
  useEffect(() => { load(); fetch("/api/client-profile").then((r) => r.json()).then((d) => setCurrentUserId(d.user?.id || "")); }, []);

  const grant = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/staff/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Could not grant access");
    else { setEmail(""); load(); }
    setSaving(false);
  };

  const revoke = async (userId: string) => {
    if (!window.confirm("Revoke staff access for this person?")) return;
    await fetch(`/api/staff/team/${userId}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="section-view">
      <ViewHeading eyebrow="Staff access" title="Manage Staff" description="Grant or revoke agent-console access for existing accounts." />
      <Panel>
        <PanelHeader title="Grant access" />
        <form className="modal-form" onSubmit={grant}>
          <label>Email address<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="person@example.com" /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={saving}>{saving ? "Granting..." : "Grant staff access"}</button>
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
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Manual verify**

As staff, visit `/staff/team`, grant access to a second test account's email, confirm it appears in the list and that account can then reach `/staff`. Revoke it, confirm they're bounced back out. Confirm the "Revoke" button is disabled on your own row.

- [ ] **Step 4: Commit**

```bash
git add app/staff/\(shell\)/team/page.tsx
git commit -m "Add Manage Staff page"
```

---

## Final verification (whole plan)

- [ ] `npm run build` passes with zero errors.
- [ ] Full manual pass per the spec's Verification section.
- [ ] `git push origin main`.
