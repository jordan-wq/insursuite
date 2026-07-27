# Client Onboarding / Underwriting Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give staff a way to bring a brand-new prospect into InsurSuite themselves — a staff-only underwriting sheet (health, lifestyle/risk, financial, beneficiaries) plus policy details, saved as staff go, that ends in a real invite email creating the prospect's account — matching `docs/superpowers/specs/2026-07-26-client-onboarding-underwriting-design.md`.

**Architecture:** A new `underwriting_records` table (RLS enabled, zero client-facing policies — same lockdown pattern as `agent_roles`) holds the draft and, later, the permanent staff-only underwriting record. New `isAgent`-gated API routes under `app/api/agent/onboarding/` handle drafting, saving, and a final atomic "complete" step that creates the Supabase Auth user (via `inviteUserByEmail`, reusing the pattern from the approved staff-invite spec), the `client_profiles` row, and the `user_policies` row together. The staff-facing sheet at `/staff/onboarding/[id]` reuses the client portal's existing `OnboardingFlow` UI pattern (`.onboarding-layout`/`.onboarding-checklist`/`.intake-fields`, a data-driven `fields` array per section) rather than `CallIntakeView`'s live-call layout — this is the "cleaner sheet" the design explicitly asked for.

**Tech Stack:** Next.js 16 App Router, Supabase (Auth/Postgres), TypeScript.

**Verification convention:** No unit-test framework in this repo (`npm test` = `next build`). Every task's test step is `npm run build` plus a manual verification note (no dev server / live database available to an implementer in a sandboxed context — the controller running this plan does the manual pass after each task, not the implementer).

**Spec:** `docs/superpowers/specs/2026-07-26-client-onboarding-underwriting-design.md`

---

## Shared field reference (read before Tasks 3, 4, 6, 7)

The `underwriting` jsonb column and the sheet's sections use these keys — defined once here so every task references the same list instead of drifting:

**Health History:** `heightWeight`, `tobaccoUse` (select: Never / Former / Current), `majorConditions` (textarea), `currentMedications` (textarea), `familyHealthHistory` (textarea), `recentHospitalizations` (textarea).

**Lifestyle & Risk:** `occupation`, `hazardousHobbies` (textarea), `drivingRecord` (textarea), `foreignTravel` (textarea), `alcoholSubstanceUse` (textarea).

**Financial:** `annualIncome` (select, same option set as the client portal's existing `annualIncomeRange` field for consistency: "Under $25,000", "$25,000–$49,999", "$50,000–$74,999", "$75,000–$99,999", "$100,000–$149,999", "$150,000+"), `netWorth` (text), `existingCoverage` (textarea), `coveragePurpose` (select, same option set as the client portal's existing `primaryGoal`: "Protect family income", "Pay off a mortgage", "Final expenses", "Build cash value", "Estate or legacy planning", "Business protection", "Review existing coverage").

**Beneficiaries:** `primaryBeneficiaryName`, `primaryBeneficiaryRelationship`, `primaryBeneficiaryPercentage` (number), `contingentBeneficiaryName`, `contingentBeneficiaryRelationship`, `contingentBeneficiaryPercentage` (number).

**Wrap-up:** `missingDocuments` (textarea), `underwritingNotes` (textarea), `recommendedNextStep` (textarea).

The `policyDraft` jsonb column (and the eventual `user_policies` insert) uses exactly the existing `user_policies` column names in camelCase: `policyNumber`, `policyType`, `carrier`, `insuredName`, `ownerName`, `deathBenefit` (number), `monthlyPremium` (number), `effectiveDate` (date), `beneficiaries` (text summary), `cashValue` (number).

---

### Task 1: Migration — `underwriting_records` table

**Files:**
- Create: `supabase/migrations/0007_underwriting_records.sql`

- [ ] **Step 1: Write the migration**

```sql
create table public.underwriting_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'completed')),
  created_by uuid references auth.users(id) on delete set null,

  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  date_of_birth date,
  address text not null default '',
  city text not null default '',
  state text not null default '',
  postal_code text not null default '',

  underwriting jsonb not null default '{}'::jsonb,
  policy_draft jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.underwriting_records enable row level security;
-- No client-facing policies, intentionally — same pattern as agent_roles/staff_invites
-- (see supabase/migrations/0001_init.sql). This table is only ever touched through
-- the server-only admin client, gated by an app-level isAgent() check.
```

