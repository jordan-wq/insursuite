@AGENTS.md

## Claude Code

Everything below is additional context for Claude Code specifically — architecture, workflow conventions, and current project state that `AGENTS.md` (imported above) doesn't cover. `AGENTS.md` already has the product overview and the security/data/insurance-safety rules; this file doesn't repeat them.

### What this is

Insurance client portal. Next.js 16 (App Router, Turbopack), React 19, TypeScript, Supabase (Auth/Postgres/Storage). Deployed on Vercel from `github.com/jordan-wq/insursuite`. There is **no unit-test framework** — `npm run build` (type-check + static generation) is the only verification convention. Don't add a test framework unasked.

### Two separate apps in one repo

- **Client portal** — `/`, gated by a normal Supabase session. Almost the entire UI lives in one dense file, `app/page.tsx` (thousands of lines, minimal whitespace, inline JSX). This is the established style here — don't unilaterally split it into smaller files or "clean up" formatting; only touch what a task requires. Shared pieces that *were* worth extracting live in `app/components/shared.tsx` (`Panel`, `PanelHeader`, `ViewHeading`, `ticketCode`).
- **Staff/agent shell** — `/staff`, its own login (`app/staff/login/page.tsx`) and its own layout (`app/staff/(shell)/layout.tsx`), gated separately by membership in the `agent_roles` table (`app/service-routing.ts`'s `isAgent()`), not by any client-side role flag. `middleware.ts` is what routes `/staff/*` traffic to the staff login instead of the client login — check `isPublicPath()`/`loginPathFor()` there before adding any new top-level route, or it'll either wrongly force a login redirect or wrongly bypass one.

### Auth and the client/agent trust boundary

- `app/auth.ts`'s `getCurrentUser()` is **fail-closed**: if Supabase is configured (any real deployment) and there's no real session, it returns `null` — it never falls back to a synthetic user. The local-dev synthetic user only exists when Supabase isn't configured at all, and never in production. Don't reintroduce a fallback-to-fake-user path.
- Two Supabase clients: `lib/supabase/server.ts` (session-scoped, RLS-enforced — use this for anything client-facing) and `lib/supabase/admin.ts` (service-role, **bypasses RLS**). The admin client must only be touched after an explicit `isAgent(user.id)` check — that's the only authorization boundary on agent-facing routes now. `isAssignedToAgent()` (an earlier per-client assignment check in `app/api/agent/policies/route.ts`) was deliberately removed during the admin-console-shell work (see `docs/superpowers/specs/2026-07-26-admin-console-shell-design.md`'s "Deliberate access-control change") — any staff account can now read/act on any client, matching the existing flat trust model. Don't reintroduce assignment-scoping without checking that spec first.
- Profile data shape gotcha: `StoredProfile` has `fullName`/`phone`/`dateOfBirth` at the top level, but everything else collected during onboarding (beneficiaries, emergency contact, income, goals, etc.) lives one level deeper in `StoredProfile.profile` (a jsonb blob filtered through `sanitizeProfile()`'s allow-list in `app/profile-fields.ts`). Reading `profile.primaryBeneficiary` instead of `profile.profile.primaryBeneficiary` is a real mistake that's been made in this codebase before — double-check which level a field lives at.
- `saveProfilePatch` (`app/page.tsx`) takes `(patch, accountPatch?)` — `patch` merges into the nested `profile` jsonb, `accountPatch` (optional, `{fullName?, phone?}`) overrides the top-level fields. It always POSTs to `/api/client-profile` (that route has no PATCH handler, only GET/POST).

### Feature backlog convention

AI Assistant, Coverage Review, and Claims Concierge were deliberately pulled from `navItems` (not deleted) — the code still exists but isn't reachable from the nav. If asked to revive one, look for the existing component before rebuilding it.

### Workflow: how work gets planned and shipped here

This project follows the `superpowers` skill flow for anything beyond a trivial fix:
1. **Brainstorm** → design doc in `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, reviewed by a spec-document-reviewer subagent before moving on.
2. **Plan** → task-by-task implementation plan in `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`, reviewed the same way.
3. **Execute** → in an isolated git worktree under `.worktrees/<topic>` on branch `feature/<topic>` (slug matches the spec/plan filename), *unless* the change is a trivial one-off fix with no spec/plan, which may go directly on `main`. Each task gets its own commit, a spec-compliance review, and a code-quality review before moving to the next task.

Check `docs/superpowers/specs/` and `docs/superpowers/plans/` for prior art before starting something that might already be designed.

#### Session coordination

Multiple Claude Code sessions can be working this repo at once. Before starting *any* new work:
- Read `docs/superpowers/ACTIVE.md` — the ledger of in-flight tasks (topic, worktree/branch, phase, started date).
- Run `git worktree list` and `git status --short` on `main`. Uncommitted or staged changes with no matching ledger entry mean someone's mid-task without having logged it — surface this to the user rather than building on top of it or discarding it.
- Don't edit files another ledger entry is actively touching unless you're explicitly resuming that entry's task.
- Add an entry when you start (brainstorming/planning/executing), update its phase as work progresses, remove it when the task merges to `main` or is abandoned.
- Whichever session is active is responsible for keeping this ledger honest — correct stale or missing entries as you find them rather than leaving drift for the next session.

#### Worktree hygiene

- Worktree path and branch name share the topic slug used by the spec/plan filenames: `.worktrees/<topic>` / `feature/<topic>`.
- Once a feature branch merges to `main`, remove its worktree (`git worktree remove .worktrees/<topic>`) and delete the local branch. Do this prune as a first step before creating a new worktree, not as an afterthought.

#### Token/context efficiency

- Delegate broad, multi-file, or open-ended searches to the Explore agent rather than manually chaining Grep/Glob calls.
- Don't re-read a file immediately after editing it — Edit/Write already confirms the change landed.
- `app/page.tsx` is thousands of lines; jump to the relevant section with Grep/Glob line numbers instead of reading it in full.
- `npm run build` is the only verification step and isn't cheap — batch related edits and build once before wrapping up, not after every small unrelated change.

### Current state (as of 2026-07-26)

This section covers completed milestones only. For live in-flight work, check `docs/superpowers/ACTIVE.md`.

- Cloudflare/D1/R2/OpenAI-Sites migration to Vercel + Supabase: **done**.
- Policy enrichment (premium due dates, carrier logo directory, packet-delivery notifications), the staff shell + Manage Staff screen, and agent↔client messaging: **done**, all merged to `main`.
- A manual security review found and fixed: a messaging RLS gap, a fail-open auth fallback, a search-filter injection risk, an IDOR gap in agent policy routes, and a header-injection risk on document downloads. Left open on purpose: no admin/staff role tiering yet (any staff account can grant/revoke others — flat trust model, intentional for a small team), and no CSP headers yet (flagged, not demonstrated as exploitable).
- The "MVP launch checklist" (real-data fix for Family & Household, Terms/Privacy pages, styled error/404 pages, fixing two fake-persistence bugs in Settings, `?mode`-aware login): **done**, merged to `main`.
- A **staff invite-by-email** design is approved (`docs/superpowers/specs/2026-07-25-staff-invite-design.md`) — extends the existing Manage Staff page so an agent can invite someone who hasn't signed up yet, instead of the current dead-end error. **Not yet planned or implemented** — this is the next real piece of unstarted, already-designed work if picking this project back up.
- Deferred, not yet scoped: a "version control" feature for documents/data-edit history (scope was never nailed down — clarify before starting).
