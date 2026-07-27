-- Staff-only underwriting intake records for client onboarding. Same
-- lockdown pattern as agent_roles/agent_notifications in 0001_init.sql:
-- RLS enabled, zero client-facing policies. This table is only ever
-- touched through the server-only service-role admin client, gated by
-- an app-level isAgent() check.

create table public.underwriting_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'completed')),
  created_by uuid references auth.users(id) on delete set null,

  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  date_of_birth date,
  address text not null default '',
  city text not null default '',
  state text not null default '',
  postal_code text not null default '',

  underwriting jsonb not null default '{}'::jsonb,
  policy_draft jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.underwriting_records enable row level security;
-- No client-facing policies, intentionally -- same pattern as agent_roles/
-- agent_notifications above. This table is only ever touched through the
-- server-only admin client, gated by an app-level isAgent() check.
