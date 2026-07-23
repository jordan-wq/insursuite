# Policy enrichment + real notifications + mobile install

## Context

InsurSuite's core loop (auth, policies, documents, service requests) is live on Vercel/Supabase. The next push is value-add polish on top of that loop: surface premium due dates, identify carriers visually with a direct link out, notify clients when a policy packet is delivered, and make the portal easy to get onto a phone. None of this changes the data ownership/RLS model already in place — it extends the same tables and patterns.

## Goals

- Show each policy's premium due date, extracted automatically like other OCR fields.
- Show a carrier's real logo + a direct link to their site/portal, for a curated set of carriers.
- Let staff mark a policy's packet as delivered, which notifies the client.
- Replace the fake static Notifications page with a real, database-backed one.
- Give desktop users a QR code + short instructions to install the portal on their phone.

## Non-goals

- No third-party logo API / live domain-guessing (declined — curated directory only).
- No real carrier shipment/tracking integration (declined — staff-marked status only).
- No push notifications (browser/OS-level) — in-app notifications only, for now.

## 1. Premium due date

- `user_policies` gets `premium_due_date date` (nullable, same treatment as `effective_date`).
- Document Intelligence's extraction (`structurePolicyText` in `app/page.tsx`) gets a new regex field alongside carrier/policy number/benefit/premium, feeding the existing scan-review confirmation form — no new UI pattern, just one more field in the form the client already confirms before saving.
- `/api/policies` parses/stores it via the existing `parseDate` helper (`app/lib/money.ts`).
- Display: policy row gets a small countdown chip — "Due in 12 days" (default), amber under 14 days, red and "N days overdue" if past due. Hidden entirely when unset (sample/unscanned policies).

## 2. Carrier directory (logos + direct links)

- New file `app/carriers.ts`: a small static lookup, keyed by a normalized carrier name —
  ```ts
  export const CARRIER_DIRECTORY: Record<string, { logo?: string; url?: string }> = {
    "northwestern mutual": { logo: "/carriers/northwestern-mutual.svg", url: "https://www.northwesternmutual.com" },
    ...
  };
  ```
- Real logo files fetched from each carrier's official press/newsroom assets and saved under `public/carriers/*.svg` (or `.png` where no vector is available) during implementation. Initial set = the carriers already referenced in this codebase's sample data (Northwestern Mutual, Banner Life, Haven Life, RBC Insurance, Mutual of Omaha); more can be added later by dropping in a file and a lookup entry.
- A carrier not in the directory (or before a logo file is sourced) falls back to an initials badge — the same visual pattern already used for people's avatars everywhere else in the app. Never a broken image.
- Shown: policy row icon slot (replaces today's generic type-based Lucide icon for any *real, non-sample* policy with a matched carrier). Sample/demo policies (`policy.isSample`) always keep the current placeholder icon regardless of whether their carrier name happens to match the directory — real branding only applies to a client's actual saved data, consistent with how sample data is visually distinguished everywhere else in the app (`DataModeBanner`, "Example" activity labels). Also shown in the policy detail modal (plus a "Visit [Carrier]" link button next to Manage Policy) and the document row where a document is linked to a policy. Carrier-name matching against `CARRIER_DIRECTORY` is case-insensitive exact match on the trimmed carrier string; no match falls back to the initials badge.
- Sourcing the actual logo files is manual, per-carrier implementation work (pulling from each carrier's official press/newsroom page), not an automated step — expect a handful of image files added directly as part of building this.

## 3. Packet delivery status + agent workflow

- `user_policies` gets `packet_status text not null default 'not_sent'` (`not_sent` / `sent` / `delivered`).
- Agent Console currently only shows the assigned request queue — there's no client-policy view at all. Add a small expandable panel: clicking a client's name in the queue expands to show that client's policies (name, carrier, packet status) with a status dropdown, using the same admin/service-role client pattern the queue already uses (`app/lib/supabase/admin.ts`, gated by the existing `isAgent` check).
- Moving a policy to `delivered` inserts a notification for that policy's owner (see below).

## 4. Real notifications

- New `notifications` table: `id uuid, user_id uuid, type text, title text, message text, read boolean default false, related_policy_id uuid null, created_at timestamptz`. RLS: owner-only select/update (mark read), same pattern as every other client-owned table. Inserts happen via the admin client from trigger points (agent actions), same as `agent_notifications` today.
- `NotificationsView` (currently a hardcoded array) becomes a real `/api/notifications` GET (list) + PATCH (mark read/mark all read), replacing the static list — same shape, real data.
- The two other hardcoded "3" unread indicators in `app/page.tsx` (the sidebar nav badge on the Notifications item, and the header bell button's count) must be driven by the same real unread count — not left as static placeholders once the list itself is real.
- First two triggers: packet delivered (above), and premium-due-soon (a lightweight check — e.g. computed when the client-profile/dashboard data loads — no cron/background job needed yet). Dedup rule: before inserting a premium-due-soon notification, skip if an unread notification of that type already exists for that policy — this is a repeated-load check, not a scheduled job, so without this guard the same reminder would be inserted on every dashboard visit.

## 5. QR code + mobile install tutorial

- Settings gets a new "Get InsurSuite on your phone" panel: a QR code (generated client-side with the `qrcode` package, encoding `window.location.origin` — works correctly in any environment without hardcoding a URL) plus two short numbered tutorials (iOS Safari: Share → Add to Home Screen; Android Chrome: menu → Install app / Add to Home screen).
- Add a minimal `public/manifest.json` (name, short_name, start_url, display: standalone, theme_color, and the existing `favicon.svg` as its icon) linked from `app/layout.tsx`'s metadata. This is a small addition — no new icon assets needed — but it's what makes Android's install prompt show the real name/icon instead of a bare bookmark, which is the difference between "a bookmark" and "feels like the app."

## Verification

- `npm run build` after each numbered section.
- Manual pass in the browser preview: scan a document and confirm premium date appears in the review form and saves; confirm a known carrier shows its real logo + link and an unknown one shows initials; mark a policy delivered as an agent and confirm the client sees a real notification; scan the Settings QR code / read the instructions for sanity.