- [ ] **Step 2: Push the migration**

Run: `npx supabase db push`
Expected: exits 0, migration `0007_underwriting_records` applied. If the CLI reports "Cannot find project ref" or an auth error, the project needs `npx supabase link --project-ref <ref>` first (the ref is the subdomain in `NEXT_PUBLIC_SUPABASE_URL`, e.g. `https://<ref>.supabase.co`) — link once, then re-run the push.

- [ ] **Step 3: Manual verify**

`npx supabase migration list` — confirm `0007` shows in both the `local` and `remote` columns. In the Supabase dashboard (Database → Tables), confirm `underwriting_records` exists with RLS enabled and zero policies listed.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0007_underwriting_records.sql
git commit -m "Add underwriting_records table for client onboarding intake"
```

---

### Task 2: API — start a draft, list drafts

**Files:**
- Create: `app/api/agent/onboarding/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/agent/onboarding/route.ts
import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

const DRAFT_SELECT = "id, firstName:first_name, lastName:last_name, email, updatedAt:updated_at";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: drafts } = await admin
    .from("underwriting_records")
    .select(DRAFT_SELECT)
    .eq("status", "draft")
    .order("updated_at", { ascending: false });

  return Response.json({ drafts: drafts || [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const body = await request.json() as { firstName?: string; lastName?: string; email?: string; phone?: string; dateOfBirth?: string };
  const firstName = (body.firstName || "").trim();
  const lastName = (body.lastName || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  if (!firstName || !lastName || !email) return Response.json({ error: "First name, last name, and email are required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: existing } = await admin.from("client_profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return Response.json({ error: "An account with this email already exists" }, { status: 409 });

  const { data: draft, error } = await admin
    .from("underwriting_records")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: (body.phone || "").trim(),
      date_of_birth: body.dateOfBirth || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !draft) return Response.json({ error: "Could not start intake" }, { status: 500 });
  return Response.json({ id: draft.id }, { status: 201 });
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add app/api/agent/onboarding/route.ts
git commit -m "Add onboarding draft creation and listing API"
```

---

### Task 3: API — fetch and save a draft

**Files:**
- Create: `app/api/agent/onboarding/[id]/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/agent/onboarding/[id]/route.ts
import { createAdminSupabase } from "../../../../lib/supabase/admin";
import { getCurrentUser } from "../../../../auth";
import { isAgent } from "../../../../service-routing";

const RECORD_SELECT = "id, userId:user_id, status, firstName:first_name, lastName:last_name, email, phone, dateOfBirth:date_of_birth, address, city, state, postalCode:postal_code, underwriting, policyDraft:policy_draft, createdAt:created_at, updatedAt:updated_at";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const { id } = await context.params;
  const admin = createAdminSupabase();
  const { data: record } = await admin.from("underwriting_records").select(RECORD_SELECT).eq("id", id).maybeSingle();
  if (!record) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ record });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const { id } = await context.params;
  const admin = createAdminSupabase();
  const { data: existing } = await admin.from("underwriting_records").select("status").eq("id", id).maybeSingle();
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (existing.status === "completed") return Response.json({ error: "This intake is already completed and cannot be edited" }, { status: 400 });

  const body = await request.json() as {
    firstName?: string; lastName?: string; email?: string; phone?: string; dateOfBirth?: string;
    address?: string; city?: string; state?: string; postalCode?: string;
    underwriting?: Record<string, string | number>; policyDraft?: Record<string, string | number>;
  };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.firstName !== undefined) update.first_name = body.firstName.trim();
  if (body.lastName !== undefined) update.last_name = body.lastName.trim();
  if (body.email !== undefined) update.email = body.email.trim().toLowerCase();
  if (body.phone !== undefined) update.phone = body.phone.trim();
  if (body.dateOfBirth !== undefined) update.date_of_birth = body.dateOfBirth || null;
  if (body.address !== undefined) update.address = body.address;
  if (body.city !== undefined) update.city = body.city;
  if (body.state !== undefined) update.state = body.state;
  if (body.postalCode !== undefined) update.postal_code = body.postalCode;
  if (body.underwriting !== undefined) update.underwriting = body.underwriting;
  if (body.policyDraft !== undefined) update.policy_draft = body.policyDraft;

  const { data: record, error } = await admin.from("underwriting_records").update(update).eq("id", id).select(RECORD_SELECT).single();
  if (error || !record) return Response.json({ error: "Could not save" }, { status: 500 });
  return Response.json({ record });
}
```

(`underwriting`/`policyDraft` are replaced wholesale, not merged server-side — the sheet's client-side state already holds the full accumulated object across sections in the same session, matching the exact pattern the client portal's own `OnboardingFlow` already uses: `POST /api/client-profile` sends the complete `profile` object every save, not a partial patch. Following that established convention here avoids introducing a second, inconsistent merge strategy.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add app/api/agent/onboarding/\[id\]/route.ts
git commit -m "Add onboarding draft fetch and save API"
```

---

### Task 4: API — complete and invite

**Files:**
- Create: `app/api/agent/onboarding/[id]/complete/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/agent/onboarding/[id]/complete/route.ts
import { createAdminSupabase } from "../../../../../lib/supabase/admin";
import { getCurrentUser } from "../../../../../auth";
import { isAgent } from "../../../../../service-routing";
import { sanitizeProfile } from "../../../../../profile-fields";

type PolicyDraft = { policyNumber?: string; policyType?: string; carrier?: string; insuredName?: string; ownerName?: string; deathBenefit?: number; monthlyPremium?: number; effectiveDate?: string; beneficiaries?: string; cashValue?: number };

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const { id } = await context.params;
  const admin = createAdminSupabase();
  const { data: draft } = await admin.from("underwriting_records").select("*").eq("id", id).maybeSingle();
  if (!draft) return Response.json({ error: "Not found" }, { status: 404 });
  if (draft.status === "completed") return Response.json({ error: "This intake has already been completed" }, { status: 400 });
  if (!draft.first_name || !draft.last_name || !draft.email) return Response.json({ error: "First name, last name, and email are required to complete" }, { status: 400 });

  const { data: existing } = await admin.from("client_profiles").select("id").eq("email", draft.email).maybeSingle();
  if (existing) return Response.json({ error: "An account with this email already exists" }, { status: 409 });

  const origin = new URL(request.url).origin;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(draft.email, {
    redirectTo: `${origin}/auth/callback?return_to=/`,
  });
  if (inviteError || !invited?.user) return Response.json({ error: inviteError?.message || "Could not send invite" }, { status: 500 });

  const newUserId = invited.user.id;
  const policy = (draft.policy_draft || {}) as PolicyDraft;

  const { error: profileError } = await admin.from("client_profiles").insert({
    user_id: newUserId,
    email: draft.email,
    full_name: `${draft.first_name} ${draft.last_name}`.trim(),
    phone: draft.phone || "",
    date_of_birth: draft.date_of_birth || null,
    onboarding_status: "completed",
    onboarding_step: 0,
    profile: sanitizeProfile({ address: draft.address, city: draft.city, state: draft.state, postalCode: draft.postal_code }),
  });
  if (profileError) return Response.json({ error: "Invite sent, but could not create the client profile — check the Supabase dashboard for the new auth user and finish setup manually." }, { status: 500 });

  await admin.from("user_policies").insert({
    user_id: newUserId,
    policy_number: policy.policyNumber || "",
    policy_type: policy.policyType || "",
    carrier: policy.carrier || "",
    insured_name: policy.insuredName || "",
    owner_name: policy.ownerName || "",
    death_benefit: policy.deathBenefit || null,
    monthly_premium: policy.monthlyPremium || null,
    effective_date: policy.effectiveDate || null,
    beneficiaries: policy.beneficiaries || "",
    cash_value: policy.cashValue || null,
  });

  const { data: completed, error: completeError } = await admin
    .from("underwriting_records")
    .update({ status: "completed", user_id: newUserId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, userId:user_id, status")
    .single();
  if (completeError || !completed) return Response.json({ error: "Invite and account created, but could not mark the intake completed — check the Supabase dashboard." }, { status: 500 });

  return Response.json({ record: completed });
}
```

(Steps run in sequence, not inside a database transaction — Supabase Auth admin calls can't participate in one alongside Postgres writes. If a later step fails, the error message says so explicitly rather than claiming full success, per the spec's explicit call-out of this as a known, accepted edge case rather than something silently glossed over. `sanitizeProfile()` is reused unchanged — `address`/`city`/`state`/`postalCode` are already in `CORE_PROFILE_FIELDS`, so no allow-list change is needed.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add app/api/agent/onboarding/\[id\]/complete/route.ts
git commit -m "Add onboarding completion API: creates auth user, client profile, policy, and sends invite"
```

---

### Task 5: UI — draft list and start-new-intake

**Files:**
- Create: `app/staff/(shell)/onboarding/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelHeader, ViewHeading } from "../../../components/shared";

type Draft = { id: string; firstName: string; lastName: string; email: string; updatedAt: string };

export default function OnboardingListPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => fetch("/api/agent/onboarding", { cache: "no-store" }).then((r) => r.json()).then((d) => setDrafts(d.drafts || []));
  useEffect(() => { load(); }, []);

  const startIntake = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/agent/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName, lastName, email, phone }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Could not start intake"); setSaving(false); return; }
    router.push(`/staff/onboarding/${result.id}`);
  };

  return <div className="section-view">
    <ViewHeading eyebrow="New client intake" title="Onboarding" description="Capture underwriting and policy details for a new prospect, then invite them to their account." action={<button className="primary-button" onClick={() => setShowNew((current) => !current)}>{showNew ? "Close" : "Start new intake"}</button>} />
    {showNew && <Panel><PanelHeader title="Start a new intake" /><form className="modal-form" onSubmit={startIntake}><label>First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></label><label>Last name<input value={lastName} onChange={(e) => setLastName(e.target.value)} required /></label><label>Email address<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label><label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(000) 000-0000" /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={saving}>{saving ? "Starting..." : "Start intake"}</button></form></Panel>}
    <Panel><PanelHeader title={`In-progress intakes (${drafts.length})`} /><div className="beneficiary-list">{drafts.map((draft) => <a key={draft.id} href={`/staff/onboarding/${draft.id}`} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10, padding: 11, border: "1px solid var(--line)", borderRadius: 9, textDecoration: "none", color: "inherit" }}><span><strong style={{ display: "block" }}>{draft.firstName} {draft.lastName}</strong><small style={{ display: "block", marginTop: 3, color: "var(--muted)" }}>{draft.email}</small></span><small>Updated {new Date(draft.updatedAt).toLocaleDateString()}</small></a>)}{!drafts.length && <p className="modal-copy">No intakes in progress.</p>}</div></Panel>
  </div>;
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0. (`/staff/onboarding/[id]` doesn't exist until Task 6 — links 404 until then, expected.)

- [ ] **Step 3: Commit**

```bash
git add app/staff/\(shell\)/onboarding/page.tsx
git commit -m "Add onboarding draft list and start-intake page"
```

---

### Task 6: UI — the underwriting sheet

**Files:**
- Create: `app/staff/(shell)/onboarding/[id]/page.tsx`

- [ ] **Step 1: Write the page**

This reuses the client portal's `OnboardingFlow` structure (`app/page.tsx:779`) and its already-styled `.onboarding-layout`/`.onboarding-checklist`/`.onboarding-form-card`/`.intake-fields` CSS — a data-driven array of sections, each with a `fields` list, one section shown at a time with a left-side step nav. This is the "cleaner than Call Intake" sheet the design calls for: no live-call three-column layout, no suggested-questions sidebar, just a straightforward guided form.

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check } from "lucide-react";

