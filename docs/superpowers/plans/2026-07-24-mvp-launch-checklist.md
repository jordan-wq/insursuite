# MVP Launch Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the last 4 gaps found in an MVP-readiness audit before InsurSuite's first real clients start using it: a client-facing page showing fabricated data, no legal disclosure pages, unstyled default error/404 screens, and two Settings controls that silently discard user input.

**Architecture:** All 4 tasks are small, independent edits to the existing Next.js App Router structure — no new subsystems, no schema changes. Task 1 rewires one component to props it doesn't currently receive. Task 2 adds two new static routes plus a middleware allow-list entry. Task 3 adds the two Next.js App Router convention files (`error.tsx`, `not-found.tsx`), reusing the app's existing `.portal-gate`/`.gate-card` CSS pattern (already used at `app/page.tsx:952` for the existing portal-open error state) rather than inventing new styles. Task 4 fixes a real bug in the shared profile-save function or the notification toggles will still discard data no matter how they're wired.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (`/api/client-profile` for profile persistence).

**Verification convention:** No unit-test framework in this repo (`npm test` = `next build`). Every task's test step is `npm run build` plus a manual browser-preview check.

**Spec:** `docs/superpowers/specs/2026-07-24-mvp-launch-checklist-design.md`

**Task order:** Tasks 1-4 are independent of each other and can be done in any order. Numbered for reference only.

---

### Task 1: Family & Household — wire to real data

**Files:**
- Modify: `app/page.tsx:542-544` (`FamilyView`), `app/page.tsx:575` (its call site in `SectionContent`)

- [ ] **Step 1: Rewrite `FamilyView` to accept and use real data**

Replace the entire `FamilyView` function (currently lines 542-544) with:

```tsx
function FamilyView({ onOpen, notify, profile, policyData, user }: { onOpen: (modal: string) => void; notify: (message: string) => void; profile: StoredProfile | null; policyData: Policy[]; user: PortalUser | null }) {
  const displayName = profile?.fullName || user?.displayName || "Account owner";
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const totalCoverage = policyData.reduce((sum, policy) => sum + money(policy.benefit), 0);
  const beneficiaryName = profile?.profile?.primaryBeneficiary ? String(profile.profile.primaryBeneficiary) : "";
  const beneficiaryRelationship = profile?.profile?.primaryRelationship ? String(profile.profile.primaryRelationship) : "";
  const beneficiaryPercentage = profile?.profile?.primaryPercentage ? String(profile.profile.primaryPercentage) : "";
  const beneficiaryInitials = beneficiaryName ? beneficiaryName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "";
  const emergencyContactName = profile?.profile?.emergencyContactName ? String(profile.profile.emergencyContactName) : "";
  const emergencyContactPhone = profile?.profile?.emergencyContactPhone ? String(profile.profile.emergencyContactPhone) : "";
  const dependentsCount = profile?.profile?.dependentsCount ? String(profile.profile.dependentsCount) : "";

  return <div className="section-view"><ViewHeading eyebrow="People your coverage protects" title="Family & Household" description="Keep household details, emergency contacts, and protection roles accurate." action={<button className="primary-button" onClick={() => notify("Household member form opened.")}><Plus size={17} />Add member</button>} /><div className="family-grid"><article className="person-card primary-person"><div className="person-top"><span className="avatar big">{initials}</span><span className="pill blue">Account owner</span></div><h3>{displayName}</h3><p>Owner · Primary insured</p><div><span><strong>{currency(totalCoverage)}</strong><small>Total protection</small></span><span><strong>{policyData.length}</strong><small>Policies</small></span></div><button onClick={() => notify("Profile details are managed in Settings.")}>View profile<ChevronRight size={17} /></button></article>{beneficiaryName ? <article className="person-card"><div className="person-top"><span className="avatar big soft">{beneficiaryInitials}</span><span className="status active"><Check size={13} />Protected</span></div><h3>{beneficiaryName}</h3><p>{beneficiaryRelationship || "Beneficiary"} · Primary beneficiary</p><div><span><strong>{beneficiaryPercentage || "—"}</strong><small>Primary share</small></span></div><button onClick={() => onOpen("beneficiary")}>Review details<ChevronRight size={17} /></button></article> : <article className="person-card"><div className="person-top"><span className="avatar big soft"><UsersRound size={20} /></span></div><h3>No beneficiary on file</h3><p>Add one from your protection profile.</p><button onClick={() => onOpen("beneficiary")}>Add beneficiary<ChevronRight size={17} /></button></article>}<button className="add-person-card" onClick={() => notify("Household member form opened.")}><span><Plus size={23} /></span><strong>Add a household member</strong><p>Track dependents, emergency contacts, and protection needs.</p></button></div><Panel className="household-readiness"><PanelHeader title="Household readiness" />{emergencyContactName ? <div><CheckCircle2 size={20} /><span><strong>Emergency contact confirmed</strong><small>{emergencyContactName}{emergencyContactPhone ? ` · ${emergencyContactPhone}` : ""}</small></span><button onClick={() => notify("Update your emergency contact in your protection profile.")}>Review</button></div> : <div><CircleHelp size={20} /><span><strong>Emergency contact not on file</strong><small>Add an emergency contact to improve your household readiness.</small></span><button onClick={() => notify("Update your emergency contact in your protection profile.")}>Add details</button></div>}{dependentsCount ? <div><CheckCircle2 size={20} /><span><strong>{dependentsCount} dependent{dependentsCount === "1" ? "" : "s"} on file</strong><small>Keep dependent details current for your coverage analysis.</small></span><button onClick={() => notify("Dependent details opened.")}>Review</button></div> : <div><CircleHelp size={20} /><span><strong>Dependent needs not reviewed</strong><small>Add dependents to improve your coverage analysis.</small></span><button onClick={() => notify("Dependent details opened.")}>Add details</button></div>}</Panel></div>;
}
```

