# Staff Invite-by-Email — Design

## Context

The existing "Manage Staff" page (`app/staff/(shell)/team/page.tsx`, backed by `app/api/staff/team/route.ts`) already lets an agent grant/revoke staff (`agent_roles`) access by email — but only for people who've already signed up. If the email doesn't match an existing `client_profiles` row, granting fails with "No account found for that email — they need to sign up first," and there's no way to actually send that person anything. Today's real-world workaround (an agent has to separately tell the person to go sign up, then remember to come back and grant them) is exactly the friction this closes.

This came up directly from the ongoing MVP-completion work — Task 6 of `docs/superpowers/plans/2026-07-25-mvp-completion.md` needed real agent accounts provisioned, and doing that by hand (direct SQL via the Supabase Management API) surfaced that this should just be a self-serve feature instead of something done manually every time.

## Scope

### 1. New table: `staff_invites`

```sql
create table if not exists public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index if not exists staff_invites_pending_email_idx
  on public.staff_invites (lower(email)) where status = 'pending';
```

The partial unique index prevents inviting the same still-pending email twice (re-inviting after a cancel is fine — a new row is created since the old one is `cancelled`, not `pending`). No RLS policies needed — like `agent_roles`/`agent_notifications`, this table is only ever touched through the server-only admin client, gated by an app-level `isAgent()` check, matching the existing pattern documented in `supabase/migrations/0001_init.sql`.

### 2. `POST /api/staff/team` — try instant grant, fall back to invite

Current behavior (`app/api/staff/team/route.ts`): looks up `client_profiles` by email; 404s with "they need to sign up first" if not found.

New behavior: same lookup first — if a `client_profiles` row exists, grant `agent_roles` immediately exactly as today (unchanged). If it doesn't exist, instead of erroring:
1. Call `admin.auth.admin.inviteUserByEmail(email, { redirectTo: "<origin>/auth/callback?return_to=/staff" })` — this creates the Supabase Auth user and sends Supabase's built-in branded invite email with a link to set a password. (`createAdminSupabase()` already returns a standard `@supabase/supabase-js` client constructed with the service-role key, so the `auth.admin` namespace is available with no new client/dependency.)
2. Insert a `staff_invites` row (`email`, `invited_by: user.id`, `status: 'pending'`).
3. Return `201` with a response the frontend can distinguish from an instant grant (e.g. `{ invited: true }` vs today's `{ ok: true }`), so the UI can show "Invite sent" instead of "Access granted."

If `inviteUserByEmail` itself fails (e.g. malformed email, Supabase-side error), surface that error same as any other failed save — no `staff_invites` row gets written.

### 3. `GET /api/staff/team` — include pending invites

Add a second query for `staff_invites` where `status = 'pending'`, returned alongside the existing `staff` array as `pendingInvites: [{ id, email, createdAt }]`.

### 4. New endpoint: `DELETE /api/staff/invites/[id]`

Same `isAgent()` gate as every other staff route. Sets the matching `staff_invites` row's `status` to `'cancelled'` (soft — don't hard-delete, keeps a record). This does **not** delete the underlying Supabase Auth user created by `inviteUserByEmail` — if that person later clicks the stale invite link, `/auth/callback` (see below) simply won't find a pending invite for their email and they'll land as a normal signed-in user with no staff access, which is the safe/correct outcome. Deleting Auth users from a cancel action is unnecessary risk for no real benefit here.

### 5. `app/auth/callback/route.ts` — grant on accept

Current behavior: exchanges the `code` query param for a session, redirects to `return_to`. No awareness of staff invites.

New behavior: after `exchangeCodeForSession` succeeds, look up the now-authenticated user's email against `staff_invites` where `status = 'pending'` (case-insensitive match, matching the partial unique index). If found:
- Insert into `agent_roles` for this `user.id` (same insert the instant-grant path already does).
- Update the `staff_invites` row: `status = 'accepted'`, `accepted_at = now()`.
- This makes `agent_roles` membership happen only once the invitee has actually completed signup (set a password via the invite link) and their code exchange succeeds — never earlier. Matches the explicit requirement that access isn't provisioned until signup is actually complete.

This lookup only needs to run when `code` was present and exchanged successfully (i.e., on every real auth callback, invite or not) — it's a cheap extra query, not worth gating behind an extra flag, and correctly no-ops for the vast majority of callbacks (password resets, normal email confirmations) that won't match any pending invite.

### 6. `ManageStaffPage` UI (`app/staff/(shell)/team/page.tsx`)

- The existing grant form's success handling now also handles the `{ invited: true }` response shape — show "Invite sent to {email}" instead of "Access granted" (both just clear the field and reload the list).
- New "Pending invites" panel below "Current staff", listing `pendingInvites` (email + "Invited {date}") each with a "Cancel" button calling the new `DELETE /api/staff/invites/[id]`.

## Out of scope

- Custom-branded invite email content — reuses Supabase's default invite email template (the same one the user is independently checking/branding as a separate task). Not building custom email sending.
- Resending/expiring invites automatically. If an invite goes stale, cancel it and send a new one — no auto-expiry logic.
- Any change to the existing flat trust model (any staff member can invite/grant/revoke any other) — unchanged, matches an earlier explicit product decision from the security review.

## Verification

- `npm run build`.
- Manual: invite a brand-new email from Manage Staff, confirm a `staff_invites` row appears as pending in the UI, confirm the invite email arrives (Supabase default template) with a working set-password link, confirm accepting it lands the person in `/staff` with access already granted and the invite flips to accepted (no longer listed as pending).
- Manual: invite, then cancel before acceptance — confirm it disappears from pending, and confirm clicking the (now-stale) invite link afterward does NOT grant access.
- Manual: grant access to an email that already has a client account — confirm this still works instantly exactly as it does today (unchanged code path).
