-- Bind a staff invite to the specific Supabase Auth user that
-- inviteUserByEmail creates, not just the invited email address. The
-- callback route grants agent_roles when a code exchange matches a
-- pending invite -- matching on email alone let an unrelated code
-- exchange for a colliding email (e.g. a client-onboarding invite sent
-- to the same address) trigger the same grant. Matching on the exact
-- invited auth user id closes that gap.

alter table public.staff_invites
  add column invited_user_id uuid references auth.users(id) on delete set null;
