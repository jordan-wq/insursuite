# MVP Launch Checklist — Design

## Context

InsurSuite is about to onboard its first real clients (private beta, under 10 clients, 1-2 agents — clients invited/onboarded directly, no open public signup). The Cloudflare→Vercel/Supabase migration, policy enrichment, staff shell, agent-client messaging, carrier logos, and a security review are all shipped and live on `main`.

This spec covers the last gaps found in an MVP-readiness audit before real client PII starts flowing through the app. Scope is deliberately narrow: only issues that either mislead a real client or silently discard their real data. Lower-priority items (Supabase auth email branding, staff account provisioning, expanding the Settings state dropdown beyond TX/OK/FL, CSP headers, monitoring/error tracking) were surfaced and explicitly deferred — the client base is small enough (<10) that these aren't launch-blocking, and can be picked up later without a design cycle.

## Scope

### 1. Family & Household — wire to real data

`FamilyView` (`app/page.tsx`) is currently the only client-facing nav view still using 100%-static markup: every client who opens "Family & Household" sees a hardcoded "Jordan McNutt" / "Alex Smith" household with fabricated dollar amounts and policy counts, regardless of who is actually signed in. Every other view (`Dashboard`, `PoliciesView`, `CoverageView`, the beneficiary modal) already reads from real `profile`/`policyData`/`user` props with honest empty states — `FamilyView` never got that treatment.

