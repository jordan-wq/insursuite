# InsurSuite Marketing Site — Brief

This is a direct brief from the product owner (Jordan), written by another Claude Code session on his behalf, for whichever session builds this. It captures what he actually wants, distilled from a longer conversation, so you don't have to re-derive it or re-ask most of it.

**Read `AGENTS.md` and `CLAUDE.md` in this repo first** for the product overview, architecture, and security rules. This brief is scoped narrowly to the marketing site.

## Explicit instruction on approach

Build this plainly and directly. **Do not invoke the `ui-ux-pro-max`, `frontend-design`, or `algorithmic-art` skills for this** — a prior attempt used all three and produced something over-engineered relative to what was actually wanted (custom generative-art background motifs, a second typeface system, etc.). Reuse what's already in this codebase's CSS instead of inventing a new design system. If a `superpowers:brainstorming` → spec → plan cycle feels like the right amount of process for this, that's fine — but keep the actual visual/technical choices simple and grounded in the existing app, not a fresh design-tool-driven exploration.

## What to build

A real, multi-page, informative marketing site — not just a login gate with a paragraph of copy. Confirmed scope:

- **Homepage** (`/`)
- **Mission** (`/mission`)
- **Manifesto** (`/manifesto`)
- **How It Works** (`/how-it-works`)
- **How We're Different** (`/how-we-differ`) — vs. a traditional insurance broker
- **Talk with an Agent** (`/talk-to-an-agent`)
- **FAQ** (`/faq`)
- **About** (`/about`)

All pages share one nav and one footer.

## Login

Two buttons, top-right of the nav, **equal visual weight** — not one primary and one buried:
- **Client Login** → `/login`
- **Agent Login** → `/staff/login`

The homepage hero itself should be informative (what InsurSuite is, why it matters), not login-focused — the logins live in the nav, not as the hero's main CTA. Confirmed via earlier mockup review: two equal buttons, not a combined dropdown, not an asymmetric client-primary/agent-secondary treatment.

## Visual direction

- **White + navy blue.** This app's existing marketing pages (`/login`, `/terms`, `/privacy` in `app/globals.css`) already use a light background with navy ink (`#081831` headings, `#102039` body) and a blue accent (`#2868d8`) — reuse those, don't invent a new palette.
- **Typeface:** the existing Geist font already used throughout the app (`app/layout.tsx`). Don't introduce a second typeface.
- **Photography:** real, honest-feeling family photography — not obviously-fake corporate stock. Stock photos are fine as a placeholder (nothing about the layout should depend on specific images), swappable later once Jordan has real photos.
- **Tone:** premium but restrained — the standing bar from Jordan's global CLAUDE.md is Apple/Linear/Vercel-level polish, not flashy or maximalist. Cinematic, intentional, not busy.
- No generative-art backgrounds, no decorative canvas/SVG patterns — keep it clean.

## Content — what each page should actually say

Honest, plain-English copy, not marketing fluff that overstates what the product does. This exact copy was already drafted and reviewed earlier — reuse it as a strong starting point rather than drafting from scratch:

**Mission** — Why InsurSuite exists: making insurance feel organized and explainable before it's urgent, one place for policies/documents/beneficiaries that both the client and their agent can see. Who it's for: families who want to understand their own coverage, and agents who want a real relationship with clients instead of a spreadsheet and a renewal reminder.

**Manifesto** — A short numbered list of belief statements, e.g.: "Insurance should be legible before it is urgent." / "Every household deserves one trusted place for policies, people, documents, and next steps." / "You should never have to search through emails, drawers, and carrier portals to understand what protects your family." / "Your agent should know your family, not just your policy number." / "A good system disappears into the background until the day you need it most."

**How It Works** — Real steps, honestly described: create an account → short protection profile → add existing policies (upload or agent adds them) → your agent has the full picture → ongoing support and annual reviews. Include a note that none of this itself changes a policy — actual coverage changes go through the carrier and the agent.

**How We're Different** — vs. a traditional broker: one agent (not a call center), a real shared document vault instead of scattered paperwork, no cold-call renewal pressure, coverage picture visible any time instead of only at renewal. **Jordan should review/edit the specific claims here before this ships publicly** — treat the first draft as a draft, not final copy.

**Talk with an Agent** — What a conversation looks like (no sales pressure, your own assigned agent, real answers), how to actually start one (create an account, requests from inside the portal go to your assigned agent). CTA to create an account.

**FAQ** — Honest answers grounded in what the product actually does, e.g.: "Is InsurSuite an insurance carrier?" (no — it's a client portal, not a carrier), "Does uploading a document or updating my profile change my policy?" (no — changes go through the carrier/agent), "What information do you collect?" (link to Privacy Policy), "How do I talk to my agent?", "How do I stop using InsurSuite?" (contact your agent).

**About** — Keep minimal per Jordan's explicit call: founder-only for now, brief and honest, no fabricated team roster. Expand later as the team actually grows.

## Known technical gotchas (save yourself the debugging time)

- `middleware.ts` has an `isPublicPath()` allow-list. **Any new page you add here must be added to that list**, or a signed-out visitor hitting it gets redirected straight to `/login` before Next.js ever renders your page. This is the single most important thing to get right — a prior attempt caught this the hard way.
- Check `next.config.ts` for a `redirects()` block — there was previously a stale entry sending `/mission`/`/manifesto` back to `/`, which silently defeated new pages with those names. Confirm it's clean before assuming your new routes work.
- `app/landing/page.tsx` is an old, redundant marketing page. If this new site fully replaces it, retire it — but check nothing else links to it first.
- No unit-test framework in this repo. `npm run build` (type-check + static generation) is the verification convention, plus an actual browser check — click through every page and nav link before calling it done, since a static-code review alone won't catch a broken client-side toggle or a middleware redirect gap.

## What's explicitly not in scope

- No custom lead-capture/contact form on "Talk with an Agent" — there's no anonymous inbound-lead system in this app today; the CTA there is "create an account," which is the real mechanism.
- No pricing page — not requested, no public pricing model exists to describe honestly.
- No real team photos/bios beyond the founder — add later as the team grows.