Notes on why this is safe:
- `profile.fullName`/`profile.phone` are top-level on `StoredProfile`; the beneficiary/emergency-contact/dependents fields live one level deeper at `profile.profile.*` — same nesting the existing beneficiary modal already reads at `app/page.tsx:996`.
- `money()`/`currency()` are existing module-scope helpers (`app/page.tsx:145-146`), already used elsewhere in this file for the same "parse a `$X,XXX`-style string into a number, then format it back" job.
- `Check`, `CheckCircle2`, `CircleHelp`, `ChevronRight`, `Plus`, `UsersRound` are all already imported at the top of `app/page.tsx` (they're used by the existing hardcoded version of this same function) — no new imports needed.
- The "Add member" / "View profile" buttons keep their placeholder `notify()` behavior — no household-editing UI exists yet and building one is out of scope for this plan.

- [ ] **Step 2: Pass the new props at the call site**

In `SectionContent`, change line 575 from:

```tsx
if (active === "Family & Household") return <FamilyView onOpen={onOpen} notify={notify} />;
```

to:

```tsx
if (active === "Family & Household") return <FamilyView onOpen={onOpen} notify={notify} profile={profile} policyData={policyData} user={user} />;
```

`profile`, `policyData`, and `user` are already parameters of `SectionContent` (used by the `Dashboard`/`PoliciesView`/`CoverageView` branches right above) — no new prop threading needed above this level.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Manual verify**

In the browser preview, sign in as a real (non-sample) test account that has a saved profile with `primaryBeneficiary` and `emergencyContactName` set. Open "Family & Household" — confirm it shows that account's real name, real policy count/total coverage, and the real beneficiary/emergency-contact data, NOT "Jordan McNutt"/"Alex Smith". Then check a second account (or temporarily clear those profile fields) to confirm the empty states ("No beneficiary on file", "Emergency contact not on file") render correctly instead of crashing or showing blank content.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "Wire Family & Household to real profile and policy data"
```

---

### Task 2: Terms of Service + Privacy Policy pages

**Files:**
- Create: `app/terms/page.tsx`
- Create: `app/privacy/page.tsx`
- Modify: `middleware.ts` (`isPublicPath`)
- Modify: `app/page.tsx` (`AccountCreation` consent checkbox, `SignInGate` footer)
- Modify: `app/login/page.tsx` (footer)
- Modify: `app/globals.css` (footer styles)

- [ ] **Step 1: Add `/terms` and `/privacy` to the middleware's public-path allow-list**

In `middleware.ts`, `isPublicPath()` is currently:

```ts
function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/staff/login" ||
    pathname.startsWith("/auth/") ||
    pathname === "/signin-with-chatgpt" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/file.svg") ||
    pathname.startsWith("/globe.svg") ||
    pathname.startsWith("/window.svg")
  );
}
```

Add `/terms` and `/privacy` to it:

```ts
function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/staff/login" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname.startsWith("/auth/") ||
    pathname === "/signin-with-chatgpt" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/file.svg") ||
    pathname.startsWith("/globe.svg") ||
    pathname.startsWith("/window.svg")
  );
}
```

Without this step, a signed-out visitor hitting `/terms` or `/privacy` directly would get redirected to `/login` instead of seeing the page — this is not optional.

- [ ] **Step 2: Create `app/terms/page.tsx`**

```tsx
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const metadata = { title: "Terms of Service | InsurSuite" };

