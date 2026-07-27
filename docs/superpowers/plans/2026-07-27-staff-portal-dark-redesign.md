# Staff Portal Dark Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the entire `/staff` admin shell to the approved dark elevated-dashboard design, isolated from the shared light-theme chrome the concurrent client-portal redesign also depends on.

**Architecture:** Add a `.staff-shell` class alongside the existing `.app-shell` class on the staff layout's root element. Two techniques do the actual reskinning, layered in this order: (1) redefine the shared design-token custom properties (`--color-text`, `--muted`, `--panel-bg`, etc.) inside `.staff-shell` — most components already read colors through these tokens, so this alone repaints panels, borders, and most text without touching a single component selector; (2) targeted `.staff-shell <selector>` overrides for the remaining classes that hardcode colors instead of using tokens (confirmed by grep against the actual CSS — `.eyebrow-row`, `.stat-value`, `.panel-header h2`, `.sidebar`, `.support-bubble`, form labels/inputs, and the entire `app/onboarding.css` family, which uses no tokens at all). No existing unscoped rule is edited — every new rule's selector starts with `.staff-shell`.

**Tech Stack:** Next.js 16 App Router, plain CSS (`app/globals.css`, `app/sections.css`, `app/onboarding.css`) — no CSS-in-JS, no test framework. `npm run build` is the only automated verification available.

**Spec:** `docs/superpowers/specs/2026-07-27-staff-portal-dark-redesign-design.md`

**Before starting:** confirm `docs/superpowers/ACTIVE.md` still shows `staff-portal-dark-redesign` as the active phase for this work, and that no other session has since started touching `app/globals.css`, `app/sections.css`, `app/onboarding.css`, or `app/staff/(shell)/**` (the concurrent client-portal redesign is the main risk — check its ledger row before each task, not just once).

**Execution location:** per this repo's convention (`CLAUDE.md` → Workflow), do this in an isolated worktree: `.worktrees/staff-portal-dark-redesign` on branch `feature/staff-portal-dark-redesign` (use the `superpowers:using-git-worktrees` skill to create it before Task 1). Update `docs/superpowers/ACTIVE.md`'s row for this topic with the worktree/branch once created.

---

### Task 1: Root wrapper class + sidebar nav grouping

**Files:**
- Modify: `app/staff/(shell)/layout.tsx`

- [ ] **Step 1: Add the `.staff-shell` class and split the nav into Workspace/System groups**

Replace the full file with:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, MessagesSquare, Users, BookOpen, UserCog, ShieldCheck, UserPlus } from "lucide-react";
import { getCurrentUser } from "../../auth";
import { isAgent } from "../../service-routing";

