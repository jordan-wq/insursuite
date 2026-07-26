# Marketing Site — Design

## Context

InsurSuite currently has two overlapping, unfinished marketing surfaces: `SignInGate` (rendered inside `app/page.tsx` when a signed-out visitor's client-side `portalMode` flips to `"signed_out"`) and a near-duplicate standalone `/landing` route (`app/landing/page.tsx`). Neither is a real informative site — both are a single hero + manifesto + platform-grid page, and (discovered during the MVP-launch-checklist verification pass) `SignInGate` is largely unreachable in practice: `middleware.ts`'s `isPublicPath()` doesn't include `/`, so a genuinely signed-out visitor hitting `/` gets redirected straight to `/login` before ever seeing it.

This spec replaces both with one real, informative marketing site: white + navy, honest real-feeling family photography, a proper nav with Client Login / Agent Login, and real content pages — not just a login gate with some manifesto text bolted on.

Two visual/structural decisions were validated with the user via the brainstorming visual companion before this spec was written: the nav login treatment (two equal-weight buttons, not a combined dropdown or an asymmetric client/agent priority), and the overall homepage shape (informative hero with real photography, not a login-focused hero — logins live in the nav).

## Scope

### 1. Fix reachability: add all 8 new public paths to the allow-list

`middleware.ts`'s `isPublicPath()` needs `pathname === "/"` **and** all 7 new subpages added: `/mission`, `/manifesto`, `/how-it-works`, `/how-we-differ`, `/talk-to-an-agent`, `/faq`, `/about`. This is the load-bearing fix — without every one of these, the corresponding page redirects a signed-out visitor to `/login` before they ever see it (confirmed: the middleware `matcher` regex matches all of these paths, and the redirect fires whenever `!user && !isPublicPath(pathname)`). Missing even one defeats the point of that page existing. Verified safe: middleware only redirects a request when `!user` (no session) — a signed-in user hitting any of these paths is already unaffected by `isPublicPath`, since the redirect check never triggers for them.

**Known limitation, explicitly out of scope:** `/` is still rendered by the same large client-component `app/page.tsx` that also renders the entire authenticated app, gated by a client-side `portalMode` state machine (`"loading"` → checks `/api/...`, gets a 401 → `"signed_out"` → renders `SignInGate`). This means a signed-out visitor briefly sees the existing `PortalLoading` spinner before the marketing homepage appears, instead of the homepage being an instantly-served static page. Fixing that would mean splitting the authenticated app off of `/` onto its own route — a real architectural change (touches every login redirect, `requireCurrentUser`'s assumptions, etc.) that isn't justified just to build an informative marketing site. Noted as a future improvement, not built here.

### 2. Shared marketing nav + footer component

New file: `app/components/marketing-shell.tsx`, exporting `MarketingNav` and `MarketingFooter`, used by the homepage (`SignInGate`) and every new subpage below. Reuses the existing `.marketing-nav`/`.marketing-page`/`.gate-brand` CSS classes already established (from the `/login` page and current `SignInGate`) rather than introducing a new visual language.

`MarketingNav`: brand mark on the left; page links (Mission, Manifesto, How It Works, How We're Different, Talk with an Agent, FAQ, About) in the middle/right; two equal-weight login buttons on the far right — "Client Login" (solid navy, links to `/login`) and "Agent Login" (outlined/subtle, links to `/staff/login`). On narrow viewports, the page links collapse behind a menu button — the two login buttons stay visible. **This is new interactive code, not a reuse of an existing pattern:** today's `.marketing-nav` mobile CSS just stacks/scrolls the link row on small screens; the actual toggle-button-plus-scrim menu pattern only exists in the authenticated app shell (`app/page.tsx`'s sidebar toggle). `MarketingNav` borrows that interaction pattern but is genuinely new code for the marketing context.

`MarketingFooter`: extracts the `.marketing-footer` markup that already exists inline in `SignInGate` (`app/page.tsx`) and `app/login/page.tsx` (each currently renders its own copy with Terms/Privacy links) into this one shared component, then extends it with links to all the new pages.

### 3. Homepage (`SignInGate`, `app/page.tsx`)

Rebuilt using `MarketingNav`/`MarketingFooter`. Structure, top to bottom:
- Nav.
- Hero: kicker + headline + subhead (informative, not login-focused — the two logins already live in the nav) alongside one real family photo. Matches the validated mockup: text left, photo right, white background, navy headline text.
- Three teaser cards linking to Mission / Manifesto / Talk with an Agent (matches the validated mockup).
- A short "How we're different" strip — 3-4 concise points, linking through to the full How We're Different page.
- Closing CTA section (kept from the current `SignInGate`: "Build a coverage file your future self can actually use" + a primary button to `/login`).
- Footer.

The existing `manifesto` array and mission-adjacent copy already in `SignInGate` gets reused/adapted rather than rewritten from scratch — it's honest, already-written material, not filler.

### 4. New content pages

Each is a standalone route using `MarketingNav`/`MarketingFooter`, following the same file pattern already established for `/terms` and `/privacy` (server component, `export const metadata`, wrapped in `.marketing-page`).

- **`app/mission/page.tsx`** — why InsurSuite exists, who it's for. Drafted from existing manifesto/hero language already in the codebase.
- **`app/manifesto/page.tsx`** — expands the existing 3-line manifesto array into a full page (the belief statements already written, given room to breathe, not reduced to a homepage teaser).
- **`app/how-it-works/page.tsx`** — honest walkthrough of the real product flow: create an account → short profile → upload/scan policies → your agent has access → ongoing support and reviews. Drafted from what the product actually does today (matches `AGENTS.md`'s "Insurance safety" rule against overstating what the portal does).
- **`app/how-we-differ/page.tsx`** — "How We're Different" from a traditional broker. Content: a first draft from what the product genuinely provides today (direct access to your own agent instead of a call center, a real document vault instead of scattered paperwork, no cold-call sales pressure, your coverage picture visible to you at any time instead of only at renewal). **This is a first draft to be reviewed and edited by the user before it ships** — not asserting anything not already true of the product.
- **`app/talk-to-an-agent/page.tsx`** — informational: what a conversation with an assigned agent looks like, sets expectations (no pressure, your own agent, real answers). Primary CTA is "Create your account" linking to `/login?mode=signup` (see section 6 below — `/login` defaults to its sign-in tab today, so this needs a small addition to actually land on sign-up), since the product's actual mechanism for talking to an agent requires an account + an assignment — there's no anonymous lead-capture/contact-form system today, and building one is out of scope for this spec (flagged below).
- **`app/faq/page.tsx`** — drafted honestly from what the product actually does: what InsurSuite is/isn't (not a carrier, doesn't itself change your policy), what data is collected (links to `/privacy`), how billing/plans work if applicable, how to talk to an agent, how to leave.
- **`app/about/page.tsx`** — kept minimal per the user's explicit choice: founder-only, brief and honest, no fabricated team roster. Easy to expand later as real hires happen.

### 5. Small addition: `?mode=signup` support on `/login`

`app/login/page.tsx`'s `LoginForm` already has a `mode` state (`"signin" | "signup"`, defaulting to `"signin"`) and already reads `useSearchParams()` for `return_to`. Read an additional `mode` param on mount and use it as the initial state when it's exactly `"signup"` (any other/missing value keeps today's `"signin"` default) — this is the only way for the new Talk with an Agent CTA (and the homepage's own "Create account" links, if pointed at `/login` directly) to land visitors on the sign-up tab instead of sign-in. Small, additive, doesn't change default behavior for the existing `/login` link used everywhere else.

### 6. Retire `app/landing/page.tsx`

Deleted. Its content is now fully superseded by the real homepage + subpages above — keeping a redundant third marketing surface around would just be more to maintain and more chances for inconsistent messaging.

## Out of scope

- An actual anonymous lead-capture/contact form on the Talk with an Agent page. Today, talking to an agent requires an account. Building real anonymous inbound-lead handling (a new public API route, spam/abuse protection, agent notification on a new lead) is a meaningfully separate feature — flag for a future spec if wanted.
- Splitting the authenticated app off of `/` onto its own route to make the marketing homepage a true fast static page (see the known limitation in section 1).
- Real team photos/bios beyond the founder-only About page — add later as the team actually grows.
- Pricing/plans page — not requested, and the product doesn't currently have a public pricing model to describe honestly.
- Custom, non-stock photography — stock photos are a deliberate placeholder per the user's explicit choice, swappable later with zero design changes needed.

## Verification

- `npm run build`.
- Manual, signed out: visit `/` directly — confirm it's no longer redirected to `/login`, confirm the loading flash then homepage. Click through every nav link (Mission, Manifesto, How It Works, How We're Different, Talk with an Agent, FAQ, About) and confirm each renders. Click "Client Login" → lands on `/login`; click "Agent Login" → lands on `/staff/login`.
- Manual, signed in: visit `/` — confirm the authenticated dashboard still renders correctly (unaffected by the middleware change).
- Confirm `/landing` no longer exists (404, or removed from any remaining internal links).
