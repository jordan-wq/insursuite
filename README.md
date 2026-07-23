# InsurSuite

InsurSuite is a persistent insurance client portal with guided onboarding, AI-assisted document extraction, policy organization, structured service requests, chatbot-to-human escalation, and an agent service console.

Read `AGENTS.md` before making changes.

Next.js app deployed on Vercel, backed by Supabase (Auth, Postgres, Storage).

## Prerequisites

- Node.js `>=22.13.0`

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable key.
3. `npm run dev`

## Data layer

- `supabase/migrations/` — schema and Row Level Security policies for `client_profiles`, `user_policies`, `documents`, `service_requests`, `agent_notifications`, `knowledge_entries`, and `chat_messages`, plus the `documents` storage bucket. Apply with `npx supabase db push` after `npx supabase link --project-ref <ref>`.
- Every client-owned table is keyed on `auth.uid()` and protected by RLS: a signed-in user can only read/write their own rows.
- The agent console (`/api/agent/queue`, `/api/knowledge`) uses a server-only service-role client (`SUPABASE_SERVICE_ROLE_KEY`) to read and update across users, gated by the `AGENT_EMAILS` allowlist checked in `app/service-routing.ts` before any query runs.

## Commands

- `npm run dev` — start the local dev server
- `npm run build` — production build
- `npm run start` — run the built app
- `npm test` — build-only correctness check
- `npm run lint` — eslint

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
