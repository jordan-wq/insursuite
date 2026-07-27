# Active Work Ledger

One row per in-flight task. Any session must check this before starting new work (see CLAUDE.md → Workflow → Session coordination), and keep it current: add an entry on start, update phase as work progresses, remove it on merge or abandonment.

| Topic slug | Worktree / branch | Phase | Started | Notes |
|---|---|---|---|---|
| staff-portal-dark-redesign | not yet created (plan calls for `.worktrees/staff-portal-dark-redesign` / `feature/staff-portal-dark-redesign`) | spec + 9-task plan written, each reviewed and fixed across 2-3 passes, both committed to main; ready to execute | 2026-07-27 | Dark-only reskin of the entire `/staff` shell via a `.staff-shell` scoping class: redefine shared design tokens (`--color-text`, `--panel-bg`, etc.) for broad coverage, then targeted overrides for the classes that hardcode colors instead of using tokens (`.eyebrow-row`/`.stat-value`/`.panel-header`/`.sidebar`/`.support-bubble`/form fields/the whole `onboarding.css` family). Spec: `specs/2026-07-27-staff-portal-dark-redesign-design.md`. Plan: `plans/2026-07-27-staff-portal-dark-redesign.md` (9 tasks). Plan review caught real bugs worth knowing if resuming: an unstyled plain `<input>` in the Manage Staff grant form, a hardcoded `border-color` that would've survived the token override, support-bubble classes initially copied from the wrong component's convention (`.consultant`/`.user` here, not `.user`/`.event`), and a low-contrast `.text-button` color affecting client names in the Conversations queue — all fixed in the plan as written. Next step: execute via subagent-driven-development in an isolated worktree. Mockups saved in `.superpowers/brainstorm/68745-1785183068/` (gitignored). |

Resolved: the previously-unclaimed uncommitted changes to `app/login/page.tsx`, `app/page.tsx`, `app/staff/(shell)/layout.tsx`, `app/staff/login/page.tsx`, `middleware.ts` were committed to `main` as `c23ca7e` ("Fix staff login: move isAgent check out of Edge middleware into shell layout") — that was the admin-login fix from earlier this session, unrelated to admin-console-shell.

Resolved: `client-onboarding-underwriting` (8-task plan) merged to `main` at `66e56fe` on 2026-07-27 — all tasks implemented and reviewed via subagent-driven-development, worktree/branch removed.

Resolved: `staff-invite` merged to `main` on 2026-07-27 — implemented, reviewed, blocking issues found and fixed, re-reviewed clean, worktree/branch removed.
