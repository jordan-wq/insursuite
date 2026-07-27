# Active Work Ledger

One row per in-flight task. Any session must check this before starting new work (see CLAUDE.md → Workflow → Session coordination), and keep it current: add an entry on start, update phase as work progresses, remove it on merge or abandonment.

| Topic slug | Worktree / branch | Phase | Started | Notes |
|---|---|---|---|---|
| staff-invite | `.worktrees/staff-invite` / `feature/staff-invite` | all 6 tasks implemented+reviewed; final branch review found blocking issues, fixes not yet started | 2026-07-27 | Spec+plan approved and fully implemented (`specs/2026-07-25-staff-invite-design.md`, `plans/2026-07-27-staff-invite.md`), 7 commits on branch. Final whole-branch review found 2 critical + 3 important issues not caught by per-task review — see TaskList (tasks 7-11) for the itemized fix list. NOT YET MERGED. Paused for a machine restart; resume by asking to continue the staff-invite fixes and checking TaskList. |
| staff-portal-dark-redesign | none yet (main, brainstorming) | brainstorming | 2026-07-27 | Dark-only visual redesign of `/staff` shell (elevated-dashboard style: gradient accent tile, elevated cards, grouped sidebar nav). Direction approved via visual companion mockups. Isolation strategy proposed (new `.staff-shell` wrapper class, all-new scoped CSS, zero edits to shared `.app-shell`/`.sidebar`/`.panel`/`:root` tokens the client-portal redesign also depends on) — awaiting user confirmation. No spec file written yet. Mockups saved in `.superpowers/brainstorm/68745-1785183068/` (gitignored). |

Resolved: the previously-unclaimed uncommitted changes to `app/login/page.tsx`, `app/page.tsx`, `app/staff/(shell)/layout.tsx`, `app/staff/login/page.tsx`, `middleware.ts` were committed to `main` as `c23ca7e` ("Fix staff login: move isAgent check out of Edge middleware into shell layout") — that was the admin-login fix from earlier this session, unrelated to admin-console-shell.

Resolved: `client-onboarding-underwriting` (8-task plan) merged to `main` at `66e56fe` on 2026-07-27 — all tasks implemented and reviewed via subagent-driven-development, worktree/branch removed.
