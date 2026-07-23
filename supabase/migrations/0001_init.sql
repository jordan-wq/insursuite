-- InsurSuite core schema. client_profiles, user_policies, documents,
-- service_requests, knowledge_entries, chat_messages, and agent_roles
-- already exist in this project (created directly against the database);
-- these `if not exists`/idempotent statements document that live shape so
-- the migration history matches reality and stays reproducible.

create table if not exists public.agent_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'agent',
  created_at timestamptz not null default now()
);

create table if not exists public.client_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  phone text not null default '',
  date_of_birth date,
  onboarding_status text not null default 'in_progress',
  onboarding_step integer not null default 0,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_number text not null,
  policy_type text not null default '',
  carrier text not null default '',
  insured_name text not null default '',
  owner_name text not null default '',
  death_benefit numeric,
  monthly_premium numeric,
  effective_date date,
  beneficiaries text not null default '',
  cash_value numeric,
  source_file_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, policy_number)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_id uuid references public.user_policies(id) on delete set null,
  policy_number text not null default '',
  storage_key text not null unique,
  file_name text not null,
  content_type text not null default 'application/octet-stream',
  file_size integer not null default 0,
  processing_status text not null default 'processed',
  created_at timestamptz not null default now()
);

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null,
  details text not null default '',
  request_data jsonb not null default '{}'::jsonb,
  status text not null default 'new',
  assigned_to uuid references auth.users(id) on delete set null,
  source text not null default 'client',
  priority text not null default 'normal',
  unread_by_agent boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  keywords text not null default '',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  message text not null,
  resolution text not null default 'answered',
  service_request_id uuid references public.service_requests(id) on delete set null,
  created_at timestamptz not null default now()
);

-- New: agent-console notifications. Doesn't exist yet in this project.
create table if not exists public.agent_notifications (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  title text not null,
  message text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.agent_roles enable row level security;
alter table public.client_profiles enable row level security;
alter table public.user_policies enable row level security;
alter table public.documents enable row level security;
alter table public.service_requests enable row level security;
alter table public.knowledge_entries enable row level security;
alter table public.chat_messages enable row level security;
alter table public.agent_notifications enable row level security;

-- Existing tables already carry client-owner policies (select/insert/update
-- scoped to auth.uid() = user_id). knowledge_entries has none yet: the
-- in-app chatbot needs to read active entries on behalf of the signed-in
-- client. agent_roles and agent_notifications intentionally get no
-- client-facing policies -- the agent console reads/writes them through the
-- server-only service-role client, gated by an app-level agent_roles check.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'knowledge_entries'
      and policyname = 'Authenticated users read active knowledge entries'
  ) then
    create policy "Authenticated users read active knowledge entries"
      on public.knowledge_entries for select
      to authenticated
      using (active = true);
  end if;
end $$;
