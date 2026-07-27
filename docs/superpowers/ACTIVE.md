# Active Work Ledger

One row per in-flight task. Any session must check this before starting new work (see CLAUDE.md → Workflow → Session coordination), and keep it current: add an entry on start, update phase as work progresses, remove it on merge or abandonment.

| Topic slug | Worktree / branch | Phase | Started | Notes |
|---|---|---|---|---|
Resolved: the previously-unclaimed uncommitted changes to `app/login/page.tsx`, `app/page.tsx`, `app/staff/(shell)/layout.tsx`, `app/staff/login/page.tsx`, `middleware.ts` were committed to `main` as `c23ca7e` ("Fix staff login: move isAgent check out of Edge middleware into shell layout") — that was the admin-login fix from earlier this session, unrelated to admin-console-shell.

Resolved: `client-onboarding-underwriting` (8-task plan) merged to `main` at `66e56fe` on 2026-07-27 — all tasks implemented and reviewed via subagent-driven-development, worktree/branch removed.

Resolved: `staff-invite` merged to `main` on 2026-07-27 — implemented, reviewed, blocking issues found and fixed, re-reviewed clean, worktree/branch removed.

Resolved: `staff-portal-dark-redesign` merged to `main` at `33a6a32` on 2026-07-27 — all 9 tasks implemented via an orchestrated workflow (one implementer + two independent reviewers per task, bounded fix-and-recheck loop), branch/worktree removed. One extra cleanup landed after the workflow: Task 7's quality reviewer caught 8 lines of dead CSS (`.intake-safety`/`.sensitive-data-note`/`.intake-checkbox`, copied from the client-facing onboarding flow's class list but never rendered by the staff onboarding detail page) — removed, plan doc updated to match. **Live browser visual QA (the plan's Task 9) was explicitly skipped** — no staff-role credentials were available for this Supabase project in this session, and the user chose to proceed on the build + two-reviewer verification alone rather than share credentials or review it personally. If a rendering issue turns up in the deployed `/staff` shell, start here.
