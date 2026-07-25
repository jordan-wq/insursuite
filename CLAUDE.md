# InsurSuite — Claude Code guide

Also read `AGENTS.md` in this same directory — it has the product overview, security/data rules, and insurance-safety rules that apply to every change. This file covers architecture, workflow conventions, and current project state that AGENTS.md doesn't.

## What this is

Insurance client portal. Next.js 16 (App Router, Turbopack), React 19, TypeScript, Supabase (Auth/Postgres/Storage). Deployed on Vercel from `github.com/jordan-wq/insursuite`. There is **no unit-test framework** — `npm run build` (type-check + static generation) is the only verification convention. Don't add a test framework unasked.

## Two separate apps in one repo

- **Client portal** — `/`, gated by a normal Supabase session. Almost the entire UI lives in one dense file, `app/page.tsx` (thousands of lines, minimal whitespace, inline JSX). This is the established style here — don't unilaterally split it into smaller files or "clean up" formatting; only touch what a task requires. Shared pieces that *were* worth extracting live in `app/components/shared.tsx` (`Panel`, `PanelHeader`, `ViewHeading`, `ticketCode`).
- **Staff/agent shell** — `/staff`, its own login (`app/staff/login/page.tsx`) and its own layout (`app/staff/(shell)/layout.tsx`), gated separately by membership in the `agent_roles` table (`app/service-routing.ts`'s `isAgent()`), not by any client-side role flag. `middleware.ts` is what routes `/staff/*` traffic to the staff login instead of the client login — check `isPublicPath()`/`loginPathFor()` there before adding any new top-level route, or it'll either wrongly force a login redirect or wrongly bypass one.

## Auth and the client/agent trust boundary

- `app/auth.ts`'s `getCurrentUser()` is **fail-closed**: if Supabase is configured (any real deployment) and there's no real session, it returns `null` — it never falls back to a synthetic user. The local-dev synthetic user only exists when Supabase isn't configured at all, and never in production. Don't reintroduce a fallback-to-fake-user path.
- Two Supabase clients: `lib/supabase/server.ts` (session-scoped, RLS-enforced — use this for anything client-facing) and `lib/supabase/admin.ts` (service-role, **bypasses RLS**). The admin client must only be touched after an explicit `isAgent(user.id)` check, and every agent-facing route that looks up a specific client's data must also verify that client is actually assigned to that agent (see `isAssignedToAgent()` in `app/api/agent/policies/route.ts` for the pattern) — this is the IDOR guard this codebase relies on. Don't add a new agent route that queries by a client-supplied ID without this check.
- Profile data shape gotcha: `StoredProfile` has `fullName`/`phone`/`dateOfBirth` at the top level, but everything else collected during onboarding (beneficiaries, emergency contact, income, goals, etc.) lives one level deeper in `StoredProfile.profile` (a jsonb blob filtered through `sanitizeProfile()`'s allow-list in `app/profile-fields.ts`). Reading `profile.primaryBeneficiary` instead of `profile.profile.primaryBeneficiary` is a real mistake that's been made in this codebase before — double-check which level a field lives at.
- `saveProfilePatch` (`app/page.tsx`) takes `(patch, accountPatch?)` — `patch` merges into the nested `profile` jsonb, `accountPatch` (optional, `{fullName?, phone?}`) overrides the top-level fields. It always POSTs to `/api/client-profile` (that route has no PATCH handler, only GET/POST).

## Feature backlog convention

AI Assistant, Coverage Review, and Claims Concierge were deliberately pulled from `navItems` (not deleted) — the code still exists but isn't reachable from the nav. If asked to revive one, look for the existing component before rebuilding it.

## Workflow: how work gets planned and shipped here

This project follows the `superpowers` skill flow for anything beyond a trivial fix:
1. **Brainstorm** → design doc in `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, reviewed by a spec-document-reviewer subagent before moving on.
2. **Plan** → task-by-task implementation plan in `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`, reviewed the same way.
3. **Execute** → either directly in the working tree (fine for most changes) or in an isolated git worktree under `.worktrees/` on a `feature/*` branch (ask the user which — some sessions have gone straight to `main`, others have used a worktree; there's no fixed rule, it depends on how much the user wants to review before it lands). Each task gets its own commit, a spec-compliance review, and a code-quality review before moving to the next task.

Check `docs/superpowers/specs/` and `docs/superpowers/plans/` for prior art before starting something that might already be designed.

## Current state (as of 2026-07-24)

- Cloudflare/D1/R2/OpenAI-Sites migration to Vercel + Supabase: **done**.
- Policy enrichment (premium due dates, carrier logo directory, packet-delivery notifications), the staff shell + Manage Staff screen, and agent↔client messaging: **done**, all merged to `main`.
- A manual security review found and fixed: a messaging RLS gap, a fail-open auth fallback, a search-filter injection risk, an IDOR gap in agent policy routes, and a header-injection risk on document downloads. Left open on purpose: no admin/staff role tiering yet (any staff account can grant/revoke others — flat trust model, intentional for a small team), and no CSP headers yet (flagged, not demonstrated as exploitable).
- An "MVP launch checklist" plan (real-data fix for the Family & Household page, Terms/Privacy pages, styled error/404 pages, fixing two fake-persistence bugs in Settings) is **in progress** on branch `feature/mvp-launch-checklist` in `.worktrees/mvp-launch-checklist/` — check `git log` on that branch and `docs/superpowers/plans/2026-07-24-mvp-launch-checklist.md` before assuming it's done or redoing it.
- Deferred, not yet scoped: a "version control" feature for documents/data-edit history (scope was never nailed down — clarify before starting).
