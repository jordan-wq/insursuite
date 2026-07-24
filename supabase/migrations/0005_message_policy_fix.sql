-- The original policy granted clients ALL (select/insert/update/delete) on
-- their own request's messages with no check on sender_id/sender_role,
-- letting a client call the Supabase REST API directly to forge a fake
-- "agent" reply, or edit/delete a real agent's past message. Replace with
-- select (any message on an owned request) + insert-only (must be posting
-- as themselves, as a client).

drop policy "Clients manage messages on their own requests" on public.service_request_messages;

create policy "Clients view messages on their own requests"
  on public.service_request_messages for select
  using (exists (select 1 from public.service_requests sr where sr.id = service_request_id and sr.user_id = auth.uid()));

create policy "Clients post their own messages on their own requests"
  on public.service_request_messages for insert
  with check (
    sender_id = auth.uid()
    and sender_role = 'client'
    and exists (select 1 from public.service_requests sr where sr.id = service_request_id and sr.user_id = auth.uid())
  );