**Fix:** give `FamilyView` the same props as its siblings (`profile: StoredProfile | null`, `policyData: Policy[]`, `user: PortalUser | null`) and rebuild its content from real data:
- Primary person card: real user's name (from `profile.fullName || user.displayName`), initials, real policy count (`policyData.length`), and real total coverage (sum of parsed `policyData[].benefit` values, reusing the existing `money()`/`currency()` helpers already used elsewhere in this file).
- Beneficiary card: `profile.profile.primaryBeneficiary` / `primaryRelationship` / `primaryPercentage` — note these live one level deeper than `profile` itself, inside the nested `profile.profile` jsonb bag (same access pattern the beneficiary modal already uses at `app/page.tsx:996`, e.g. `storedProfile?.profile?.primaryBeneficiary`). `profile.fullName`/`profile.phone` are the only two fields that ARE top-level on `StoredProfile`. When the beneficiary fields are unset, show the same honest empty state pattern already used in the beneficiary modal ("No beneficiary on file — add one from your protection profile") rather than inventing a stat like "4 policies named" that the app has no way to actually compute (policies don't carry per-policy beneficiary assignment).
- Household readiness panel: replace the hardcoded "Alex Smith · Updated Jun 29, 2026" emergency-contact row with `profile.profile.emergencyContactName`/`emergencyContactPhone`, empty state "Emergency contact not on file" when unset. Replace the dependents row with a real count from `profile.profile.dependentsCount` when present.
- "Add member" / "View profile" buttons keep their existing `notify()` placeholder behavior (no household-editing UI exists yet and building one is out of scope) — only the *displayed* data changes from fake to real.

No backend or schema changes: all fields already exist in the `profile` jsonb blob and are already fetched into `storedProfile` at the top of `app/page.tsx`. This is purely a rewire of `FamilyView` plus threading 3 already-existing props through the one `SectionContent` call site that renders it (`app/page.tsx:575`).

### 2. Terms of Service + Privacy Policy pages

No `/terms` or `/privacy` route exists anywhere in the app, and the signup consent checkbox in `AccountCreation` references "portal terms" with no link. Real client PII (name, DOB, income range, beneficiary names, uploaded policy documents) is about to start flowing through the app, so a real (if simple) disclosure needs to exist before that happens.

**Fix:** two new static routes, `app/terms/page.tsx` and `app/privacy/page.tsx`, styled with the existing `Panel`/`ViewHeading` components so they match the app's visual language rather than looking like an unstyled legal dump. Content is plain-English and honest, not a lawyer-drafted contract:
- **Privacy**: what's collected (name, contact info, DOB, income range, beneficiary/emergency-contact info, uploaded documents), why (so your agent can service your policies), where it lives (Supabase, access-controlled, not sold to third parties), how to request deletion (contact your agent).
- **Terms**: this is a client portal for managing insurance policy information with your agent, not a substitute for your actual insurance contracts; acceptable use; account security responsibility (don't share your password); InsurSuite/your agency's liability is limited to the portal service itself.
- Both pages get a footer note: "This is a plain-language summary appropriate for early access. It is not a substitute for a formal legal review." — honest about the beta status without undermining the disclosure.

**Auth gate:** `middleware.ts`'s `isPublicPath()` (lines 19-31) is an explicit allow-list that currently does NOT include `/terms` or `/privacy` — without adding them, a signed-out visitor hitting either URL gets redirected to `/login` instead of seeing the page. Add `pathname === "/terms" || pathname === "/privacy"` to that allow-list as part of this task.

**Linking:** the `AccountCreation` consent checkbox copy gets real `<a href="/terms">`/`<a href="/privacy">` links. No footer exists anywhere in the app today (confirmed — zero `<footer>` elements in `app/page.tsx`, `app/login/page.tsx`, or `app/landing/page.tsx`), so adding one is new UI, not extending something existing: a small footer with both links gets added to `SignInGate` (the signed-out view rendered at `/`, inside `app/page.tsx`) and to `app/login/page.tsx`. The separate `app/landing/page.tsx` route (`/landing`) is a near-duplicate marketing page — out of scope for this pass; skip it.

### 3. Error / 404 pages

No `app/error.tsx` or `app/not-found.tsx` exists, so any runtime error or bad URL currently shows Next.js's raw default screen to a real client — jarring and unpolished, and on `error.tsx` specifically, potentially leaks a raw error message/stack trace.

**Fix:**
- `app/not-found.tsx`: styled to match the app (reuse existing dark/gold visual language, `Panel` component), a short "Page not found" message, and a link back to `/` (which redirects to the dashboard or login as appropriate via existing routing).
- `app/error.tsx`: client component error boundary (`"use client"`, receives `error`/`reset` props per Next.js convention). Shows a friendly "Something went wrong" message — never the raw `error.message` — with a "Try again" button calling `reset()` and a link back to `/`. Logs `error` to `console.error` for visibility in Vercel's runtime logs (no new monitoring service — not justified at this client count).

Both live at the app root, so they apply across the whole tree including `/staff`. No nested per-route-group error/not-found files are needed at this scope.

### 4. Settings — make Save actually save

Two fake-persistence bugs in `SettingsView` (`app/page.tsx:550-563`):
- The profile form's submit handler calls `notify("Profile settings saved.")` and does nothing else — name/phone edits are silently discarded.
- The 4 notification-preference toggles (`email`, `sms`, `policy`, `marketing`) live in local `useState` only, seeded with hardcoded defaults (`true, true, true, false`) every page load — any change is lost on refresh.

**Fix:**
- `saveProfilePatch` (`app/page.tsx:892-910`, the function backing the `onSaveProfile` prop) always sends `storedProfile.fullName`/`storedProfile.phone` as the top-level `fullName`/`phone` fields in its POST body (**not PATCH** — `/api/client-profile` only exports `GET`/`POST`, no PATCH handler exists) and only ever merges its `patch` argument into the *nested* `profile` jsonb object. Calling it as `onSaveProfile({ fullName, phone })` would land those keys inside the nested blob instead of the top-level fields the profile form actually edits — and `fullName`/`phone` aren't in the nested allow-list (`ALLOWED_PROFILE_FIELDS` in `app/profile-fields.ts`) anyway, so `sanitizeProfile()` would silently strip them. Net effect of doing it that way: still broken.
  Real fix: give `saveProfilePatch` a second optional parameter for top-level account fields, e.g. `saveProfilePatch(patch: Record<string, string | boolean>, accountPatch: { fullName?: string; phone?: string } = {})`, and use `accountPatch.fullName ?? storedProfile.fullName` / `accountPatch.phone ?? storedProfile.phone` when building the request body. Existing callers (like `CallIntakeView`, which calls the prop as `onSave`) keep working unchanged since the new parameter defaults to `{}`. `SettingsView`'s form submit calls `onSaveProfile({}, { fullName, phone })`.
- Add 4 new keys to the profile allow-list in `sanitizeProfile()` (`app/profile-fields.ts`): `notifyEmail`, `notifySms`, `notifyPolicy`, `notifyMarketing` (booleans). `SettingsView`'s toggle state initializes from `profile.profile.notify*` (defaulting to today's `true/true/true/false` when unset, so existing accounts see no change), and each toggle click calls `onSaveProfile({ [key]: newValue })` — the nested-patch path, which already works correctly today (this part of `saveProfilePatch` is not the buggy part). Note there's no existing precedent in this codebase for saving a single field immediately on toggle (the one current consumer, `CallIntakeView`, batches edits behind an explicit Save button) — this is a new small pattern, not a reuse of an existing one, but the underlying merge logic supports it without changes.

## Out of scope (flagged, not built)

- Supabase auth email template branding (signup confirmation / password reset emails may still look like raw Supabase defaults) — worth a look before a larger client batch, not blocking for <10 known clients.
- Confirming real agent accounts exist in `agent_roles` — operational task for the user, not a code change.
- Expanding the Settings state dropdown beyond TX/OK/FL.
- CSP/security headers (flagged in the prior security review, general hardening not a demonstrated vulnerability).
- Monitoring/error tracking beyond Vercel's built-in logs — not justified at this scale.
- Building real household-editing UI (the "Add member" button stays a placeholder) — no design exists yet for what fields that would even collect beyond what onboarding already gathers.
- The deferred "version control" feature from an earlier session — separate, not-yet-scoped spec.

## Verification

- `npm run build` after implementation (type-check + static generation).
- Manual browser pass: sign in as a real (non-sample) test account with a saved profile → open Family & Household, confirm it shows that account's real name/beneficiary/emergency-contact data with correct empty states for unset fields, not the old hardcoded Jordan/Alex data.
- Visit `/terms` and `/privacy` directly, confirm they render and are linked from signup + footer.
- Trigger a 404 (bad URL) and a thrown error (temporarily, in dev) to confirm the styled pages render instead of Next's defaults, then confirm the temporary error trigger is removed.
- In Settings, edit name/phone and reload — confirm the change persisted. Toggle a notification preference and reload — confirm it persisted.
