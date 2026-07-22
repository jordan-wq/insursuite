# Codex handoff

## Current production application

- Public URL: https://insursuite.jmupnxt.chatgpt.site
- Hosting project: `appgprj_6a5ff547bb4c8191bcedd8a1f28e7de1`
- Runtime bindings: D1 as `DB`, R2 as `BUCKET`
- Required runtime variable: `AGENT_EMAILS` as a comma-separated staff allowlist

The repository contains source and migrations only. Production D1 records, R2 objects, authentication state, and environment-variable values are intentionally not part of the repository.

## First Codex task

Use this initial prompt after connecting the repository to a Codex environment:

> Read AGENTS.md and CODEX_HANDOFF.md. Inspect the repository without changing files. Run lint and build, review authentication and data ownership boundaries, summarize the architecture, and identify the three highest-risk production gaps.

## Local setup

1. Install Node.js 22.13 or newer on Linux.
2. Run `npm run install:ci`.
3. Run `npm run lint` and `npm run build`.
4. Use `npm run dev` for local work. The Vite configuration simulates declared bindings locally.

## Deployment notes

Production is deployed through OpenAI Sites. A normal GitHub clone does not contain live D1/R2 data or Sites credentials. Keep `.openai/hosting.json` intact so Sites recognizes the existing project and bindings. Apply generated Drizzle migrations in order during deployment.

## Suggested next milestones

1. Add authenticated document preview/download with ownership checks.
2. Add outbound ticket alerts through a selected provider while retaining in-app notifications.
3. Connect a model-backed chatbot through a server-side credential and retain retrieval grounding, audit logs, and automatic human escalation.
4. Add staff administration, round-robin availability, service-level timers, and reassignment controls.
5. Add data export, correction, deletion, retention, and consent-history workflows.

