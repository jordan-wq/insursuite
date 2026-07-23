-- InsurSuite core schema: client profiles, policies, documents, service
-- requests, agent notifications, chatbot knowledge base, and chat history.
-- All client-owned tables key on auth.uid() and are protected by RLS.

create table if not exists public.client_profiles (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  date_of_birth text not null default '',
  onboarding_status text not null default 'in_progress',
  onboarding_step integer not null default 0,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_policies (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_number text not null,
  policy_type text not null default '',
  carrier text not null default '',
  insured_name text not null default '',
  owner_name text not null default '',
  death_benefit text not null default '',
  monthly_premium text not null default '',
  effective_date text not null default '',
  beneficiaries text not null default '',
  cash_value text not null default '',
  source_file_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, policy_number)
);

create table if not exists public.documents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_key text not null unique,
  file_name text not null,
  content_type text not null default 'application/octet-stream',
  file_size integer not null default 0,
  policy_number text not null default '',
  processing_status text not null default 'processed',
  created_at timestamptz not null default now()
);

create table if not exists public.service_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null,
  details text not null default '',
  request_data jsonb not null default '{}'::jsonb,
  status text not null default 'new',
  assigned_to text not null default '',
  source text not null default 'client',
  priority text not null default 'normal',
  unread_by_agent boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_notifications (
  id bigint generated always as identity primary key,
  agent_email text not null,
  client_email text not null,
  service_request_id bigint not null references public.service_requests(id) on delete cascade,
  title text not null,
  message text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_entries (
  id bigint generated always as identity primary key,
  question text not null,
  answer text not null,
  keywords text not null default '',
  active boolean not null default true,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  message text not null,
  resolution text not null default 'answered',
  service_request_id bigint references public.service_requests(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.client_profiles enable row level security;
alter table public.user_policies enable row level security;
alter table public.documents enable row level security;
alter table public.service_requests enable row level security;
alter table public.agent_notifications enable row level security;
alter table public.knowledge_entries enable row level security;
alter table public.chat_messages enable row level security;

-- Clients can only ever see and write their own rows. Agent-console access
-- (cross-user reads/writes on service_requests, agent_notifications, and
-- knowledge_entries writes) goes through the server-only service-role
-- client, after the app layer confirms the caller's email is in
-- AGENT_EMAILS -- so no staff-facing RLS policies are needed here.

create policy "Individuals manage their own profile"
  on public.client_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Individuals manage their own policies"
  on public.user_policies for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Individuals manage their own documents"
  on public.documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Individuals manage their own service requests"
  on public.service_requests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Individuals manage their own chat messages"
  on public.chat_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The in-app chatbot matches against active knowledge entries on behalf of
-- the signed-in client, so any authenticated user may read active entries.
create policy "Authenticated users read active knowledge entries"
  on public.knowledge_entries for select
  to authenticated
  using (active = true);
