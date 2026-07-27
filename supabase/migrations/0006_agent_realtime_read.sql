do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'service_requests'
      and policyname = 'Agents read all service requests'
  ) then
    create policy "Agents read all service requests"
      on public.service_requests for select
      using (exists (select 1 from public.agent_roles ar where ar.user_id = auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'service_request_messages'
      and policyname = 'Agents read all service request messages'
  ) then
    create policy "Agents read all service request messages"
      on public.service_request_messages for select
      using (exists (select 1 from public.agent_roles ar where ar.user_id = auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'service_requests'
  ) then
    alter publication supabase_realtime add table public.service_requests;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'service_request_messages'
  ) then
    alter publication supabase_realtime add table public.service_request_messages;
  end if;
end $$;