export default async function StaffShellLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) redirect("/?notice=staff_access_denied");

  return (
    <div className="app-shell staff-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><ShieldCheck size={25} /></div><div><strong>Insur<span>Suite</span></strong><small>Admin Console</small></div></div>
        <nav aria-label="Staff navigation">
          <div className="staff-nav-group-label">Workspace</div>
          <Link href="/staff"><LayoutDashboard size={20} /><span>Overview</span></Link>
          <Link href="/staff/conversations"><MessagesSquare size={20} /><span>Conversations</span></Link>
          <Link href="/staff/clients"><Users size={20} /><span>Clients</span></Link>
          <Link href="/staff/onboarding"><UserPlus size={20} /><span>Onboarding</span></Link>
          <div className="staff-nav-group-label">System</div>
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

The only changes: `className="app-shell"` → `className="app-shell staff-shell"`, and the two new `<div className="staff-nav-group-label">` labels splitting the six links into Workspace (Overview/Conversations/Clients/Onboarding) and System (Knowledge/Manage Staff). Nothing else moves. Note there is no active-link highlighting in this layout today (no `usePathname` check, no `active` class applied to any `<Link>`) — this task doesn't add one; it's out of scope for a reskin.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds with no type errors (this is a markup-only change, `.staff-shell` and `.staff-nav-group-label` aren't styled yet — the page will build fine and look unchanged except for the two new unstyled label divs, which is expected until Task 3).

- [ ] **Step 3: Commit**

```bash
git add "app/staff/(shell)/layout.tsx"
git commit -m "Add .staff-shell scoping class and Workspace/System nav grouping"
```

---

### Task 2: Dark design-token layer

This is the highest-leverage task: redefining these custom properties inside `.staff-shell` repaints every component that already reads colors through them — confirmed by grep to include `.panel`/`.stat-card` (background, border, shadow — both driven entirely by `--panel-bg`/`--panel-border`/`--panel-shadow`), `.view-heading` (color via `--color-text`/`--color-text-soft`), `.detail-grid` (border/muted text via `--line`/`--muted`), `.empty-state` (text via `--color-text-muted`), `.beneficiary-list`, `.knowledge-list`, and others — without writing a single one of those selectors by hand.

**Files:**
- Modify: `app/globals.css` (append new section at end of file)

- [ ] **Step 1: Append the token-override block**

Add to the end of `app/globals.css`:

```css

/* ==========================================================================
   Staff portal dark redesign — everything below is scoped under .staff-shell.
   No rule above this line is modified. See docs/superpowers/specs/2026-07-27-staff-portal-dark-redesign-design.md.
   ========================================================================== */

.staff-shell {
  background: #0b1220;
  color: #f2f5fa;

  --color-page: #0b1220;
  --color-text: #f2f5fa;
  --color-text-soft: #b7c1d9;
  --color-text-muted: #8894b3;
  --color-border: #232f4d;
  --color-border-soft: #1c2740;
  --color-surface: #141d33;
  --color-surface-strong: #1a2440;
  --color-surface-muted: #0d1526;

  --ink: #f2f5fa;
  --muted: #8894b3;
  --line: #232f4d;
  --soft: #141d33;

  --panel-bg: #141d33;
  --panel-border: 1px solid #232f4d;
  --panel-shadow: none;
}
```

`background`/`color` set directly on `.staff-shell` (the same element `.app-shell` is on, per Task 1) beat the existing `.app-shell` background rule on specificity-tie/source-order, and establish the dark text color as the inherited default for every descendant that doesn't set its own `color` (e.g. `.detail-grid strong`, which today has no explicit color and would otherwise silently keep inheriting the light theme's navy from `body`).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Manual check**

Run `npm run dev`, sign in with a staff/agent account, visit `/staff`. Confirm: the overall page background is now dark and panels/stat-cards have repainted to a dark surface with a visible border — even though nothing else has been styled yet, this one block should already make the page substantially dark. Expect it to still look rough (sidebar still light-navy from its own hardcoded background, several text elements still dark-on-dark) — that's expected; later tasks fix those.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "Add dark design-token overrides scoped to .staff-shell"
```

---

### Task 3: Sidebar, brand, and nav-group styling

The sidebar's background is set directly (not through a token) both in the base rule (`app/globals.css:69`) and the design-system-layer override (`app/globals.css:281-285`), so it needs its own scoped override. Same for brand text and nav link colors.

**Files:**
- Modify: `app/globals.css` (append to the block started in Task 2)

- [ ] **Step 1: Add sidebar/nav CSS**

Append:

```css
.staff-shell .sidebar {
  background: #0d1526;
  border-right: 1px solid #1c2740;
  box-shadow: none;
}
.staff-shell .brand strong { color: #f2f5fa; }
.staff-shell .brand strong span { color: #5b8fef; }
.staff-shell .brand small { color: #5b6c8c; }
.staff-shell .staff-nav-group-label {
  padding: 0 10px;
  margin: 14px 0 6px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: #465170;
}
.staff-shell .sidebar nav > .staff-nav-group-label:first-child { margin-top: 0; }
.staff-shell .sidebar nav a { color: #8894b3; }
.staff-shell .sidebar nav a:hover { background: rgba(255,255,255,.05); transform: none; }
.staff-shell .sidebar nav a.active { background: #1a2b52; color: #f2f5fa; box-shadow: none; }
```

The sign-out button's inline `style={{ color: "#cfe0fb" }}` (set in `layout.tsx`, unchanged by this plan) already reads as a light blue-white against the new `#0d1526` sidebar background, so it needs no override.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Manual check**

Refresh `/staff` in the browser. Confirm: sidebar is now a dark navy-black (`#0d1526`) instead of the old bright navy gradient, brand text is legible, the "Workspace" and "System" group labels are visible in small uppercase muted text, and nav links are legible muted text that lightens on hover.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "Style staff sidebar, brand, and nav groups for dark theme"
```

---

### Task 4: Panel headers, stat tiles, and eyebrow text

`.panel-header h2` hardcodes navy text in two separate cascade layers (base + design-system-layer override); `.eyebrow-row` and `.stat-value` each hardcode navy in a single rule. `.text-button` hardcodes a blue (`#235bb6`) that computes to roughly 2.6:1 contrast against the new dark panel surface — under WCAG AA's 3:1 floor for UI text — and is rendered widely (client names in the Conversations queue, "Save"/"Download" links elsewhere). None of these route through a design token, so Task 2's variable redefinitions don't reach them. `.stat-card::before` is an unscoped pseudo-element that paints a light gradient bar on every stat card. `.panel`/`.stat-card` border-color also needs a direct fix here (see below) since a later hardcoded rule beats the Task 2 token override for that property specifically.

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add panel/stat-tile CSS**

Append:

```css
.staff-shell .panel,
.staff-shell .stat-card { border-color: #232f4d; }
.staff-shell .panel-header h2 { color: #f2f5fa; }
.staff-shell .text-button { color: #8fb2f7; }
.staff-shell .panel-header .text-button:hover { background: rgba(255,255,255,.06); }
.staff-shell .eyebrow-row { color: #b7c1d9; }
.staff-shell .eyebrow-row svg { color: #8894b3; }
.staff-shell .stat-value { color: #f2f5fa; }
.staff-shell .stat-card::before { content: none; }
```

The `.panel, .stat-card { border-color: #232f4d; }` line is not optional: `app/globals.css:621` sets `.panel, .stat-card { border-color:#cad8e5; }` (a later, equal-specificity longhand) which wins over Task 2's `--panel-border` token redefinition for the `border` shorthand at line 309 — so without this explicit override, every panel and stat-card keeps a light `#cad8e5` ring around its otherwise-dark surface.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Manual check**

Refresh `/staff`. Confirm: the four stat tiles and the "Quick links" panel below them have legible white/light headings and labels (not dark-navy-on-dark), panels/stat-cards have a subtle dark border (not a light `#cad8e5` ring), and no thin warm-colored gradient line appears along the top edge of any tile. Visit `/staff/conversations` and confirm client names in the conversation queue are a legible light blue, not a muddy dark blue.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "Fix panel-header, stat-tile, and eyebrow text colors for dark theme"
```

---

### Task 5: Buttons and shared form fields

`.secondary-button` hardcodes a light background/border in two cascade layers. `.primary-button` keeps its existing blue gradient unchanged — it's already the one saturated accent color per the approved visual system, and reads fine on a dark background. `.modal-form` and `.knowledge-form` hardcode dark-navy label text and light input surfaces (used by the Manage Staff grant form and the Knowledge entry form, both in scope). `.form-error` is `!important` in its base rule, so the override needs `!important` too to win.

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add button/form CSS**

Append:

```css
.staff-shell .secondary-button {
  border-color: #2c3a5c;
  color: #d3dced;
  background: #171f38;
}
.staff-shell .modal-form label,
.staff-shell .knowledge-form label {
  color: #d3dced;
}
.staff-shell .modal-form input,
.staff-shell .modal-form select,
.staff-shell .modal-form textarea,
.staff-shell .knowledge-form input,
.staff-shell .knowledge-form textarea,
.staff-shell .agent-queue select {
  color: #f2f5fa;
  background: #0d1526;
  border-color: #2c3a5c;
}
.staff-shell .modal-form .form-notice {
  color: #86efac;
  background: rgba(24, 130, 79, .18);
}
.staff-shell .form-error { color: #f87171 !important; }
```

The base `.modal-form` rule (`app/globals.css:214`) only styles `select`/`textarea`, never `input` — but the Manage Staff "Grant access" form (`app/staff/(shell)/team/page.tsx:55`) is a single plain `<input type="email">`, so `.modal-form input` must be added explicitly or that field falls back to unstyled white browser-native input chrome. `.agent-queue select` (`app/globals.css:133`, shares its rule with `.knowledge-form input`/`.knowledge-form textarea`) drives the Conversations reassign/status/packet-status dropdowns and has no other override anywhere in this plan.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Manual check**

Visit `/staff/team`, open "Grant access" — confirm the form's labels are legible light text and the input has a dark surface with visible border, not a white input floating on the dark panel. Visit `/staff/knowledge` and check the "Add entry" form the same way.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "Style buttons and shared form fields for dark theme"
```

---

### Task 6: Conversations, Clients, and Knowledge components

Covers every remaining hardcoded-color class rendered by the Conversations reply thread, the new-conversation client search, the agent intake summary, and the knowledge list — confirmed by grep of `app/staff/(shell)/**/*.tsx` against `app/globals.css`.

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add component CSS**

Append:

```css
.staff-shell .support-bubble p {
  color: #e4e9f5;
  background: #1a2440;
  border-color: #2c3a5c;
  box-shadow: none;
}
.staff-shell .support-bubble p small { color: #8894b3; }
.staff-shell .support-bubble.consultant p {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}
.staff-shell .support-bubble.consultant p small { color: #cfe0fb; }
.staff-shell .support-bubble > span { background: #1a2440; color: #8fb2f7; }
.staff-shell .support-bubble.consultant > span { color: #fff; background: #2563eb; }
.staff-shell .support-composer {
  background: #141d33;
  border-top-color: #232f4d;
}
.staff-shell .support-composer input {
  color: #f2f5fa;
  background: #0d1526;
  border-color: #2c3a5c;
}
.staff-shell .support-composer button:not(:last-child) {
  color: #8894b3;
  background: #1a2440;
}
.staff-shell .support-composer button:last-child {
  color: #fff;
  background: #2563eb;
}
.staff-shell .new-conversation-panel { background: #0d1526; border-color: #232f4d; }
.staff-shell .new-conversation-panel > input {
  color: #f2f5fa;
  background: #141d33;
  border-color: #2c3a5c;
}
.staff-shell .client-search-results button {
  color: #d3dced;
  background: #141d33;
  border-color: #2c3a5c;
}
.staff-shell .agent-queue article { background: #141d33; }
.staff-shell .agent-queue article.unread { background: #16213f; border-left-color: #2563eb; }
.staff-shell .agent-queue span { color: #8894b3; }
.staff-shell .agent-intake-details div { background: #1a2440; }
.staff-shell .agent-intake-details dt { color: #8894b3; }
.staff-shell .agent-intake-details dd { color: #f2f5fa; }
.staff-shell .knowledge-list p { background: #141d33; }
.staff-shell .empty-state strong { color: #f2f5fa; }
```

Note: `.staff-shell .support-composer button` is split into `:not(:last-child)` / `:last-child` rather than one flat selector, because a flat selector ties in specificity with the pre-existing global rule `.support-composer button:last-child { background:#2868d8 }` (`app/globals.css:343`) and loses on source order, silently killing the send button's blue accent. The `:last-child` variant reuses the plan's own accent color (`#2563eb`, matching `.support-bubble.consultant` and `.stat-card-accent` elsewhere in this plan).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Manual check**

Visit `/staff/conversations`: open a conversation and confirm reply-thread bubbles are legible — the client's messages (`.support-bubble.user`) get the plain dark-surface treatment, your own replies as staff (`.support-bubble.consultant`, since `senderRole === "agent"` maps to the `consultant` class in this component) stay blue — confirm the message composer's input field is a dark surface, and (if there's an unassigned/unclaimed queue visible) confirm queue article cards aren't stark white. Start a new conversation to check the client-search input/results list. Visit `/staff/knowledge` and confirm existing entries in the list are dark-surfaced, not white strips. Visit a client detail page's agent intake summary (if present) and confirm the key/value grid is legible. Visit `/staff/onboarding` and trigger an empty state (e.g. an already-completed intake) to confirm its heading is legible.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "Style conversations, client-search, agent-queue, and knowledge-list for dark theme"
```

---

### Task 7: Onboarding detail page (`app/onboarding.css`)

`app/onboarding.css` hardcodes every color with no design tokens at all (confirmed — it predates the token system), so nothing here is fixed by Task 2. This file also contains the unrelated `/portal-gate` and `/account-creation` (client-facing signup) rules — leave those completely alone; only touch the `.onboarding-*`/`.intake-*`/`.overall-progress`/`.sensitive-data-note` classes used by `/staff/onboarding/[id]`.

**Files:**
- Modify: `app/globals.css` (new rules still go here, scoped under `.staff-shell`, per the isolation approach — `app/onboarding.css` itself is not touched, since none of its own rules need to change, they just need to be beaten by more specific scoped rules)

- [ ] **Step 1: Add onboarding-detail CSS**

Append:

```css
.staff-shell .onboarding-checklist {
  background: #141d33;
  border-color: #232f4d;
}
.staff-shell .onboarding-checklist h2 { color: #f2f5fa; }
.staff-shell .onboarding-checklist > p { color: #8894b3; }
.staff-shell .overall-progress { background: #232f4d; }
.staff-shell .onboarding-checklist > small { color: #5b8fef; }
.staff-shell .onboarding-checklist nav button {
  color: #b7c1d9;
}
.staff-shell .onboarding-checklist nav button > span {
  border-color: #2c3a5c;
  color: #8894b3;
}
.staff-shell .onboarding-checklist nav button strong { color: #f2f5fa; }
.staff-shell .onboarding-checklist nav button small { color: #8894b3; }
.staff-shell .onboarding-checklist nav button.active {
  color: #dbe6fb;
  background: #1a2b52;
}
.staff-shell .onboarding-checklist nav button.active > span {
  border-color: #5b8fef;
  color: #fff;
  background: #2563eb;
}
.staff-shell .onboarding-checklist nav button.complete > span {
  border-color: #234533;
  color: #86efac;
  background: #12291c;
}
.staff-shell .onboarding-form-card {
  background: #141d33;
  border-color: #232f4d;
}
.staff-shell .onboarding-form-head > span { color: #5b8fef; }
.staff-shell .onboarding-form-head h1 { color: #f2f5fa; }
.staff-shell .onboarding-form-head p { color: #8894b3; }
.staff-shell .intake-fields > label { color: #d3dced; }
.staff-shell .intake-fields input:not([type=checkbox]),
.staff-shell .intake-fields select,
.staff-shell .intake-fields textarea {
  color: #f2f5fa;
  background: #0d1526;
  border-color: #2c3a5c;
}
.staff-shell .intake-fields label > small { color: #8894b3; }
.staff-shell .onboarding-actions { border-top-color: #232f4d; }
.staff-shell .step-label { color: #dbe6fb; background: #1a2b52; }
```

`.intake-safety`, `.sensitive-data-note`, and `.intake-checkbox` (also defined in `app/onboarding.css`) are intentionally left out here: they're rendered only by the client-facing onboarding flow (`/account-creation`), not by `/staff/onboarding/[id]` — this page's `FieldType` union has no checkbox variant and its JSX has no safety-banner element. They were in an earlier draft of this task (copied from the full `onboarding.css` class list without checking against this page's actual markup) and were removed as dead code once that was caught in review.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Manual check**

Visit `/staff/onboarding`, open an in-progress intake (`/staff/onboarding/[id]`). Confirm: the left checklist panel and right form card are both dark-surfaced with legible text, the active/complete step indicators are visibly distinct, and all input fields have a dark surface with visible border and legible typed text.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "Style onboarding detail page for dark theme"
```

---

### Task 8: Overview page bespoke tile treatment

Per the approved mockup, only the first stat tile ("Open conversations") gets the gradient accent + a "View all" hint; the other three stay on the plain dark panel surface established by Task 2/4. The "Quick links" panel's content is unchanged — only its surface already changed via the token layer.

**Files:**
- Modify: `app/staff/(shell)/page.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Update the Overview page markup**

Replace the file's `return` statement (the JSX) with:

```tsx
  return <div className="section-view"><ViewHeading eyebrow="Admin console" title="Overview" description="What needs attention across the team right now." /><div className="agent-console-grid">{tiles.map((tile, i) => <Link key={tile.label} href={tile.href} className={`stat-card${i === 0 ? " stat-card-accent" : ""}`} style={{ textDecoration: "none", color: "inherit" }}><div><span className="eyebrow-row"><tile.icon size={16} />{tile.label}</span><strong className="stat-value">{tile.value}</strong></div>{i === 0 && <span className="stat-card-hint">View all →</span>}</Link>)}</div><Panel style={{ marginTop: 16 }}><PanelHeader title="Quick links" /><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Link href="/staff/conversations" className="secondary-button">View all conversations</Link><Link href="/staff/clients" className="secondary-button">Browse clients</Link></div></Panel></div>;
```

The only changes from the current version: `tiles.map((tile) => ...)` → `tiles.map((tile, i) => ...)`, the `className="stat-card"` gains a conditional `stat-card-accent` on the first tile, and a `<span className="stat-card-hint">View all →</span>` renders only on the first tile.

- [ ] **Step 2: Add the accent-tile CSS**

Append to `app/globals.css`:

```css
.staff-shell .stat-card-accent {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border-color: transparent;
}
.staff-shell .stat-card-accent .eyebrow-row,
.staff-shell .stat-card-accent .eyebrow-row svg,
.staff-shell .stat-card-accent .stat-value {
  color: #fff;
}
.staff-shell .stat-card-hint {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  color: rgba(255,255,255,.75);
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Manual check**

Visit `/staff`. Confirm: the "Open conversations" tile now has the blue gradient background with white text and a "View all →" hint line beneath the count; the other three tiles remain on the plain dark panel surface; the "Quick links" panel below is unchanged in content.

- [ ] **Step 5: Commit**

```bash
git add "app/staff/(shell)/page.tsx" app/globals.css
git commit -m "Add accent gradient treatment to the primary Overview stat tile"
```

---

### Task 9: Full visual QA pass and regression check

**Files:** none (verification-only task)

- [ ] **Step 1: Walk every in-scope page**

With `npm run dev` running and signed in as a staff account, visit and visually inspect each of the following, looking specifically for: light-theme colors bleeding through (white cards, dark-navy-on-dark text, light input fields), and anything that looks half-migrated:

- `/staff` (Overview)
- `/staff/conversations` (list view, an open conversation, and starting a new conversation)
- `/staff/clients` (list view)
- `/staff/clients/[id]` (any client detail page, including its agent intake summary if present)
- `/staff/onboarding` (list view)
- `/staff/onboarding/[id]` (an in-progress intake, and — if one exists — a completed one, to see the empty state)
- `/staff/knowledge` (list + add-entry form)
- `/staff/team` (Manage Staff — roster, grant form, pending invites if any)

- [ ] **Step 2: Confirm no leakage outside the staff shell**

Visit `/staff/login` (outside the `.staff-shell`-wrapped layout) and the client portal at `/` — both must render exactly as they did before this work started, confirming the `.staff-shell` scoping didn't leak. If the client-portal redesign (a separate concurrent effort) has landed changes to `app/globals.css` in the meantime, re-check this step against current `main` before treating any difference as a regression from this work specifically.

- [ ] **Step 3: Final build**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Update the active-work ledger**

Edit `docs/superpowers/ACTIVE.md`: either mark `staff-portal-dark-redesign` merged/resolved (if merging now) or update its phase to "implemented, pending merge decision" with a one-line summary of what was found in QA, matching the existing ledger convention for other rows.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/ACTIVE.md
git commit -m "Update active-work ledger: staff-portal-dark-redesign implemented"
```
