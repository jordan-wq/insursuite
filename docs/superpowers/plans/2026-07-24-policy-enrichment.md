# Policy Enrichment + Real Notifications + Mobile Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add premium due dates, a curated carrier logo/link directory, staff-marked packet delivery, a real database-backed notifications system, and a QR-code mobile-install panel to InsurSuite.

**Architecture:** Extends the existing Next.js App Router + Supabase (Postgres/RLS/Storage) stack in place — no new services. All five sub-features share one Postgres migration. `app/page.tsx` remains the single client-shell component; new logic is added as new functions/sections in that file and two new small modules (`app/carriers.ts`, `app/lib/supabase` stays as-is).

**Tech Stack:** Next.js 16 (App Router, Turbopack), Supabase (Postgres + Auth + Storage), TypeScript, no CSS framework beyond the existing hand-written `app/*.css`. New dependency: `qrcode` (client-side QR generation).

**Verification convention:** This repo has no unit-test framework (`package.json`'s `"test"` script is literally `next build` — a type-check + build, nothing more). Every task's "test" step is therefore `npm run build` (must exit 0, no TypeScript errors) plus a manual browser-preview check where the task changes visible behavior. Do not introduce Jest/Vitest — follow the existing convention.

**Spec:** `docs/superpowers/specs/2026-07-23-policy-enrichment-design.md`

---

### Task 1: Migration — premium date, packet status, notifications table

**Files:**
- Create: `supabase/migrations/0003_notifications_and_policy_status.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Push the migration**

Run: `npx supabase db push` (from the repo root; requires `SUPABASE_ACCESS_TOKEN` set in the environment — see prior session notes / ask the user for it if not already exported)
Expected: `Applying migration 0003_notifications_and_policy_status.sql...` then `Finished supabase db push.` with no errors. If `user_policies` already has a `packet_status`-shaped column from a prior partial run, the `add column if not exists` guards make this safe to re-run.

- [ ] **Step 3: Verify the new shape**

Run (via curl against the Management API, same pattern used earlier this session):
```bash
curl -s -X POST "https://amxyofwhxrsdorzvfzjz.supabase.co/rest/v1/" -H "apikey: <anon key>" > /dev/null  # sanity connectivity check only if curl to Management API is unavailable
```
Or simpler — from the repo, run: `npx supabase migration list` and confirm `0003_notifications_and_policy_status` shows as applied both locally and remotely.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_notifications_and_policy_status.sql
git commit -m "Add premium date, packet status, and notifications table"
```

---

### Task 2: Money/date helpers already reusable — no new helper needed

**Files:** none (verification-only task, keeps the plan honest about what's reused)

- [ ] **Step 1: Confirm `parseDate` in `app/lib/money.ts` already does what premium-date storage needs** (it does — it's used for `effective_date` today). No code change in this task; proceed to Task 3.

---

### Task 3: Extend Document Intelligence extraction with premium due date

**Files:**
- Modify: `app/page.tsx:81-92` (`ExtractedPolicy` type)
- Modify: `app/page.tsx:193-207` (`structurePolicyText`)
- Modify: `app/page.tsx` scan-review form (search for `updateExtracted("effectiveDate"` — the review form field for effective date) to add a matching field for premium due date
- Modify: `app/page.tsx:852` (`saveScannedPolicy`'s optimistic `newPolicy` object)
- Modify: `app/api/policies/route.ts` (insert/upsert payload)
- Modify: `app/api/client-profile/route.ts` (its own separate `POLICY_SELECT` constant — **this is the route the client actually calls to load policy data**; `/api/policies` is not fetched from `app/page.tsx` at all, only used for saving)

- [ ] **Step 1: Add the field to `ExtractedPolicy` and extraction regex**

In `app/page.tsx`, find `type ExtractedPolicy = {` (line ~81) and add `premiumDueDate: string;` alongside the existing `effectiveDate: string;`.

In `structurePolicyText` (line ~204), add directly after the `effectiveDate` line:

```ts
  const premiumDueDate = matchField(clean, [/(?:premium due date|next premium due|due date)\s*[:\-]?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i, /(?:premium due date|next premium due|due date)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i]);
```

Add `premiumDueDate` to the object returned at the end of `structurePolicyText` (same pattern as `effectiveDate`), and include it in the `found`/`confidence` count array alongside the other matched fields.

- [ ] **Step 2: Add the field to the scan-review confirmation form**

Find the `<label>Effective date<input value={extractedPolicy.effectiveDate} ...` line in the scan-review form JSX. Add an equivalent label/input immediately after it:

```tsx
<label>Premium due date<input value={extractedPolicy.premiumDueDate} onChange={(e) => updateExtracted("premiumDueDate", e.target.value)} placeholder="MM/DD/YYYY" /></label>
```

- [ ] **Step 3: Include it in the save payload**

Find where `saveScannedPolicy` (or the fetch call to `/api/policies`) builds its POST body from `extractedPolicy` — add `premiumDueDate: extractedPolicy.premiumDueDate` to that object.

- [ ] **Step 4: Accept and store it in the API route**

In `app/api/policies/route.ts`, add to the destructured/read body: `premiumDueDate`, and to the upsert values object: `premium_due_date: parseDate(body.premiumDueDate)` (using the existing `parseDate` import from `app/lib/money.ts`). Add `premiumDueDate:premium_due_date` to `POLICY_SELECT` and to the response formatting (no money formatting needed — dates pass through as-is, matching how `effectiveDate` is already handled).

- [ ] **Step 5: Add it to `app/api/client-profile/route.ts` too — this is the route the client actually loads policy data from**

`app/page.tsx` never calls `GET /api/policies` — every policy shown on Dashboard/My Policies comes from `GET /api/client-profile`, which has its own separate `POLICY_SELECT` constant (not the same one edited in Step 4). Add `premiumDueDate:premium_due_date` to that route's `POLICY_SELECT` as well, or Task 4's countdown chip and Task 10's due-soon trigger will silently never see a value.

- [ ] **Step 6: Carry it through the optimistic scan-save update**

In `saveScannedPolicy` (`app/page.tsx:852`), the local `newPolicy` object used to optimistically update UI state before the next reload doesn't currently include a premium-date field — add `premiumDueDate: extractedPolicy.premiumDueDate` to it so the countdown chip (Task 4) appears immediately after saving a scan, not only after a full page reload.

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 8: Manual verify**

In the browser preview, scan a sample policy document (or use the demo scan flow), confirm the "Premium due date" field appears in the review form, save, and confirm the saved value is visible after reloading the dashboard (via `client-profile`, not `/api/policies`).

- [ ] **Step 9: Commit**

```bash
git add app/page.tsx app/api/policies/route.ts
git commit -m "Extract and store premium due date from scanned policies"
```

---

### Task 4: Premium due date countdown chip on the policy row

**Files:**
- Modify: `app/page.tsx` (`Policy` type, policy row rendering in `PoliciesView`/policy list)

- [ ] **Step 1: Add `premiumDueDate` to the `Policy` type**

In `type Policy = {` (line ~68), add `premiumDueDate?: string;`. Update the mapping from API results to `Policy` objects (search `deathBenefit: policy.deathBenefit ||` for the existing mapping pattern) to include `premiumDueDate: policy.premiumDueDate`.

- [ ] **Step 2: Write a small pure helper for the countdown label**

Add near the top of `app/page.tsx` (alongside `ticketCode`):

```ts
function premiumDueLabel(dateStr?: string): { text: string; tone: "default" | "warning" | "danger" } | null {
  if (!dateStr) return null;
  const due = new Date(dateStr);
  if (Number.isNaN(due.getTime())) return null;
  const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`, tone: "danger" };
  if (days === 0) return { text: "Due today", tone: "warning" };
  return { text: `Due in ${days} day${days === 1 ? "" : "s"}`, tone: days <= 14 ? "warning" : "default" };
}
```

- [ ] **Step 3: Render the chip on the policy row**

Find the policy row JSX (search `className="policy-row"`). Inside the row, near the benefit/premium display, add:

```tsx
{premiumDueLabel(policy.premiumDueDate) && <small className={`premium-due-chip ${premiumDueLabel(policy.premiumDueDate)!.tone}`}>{premiumDueLabel(policy.premiumDueDate)!.text}</small>}
```

(Compute the label once into a local variable inside the `.map()` callback rather than calling the helper twice — clean this up during implementation, don't literally ship the duplicate call above.)

Add the same chip to `PoliciesView`'s `large-policy-card` list (~line 397) — My Policies is the primary browsing view for saved policies, not just the Dashboard summary row.

- [ ] **Step 4: Add chip styling**

In `app/sections.css`, add:

```css
.premium-due-chip { display: inline-block; margin-top: 4px; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 650; background: var(--color-surface-muted); color: var(--color-text-muted); }
.premium-due-chip.warning { background: #fff4e0; color: #9a5b00; }
.premium-due-chip.danger { background: #fdeaea; color: #b42318; }
```

- [ ] **Step 5: Build, then manually verify** a policy with a saved `premium_due_date` in the past 14 days shows amber, one further out shows the neutral style, one in the past shows red/overdue.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/sections.css
git commit -m "Show premium due date countdown on policy rows"
```

---

### Task 5: Carrier directory (structure + fallback, no logos yet)

**Files:**
- Create: `app/carriers.ts`
- Modify: `app/page.tsx` — all three `policy-icon` occurrences (Dashboard's `policy-row` at line ~324, `PoliciesView`'s `large-policy-card` list at line ~397, and the policy detail modal hero at line ~956), plus `DocumentVaultView`'s document row

- [ ] **Step 1: Create the directory module**

```ts
// app/carriers.ts
export type CarrierEntry = { logo?: string; url?: string };

export const CARRIER_DIRECTORY: Record<string, CarrierEntry> = {
  "northwestern mutual": { url: "https://www.northwesternmutual.com" },
  "banner life": { url: "https://www.bannerlife.com" },
  "haven life": { url: "https://www.havenlife.com" },
  "rbc insurance": { url: "https://www.rbcinsurance.com" },
  "mutual of omaha": { url: "https://www.mutualofomaha.com" },
};

export function lookupCarrier(name: string | undefined): CarrierEntry | null {
  if (!name) return null;
  return CARRIER_DIRECTORY[name.trim().toLowerCase()] ?? null;
}
```

(`logo` left unset for every entry — Task 6 sources real files and fills these in. Leaving them unset now means `lookupCarrier` already works end-to-end with the initials-badge fallback before any image asset exists.)

- [ ] **Step 2: Add a small carrier badge component**

In `app/page.tsx`, add near `ticketCode`/`premiumDueLabel`:

```tsx
function CarrierBadge({ carrier, isSample, size = 34 }: { carrier?: string; isSample?: boolean; size?: number }) {
  const entry = isSample ? null : lookupCarrier(carrier);
  const initials = (carrier || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (entry?.logo) return <img src={entry.logo} alt={carrier} width={size} height={size} className="carrier-badge-logo" />;
  return <span className="carrier-badge-initials" style={{ width: size, height: size }}>{initials}</span>;
}
```

Import `lookupCarrier` from `./carriers` at the top of `app/page.tsx`.

- [ ] **Step 3: Use it everywhere a policy icon renders**

Find the existing `<span className={\`policy-icon ${policy.color}\`}><policy.icon size={24} /></span>`-style rendering. There are **three** occurrences, all needing the same treatment: Dashboard's `policy-row` (~line 324), `PoliciesView`'s `large-policy-card` list (~line 397), and the policy detail modal hero (~line 956, uses `selectedPolicy` instead of `policy`). In each, replace the inner icon rendering with `<CarrierBadge carrier={policy.carrier} isSample={policy.isSample} />` (or `selectedPolicy.carrier`/`selectedPolicy.isSample` in the modal), keeping the existing wrapper `<span className={...}>` classes so layout/spacing is unaffected — swap only the inner icon for the badge. Also add a small `<CarrierBadge>` (size 20-24) to `DocumentVaultView`'s document row where a document has a linked `policyNumber` matching a real policy's carrier — pass the carrier looked up from the matching policy in `uploadedDocuments`'s parent scope (`persistentDocuments`/`policyData`), not the document row itself, since documents don't carry a `carrier` field directly.

- [ ] **Step 4: Add a "Visit [Carrier]" link in the policy detail modal**

Next to the existing "Manage Policy" button in the detail modal actions row, add:

```tsx
{lookupCarrier(selectedPolicy.carrier)?.url && !selectedPolicy.isSample && (
  <a className="secondary-button" href={lookupCarrier(selectedPolicy.carrier)!.url} target="_blank" rel="noopener noreferrer">
    <ArrowRight size={17} />Visit {selectedPolicy.carrier}
  </a>
)}
```

- [ ] **Step 5: Add badge CSS**

```css
.carrier-badge-logo { border-radius: 10px; object-fit: contain; background: #fff; }
.carrier-badge-initials { display: grid; place-items: center; border-radius: 10px; background: var(--color-surface-muted); color: var(--color-text-muted); font-weight: 700; font-size: 12px; }
```

- [ ] **Step 6: Build, then manually verify**: a policy whose carrier matches the directory shows the "Visit" link; a sample policy or unmatched carrier shows initials and no broken image.

- [ ] **Step 7: Commit**

```bash
git add app/carriers.ts app/page.tsx app/sections.css
git commit -m "Add carrier directory with initials-badge fallback"
```

---

### Task 6: Source real carrier logo files

**Files:**
- Create: `public/carriers/northwestern-mutual.svg` (or `.png`), and one file per carrier in the initial directory
- Modify: `app/carriers.ts` (fill in `logo` paths)

- [ ] **Step 1: For each of the 5 carriers in `CARRIER_DIRECTORY`, source an official logo image** from that carrier's public press/newsroom/media-kit page (e.g. search "`<carrier name>` newsroom logo" or "`<carrier name>` press kit"). Prefer an SVG or transparent PNG. Save under `public/carriers/<slug>.svg` (or `.png`).

- [ ] **Step 2: Fill in the `logo` path for each entry in `app/carriers.ts`**, e.g. `"northwestern mutual": { logo: "/carriers/northwestern-mutual.svg", url: "..." }`.

- [ ] **Step 3: Build, then manually verify** each of the 5 sample-adjacent real carriers (test by saving a real policy with that exact carrier name — sample policies never show real logos per the spec) renders its actual logo, not initials.

- [ ] **Step 4: Commit**

```bash
git add public/carriers app/carriers.ts
git commit -m "Add real carrier logo assets"
```

---

### Task 7: Packet status field + agent panel

**Files:**
- Modify: `app/api/policies/route.ts` (expose `packetStatus` in `POLICY_SELECT`, no client-writable path)
- Create: `app/api/agent/policies/route.ts` (agent-only list/update for a given client's policies)
- Modify: `app/page.tsx` (`AgentConsole` — expandable per-client policy panel)

- [ ] **Step 1: Expose `packetStatus` read-only on the client-facing policies route**

In `app/api/policies/route.ts`, add `packetStatus:packet_status` to `POLICY_SELECT`. Do not add it to the POST body handling — clients never set this themselves.

- [ ] **Step 2: Create the agent-only route**

```ts
// app/api/agent/policies/route.ts
import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

const POLICY_SELECT = "id, policyNumber:policy_number, policyType:policy_type, carrier, packetStatus:packet_status";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) return Response.json({ error: "clientId is required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: policies } = await admin.from("user_policies").select(POLICY_SELECT).eq("user_id", clientId);
  return Response.json({ policies: policies || [] });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const body = await request.json() as { id?: string; packetStatus?: string };
  if (!body.id || !["not_sent", "sent", "delivered"].includes(body.packetStatus || "")) {
    return Response.json({ error: "Valid policy id and status required" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: policy, error } = await admin
    .from("user_policies")
    .update({ packet_status: body.packetStatus })
    .eq("id", body.id)
    .select("id, userId:user_id, packetStatus:packet_status")
    .single();

  if (error || !policy) return Response.json({ error: "Policy not found" }, { status: 404 });

  if (body.packetStatus === "delivered") {
    await admin.from("notifications").insert({
      user_id: policy.userId,
      type: "packet_delivered",
      title: "Your policy packet has been delivered",
      message: "Your policy documents are on their way or have arrived — check your mailbox.",
      related_id: policy.id,
    });
  }

  return Response.json({ policy });
}
```

- [ ] **Step 3: Add the expandable panel in `AgentConsole`**

In `app/page.tsx`'s `AgentConsole` function, add local state for the expanded client id and its fetched policies:

```ts
const [expandedClient, setExpandedClient] = useState<string | null>(null);
const [clientPolicies, setClientPolicies] = useState<Record<string, { id: string; policyNumber: string; carrier: string; packetStatus: string }[]>>({});
const toggleClient = async (clientId: string) => {
  if (expandedClient === clientId) { setExpandedClient(null); return; }
  setExpandedClient(clientId);
  if (!clientPolicies[clientId]) {
    const response = await fetch(`/api/agent/policies?clientId=${clientId}`);
    if (response.ok) setClientPolicies((current) => ({ ...current, [clientId]: (await response.json()).policies }));
  }
};
const updatePacketStatus = async (policyId: string, clientId: string, packetStatus: string) => {
  await fetch("/api/agent/policies", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: policyId, packetStatus }) });
  setClientPolicies((current) => ({ ...current, [clientId]: current[clientId].map((p) => p.id === policyId ? { ...p, packetStatus } : p) }));
};
```

This requires the queue items to carry the client's `user_id`, not just `clientName` — the API already returns it (`REQUEST_SELECT` in `app/api/agent/queue/route.ts` includes `userId:user_id`), but the `QueueItem` type in `AgentConsole` (`app/page.tsx:512`, `ServiceRequest & { clientName: string; unreadByAgent: boolean; requestData?: ... }`) does not declare a `userId` field — `ServiceRequest` itself has none either. Add `userId: string;` to the `QueueItem` type intersection first, or `item.userId` fails the build. Then add a clickable client name (`onClick={() => toggleClient(item.userId)}`) and, when `expandedClient === item.userId`, render `clientPolicies[item.userId]?.map(...)` as a small list with a `<select>` per policy (options: Not Sent / Sent / Delivered) calling `updatePacketStatus`.

- [ ] **Step 4: Build, then manually verify**: as a staff account, expand a client with saved policies, change packet status to Delivered, then sign in as that client and confirm a real notification appears (this ties into Task 8/9 below — if those aren't done yet, verify via a direct query against the `notifications` table instead).

- [ ] **Step 5: Commit**

```bash
git add app/api/policies/route.ts app/api/agent/policies/route.ts app/page.tsx
git commit -m "Add packet delivery status and agent policy panel"
```

---

### Task 8: Real notifications API

**Files:**
- Create: `app/api/notifications/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/notifications/route.ts
import { createServerSupabase } from "../../lib/supabase/server";
import { getCurrentUser } from "../../auth";

const NOTIFICATION_SELECT = "id, type, title, message, read, relatedId:related_id, createdAt:created_at";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const supabase = await createServerSupabase();
  const { data: notifications } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return Response.json({ notifications: notifications || [] });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json() as { id?: string; markAllRead?: boolean };
  const supabase = await createServerSupabase();

  if (body.markAllRead) {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    return Response.json({ ok: true });
  }

  if (!body.id) return Response.json({ error: "id or markAllRead is required" }, { status: 400 });
  const { data: notification, error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select(NOTIFICATION_SELECT)
    .single();

  if (error || !notification) return Response.json({ error: "Notification not found" }, { status: 404 });
  return Response.json({ notification });
}
```

- [ ] **Step 2: Build**

Run: `npm run build` — expect exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/api/notifications/route.ts
git commit -m "Add real notifications API"
```

---

### Task 9: Wire `NotificationsView` and the two hardcoded badges to real data

**Files:**
- Modify: `app/page.tsx` (`NotificationsView`, sidebar `navItems` badge, header bell)

- [ ] **Step 1: Rewrite `NotificationsView` to fetch real data**

Replace the hardcoded `notifications` array in `NotificationsView` (line ~528) with:

```tsx
function NotificationsView({ notify }: { notify: (message: string) => void }) {
  const [notifications, setNotifications] = useState<{ id: string; type: string; title: string; message: string; read: boolean; createdAt: string }[]>([]);
  const load = () => fetch("/api/notifications", { cache: "no-store" }).then((r) => r.json()).then((d) => setNotifications(d.notifications || []));
  useEffect(() => { load(); }, []);
  const markRead = async (id: string) => { await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }); load(); };
  const markAllRead = async () => { await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ markAllRead: true }) }); notify("All notifications marked as read."); load(); };
  return <div className="section-view"><ViewHeading eyebrow="Account activity" title="Notifications" description="Coverage reminders, document updates, and request progress in one timeline." action={<button className="secondary-button" onClick={markAllRead}><CheckCircle2 size={16} />Mark all read</button>} /><Panel className="notification-list">{notifications.map(({ id, type, title, message, read, createdAt }) => <button key={id} className={read ? "" : "unread"} onClick={() => markRead(id)}><span className="notification-icon"><Bell size={20} /></span><span><strong>{title}</strong><small>{message}</small></span><time>{new Date(createdAt).toLocaleDateString()}</time>{!read && <i />}</button>)}{!notifications.length && <div className="empty-state"><CheckCircle2 size={28} /><strong>No notifications yet</strong><p>You'll see policy and account updates here.</p></div>}</Panel></div>;
}
```

(`type` is fetched but not rendered with a distinct icon per type in this minimal pass — every notification uses the same bell icon. That's an acceptable simplification; do not add a type→icon map unless asked, per YAGNI.)

- [ ] **Step 2: Drive the sidebar badge and header bell from real unread count**

This requires unread count to be available at the top-level `HomePage` component (where `navItems` and the header are rendered), not just inside `NotificationsView`. Add state there:

```ts
const [unreadCount, setUnreadCount] = useState(0);
useEffect(() => { fetch("/api/notifications", { cache: "no-store" }).then((r) => r.json()).then((d) => setUnreadCount((d.notifications || []).filter((n: { read: boolean }) => !n.read).length)); }, [portalMode]);
```

Replace the hardcoded `badge: 3` in the `navItems` array's Notifications entry — since `navItems` is a module-level constant, it cannot hold live state directly. Change the nav-rendering line (`navItems.filter(...).map(({ label, icon: Icon, badge }) => ...)`) so that for the `"Notifications"` label specifically, it uses `unreadCount` instead of the item's static `badge` field, e.g. `const displayBadge = label === "Notifications" ? unreadCount : badge;` inside the `.map()`, then render `{displayBadge > 0 && <b>{displayBadge}</b>}`. Remove `badge: 3` from the `navItems` array entry entirely (dead now).

Do the same for the header bell button (search `<Bell size={22} /><span>3</span>` or similar) — replace the hardcoded `3` with `{unreadCount > 0 && <span>{unreadCount}</span>}`.

- [ ] **Step 3: Build, then manually verify**: sidebar badge and header bell both show 0/hidden with no notifications, and update correctly after a packet-delivered notification is created and then marked read.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "Replace fake notifications with real data, wire unread badges"
```

---

### Task 10: Premium-due-soon notification trigger

**Files:**
- Modify: `app/api/client-profile/route.ts` (GET handler — dashboard load path)

- [ ] **Step 1: Add the dedup-guarded check**

In `app/api/client-profile/route.ts`'s `GET` handler, after policies are fetched, add:

```ts
const dueSoon = (policies || []).filter((p) => {
  if (!p.premiumDueDate) return false;
  const days = Math.ceil((new Date(p.premiumDueDate).getTime() - Date.now()) / 86400000);
  return days >= 0 && days <= 14;
});
for (const policy of dueSoon) {
  const { data: existing } = await supabase.from("notifications").select("id").eq("user_id", user.id).eq("type", "premium_due_soon").eq("related_id", policy.id).eq("read", false).maybeSingle();
  if (!existing) {
    await supabase.from("notifications").insert({ user_id: user.id, type: "premium_due_soon", title: "A premium is due soon", message: `${policy.carrier || "A policy"} premium is due within 14 days.`, related_id: policy.id });
  }
}
```

Place this after the existing `policies` select and before the `Response.json(...)` return, using the same `supabase` server client already in scope in that handler (this client is RLS-scoped to the signed-in user, which is correct here — a user inserting a notification for themselves).

- [ ] **Step 2: Build, then manually verify**: save a policy with `premium_due_date` 5 days out, reload the dashboard twice, confirm exactly one `premium_due_soon` notification exists (not duplicated on the second load).

- [ ] **Step 3: Commit**

```bash
git add app/api/client-profile/route.ts
git commit -m "Add premium-due-soon notification trigger with dedup guard"
```

---

### Task 11: QR code + mobile install panel

**Files:**
- Modify: `package.json` (add `qrcode` dependency)
- Modify: `app/page.tsx` (`SettingsView`)
- Modify: `app/sections.css`

- [ ] **Step 1: Install the dependency**

Run: `npm install qrcode @types/qrcode --save`
Expected: adds two lines to `package.json` dependencies/devDependencies, updates `package-lock.json`.

- [ ] **Step 2: Add the QR panel to `SettingsView`**

Add to `SettingsView`, using a dynamic `import("qrcode")` inside the effect (consistent with how this file already lazy-loads `tesseract.js`/`pdfjs-dist` — no static top-level import of `qrcode` needed):

```tsx
const [qrDataUrl, setQrDataUrl] = useState("");
useEffect(() => { import("qrcode").then((QRCode) => QRCode.toDataURL(window.location.origin, { margin: 1, width: 180 }).then(setQrDataUrl)); }, []);
```

Render a new `<Panel>` in `SettingsView`'s JSX:

```tsx
<Panel className="mobile-install-panel">
  <PanelHeader title="Get InsurSuite on your phone" />
  {qrDataUrl && <img src={qrDataUrl} alt="Scan to open InsurSuite on your phone" width={180} height={180} />}
  <div className="install-steps">
    <div><strong>iPhone (Safari)</strong><ol><li>Tap the Share icon</li><li>Tap "Add to Home Screen"</li></ol></div>
    <div><strong>Android (Chrome)</strong><ol><li>Tap the menu (⋮)</li><li>Tap "Install app" or "Add to Home screen"</li></ol></div>
  </div>
</Panel>
```

- [ ] **Step 3: Add panel styling**

```css
.mobile-install-panel img { display: block; margin: 12px 0; border-radius: 10px; }
.install-steps { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.install-steps ol { margin: 6px 0 0; padding-left: 18px; font-size: 12px; color: var(--color-text-muted); }
```

- [ ] **Step 4: Build, then manually verify**: Settings page shows a scannable QR code pointing at the current origin, and the two tutorial blocks render.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app/page.tsx app/sections.css
git commit -m "Add QR code and mobile install tutorial to Settings"
```

---

### Task 12: Web app manifest

**Files:**
- Create: `public/manifest.json`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Write the manifest**

```json
{
  "name": "InsurSuite",
  "short_name": "InsurSuite",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#1767ef",
  "background_color": "#eef4f8",
  "icons": [{ "src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml" }]
}
```

- [ ] **Step 2: Link it from `app/layout.tsx`**

In the `metadata` export in `app/layout.tsx`, add `manifest: "/manifest.json"` alongside the existing metadata fields.

- [ ] **Step 3: Build, then manually verify**: view page source / dev tools Application tab shows the manifest linked and parsed with no errors.

- [ ] **Step 4: Commit**

```bash
git add public/manifest.json app/layout.tsx
git commit -m "Add web app manifest for mobile install"
```

---

## Final verification (whole plan)

- [ ] `npm run build` passes with zero errors.
- [ ] Full manual pass per the spec's Verification section: scan a document → premium date appears and saves; a directory-matched carrier shows its real logo + link, a sample/unmatched one shows initials; agent marks a policy delivered → client gets a real notification and the badge/bell update; Settings QR code scans to the right URL.
- [ ] `git push origin main`.