export default function TermsPage() {
  return (
    <main className="marketing-page legal-page">
      <nav className="marketing-nav" aria-label="InsurSuite legal navigation">
        <div className="gate-brand"><ShieldCheck size={27} /><strong>Insur<span>Suite</span></strong></div>
        <div><Link href="/">Portal</Link></div>
      </nav>
      <section className="legal-content">
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated July 24, 2026</p>
        <p>InsurSuite is a client portal that helps you and your insurance agent organize policy information, documents, and communication in one place. It is not an insurance carrier, and using it does not itself create, change, or cancel any insurance policy — those actions still happen through your carrier and your agent.</p>
        <h2>Your account</h2>
        <p>You are responsible for keeping your login credentials confidential and for the accuracy of the information you provide. Contact your agent if you believe your account has been accessed without your permission.</p>
        <h2>Acceptable use</h2>
        <p>Use InsurSuite only to manage your own insurance information, or, if you are an agent, the information of clients you are authorized to serve. Do not attempt to access another person&apos;s account or data.</p>
        <h2>What InsurSuite provides</h2>
        <p>InsurSuite is provided during an early access period for a small group of clients. Features may change as the product develops. We will do our best to keep your information accurate and available, but InsurSuite is not a substitute for your official policy documents, which remain the authoritative record with your carrier.</p>
        <h2>Questions</h2>
        <p>If you have questions about these terms, contact your agent directly.</p>
        <p className="legal-note">This is a plain-language summary appropriate for early access. It is not a substitute for a formal legal review.</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Create `app/privacy/page.tsx`**

```tsx
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const metadata = { title: "Privacy Policy | InsurSuite" };

export default function PrivacyPage() {
  return (
    <main className="marketing-page legal-page">
      <nav className="marketing-nav" aria-label="InsurSuite legal navigation">
        <div className="gate-brand"><ShieldCheck size={27} /><strong>Insur<span>Suite</span></strong></div>
        <div><Link href="/">Portal</Link></div>
      </nav>
      <section className="legal-content">
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated July 24, 2026</p>
        <h2>What we collect</h2>
        <p>To help your agent service your policies, InsurSuite stores information you provide, including your name, contact information, date of birth, household and beneficiary details, income range, coverage goals, and any policy documents you upload.</p>
        <h2>How it&apos;s used</h2>
        <p>Your information is used only to help your agent understand and service your insurance coverage — for example, tracking beneficiaries, reminding you of premium due dates, and organizing your policy documents. We do not sell your information to third parties.</p>
        <h2>Where it&apos;s stored</h2>
        <p>Your data is stored with Supabase, a hosted database and file storage provider, using access controls that limit visibility to your own account and the agents assigned to work with you.</p>
        <h2>Your choices</h2>
        <p>You can review and update most of your information from the Settings page inside the portal. To request a copy of your data or ask that it be deleted, contact your agent.</p>
        <p className="legal-note">This is a plain-language summary appropriate for early access. It is not a substitute for a formal legal review.</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Add legal-page and footer CSS to `app/globals.css`**

Append near the existing `.marketing-page`/`.marketing-nav` block (around line 424, right after the `.product-grid .wide strong` rule):

```css
.legal-content { max-width:720px; margin:0 auto; padding:clamp(38px,6vw,72px) clamp(20px,5vw,72px) 96px; color:#334259; }
.legal-content h1 { margin:0 0 6px; color:#081831; font-size:clamp(32px,5vw,44px); letter-spacing:-1px; }
.legal-content h2 { margin:34px 0 10px; color:#132945; font-size:20px; letter-spacing:-.3px; }
.legal-content p { margin:0 0 4px; line-height:1.7; font-size:15px; }
.legal-updated { color:#697890; font-size:13px; margin-bottom:28px; }
.legal-note { margin-top:36px; padding-top:20px; border-top:1px solid rgba(204,216,230,.72); color:#697890; font-size:13px; }
.marketing-footer { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:20px clamp(20px,5vw,72px); border-top:1px solid rgba(204,216,230,.72); color:#697890; font-size:12px; }
.marketing-footer a { margin-left:16px; color:#40536e; text-decoration:none; }
.marketing-footer a:hover { color:#174fae; }
```

- [ ] **Step 5: Link the consent checkbox to the real pages**

In `AccountCreation` (`app/page.tsx:732`), find:

```tsx
<label className="consent-check"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} required /><span>I agree to the portal terms and authorize InsurSuite to store the information I choose to provide.</span></label>
```

Replace the `<span>` content so "portal terms" and a new "privacy policy" mention are real links:

```tsx
<label className="consent-check"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} required /><span>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>, and authorize InsurSuite to store the information I choose to provide.</span></label>
```

- [ ] **Step 6: Add a footer to `SignInGate`**

In `app/page.tsx`, `SignInGate`'s JSX currently ends with:

```tsx
      <section className="closing-cta">
        <h2>Build a coverage file your future self can actually use.</h2>
        <p>Start with your account, add the policies you already own, and let InsurSuite turn the paper trail into a working system.</p>
        <a className="primary-button" href="/login">Create account or sign in<ArrowRight size={17} /></a>
      </section>
    </main>
  );
}
```

Add a `<footer>` between the closing-cta section and `</main>`:

```tsx
      <section className="closing-cta">
        <h2>Build a coverage file your future self can actually use.</h2>
        <p>Start with your account, add the policies you already own, and let InsurSuite turn the paper trail into a working system.</p>
        <a className="primary-button" href="/login">Create account or sign in<ArrowRight size={17} /></a>
      </section>

      <footer className="marketing-footer">
        <span>© 2026 InsurSuite</span>
        <div><a href="/terms">Terms</a><a href="/privacy">Privacy</a></div>
      </footer>
    </main>
  );
}
```

(This file's convention for internal links is plain `<a href="...">`, not `next/link` — matching the existing `href="/login"` links a few lines above, so the footer follows the same pattern.)

- [ ] **Step 7: Add a footer to the login page**

In `app/login/page.tsx`, the default export currently ends with:

```tsx
        <div className="auth-panel-wrap">
          <Suspense fallback={<div className="auth-card"><p>Loading secure login...</p></div>}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
```

Add a footer between the closing `</section>` and `</main>`:

```tsx
        <div className="auth-panel-wrap">
          <Suspense fallback={<div className="auth-card"><p>Loading secure login...</p></div>}>
            <LoginForm />
          </Suspense>
        </div>
      </section>

      <footer className="marketing-footer">
        <span>© 2026 InsurSuite</span>
        <div><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></div>
      </footer>
    </main>
  );
}
```

This file already imports `Link` from `next/link` (used for the "Portal" nav link) — no new import needed.

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 9: Manual verify**

In the browser preview: visit `/terms` and `/privacy` directly while signed out — confirm both render (not a redirect to `/login`). Confirm the signup consent checkbox shows working "Terms of Service" and "Privacy Policy" links that open the new pages. Confirm the footer with both links appears at the bottom of the signed-out home page and the login page.

- [ ] **Step 10: Commit**

```bash
git add app/terms/page.tsx app/privacy/page.tsx middleware.ts app/page.tsx app/login/page.tsx app/globals.css
git commit -m "Add Terms of Service and Privacy Policy pages"
```

---

### Task 3: Error and 404 pages

**Files:**
- Create: `app/not-found.tsx`
- Create: `app/error.tsx`

- [ ] **Step 1: Create `app/not-found.tsx`**

This reuses the app's existing `.portal-gate`/`.gate-card`/`.gate-icon`/`.gate-brand` CSS pattern (already defined in `app/onboarding.css` and already used for the portal's own "couldn't open your portal" error state at `app/page.tsx:952`) rather than introducing new styles.

```tsx
import Link from "next/link";
import { CircleHelp, ShieldCheck } from "lucide-react";

export default function NotFound() {
  return (
    <main className="portal-gate">
      <div className="gate-card">
        <div className="gate-brand"><ShieldCheck size={27} /><strong>Insur<span>Suite</span></strong></div>
        <span className="gate-icon"><CircleHelp size={31} /></span>
        <h1>Page not found</h1>
        <p>The page you&apos;re looking for doesn&apos;t exist or may have moved.</p>
        <Link className="primary-button gate-signin" href="/">Back to InsurSuite</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create `app/error.tsx`**

Next.js requires this to be a Client Component that accepts `error`/`reset` props (App Router convention for the nearest error boundary). It must never render the raw `error.message` to the user — log it instead, same as any other unexpected runtime failure.

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CircleHelp, ShieldCheck } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="portal-gate">
      <div className="gate-card">
        <div className="gate-brand"><ShieldCheck size={27} /><strong>Insur<span>Suite</span></strong></div>
        <span className="gate-icon error"><CircleHelp size={31} /></span>
        <h1>Something went wrong</h1>
        <p>We hit an unexpected error loading this page. Your information is safe — try again, or head back to InsurSuite.</p>
        <button className="primary-button gate-signin" type="button" onClick={() => reset()}>Try again</button>
        <small><Link href="/">Back to InsurSuite</Link></small>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Manual verify — 404**

In the browser preview, navigate to a nonexistent path (e.g. `/this-page-does-not-exist`). Confirm the styled "Page not found" card renders (matching the app's visual language — brand mark, card, icon) instead of Next.js's raw default 404.

- [ ] **Step 5: Manual verify — error boundary**

Temporarily add `throw new Error("test")` at the top of any client-rendered view (e.g. the first line inside `Dashboard`'s function body), reload the page, and confirm the styled "Something went wrong" card renders with a working "Try again" button — then **remove the temporary throw** before committing.

- [ ] **Step 6: Commit**

```bash
git add app/not-found.tsx app/error.tsx
git commit -m "Add styled error and 404 pages"
```

---

### Task 4: Settings — make Save actually save

**Files:**
- Modify: `app/page.tsx:892-910` (`saveProfilePatch`), `app/page.tsx:566` (`SectionContent`'s prop type), `app/page.tsx:550-563` (`SettingsView`), `app/page.tsx:577` (`SettingsView`'s call site)
- Modify: `app/profile-fields.ts` (`CORE_PROFILE_FIELDS`)

- [ ] **Step 1: Add 4 notification-preference keys to the profile allow-list**

In `app/profile-fields.ts`, add 4 new entries to `CORE_PROFILE_FIELDS` (anywhere in the array; grouping them near the end, right before `"informationConsent"`, keeps related settings-ish fields together):

```ts
  "informationConsent",
```

becomes:

```ts
  "notifyEmail",
  "notifySms",
  "notifyPolicy",
  "notifyMarketing",
  "informationConsent",
```

`sanitizeProfile()` (same file) already accepts any key in this allow-list whose value is a `string` or `boolean` — no other change needed there, it will accept these 4 booleans automatically.

- [ ] **Step 2: Give `saveProfilePatch` a way to actually update top-level `fullName`/`phone`**

In `app/page.tsx`, `saveProfilePatch` currently (lines 892-910) always sends `storedProfile.fullName`/`storedProfile.phone` regardless of what's passed in, and only merges its `patch` argument into the nested `profile` object — meaning there is currently no way to change the account's name/phone at all through this function. Replace it with:

```tsx
  const saveProfilePatch = async (patch: Record<string, string | boolean>, accountPatch: { fullName?: string; phone?: string } = {}) => {
    if (!storedProfile) return null;
    const response = await fetch("/api/client-profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: accountPatch.fullName ?? storedProfile.fullName,
        phone: accountPatch.phone ?? storedProfile.phone,
        dateOfBirth: storedProfile.dateOfBirth,
        onboardingStatus: storedProfile.onboardingStatus || "completed",
        onboardingStep: storedProfile.onboardingStep || intakeSections.length,
        profile: { ...(storedProfile.profile || {}), ...patch },
      }),
    });
    const result = await response.json();
    if (!response.ok) { setToast(result.error || "Could not save profile"); return null; }
    setStoredProfile(result.profile);
    return result.profile as StoredProfile;
  };
```

The endpoint is `/api/client-profile` via `POST` (not PATCH — that route only exports `GET` and `POST`).

`accountPatch` defaults to `{}`, so the existing call site (`CallIntakeView`, which calls this function via its `onSave` prop with just one argument) keeps working unchanged.

- [ ] **Step 3: Widen `SectionContent`'s `onSaveProfile` prop type**

In `SectionContent`'s prop type (line 566), change:

```ts
onSaveProfile: (patch: Record<string, string | boolean>) => Promise<StoredProfile | null>
```

to:

```ts
onSaveProfile: (patch: Record<string, string | boolean>, accountPatch?: { fullName?: string; phone?: string }) => Promise<StoredProfile | null>
```

- [ ] **Step 4: Rewrite `SettingsView` to persist both the profile form and the notification toggles**

Replace the entire `SettingsView` function (currently lines 550-564) with:

```tsx
function SettingsView({ notify, user, profile, onSaveProfile }: { notify: (message: string) => void; user: PortalUser | null; profile: StoredProfile | null; onSaveProfile: (patch: Record<string, string | boolean>, accountPatch?: { fullName?: string; phone?: string }) => Promise<StoredProfile | null> }) {
  const preferenceKeyMap = { email: "notifyEmail", sms: "notifySms", policy: "notifyPolicy", marketing: "notifyMarketing" } as const;
  const [preferences, setPreferences] = useState({
    email: profile?.profile?.notifyEmail === undefined ? true : Boolean(profile.profile.notifyEmail),
    sms: profile?.profile?.notifySms === undefined ? true : Boolean(profile.profile.notifySms),
    policy: profile?.profile?.notifyPolicy === undefined ? true : Boolean(profile.profile.notifyPolicy),
    marketing: profile?.profile?.notifyMarketing === undefined ? false : Boolean(profile.profile.notifyMarketing),
  });
  const toggle = async (key: keyof typeof preferences) => {
    const nextValue = !preferences[key];
    setPreferences((current) => ({ ...current, [key]: nextValue }));
    await onSaveProfile({ [preferenceKeyMap[key]]: nextValue });
  };
  const initials = (profile?.fullName || user?.displayName || "Account").split(/\s+/).map((part) => part[0]).join("").slice(0,2).toUpperCase();
  const [qrDataUrl, setQrDataUrl] = useState("");
  useEffect(() => { import("qrcode").then((QRCode) => QRCode.toDataURL(window.location.origin, { margin: 1, width: 180 }).then(setQrDataUrl)); }, []);
  const submitProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await onSaveProfile({}, { fullName: String(form.get("fullName") || ""), phone: String(form.get("phone") || "") });
    if (result) notify("Profile settings saved.");
  };
  return <div className="section-view"><ViewHeading eyebrow="Account preferences" title="Settings" description="Manage your profile, security, and how InsurSuite keeps you informed." /><div className="settings-layout"><aside className="settings-nav"><button className="active"><UserRound size={17} />Profile</button><button><Bell size={17} />Notifications</button><button><LockKeyhole size={17} />Security</button><button><Gem size={17} />Plan & billing</button></aside><div className="settings-content"><Panel><PanelHeader title="Profile information" /><div className="profile-block"><span className="avatar big">{initials}</span><div><strong>{profile?.fullName || user?.displayName || "Account owner"}</strong><small>{user?.email || "Signed in account"}</small></div><form action="/auth/signout" method="post"><button className="secondary-button" type="submit">Sign out</button></form></div><form className="settings-form" onSubmit={submitProfile}><label>Full name<input name="fullName" defaultValue={profile?.fullName || user?.fullName || ""} /></label><label>Email address<input defaultValue={user?.email || ""} type="email" readOnly /></label><label>Phone number<input name="phone" defaultValue={profile?.phone || ""} /></label><label>State<select defaultValue="Texas"><option>Texas</option><option>Oklahoma</option><option>Florida</option></select></label><button className="primary-button" type="submit">Save changes</button></form></Panel><Panel><PanelHeader title="Notification preferences" /><div className="preference-list">{[["email", "Email updates", "Policy, ticket, and account activity"], ["sms", "Text reminders", "Draft dates and scheduled reviews"], ["policy", "Coverage alerts", "Missing details and annual review prompts"], ["marketing", "Product news", "New InsurSuite features and offers"]].map(([key, title, detail]) => <div key={key}><span><strong>{title}</strong><small>{detail}</small></span><button className={`toggle ${preferences[key as keyof typeof preferences] ? "on" : ""}`} onClick={() => toggle(key as keyof typeof preferences)} aria-label={`Toggle ${title}`}><i /></button></div>)}</div></Panel><Panel className="mobile-install-panel">
        <PanelHeader title="Get InsurSuite on your phone" />
        {qrDataUrl && <img src={qrDataUrl} alt="Scan to open InsurSuite on your phone" width={180} height={180} />}
        <div className="install-steps">
          <div><strong>iPhone (Safari)</strong><ol><li>Tap the Share icon</li><li>Tap &quot;Add to Home Screen&quot;</li></ol></div>
          <div><strong>Android (Chrome)</strong><ol><li>Tap the menu (⋮)</li><li>Tap &quot;Install app&quot; or &quot;Add to Home screen&quot;</li></ol></div>
        </div>
      </Panel></div></div></div>;
}
```

The only behavioral changes from the current version: the profile form's inputs are now named (`name="fullName"`, `name="phone"`) and its `onSubmit` actually persists via `onSaveProfile` instead of just calling `notify()`; the notification toggles read their initial state from the profile and persist each change via `onSaveProfile` instead of living in throwaway local state. The state dropdown, avatar, mobile-install panel, and everything else are unchanged.

- [ ] **Step 5: Pass `onSaveProfile` at `SettingsView`'s call site**

In `SectionContent`, change line 577 from:

```tsx
  return <SettingsView notify={notify} user={user} profile={profile} />;
```

to:

```tsx
  return <SettingsView notify={notify} user={user} profile={profile} onSaveProfile={onSaveProfile} />;
```

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 7: Manual verify**

In the browser preview, go to Settings. Edit the full name and phone fields, click "Save changes", reload the page — confirm both edits persisted (not reverted to the old values). Toggle one of the 4 notification preferences, reload the page — confirm the toggle stayed in its new position instead of resetting to the hardcoded default.

- [ ] **Step 8: Commit**

```bash
git add app/page.tsx app/profile-fields.ts
git commit -m "Make Settings profile save and notification toggles actually persist"
```

---

## Final verification (after all 4 tasks)

- [ ] Run `npm run build` one more time from a clean state to confirm nothing regressed across tasks.
- [ ] Full manual pass in the browser preview: sign in as a real test account, visit every nav item (Dashboard, My Policies, Document Vault, Support Center, Call Intake, Notifications, Family & Household, Settings) and confirm nothing broke. Visit `/terms`, `/privacy`, a bad URL, and (briefly, then revert) a forced error.