type FieldType = "text" | "date" | "number" | "select" | "textarea";
type Field = { key: string; label: string; type?: FieldType; options?: string[]; placeholder?: string };
type Section = { title: string; short: string; description: string; fields: Field[] };

const IDENTITY_SECTION: Section = {
  title: "Identity & contact", short: "Who they are", description: "Basic identity and contact details for the new account.",
  fields: [
    { key: "firstName", label: "First name" }, { key: "lastName", label: "Last name" },
    { key: "dateOfBirth", label: "Date of birth", type: "date" }, { key: "email", label: "Email address" }, { key: "phone", label: "Phone" },
    { key: "address", label: "Street address" }, { key: "city", label: "City" }, { key: "state", label: "State" }, { key: "postalCode", label: "ZIP code" },
  ],
};

const UNDERWRITING_SECTIONS: Section[] = [
  { title: "Health history", short: "Medical background", description: "Health facts relevant to underwriting. Staff-only — never shown to the client.", fields: [
    { key: "heightWeight", label: "Height / weight" },
    { key: "tobaccoUse", label: "Tobacco / nicotine use", type: "select", options: ["Never", "Former", "Current"] },
    { key: "majorConditions", label: "Major medical conditions", type: "textarea" },
    { key: "currentMedications", label: "Current medications", type: "textarea" },
    { key: "familyHealthHistory", label: "Family health history", type: "textarea" },
    { key: "recentHospitalizations", label: "Recent hospitalizations or surgeries", type: "textarea" },
  ]},
  { title: "Lifestyle & risk", short: "Risk factors", description: "Occupation and lifestyle risk factors.", fields: [
    { key: "occupation", label: "Occupation" },
    { key: "hazardousHobbies", label: "Hazardous hobbies", type: "textarea" },
    { key: "drivingRecord", label: "Driving record", type: "textarea" },
    { key: "foreignTravel", label: "Foreign travel / residency", type: "textarea" },
    { key: "alcoholSubstanceUse", label: "Alcohol / substance use", type: "textarea" },
  ]},
  { title: "Financial", short: "Income & purpose", description: "Financial context for the coverage being set up.", fields: [
    { key: "annualIncome", label: "Annual income", type: "select", options: ["Under $25,000", "$25,000–$49,999", "$50,000–$74,999", "$75,000–$99,999", "$100,000–$149,999", "$150,000+"] },
    { key: "netWorth", label: "Approximate net worth" },
    { key: "existingCoverage", label: "Existing coverage elsewhere", type: "textarea" },
    { key: "coveragePurpose", label: "Purpose of coverage", type: "select", options: ["Protect family income", "Pay off a mortgage", "Final expenses", "Build cash value", "Estate or legacy planning", "Business protection", "Review existing coverage"] },
  ]},
  { title: "Beneficiaries", short: "Who's protected", description: "Primary and contingent beneficiaries.", fields: [
    { key: "primaryBeneficiaryName", label: "Primary beneficiary name" }, { key: "primaryBeneficiaryRelationship", label: "Primary relationship" }, { key: "primaryBeneficiaryPercentage", label: "Primary percentage", type: "number" },
    { key: "contingentBeneficiaryName", label: "Contingent beneficiary name" }, { key: "contingentBeneficiaryRelationship", label: "Contingent relationship" }, { key: "contingentBeneficiaryPercentage", label: "Contingent percentage", type: "number" },
  ]},
  { title: "Wrap-up", short: "Notes & next step", description: "Anything the advisor needs to know before this goes further.", fields: [
    { key: "missingDocuments", label: "Missing documents", type: "textarea" },
    { key: "underwritingNotes", label: "Underwriting notes", type: "textarea" },
    { key: "recommendedNextStep", label: "Recommended next step", type: "textarea" },
  ]},
];

