# MVP Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every remaining gap before InsurSuite's first real clients start using it — finish and land the in-flight `feature/mvp-launch-checklist` branch, verify it actually works in a browser, deploy it, and close out the 3 remaining non-code gaps.

**Architecture:** No new features or architecture here. Tasks 1-3 finish and merge work already implemented on `feature/mvp-launch-checklist` (3 of 4 tasks fully reviewed, the 4th implemented and spec-reviewed with its code-quality review interrupted mid-run). Tasks 4-6 are verification and operational steps, not code changes.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, Vercel.

**Verification convention:** No unit-test framework in this repo. Code tasks verify via `npm run build` + browser preview. Operational tasks (5, 6) verify via direct inspection (Supabase dashboard, production URL) — there's no automated check for those.

**Related:** `docs/superpowers/plans/2026-07-24-mvp-launch-checklist.md` (the plan this one finishes), `CLAUDE.md` (current project state).

---

### Task 1: Resume Task 4's code-quality review

**Context:** Task 4 of the MVP launch checklist (Settings save fix, commit `6050d94` on `feature/mvp-launch-checklist`) is implemented and passed spec-compliance review. Its code-quality review was started and interrupted before finishing — no findings were reported either way.

- [ ] **Step 1: Dispatch a code-quality reviewer** against the same diff (base `7b59782`, head `6050d94`) in the worktree at `.worktrees/mvp-launch-checklist`, using the same review brief as the interrupted run (see the prior turn in this conversation, or reconstruct from Task 4's section in `docs/superpowers/plans/2026-07-24-mvp-launch-checklist.md`): focus on the optimistic-toggle race-condition risk, the `??`-vs-`||` correctness already confirmed by spec review, and whether widening `saveProfilePatch`'s signature is a clean API.
- [ ] **Step 2: If issues found**, fix them in the worktree, commit, re-review. If approved, proceed.

---

### Task 2: Full manual browser verification pass

**Context:** All 4 tasks were implemented and build-verified by subagents with no dev server running — nobody has actually clicked through the result yet. Do this before merging.

- [ ] **Step 1:** Start the dev server against the worktree (`.worktrees/mvp-launch-checklist`) via `preview_start`.
- [ ] **Step 2:** Sign in as a real (non-sample) test account with a saved profile. Open every nav item — Dashboard, My Policies, Document Vault, Support Center, Call Intake, Notifications, **Family & Household**, Settings — confirm nothing broke and Family & Household shows real data (not "Jordan McNutt"/"Alex Smith"), with correct empty states if you test an account with unset beneficiary/emergency-contact/dependents fields.
- [ ] **Step 3:** Visit `/terms` and `/privacy` directly while signed out — confirm both render (not a redirect to `/login`). Confirm the signup consent checkbox's links work.
- [ ] **Step 4:** Navigate to a bad URL — confirm the styled 404 renders. Temporarily force a render error (e.g. `throw new Error("test")` at the top of `Dashboard`), reload, confirm the styled error page renders with a working "Try again" button, then remove the temporary throw.
- [ ] **Step 5:** In Settings, edit name/phone, save, reload — confirm it persisted. Toggle a notification preference, reload — confirm it persisted.
- [ ] **Step 6: Stop the dev server.** If anything's broken, fix it in the worktree, rebuild, re-verify.

---

### Task 3: Merge to main and push

- [ ] **Step 1:** Use the `superpowers:finishing-a-development-branch` skill from the worktree to decide and execute the merge approach (direct merge vs. PR — ask the user which, given prior sessions have gone straight to `main`).
- [ ] **Step 2:** Confirm `main` builds clean post-merge (`npm run build`).
- [ ] **Step 3:** Push `main` to `origin`.
- [ ] **Step 4:** Clean up the worktree (`git worktree remove .worktrees/mvp-launch-checklist`) and delete the merged local/remote feature branch per the finishing-a-development-branch flow.

---

### Task 4: Post-deploy smoke test

- [ ] **Step 1:** Confirm Vercel picked up the new `main` push and the deploy succeeded (check via the Vercel MCP tools — `get_deployment`/`get_runtime_errors`/`get_deployment_build_logs`).
- [ ] **Step 2:** Open the production URL in the browser. Sign in, confirm the dashboard loads, spot-check Family & Household and Settings persistence against production data, visit `/terms` and `/privacy` on the live URL.
- [ ] **Step 3:** Report status. If the deploy failed or something's broken in production, that's a stop-and-fix, not a note for later.

---

### Task 5: Check Supabase auth email branding (advisory)

- [ ] **Step 1:** In the Supabase dashboard (Authentication → Email Templates), look at the signup-confirmation and password-reset email templates. Report whether they're still Supabase's raw defaults or already customized.
- [ ] **Step 2:** This is a report-only step — don't change the templates unless the user asks after seeing the report. Branding copy/design is the user's call.

---

### Task 6: Real agent accounts (operational — needs user input)

**Context:** Nothing in the app auto-provisions staff access. A row must exist in `public.agent_roles(user_id)` for every real agent, and that user must have already signed up (created a Supabase Auth account) before the row can reference them.

- [ ] **Step 1:** Ask the user which real people need staff/agent access, and confirm each has already signed up for an account (via `/staff/login`'s sign-up flow, or the regular flow if agents share the same auth system as clients — confirm which).
- [ ] **Step 2:** For each confirmed agent, insert a row into `agent_roles` via the Supabase Management API (same pattern used earlier in this project for direct schema/data verification) — get the user's `id` from `auth.users` by email first, don't guess it.
- [ ] **Step 3:** Verify each new agent can actually log into `/staff` and see the staff shell.

---

## Final check

- [ ] Re-read the "what's left for MVP" list from this conversation — confirm every item is either done, explicitly deferred with the user's sign-off, or newly discovered and flagged.
