create table public.service_request_messages (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('client', 'agent')),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.service_request_messages enable row level security;

create policy "Clients manage messages on their own requests"
  on public.service_request_messages for all
  using (exists (select 1 from public.service_requests sr where sr.id = service_request_id and sr.user_id = auth.uid()))
  with check (exists (select 1 from public.service_requests sr where sr.id = service_request_id and sr.user_id = auth.uid()));