const POLICY_SECTION: Section = {
  title: "Policy details", short: "The new policy", description: "The policy being set up for this client — this becomes their real policy record once invited.",
  fields: [
    { key: "policyNumber", label: "Policy number" }, { key: "policyType", label: "Policy type" }, { key: "carrier", label: "Carrier" },
    { key: "insuredName", label: "Insured name" }, { key: "ownerName", label: "Owner name" },
    { key: "deathBenefit", label: "Death benefit", type: "number" }, { key: "monthlyPremium", label: "Monthly premium", type: "number" },
    { key: "effectiveDate", label: "Effective date", type: "date" }, { key: "beneficiaries", label: "Beneficiaries summary" }, { key: "cashValue", label: "Cash value", type: "number" },
  ],
};

type Draft = {
  id: string; status: string; firstName: string; lastName: string; email: string; phone: string; dateOfBirth: string | null;
  address: string; city: string; state: string; postalCode: string;
  underwriting: Record<string, string>; policyDraft: Record<string, string>;
};

export default function OnboardingSheetPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(0);
  const [identity, setIdentity] = useState<Record<string, string>>({});
  const [underwriting, setUnderwriting] = useState<Record<string, string>>({});
  const [policy, setPolicy] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch(`/api/agent/onboarding/${params.id}`, { cache: "no-store" }).then((r) => r.json()).then((d) => {
      const record: Draft = d.record;
      setDraft(record);
      setIdentity({ firstName: record.firstName, lastName: record.lastName, email: record.email, phone: record.phone, dateOfBirth: record.dateOfBirth || "", address: record.address, city: record.city, state: record.state, postalCode: record.postalCode });
      setUnderwriting(record.underwriting || {});
      setPolicy(record.policyDraft || {});
    });
  }, [params.id]);

  const formSections = [IDENTITY_SECTION, ...UNDERWRITING_SECTIONS, POLICY_SECTION];
  const allSections = [...formSections, { title: "Review & complete", short: "Confirm & send", description: "Everything below is sent as-is. Complete & invite emails the client to set a password and sign in.", fields: [] }];
  const isReview = step === formSections.length;
  const section = allSections[step];
  const isIdentity = step === 0;
  const isPolicy = step === formSections.length - 1;
  const fieldValue = (key: string) => isIdentity ? (identity[key] || "") : isPolicy ? (policy[key] || "") : (underwriting[key] || "");
  const updateField = (key: string, value: string) => {
    if (isIdentity) setIdentity((current) => ({ ...current, [key]: value }));
    else if (isPolicy) setPolicy((current) => ({ ...current, [key]: value }));
    else setUnderwriting((current) => ({ ...current, [key]: value }));
  };

  const persist = async () => {
    const response = await fetch(`/api/agent/onboarding/${params.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...identity, underwriting, policyDraft: policy }),
    });
    return response.ok;
  };

  const save = async (next: number | null) => {
    setSaving(true);
    setNotice("");
    const ok = await persist();
    if (ok) {
      if (next !== null) { setStep(next); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else setNotice("Saved.");
    } else {
      setNotice("Could not save — please try again.");
    }
    setSaving(false);
  };

  const canComplete = Boolean(identity.firstName && identity.lastName && identity.email && policy.policyType && policy.carrier);

  const complete = async () => {
    if (!canComplete) return;
    setSaving(true);
    setNotice("");
    const saved = await persist();
    if (!saved) { setNotice("Could not save — please try again."); setSaving(false); return; }
    const response = await fetch(`/api/agent/onboarding/${params.id}/complete`, { method: "POST" });
    const result = await response.json();
    if (response.ok) router.push(`/staff/clients/${result.record.userId}`);
    else { setNotice(result.error || "Could not complete intake"); setSaving(false); }
  };

  if (!draft) return <div className="section-view"><p className="modal-copy">Loading...</p></div>;
  if (draft.status === "completed") return <div className="section-view"><div className="empty-state"><strong>Already completed</strong><p>This intake was already completed and can't be edited.</p></div></div>;

  const progress = Math.round(((step + 1) / allSections.length) * 100);
  const reviewGroups: { label: string; values: Record<string, string> }[] = [
    { label: "Identity & contact", values: identity },
    { label: "Underwriting", values: underwriting },
    { label: "Policy details", values: policy },
  ];

  return <div className="onboarding-layout">
    <aside className="onboarding-checklist">
      <span className="step-label">Step {step + 1} of {allSections.length}</span>
      <h2>{draft.firstName} {draft.lastName}</h2>
      <p>{draft.email}</p>
      <div className="overall-progress"><i style={{ width: `${progress}%` }} /></div>
      <small>{progress}% complete</small>
      <nav>{allSections.map((s, index) => <button key={s.title} className={index === step ? "active" : index < step ? "complete" : ""} onClick={() => setStep(index)}><span>{index < step ? <Check size={14} /> : index + 1}</span><div><strong>{s.short}</strong></div></button>)}</nav>
    </aside>
    <section className="onboarding-form-card">
      <div className="onboarding-form-head"><span>Section {step + 1} of {allSections.length}</span><h1>{section.title}</h1><p>{section.description}</p></div>
      {isReview ? <>
        {reviewGroups.map((group) => <div key={group.label} className="detail-grid" style={{ marginBottom: 16 }}>{Object.entries(group.values).filter(([, value]) => value).map(([key, value]) => <div key={key}><small>{key.replace(/([A-Z])/g, " $1")}</small><strong>{String(value)}</strong></div>)}{!Object.values(group.values).some(Boolean) && <div><small>{group.label}</small><strong>Nothing entered</strong></div>}</div>)}
        {notice && <p className="form-error">{notice}</p>}
        <div className="onboarding-actions">
          <button type="button" className="secondary-button" disabled={saving} onClick={() => setStep(step - 1)}>Back</button>
          {!canComplete && <p className="form-error" style={{ margin: 0 }}>First name, last name, email, policy type, and carrier are required to complete.</p>}
          <button type="button" className="primary-button" disabled={saving || !canComplete} onClick={complete}><Check size={16} />{saving ? "Completing..." : "Complete & invite"}</button>
        </div>
      </> : <form onSubmit={(event) => { event.preventDefault(); save(step + 1); }}>
        <div className="intake-fields">{section.fields.map((field) => <label key={field.key} className={field.type === "textarea" ? "wide" : ""}>{field.label}{field.type === "select" ? <select value={fieldValue(field.key)} onChange={(e) => updateField(field.key, e.target.value)}><option value="">Select one</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : field.type === "textarea" ? <textarea value={fieldValue(field.key)} onChange={(e) => updateField(field.key, e.target.value)} /> : <input type={field.type || "text"} value={fieldValue(field.key)} onChange={(e) => updateField(field.key, e.target.value)} placeholder={field.placeholder} />}</label>)}</div>
        {notice && <p className="form-error">{notice}</p>}
        <div className="onboarding-actions">
          <button type="button" className="secondary-button" disabled={step === 0 || saving} onClick={() => setStep(step - 1)}>Back</button>
          <button type="button" className="text-button save-exit" disabled={saving} onClick={() => save(null)}>Save</button>
          <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving..." : "Save & continue"}</button>
        </div>
      </form>}
    </section>
  </div>;
}
```

Notes on deviations from `OnboardingFlow`'s exact shape, all deliberate:
- No `onSkip`/"Skip setup" — that option exists in the client-facing flow for local dev convenience; it has no equivalent here.
- The step nav's `<span>` badge shows a number or a checkmark, not `OnboardingFlow`'s icon-per-section — this sheet's sections don't have a natural icon each, and a plain number/check is clearer than picking arbitrary icons.
- No `.onboarding-shell`/`.onboarding-top` wrapper — that header exists in the client-facing flow because it's a full-page experience with no other chrome; here the staff shell's own sidebar/header already provides page chrome, so the page renders `.onboarding-layout` directly. The layout/spacing rules on `.onboarding-layout` don't depend on that wrapper.
- The 8th section, "Review & complete" (matching the spec's explicit section 8), is a read-only summary of every non-empty field across all three groups (identity, underwriting, policy) rather than an input-fields section — it's the only section that doesn't render through the generic `section.fields.map(...)` path, since there's nothing to edit there. "Complete & invite" lives only on this section, disabled until first/last name, email, policy type, and carrier are all present — matching the spec's completion gate exactly (all five fields, not just the three identity ones).
- `save()`'s state-setting is factored into a separate `persist()` helper specifically so `complete()` can await the same PATCH without also flipping `saving` back to `false` partway through its own flow (a real bug in an earlier draft of this task: calling `save(null)` from inside `complete()` let the button re-enable while the completion request was still in flight, opening a brief double-click window). `complete()` now owns `saving` for its entire duration.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add app/staff/\(shell\)/onboarding/\[id\]/page.tsx
git commit -m "Add the underwriting sheet page"
```

---

### Task 7: Client Detail page — Underwriting panel

**Files:**
- Modify: `app/api/agent/clients/[id]/route.ts`
- Modify: `app/staff/(shell)/clients/[id]/page.tsx`

- [ ] **Step 1: Add the underwriting fetch to the client detail API**

In `app/api/agent/clients/[id]/route.ts`, add a fourth parallel query alongside the existing policies/requests/documents fetch, and include it in the response:

```ts
const UNDERWRITING_SELECT = "underwriting, createdAt:created_at";
```

Add this constant near the file's other `*_SELECT` constants, then extend the `Promise.all` and the returned JSON:

```ts
const [{ data: policies }, { data: requests }, { data: documents }, { data: underwriting }] = await Promise.all([
  admin.from("user_policies").select(POLICY_SELECT).eq("user_id", id),
  admin.from("service_requests").select(REQUEST_SELECT).eq("user_id", id).order("created_at", { ascending: false }),
  admin.from("documents").select(DOCUMENT_SELECT).eq("user_id", id).order("created_at", { ascending: false }),
  admin.from("underwriting_records").select(UNDERWRITING_SELECT).eq("user_id", id).eq("status", "completed").maybeSingle(),
]);

return Response.json({ profile, policies: policies || [], requests: requests || [], documents: documents || [], underwriting: underwriting || null });
```

(Read the current file first — this shows the shape of the change, not a full "replace the whole file" block, since Task 8 of the earlier admin-console-shell plan already established this file's exact structure and it must not be otherwise disturbed.)

- [ ] **Step 2: Add the panel to the client detail page**

In `app/staff/(shell)/clients/[id]/page.tsx`, extend the `ClientDetail` type and add a fifth panel, shown only when `underwriting` is present:

```tsx
type ClientDetail = {
  profile: { fullName: string; email: string; phone: string; onboardingStatus: string; profile: Record<string, unknown> } | null;
  policies: { id: string; policyNumber: string; carrier: string; packetStatus: string }[];
  requests: { id: string; requestType: string; details: string; status: string; createdAt: string }[];
  documents: { id: string; fileName: string; contentType: string; fileSize: number; createdAt: string }[];
  underwriting: { underwriting: Record<string, string>; createdAt: string } | null;
};
```

Add, inside the `.agent-console-grid`, after the existing four panels:

```tsx
{data.underwriting && <Panel><PanelHeader title="Underwriting" /><div className="detail-grid">{Object.entries(data.underwriting.underwriting).filter(([, value]) => value).map(([key, value]) => <div key={key}><small>{key.replace(/([A-Z])/g, " $1")}</small><strong>{String(value)}</strong></div>)}</div>{!Object.keys(data.underwriting.underwriting).length && <p className="modal-copy">No underwriting details recorded.</p>}</Panel>}
```

(Read the current file first and confirm the exact `const { profile, policies, requests, documents } = data;` destructuring line — add `underwriting` to it too.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add app/api/agent/clients/\[id\]/route.ts app/staff/\(shell\)/clients/\[id\]/page.tsx
git commit -m "Show completed underwriting record on the Client Detail page"
```

---

### Task 8: Sidebar nav entry

**Files:**
- Modify: `app/staff/(shell)/layout.tsx`

- [ ] **Step 1: Add the nav link**

Read the current file (built in the earlier admin-console-shell plan) and add an `Onboarding` link between `Clients` and `Knowledge`:

```tsx
<Link href="/staff/onboarding"><UserPlus size={20} /><span>Onboarding</span></Link>
```

Add `UserPlus` to the existing `lucide-react` import line.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add app/staff/\(shell\)/layout.tsx
git commit -m "Add Onboarding to the staff sidebar nav"
```

---

## Final verification (whole plan)

- [ ] `npm run build` passes with zero errors.
- [ ] Manual: start a new intake, fill in a few underwriting fields across sections, close the tab, reopen via the draft list — confirm everything saved is still there.
- [ ] Manual: complete an intake, confirm the invite email arrives, confirm accepting it lands the new client directly on their dashboard (no onboarding wizard) with the policy already visible.
- [ ] Manual: as that client, inspect `GET /api/client-profile`'s response — confirm no underwriting data appears anywhere in it.
- [ ] Manual: as staff, open that client's Client Detail page, confirm the new "Underwriting" panel shows what was entered.
- [ ] Manual: attempt a second intake with an already-used email — confirm the clear "already exists" error at draft-creation time.
