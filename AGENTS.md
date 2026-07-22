# InsurSuite repository guidance

## Product

InsurSuite is an authenticated insurance client portal built with React, Next.js-compatible Vinext, Cloudflare D1, and R2. It includes onboarding, document extraction, policy organization, a trained-answer chatbot, human escalation, structured service requests, and an agent console.

## Commands

- Install: `npm run install:ci`
- Lint: `npm run lint`
- Build: `npm run build`
- Test: `npm test`
- Generate migrations after editing `db/schema.ts`: `npm run db:generate`

Run lint and build before handing off a change. Never edit generated migration history manually unless repairing a verified migration problem.

## Architecture

- `app/page.tsx`: client portal UI and workflows
- `app/api/`: authenticated API routes
- `app/chatgpt-auth.ts`: Sign in with ChatGPT identity helpers
- `app/service-routing.ts`: agent authorization and assignment
- `db/schema.ts`: D1 schema
- `drizzle/`: ordered database migrations
- `.openai/hosting.json`: Sites project plus logical D1/R2 bindings
- R2 binding `BUCKET`: uploaded client documents
- D1 binding `DB`: profiles, policies, tickets, chatbot knowledge, and messages

## Security and data rules

- Treat insurance, household, beneficiary, and financial information as sensitive.
- Enforce authentication and ownership on every server-side read or write.
- Never trust email, user ID, assignment, role, or ownership sent by the browser.
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

