# Staff Portal Dark Redesign — Design

## Context

The `/staff` shell (agent console: Overview, Conversations, Clients, Onboarding, Knowledge, Manage Staff) currently reuses the same light-theme chrome as the client portal — `.app-shell`, `.sidebar`, `.panel`, `.stat-card`, and the rest of the shared component classes in `app/globals.css` (adopted in `f323b20`, "Replace staff top-bar with the reused app-shell/sidebar chrome"). This design is a dark-only visual reskin of that shell, explored and approved through the brainstorming visual companion (`.superpowers/brainstorm/68745-1785183068/`): direction was narrowed from three options (Refined Minimal, Elevated Dashboard, Top-Nav Command Bar) to **Elevated Dashboard**, then translated to a dark treatment and locked in.

A separate session is concurrently redesigning the client-portal UI, which also depends on the shared `.app-shell`/`.sidebar`/`.panel`/`:root` rules in `globals.css` (see the design-system application layer starting around line 258 of that file). This design must not edit those shared, unscoped rules.

## Scope

Reskin the entire `/staff` shell to dark. The Overview page gets a bespoke layout update to match the approved mockup. The other five top-level pages (Conversations, Clients, Onboarding, Knowledge, Manage Staff) and their detail sub-pages (`clients/[id]`, `onboarding/[id]`) keep their current structure and markup — only the shared classes they already render (`.panel`, `.stat-card`, `.primary-button`, `.secondary-button`, `.text-button`, `.modal-form`, `.knowledge-form`, `.detail-grid`, `.form-error`, `.support-composer`) pick up dark styling because those pages sit inside the newly-scoped wrapper.

Out of scope: a light/dark toggle (dark-only, no user preference switch), any change to `/staff/login` (unauthenticated, not part of the shell), and any structural rebuild of the five non-Overview pages beyond color/surface treatment.

## Visual system

Approved dark palette (from `overview-dark.html`):

- Base page surface: `#0b1220`
- Sidebar surface: `#0d1526`; sidebar border: `#1c2740`
- Panel/card surface: `#141d33`; panel border: `#232f4d`
- Active nav item background: `#1a2b52`
- Text: primary `#f2f5fa`, muted `#8894b3`, faint/section-label `#465170` / `#5b6c8c`
- Accent (unchanged from the existing brand blue, used sparingly): gradient `#2563eb → #1d4ed8`, applied only to the primary "needs attention" stat tile and the active sidebar nav item's left accent
- Destructive/urgent value color: `#f87171` (replaces the light theme's `#c0392b` on dark)
- Elevation is expressed as layered background + a 1px border (`#141d33` panel on `#0b1220` page, `#232f4d` border) rather than drop shadows, matching the mockup

Sidebar navigation gains two group labels: **WORKSPACE** (Overview, Conversations, Clients, Onboarding) and **SYSTEM** (Knowledge, Manage Staff), styled as small uppercase, letter-spaced, `#465170` text above each group.

## Implementation approach

**Isolation.** Add a `.staff-shell` class alongside the existing `.app-shell` class on the root `<div>` in `app/staff/(shell)/layout.tsx` — additive, not a replacement, so the shared structural CSS (`.app-shell`'s flex/sizing rules etc.) still applies. All new dark styling is added as a new block in `app/globals.css`, with every selector scoped under `.staff-shell` (e.g. `.staff-shell .panel`, `.staff-shell .sidebar`, `.staff-shell .stat-card`, `.staff-shell .primary-button`). No edits to the existing unscoped `.app-shell` / `.sidebar` / `.panel` / `:root` rules or their design-system-application-layer overrides — those stay exactly as the client-portal redesign work leaves them.

**Sidebar structure.** `app/staff/(shell)/layout.tsx`'s nav currently renders six flat `<Link>`s. Add two small uppercase group-label elements (e.g. `<div className="staff-nav-group-label">Workspace</div>`) splitting the six links into the two groups above. This is a markup change, not just CSS — the grouping doesn't exist today.

**Overview page.** `app/staff/(shell)/page.tsx` currently renders four uniform `.stat-card` tiles in an `.agent-console-grid`, followed by a `Panel`/`PanelHeader` "Quick links" block. Per the mockup: the first tile ("Open conversations") gets the gradient accent treatment and a "→ View all" hint line; the other three stay on the standard dark panel surface. Replace the "Quick links" panel with a "Recent activity" panel — this requires a data source. **Open question below** — see Verification/Follow-ups.

## Follow-up needed before implementation

The mockup's "Recent activity" panel (`New message from J. Alvarez — 2m ago`, etc.) has no backing data source today — `GET /api/agent/overview` only returns the four count fields (`openConversations`, `urgentUnread`, `unassigned`, `packetsPending`). Wiring a real recent-activity feed is a backend change beyond a CSS/markup reskin. For this pass, keep the existing "Quick links" panel content (unchanged) in the Overview page instead of building a new Recent Activity feed — only its surface styling goes dark. Recent activity becomes a separate, later feature if wanted.

## Verification

No test framework in this repo (`npm run build` is the only automated check — type-check + static generation). Manual verification: run the dev server, sign in as a staff account, and visually check all six top-level staff pages plus both detail sub-pages (`clients/[id]`, `onboarding/[id]`) for:
- No light-theme colors bleeding through (old shared-token light backgrounds, light borders, light text-on-dark contrast failures)
- Sidebar renders both group labels, active-page highlighting still works
- Overview page matches the approved mockup's stat-tile treatment
- Client-portal pages (`/`, unaffected by this change) still render exactly as before — confirms the `.staff-shell` scoping didn't leak
