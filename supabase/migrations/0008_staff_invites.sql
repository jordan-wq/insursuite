-- Pending staff invites for people who don't have an account yet. Same
-- lockdown pattern as agent_roles/agent_notifications in 0001_init.sql:
-- RLS enabled, zero client-facing policies. This table is only ever
-- touched through the server-only service-role admin client, gated by
-- an app-level isAgent() check (see app/auth/callback/route.ts for the
-- one narrow exception, documented there).

create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index staff_invites_pending_email_idx
  on public.staff_invites (lower(email)) where status = 'pending';

alter table public.staff_invites enable row level security;
-- No client-facing policies, intentionally -- same pattern as agent_roles/
-- agent_notifications above. This table is only ever touched through the
-- server-only admin client, gated by an app-level isAgent() check.
