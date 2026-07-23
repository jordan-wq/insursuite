# InsurSuite repository guidance

## Product

InsurSuite is an authenticated insurance client portal built with React and Next.js, deployed on Vercel, backed by Supabase (Auth, Postgres, Storage). It includes onboarding, document extraction, policy organization, a trained-answer chatbot, human escalation, structured service requests, and an agent console.

## Commands

- Install: `npm install`
- Lint: `npm run lint`
- Build: `npm run build`
- Test: `npm test`
- Push schema changes: edit `supabase/migrations/`, then `npx supabase db push`

## Architecture

- `app/page.tsx`: client portal UI and workflows
- `app/api/`: authenticated API routes, all backed by Supabase
- `app/auth.ts`: Supabase session helpers (`getCurrentUser`, `requireCurrentUser`)
- `app/service-routing.ts`: agent authorization (`AGENT_EMAILS` allowlist) and assignment
- `app/lib/supabase/{client,server,admin,config}.ts`: browser, server (session-scoped, RLS-enforced), and admin (service-role, RLS-bypassing) Supabase clients
- `supabase/migrations/`: ordered schema and RLS/storage policy migrations
- Supabase Storage bucket `documents`: uploaded client documents, private, per-user folder policies

## Security and data rules

- Treat insurance, household, beneficiary, and financial information as sensitive.
- Client-owned tables (profiles, policies, documents, service requests, chat) are protected by Row Level Security keyed on `auth.uid()` — never bypass this with the admin client except for gated agent-console reads/writes.
- The admin (service-role) client must only be used after an explicit `isAgent(user.email)` check. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Keep server-side allowlists and length limits on all intake fields.
- Do not log document contents, policy data, personal data, credentials, or secrets.
- Never commit `.env` files, API keys, production credentials, client documents, database exports, or storage-bucket contents.
- Do not collect SSNs, passwords, bank credentials, or complete medical records through general portal forms.
- Uploaded files require type and size validation; extracted policy fields require human confirmation before persistence.

## Insurance safety

- Clearly distinguish sample data, client-entered data, document-extracted data, and carrier-verified data.
- Do not present portal completeness scores as licensed coverage recommendations.
- AI responses are informational and must escalate carrier changes, claims, payment risk, legal questions, financial recommendations, and uncertain answers.
- Saving a beneficiary or policy change request does not change the carrier contract. State this in relevant UI.
- Preserve the human handoff path when modifying chatbot logic.

## Working conventions

- Preserve unrelated user changes.
- Prefer small, reviewable commits.
- Update schema, migrations, APIs, UI, and agent views together when adding a collected field.
- Every collected field must have a defined downstream use or be removed.
- Maintain visible sample/live labels and never silently combine sample records with client records.
