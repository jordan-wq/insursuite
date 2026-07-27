# Client onboarding / underwriting intake — Design

## Context

Staff currently have no way to bring a brand-new prospect into InsurSuite themselves. Today, an account only ever gets created two ways: the prospect self-signs-up through `/login`'s "Create account" flow, or (once the approved-but-unbuilt staff-invite spec ships) a staff member is invited by email. There's no path for the actual sales/underwriting motion this business runs on: staff on a call with a prospect, capturing health history, lifestyle/risk factors, financials, and beneficiary info — the raw underwriting a policy decision gets made from — plus the specific policy being set up for them, then getting that person into their own account to see it.

This spec adds that flow: a new staff-only "Onboarding" screen where staff fill out an underwriting sheet and policy details for a prospect, and a final action that creates the prospect's account and emails them an invite to set a password and sign in.

There's an existing, related feature worth understanding before reading further: `CallIntakeView` (`app/page.tsx:485-524`, reachable as the "Call Intake" tab inside the *client* portal nav) already lets an agent capture underwriting-style notes (health, driving history, family health history, etc.) live during a call. It writes into `client_profiles.profile` (the same jsonb blob returned to the client themselves by `GET /api/client-profile`), via fields listed in `UNDERWRITING_PROFILE_FIELDS` (`app/profile-fields.ts:65-81`). **This is a real, pre-existing gap**: despite the name, nothing about `UNDERWRITING_PROFILE_FIELDS` actually restricts that data to staff — a client can see their own recorded health notes, medications, nicotine use, and driving history today, because `sanitizeProfile()`'s allow-list (which governs what's accepted on write) doesn't govern what's returned on read, and `GET /api/client-profile` returns the whole `profile` object unfiltered. This spec's underwriting data deliberately does **not** reuse that pattern — see "Data model" below. Fixing `CallIntakeView`'s existing exposure is out of scope here; it's flagged for the user to decide on separately, not silently patched.

## Goals

- New `/staff/onboarding` screen (sidebar entry between Clients and Knowledge) where staff can start and complete a prospect intake.
- Underwriting sheet captures: identity/contact, health history, lifestyle/risk factors, financials, beneficiaries — organized in clear sections, staff/admin-only, **never** visible to the client through any client-facing route.
- Policy details captured in the same flow become a real, normal `user_policies` row — visible to the client like any other policy, once they can log in.
- Work is saved as staff go (survives a closed tab / crashed browser) — nothing is silently lost mid-intake.
- The account itself (Supabase Auth user + `client_profiles` row) and the invite email are only created at one explicit, final "Complete & Invite" action — not the moment staff starts typing.
- Reuses the already-approved staff-invite spec's `inviteUserByEmail` pattern (`docs/superpowers/specs/2026-07-25-staff-invite-design.md`) rather than inventing a second invite mechanism.
- First login lands the new client straight on their normal dashboard — no onboarding wizard, since staff already captured everything that wizard would ask for.

## Non-goals

- No SMS / phone-based login. The original ask was a text message with a login code, but this project has no SMS provider (Twilio) connected yet — deferred. A `phone` field is still captured (useful contact info, and sets up for SMS later without a schema change), but it plays no role in authentication here.
- Not fixing `CallIntakeView`'s existing client-visible-underwriting-data gap (see Context) — flagged, not addressed, in this spec.
- No underwriting-data editing by the client, ever — this is a one-way, staff-authored record.
- No multi-policy intake in one sitting — one policy per onboarding session (matches how `user_policies` already works elsewhere: multiple policies are added as separate rows over time, not batched).

## Data model

### New table: `underwriting_records`

One row per prospect/client, created as soon as staff enters a name and email (the "create early" save point), completed (linked to a real account) only at the final step.

```sql
create table public.underwriting_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'completed')),
  created_by uuid references auth.users(id) on delete set null,

  -- Identity/contact captured during intake. Duplicated into client_profiles at
  -- completion time (see "Complete & Invite" below) rather than read live from here,
  -- so the permanent underwriting record stays historically accurate even if the
  -- client later edits their own profile.
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  date_of_birth date,
  address text not null default '',
  city text not null default '',
  state text not null default '',
  postal_code text not null default '',

  -- Health, lifestyle/risk, financial, and beneficiary answers. A single jsonb
  -- blob (not individual columns) because this section's exact fields are the
  -- part most likely to need tweaking after launch, and nothing here is ever
  -- queried/filtered column-by-column — it's read and written as one unit.
  underwriting jsonb not null default '{}'::jsonb,

  -- The policy being set up, staged here until account creation (user_policies.user_id
  -- is not-null and references auth.users — that row can't exist until the account does).
  -- Copied into a real user_policies row at completion; kept here afterward as an
  -- unmodified record of exactly what was entered at intake time.
  policy_draft jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.underwriting_records enable row level security;
-- RLS enabled with ZERO policies — same pattern as agent_roles/staff_invites
-- (see supabase/migrations/0001_init.sql and the staff-invite spec's rationale).
-- This table is only ever touched through the server-only admin client, gated by
-- an app-level isAgent() check. This is the actual enforcement mechanism for "the
-- client can never see this" — not an application-layer filter that could be
-- forgotten in some future route, an actual RLS wall with no client-facing policy
-- at all. This is deliberately a stronger guarantee than CallIntakeView's existing
-- pattern (see Context).
```

`email` has no uniqueness constraint at the table level (a staff member could theoretically start two drafts for the same email before finishing either) — uniqueness is enforced where it matters, at draft-creation time, by checking `client_profiles` for a collision (see API below). `user_id` is nullable specifically to represent "no account exists yet" during drafting; it's set exactly once, at completion, and never changes after.

## API routes

All routes: `isAgent(user.id)`-gated, admin client, matching every other agent route in this codebase.

### `POST /api/agent/onboarding` — start a draft

Body: `{ firstName, lastName, email, phone?, dateOfBirth? }`. `firstName`, `lastName`, `email` required. Before inserting, checks `client_profiles` for an existing row with that email (`.eq("email", email).maybeSingle()`) — if found, returns `409` with a clear "An account with this email already exists" error rather than letting the conflict surface confusingly at completion time. Inserts a new `underwriting_records` row (`status: 'draft'`, `created_by: user.id`) and returns its `id`.

### `GET /api/agent/onboarding` — list drafts

Returns all rows where `status = 'draft'`, most-recently-updated first (`id, firstName, lastName, email, updatedAt`) — lets staff see and resume in-progress intakes rather than losing track of them. (Completed records are viewable through the Client Detail page instead, once linked — see below — not through this list.)

### `GET /api/agent/onboarding/[id]` — fetch one draft

Full row, for populating the sheet when staff resumes a draft.

### `PATCH /api/agent/onboarding/[id]` — save progress

Body: any subset of the identity columns, `underwriting` (merged shallowly into the existing jsonb, not replaced), `policyDraft` (same). Rejects (`400`) if the record's `status` is already `'completed'` — a completed record is immutable through this route (matches `underwriting_records` being described above as "an unmodified record of exactly what was entered"). Updates `updated_at`.

### `POST /api/agent/onboarding/[id]/complete` — create the account and invite

The one action that actually provisions anything real. Rejects if `status` is already `'completed'`, or if `email`/`firstName`/`lastName` are blank (guards against completing an empty/abandoned draft). Sequence, in order:

1. Re-check `client_profiles` for an email collision (same check as draft-creation — guards the case where someone else's draft or a real signup grabbed the email in the meantime).
2. `admin.auth.admin.inviteUserByEmail(email, { redirectTo: "<origin>/auth/callback?return_to=/" })` — creates the Supabase Auth user and sends Supabase's default invite email. Same call, same reasoning, as the approved staff-invite spec (`return_to=/` here, not `/staff`, since this person is a client, not staff — they land on the normal client dashboard after setting their password).
3. Insert `client_profiles`: `full_name` (first + last), `email`, `phone`, `date_of_birth`, `profile: { address, city, state, postalCode }` (through `sanitizeProfile()`, same as every other profile write — `address`/`city`/`state`/`postalCode` are already in `CORE_PROFILE_FIELDS`, no allow-list change needed), `onboarding_status: 'completed'` (skips the client-side onboarding wizard entirely, per the "straight to dashboard" decision).
4. Insert `user_policies` from `policy_draft` (`policy_number`, `policy_type`, `carrier`, `insured_name`, `owner_name`, `death_benefit`, `monthly_premium`, `effective_date`, `beneficiaries`, `cash_value` — the same columns every other policy row uses).
5. Update the `underwriting_records` row: `status: 'completed'`, `user_id` set to the new Auth user's id.

Steps 2-5 are not wrapped in a database transaction (Supabase Auth admin calls can't participate in one alongside Postgres writes) — if step 3 or 4 fails after step 2 succeeds, the Auth user and invite email already went out with no `client_profiles`/`user_policies` row behind them yet. Treat this as the same class of edge case the staff-invite spec's own "re-invite caveat" describes: worth a clear error message pointing staff to check the Supabase dashboard, not a fully automated rollback. This should be verified/hardened during implementation, not assumed away.

## UI

### `/staff/onboarding` — draft list

A simple list (reusing `Panel`/`beneficiary-list`, same pattern as the Clients directory) of in-progress drafts, each linking to `/staff/onboarding/[id]`, plus a "Start new intake" action that opens a small form (first/last name, email, phone, DOB) and calls `POST /api/agent/onboarding`, then navigates to the new draft.

### `/staff/onboarding/[id]` — the sheet itself

This is the "cleaner underwriting sheet" — explicitly not a copy of `CallIntakeView`'s three-column live-call layout (script questions + sheet + notes side by side). Instead, a single-column, sectioned form matching the field list below, one section visible at a time with a left-side step list (visually similar in spirit to the client-facing `OnboardingFlow`'s `aside`/checklist layout, `app/page.tsx:783`, which is already a "walk through sections, one at a time, save as you go" pattern this codebase has) — reusing that established shape rather than inventing a third form pattern:

1. **Identity & Contact** — first name, last name, date of birth, email, phone, street address, city, state, postal code. *(Per the user's explicit ordering: these come first, before anything else.)*
2. **Health History** — height/weight, tobacco/nicotine use, major medical conditions, current medications, family health history, recent hospitalizations/surgeries.
3. **Lifestyle & Risk** — occupation, hazardous hobbies, driving record, foreign travel/residency, alcohol/substance use.
4. **Financial** — annual income, approximate net worth, existing coverage elsewhere, purpose of coverage.
5. **Beneficiaries** — primary beneficiary (name, relationship, percentage), contingent beneficiary (name, relationship, percentage).
6. **Wrap-up** — missing documents, underwriting notes, recommended next step.
7. **Policy Details** — policy number, policy type, carrier, insured name, owner name, death benefit, monthly premium, effective date, beneficiaries summary, cash value.
8. **Review & Complete** — read-only summary of everything entered, plus the "Complete & Invite" button. Disabled until identity fields (first/last name, email) and at minimum policy type + carrier are filled — staff can leave everything else blank and complete anyway (this is a sales/intake tool, not a compliance gate; leaving fields blank is a judgment call for staff, not something the UI should block). `user_policies.policy_number` is `not null` with no default — if staff leaves it blank, the completion step inserts an empty string (satisfies the constraint; not treated as a validation error). Flag this in the plan as an explicit decision, not something to silently work around.

Each section (1-7) has its own "Save & continue" action, calling `PATCH /api/agent/onboarding/[id]` with just that section's fields — matching `OnboardingFlow`'s existing per-section save pattern, not continuous autosave-on-keystroke (nothing else in this codebase autosaves that aggressively, and it's not needed here: staff explicitly finishing a section and clicking through is the natural unit of "don't lose this").

### Client Detail page — new panel

`app/staff/(shell)/clients/[id]/page.tsx` (already exists, built in the earlier admin-console-shell work) gets a fifth panel, "Underwriting," visible only when a completed `underwriting_records` row exists for that client (`GET /api/agent/clients/[id]` needs to also fetch and return it). Shows the full underwriting sheet read-only — this is where staff reference it after the fact. Explicitly **not** added anywhere in the client-facing portal.

## Verification

- `npm run build`.
- Manual: start a new intake, fill in identity + a few underwriting fields, close the tab, reopen via the draft list, confirm everything saved is still there.
- Manual: complete an intake, confirm the invite email arrives (Supabase default template), confirm accepting it lands the new client directly on their dashboard (no onboarding wizard) with the policy already showing.
- Manual: as that client, inspect the network tab / `GET /api/client-profile` response — confirm no underwriting data (health, lifestyle, financial, beneficiary answers) appears anywhere in it.
- Manual: as staff, open that client's Client Detail page, confirm the new "Underwriting" panel shows everything that was entered.
- Manual: attempt to start a second intake with an email that already has an account — confirm the clear "already exists" error, not a confusing failure at completion time.
