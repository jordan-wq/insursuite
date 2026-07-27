# Active Work Ledger

One row per in-flight task. Any session must check this before starting new work (see CLAUDE.md → Workflow → Session coordination), and keep it current: add an entry on start, update phase as work progresses, remove it on merge or abandonment.

| Topic slug | Worktree / branch | Phase | Started | Notes |
|---|---|---|---|---|
| staff-invite | `.worktrees/staff-invite` / `feature/staff-invite` | executing (task 1/6 done) | 2026-07-27 | Spec + plan approved (`specs/2026-07-25-staff-invite-design.md`, `plans/2026-07-27-staff-invite.md`). Subagent-driven execution in progress. |

Resolved: the previously-unclaimed uncommitted changes to `app/login/page.tsx`, `app/page.tsx`, `app/staff/(shell)/layout.tsx`, `app/staff/login/page.tsx`, `middleware.ts` were committed to `main` as `c23ca7e` ("Fix staff login: move isAgent check out of Edge middleware into shell layout") — that was the admin-login fix from earlier this session, unrelated to admin-console-shell.

Resolved: `client-onboarding-underwriting` (8-task plan) merged to `main` at `66e56fe` on 2026-07-27 — all tasks implemented and reviewed via subagent-driven-development, worktree/branch removed.
