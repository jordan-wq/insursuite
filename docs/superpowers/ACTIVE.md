# Active Work Ledger

One row per in-flight task. Any session must check this before starting new work (see CLAUDE.md → Workflow → Session coordination), and keep it current: add an entry on start, update phase as work progresses, remove it on merge or abandonment.

| Topic slug | Worktree / branch | Phase | Started | Notes |
|---|---|---|---|---|
| staff-portal-dark-redesign | none yet (main) | spec written, reviewed (2 review passes), and committed; awaiting user's read-through before planning | 2026-07-27 | Dark-only visual redesign of `/staff` shell (elevated-dashboard style: gradient accent tile, elevated cards, grouped sidebar nav). Direction + isolation strategy (new `.staff-shell` wrapper class, all-new scoped CSS, zero edits to shared `.app-shell`/`.sidebar`/`.panel`/`:root` tokens the client-portal redesign also depends on) both confirmed by user. Spec at `specs/2026-07-27-staff-portal-dark-redesign-design.md` — spec-document-reviewer caught and fixed a materially incomplete shared-class scope list across two passes (missed `.view-heading`, `.panel-header`, `.support-bubble`, the whole `onboarding.css` component family, and an unscoped `.stat-card::before` pseudo-element). Next step: user reviews the spec file, then writing-plans. Mockups saved in `.superpowers/brainstorm/68745-1785183068/` (gitignored). |

Resolved: the previously-unclaimed uncommitted changes to `app/login/page.tsx`, `app/page.tsx`, `app/staff/(shell)/layout.tsx`, `app/staff/login/page.tsx`, `middleware.ts` were committed to `main` as `c23ca7e` ("Fix staff login: move isAgent check out of Edge middleware into shell layout") — that was the admin-login fix from earlier this session, unrelated to admin-console-shell.

Resolved: `client-onboarding-underwriting` (8-task plan) merged to `main` at `66e56fe` on 2026-07-27 — all tasks implemented and reviewed via subagent-driven-development, worktree/branch removed.

Resolved: `staff-invite` merged to `main` on 2026-07-27 — implemented, reviewed, blocking issues found and fixed, re-reviewed clean, worktree/branch removed.
