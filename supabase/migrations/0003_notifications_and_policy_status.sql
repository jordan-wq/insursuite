-- Premium due date and packet delivery status on policies.
alter table public.user_policies add column if not exists premium_due_date date;
alter table public.user_policies add column if not exists packet_status text not null default 'not_sent';
alter table public.user_policies add constraint user_policies_packet_status_check
  check (packet_status in ('not_sent', 'sent', 'delivered'));

-- Real notifications, replacing the client's static sample list.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null default '',
  read boolean not null default false,
  related_id uuid,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Individuals manage their own notifications"
  on public.notifications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
