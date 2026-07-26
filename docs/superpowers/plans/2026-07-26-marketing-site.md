# Marketing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace InsurSuite's two thin, largely-unreachable marketing surfaces (`SignInGate` and `/landing`) with one real informative marketing site: a rebuilt homepage and 7 content pages, a shared nav with equal-weight Client Login / Agent Login buttons, a formalized navy/white design system with a serif-headline + Geist-body typography pairing, and a bespoke generative background motif — all gated behind a middleware fix that makes the site actually reachable by signed-out visitors (it currently isn't).

**Architecture:** A new shared `MarketingNav`/`MarketingFooter` component pair (`app/components/marketing-shell.tsx`) used by the rebuilt homepage and all 7 new content page routes, each following the same server-component pattern already established by `/terms` and `/privacy`. One new CSS layer in `app/globals.css` formalizes the navy/white palette as explicit tokens and adds the editorial (serif-headline) content style. One pre-generated static SVG asset provides the generative background motif — no client-side generative-art runtime, it's a plain vector file.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, hand-written CSS with custom properties (no Tailwind/shadcn), Google Fonts via `next/font/google`.

**Verification convention:** No unit-test framework in this repo (`npm test` = `next build`). Every task's test step is `npm run build` plus a manual browser-preview check.

**Spec:** `docs/superpowers/specs/2026-07-26-marketing-site-design.md`

**Design decisions locked in during brainstorming (via ui-ux-pro-max, frontend-design, and algorithmic-art skill exploration, confirmed with the user):**
- Palette: formalize the navy/white system already partially in `app/globals.css` (`#081831` headline ink, `#102039` body ink, `#2868d8` accent blue, `#536277`/`#697890` muted text, light off-white background) as explicit CSS custom properties, rather than introducing new colors.
- Typography: pair a serif display font (Newsreader) for headlines on the new editorial content pages with the existing Geist for body/UI text — not all-sans (reads generic), not all-serif (loses consistency with the rest of the app).
- A custom generative background motif ("Distributed Held" — a constrained Poisson-disc node field with nearest-neighbor connections) is available as a pre-generated static SVG asset, used sparingly as a section divider — not a general-purpose decorative pattern slathered across every page.

**Task order:** Tasks 1-5 are foundational (shared infrastructure) and must land before Tasks 6-11 (the actual pages), which depend on them. Tasks 6-11 can happen in any order relative to each other.

---

### Task 1: Typography and design tokens

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Add the Newsreader font**

In `app/layout.tsx`, add a `Newsreader` import alongside the existing `Geist`/`Geist_Mono`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
```

Add `newsreader.variable` to the `<body>` `className`:

```tsx
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} antialiased`}
      >
```

Note: this only makes the `--font-serif` custom property available — it does not change the default body font anywhere. The existing `body { font-family: Inter, ui-sans-serif, ... }` rule in `globals.css` is untouched by this plan (a pre-existing inconsistency — `--font-geist-sans` is loaded but not actually referenced by that rule — was noticed while doing this work, but fixing site-wide default typography is out of scope here; this plan only adds new, explicitly-scoped serif usage for the new editorial pages).

- [ ] **Step 2: Add navy design tokens and the editorial content style to `app/globals.css`**

**Important — name collision check first:** `app/globals.css`'s `:root` block (lines 6-8) already declares `--navy-950`, `--navy-900` (`#08224c`), and `--navy-800` (`#0a306c`) — different colors than what this task needs. Do NOT reuse those names (it would create two conflicting definitions of the same custom property, with whichever comes later in the file silently winning). Use distinct names instead — add these near the existing `--color-text-soft`/`--color-text-muted`/`--color-border` tokens:

```css
  --editorial-navy-900: #081831;
  --editorial-navy-800: #102039;
  --editorial-navy-accent: #2868d8;
```

(`#081831` and `#102039` are already used as hardcoded literals elsewhere in this file — e.g. `.legal-content h1`, `.hero-copy h1` — so this just gives the existing color a proper token name under this task's new scope, without touching the pre-existing `--navy-900`/`--navy-800` tokens or anything that currently uses them.)

Then, near the existing `.legal-content` rules (search for `.legal-content` — added during the MVP-launch-checklist work), add a parallel editorial style block for the new content pages:

```css
.editorial-content { max-width:760px; margin:0 auto; padding:clamp(38px,6vw,72px) clamp(20px,5vw,72px) 96px; color:#334259; }
.editorial-content h1 { font-family:var(--font-serif), Georgia, serif; margin:0 0 6px; color:var(--editorial-navy-900); font-size:clamp(34px,5.5vw,50px); font-weight:600; letter-spacing:-.5px; line-height:1.08; }
.editorial-content h2 { font-family:var(--font-serif), Georgia, serif; margin:38px 0 12px; color:var(--editorial-navy-800); font-size:clamp(22px,3vw,26px); font-weight:600; letter-spacing:-.3px; }
.editorial-content p { margin:0 0 6px; line-height:1.75; font-size:16px; }
.editorial-kicker { display:inline-block; margin-bottom:18px; color:var(--editorial-navy-accent); font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.1em; }
.editorial-content .content-note { margin-top:36px; padding-top:20px; border-top:1px solid rgba(204,216,230,.72); color:#697890; font-size:13px; }
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0. No visible change to any existing page yet — this task only adds new, unused-so-far CSS/font infrastructure.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "Add Newsreader font and navy design tokens for the marketing site"
```

---

### Task 2: Middleware — make the whole site reachable

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Add all 8 new public paths**

In `middleware.ts`, `isPublicPath()` currently reads:

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

Add `/`, `/mission`, `/manifesto`, `/how-it-works`, `/how-we-differ`, `/talk-to-an-agent`, `/faq`, and `/about`:

```ts
function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/mission" ||
    pathname === "/manifesto" ||
    pathname === "/how-it-works" ||
    pathname === "/how-we-differ" ||
    pathname === "/talk-to-an-agent" ||
    pathname === "/faq" ||
    pathname === "/about" ||
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

This is the single most important step in this whole plan — every page built in Tasks 6-11 is unreachable by a signed-out visitor without its path being listed here. Confirmed safe: middleware only redirects when `!user` (no session), so signed-in users hitting these paths are unaffected either way (they already pass through today).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "Add homepage and marketing content pages to the public-path allow-list"
```

---

### Task 3: Shared MarketingNav / MarketingFooter component

**Files:**
- Create: `app/components/marketing-shell.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, ShieldCheck, X } from "lucide-react";

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/mission", label: "Mission" },
  { href: "/manifesto", label: "Manifesto" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/how-we-differ", label: "How We're Different" },
  { href: "/talk-to-an-agent", label: "Talk with an Agent" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="marketing-nav" aria-label="InsurSuite marketing navigation">
      <Link href="/" className="gate-brand"><ShieldCheck size={27} /><strong>Insur<span>Suite</span></strong></Link>
      <button type="button" className="marketing-menu-toggle" onClick={() => setOpen((current) => !current)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      <div className={`marketing-nav-body${open ? " open" : ""}`}>
        <div className="marketing-nav-links">
          {NAV_LINKS.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
        </div>
        <div className="marketing-nav-logins">
          <a className="primary-button" href="/login">Client Login</a>
          <a className="secondary-button" href="/staff/login">Agent Login</a>
        </div>
      </div>
    </nav>
  );
}

export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <span>© 2026 InsurSuite</span>
      <div>
        {NAV_LINKS.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
      </div>
    </footer>
  );
}
```

Notes: `Menu`/`X`/`ShieldCheck` are all standard `lucide-react` icons (the package is already a dependency, `ShieldCheck` is already used throughout this codebase). `NAV_LINKS` is defined once and reused by both the nav and the footer, so there's one list to update if a page is ever added/renamed. `MarketingNav` is `"use client"` because it needs local state for the mobile menu toggle — `MarketingFooter` doesn't need state but lives in the same file since the two are always used together and share `NAV_LINKS`.

- [ ] **Step 2: Fix two existing rules that would otherwise break the mobile toggle**

**Important — pre-existing conflict #1:** `app/globals.css` line 392 has `.marketing-nav > div:last-child { display:flex; align-items:center; gap:8px; }`. In the new markup, `.marketing-nav-body` IS `.marketing-nav`'s last-child `<div>`, so this old rule also matches it — and at specificity (0,2,1) it beats the new mobile media-query rule's `display:none` at (0,1,0), meaning the nav body would stay visibly `flex` at every viewport width and the hamburger toggle would do nothing. Fix the old rule so it no longer matches the new element — change line 392 to:

```css
.marketing-nav > div:last-child:not(.marketing-nav-body) { display:flex; align-items:center; gap:8px; }
```

**Important — pre-existing conflict #2:** the same problem recurs inside the existing `@media (max-width: 680px)` block (lines 476-479 or thereabouts — search for `@media (max-width: 680px)`), which has its own leftover nav rules from before this component existed:

```css
@media (max-width: 680px) {
  .marketing-nav { position:relative; align-items:flex-start; flex-direction:column; }
  .marketing-nav > div:last-child { width:100%; overflow-x:auto; padding-bottom:2px; }
  ...
```

These two lines were written for the *old* nav structure (brand + one plain link row that stacked and scrolled horizontally). They're now redundant with — and conflict with — the new Step 3 rules below, which already fully take over mobile nav layout at ≤860px (a range that includes everything ≤680px): `.marketing-nav > div:last-child` here would again match `.marketing-nav-body` and force `width:100%; overflow-x:auto; padding-bottom:2px` onto the dropdown regardless of the new rules, and `.marketing-nav { flex-direction:column }` would stack the logo above the hamburger button instead of keeping them on one row. **Delete both of these two lines** from the `@media (max-width: 680px)` block entirely — don't just scope them, remove them, since the new ≤860px block in Step 3 is now the single source of truth for mobile nav layout and these are pure leftover duplication. Leave every other rule in that same `@media (max-width: 680px)` block untouched (the hero/product-grid/trust-strip rules there are unrelated to the nav and still needed).

- [ ] **Step 3: Add CSS for the two login buttons and the mobile menu toggle**

Add to `app/globals.css`, near the existing `.marketing-nav`/`.marketing-footer` rules:

```css
.marketing-nav-body { display:flex; align-items:center; gap:20px; }
.marketing-nav-links { display:flex; align-items:center; gap:18px; }
.marketing-nav-links a { min-height:40px; display:flex; align-items:center; padding:0 10px; border-radius:999px; color:#40536e; text-decoration:none; font-size:13px; font-weight:700; white-space:nowrap; }
.marketing-nav-links a:hover { color:#174fae; background:#edf5ff; }
.marketing-nav-logins { display:flex; align-items:center; gap:8px; padding-left:14px; border-left:1px solid rgba(204,216,230,.72); }
.marketing-nav-logins .primary-button, .marketing-nav-logins .secondary-button { padding:0 16px; min-height:38px; font-size:13px; text-decoration:none; }
.marketing-nav-logins .primary-button { color:#fff; }
.marketing-nav-logins .secondary-button { color:#18325b; }
.marketing-menu-toggle { display:none; padding:8px; border:0; border-radius:8px; background:transparent; color:#102039; cursor:pointer; }
@media (max-width: 860px) {
  .marketing-menu-toggle { display:flex; }
  .marketing-nav-body { position:absolute; top:100%; left:0; right:0; flex-direction:column; align-items:stretch; gap:16px; padding:18px clamp(20px,5vw,72px) 22px; background:#fff; border-bottom:1px solid rgba(204,216,230,.72); display:none; }
  .marketing-nav-body.open { display:flex; }
  .marketing-nav-links { flex-direction:column; align-items:flex-start; gap:4px; }
  .marketing-nav-logins { padding-left:0; border-left:0; border-top:1px solid rgba(204,216,230,.72); padding-top:14px; }
}
.marketing-footer .marketing-nav-links, .marketing-footer div { flex-wrap:wrap; }
```

Notes: `.marketing-nav-logins .primary-button`/`.secondary-button` explicitly set `color` because the existing `.marketing-nav a { color:#40536e; ... }` rule (line 393, specificity (0,1,1)) would otherwise win over the base `.primary-button`/`.secondary-button` classes' own color (specificity (0,1,0)) and render both login links as plain gray-blue text instead of the intended solid-navy/outlined button treatment — this override is required, not optional. Separately, this mobile-menu-toggle pattern is genuinely new (the existing `.marketing-nav` mobile behavior just stacks/scrolls; the toggle-button interaction pattern is new code for the marketing context, matching the spec's explicit callout of this). At 7 nav links plus 2 login buttons, the nav needs the collapse to avoid crowding — 860px was chosen (not the more common 768px) to give the 7-link row enough room to stay uncrowded slightly longer before collapsing, given how much horizontal content this specific nav carries.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: exits 0. `MarketingNav`/`MarketingFooter` aren't imported anywhere yet, so this is inert — just confirms no syntax errors.

- [ ] **Step 5: Commit**

```bash
git add app/components/marketing-shell.tsx app/globals.css
git commit -m "Add shared MarketingNav/MarketingFooter components"
```

---

### Task 4: `?mode=signup` support on `/login`

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Read the `mode` search param on mount**

In `app/login/page.tsx`, `LoginForm` currently initializes its mode state as:

```tsx
  const [mode, setMode] = useState<"signin" | "signup">("signin");
```

Change it to read the `mode` query param, defaulting to `"signin"` for anything else (missing, `"signin"`, or any unrecognized value):

```tsx
  const [mode, setMode] = useState<"signin" | "signup">(searchParams.get("mode") === "signup" ? "signup" : "signin");
```

This line comes after `const searchParams = useSearchParams();` (already present a few lines above for `return_to`), so no new hook call is needed — just read `mode` from the same `searchParams` object.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Manual verify**

There's no dev server running yet in this task's context — skip interactive verification here (Task 6 onward will exercise this end-to-end once the Talk with an Agent page links to it). Confirm by reading the diff that `searchParams.get("mode")` is called before any conditional return, matching how `return_to` is already read.

- [ ] **Step 4: Commit**

```bash
git add app/login/page.tsx
git commit -m "Support ?mode=signup on the login page"
```

---

### Task 5: Generative background motif asset — already done

`public/motifs/distributed-held.svg` is already committed to `main` (generated using a seeded Poisson-disc node-field algorithm — nodes placed with a minimum-distance constraint, connected only to their nearest 2 neighbors, line opacity falling off with distance — a deliberate alternative to a generic gradient-blob decoration). No action needed for this task; it's listed here only so Task 6 (which references `/motifs/distributed-held.svg`) has a clear pointer to where the asset came from.

- [ ] **Step 1: Confirm the asset is present**

Run: `wc -l public/motifs/distributed-held.svg` — expect 158 lines, starting with `<svg viewBox="0 0 1400 220" ...>`. If it's missing for any reason, stop and flag it — don't regenerate a different one, since Task 6's homepage design was validated against this specific file.

---

### Task 6: Rebuild the homepage (`SignInGate`)

**Files:**
- Modify: `app/page.tsx:664-759` (`SignInGate`)

- [ ] **Step 1: Replace `SignInGate` entirely**

Replace the full current `SignInGate` function (lines 664-759) with:

```tsx
function SignInGate() {
  return (
    <main className="marketing-page">
      <MarketingNav />

      <section className="marketing-hero">
        <div className="hero-copy">
          <span className="market-kicker"><LockKeyhole size={15} />Insurance, organized</span>
          <h1>We help families understand what protects them, before it&apos;s urgent.</h1>
          <p>InsurSuite gives you and your agent one honest place for policies, documents, beneficiaries, and every conversation about your coverage.</p>
          <div className="hero-actions">
            <a className="primary-button" href="/login?mode=signup">Create account<ArrowRight size={17} /></a>
            <Link className="secondary-button" href="/mission">Read our mission</Link>
          </div>
          <div className="trust-strip">
            <span><CheckCircle2 size={16} />Policy vault</span>
            <span><CheckCircle2 size={16} />Coverage checkups</span>
            <span><CheckCircle2 size={16} />Human support</span>
          </div>
        </div>
        <div className="hero-photo" aria-hidden="true">
          <img src="https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=900&q=70" alt="" />
        </div>
      </section>

      <div className="motif-divider" aria-hidden="true"><img src="/motifs/distributed-held.svg" alt="" /></div>

      <section className="homepage-teasers">
        <Link href="/mission" className="teaser-card"><span className="editorial-kicker">Mission</span><p>Why we built InsurSuite, and who it&apos;s for.</p><ArrowRight size={16} /></Link>
        <Link href="/manifesto" className="teaser-card"><span className="editorial-kicker">Manifesto</span><p>What we believe insurance should feel like.</p><ArrowRight size={16} /></Link>
        <Link href="/talk-to-an-agent" className="teaser-card"><span className="editorial-kicker">Talk with an Agent</span><p>Real conversation, no pressure, no cold calls.</p><ArrowRight size={16} /></Link>
      </section>

      <section className="differentiator-strip">
        <h2>How we&apos;re different</h2>
        <div>
          <article><strong>Your own agent</strong><p>Not a call center — one person who knows your household.</p></article>
          <article><strong>A real document vault</strong><p>Every policy and form in one place, not scattered across drawers and emails.</p></article>
          <article><strong>No cold-call pressure</strong><p>We answer questions. We don&apos;t chase renewals with sales calls.</p></article>
        </div>
        <Link href="/how-we-differ" className="secondary-button">Read the full comparison<ArrowRight size={16} /></Link>
      </section>

      <section className="closing-cta">
        <h2>Build a coverage file your future self can actually use.</h2>
        <p>Start with your account, add the policies you already own, and let InsurSuite turn the paper trail into a working system.</p>
        <a className="primary-button" href="/login?mode=signup">Create account or sign in<ArrowRight size={17} /></a>
      </section>

      <MarketingFooter />
    </main>
  );
}
```

Add `MarketingNav`/`MarketingFooter` to the imports at the top of `app/page.tsx`:

```tsx
import { MarketingNav, MarketingFooter } from "./components/marketing-shell";
```

(`Link` from `next/link` is not currently imported in `app/page.tsx` — check the top of the file; if it's missing, add `import Link from "next/link";`. `ArrowRight`, `CheckCircle2`, `LockKeyhole` are already imported and used elsewhere in this file.)

Notes on what changed from the old version: the in-page `#mission`/`#manifesto`/`#platform` anchor sections are gone — that content now lives on real pages (Task 7). The old `.hero-product` fake product-window mockup is replaced with a real photo (matches the spec's "informative hero with real photography, not a login-focused hero" — logins now live in the nav). The generative motif appears once, as a section divider between the hero and the teaser cards — not repeated elsewhere on this page, matching the "used sparingly" design decision.

- [ ] **Step 2: Add CSS for the new homepage sections**

Add to `app/globals.css`, near the existing `.marketing-hero`/`.trust-strip` rules:

```css
.hero-photo { position:relative; min-height:420px; border-radius:22px; overflow:hidden; box-shadow:0 30px 70px rgba(10,31,68,.16); }
.hero-photo img { width:100%; height:100%; object-fit:cover; display:block; }
.motif-divider { width:100%; overflow:hidden; }
.motif-divider img { width:100%; display:block; }
.homepage-teasers { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; padding:48px clamp(20px,5vw,72px); }
.teaser-card { display:flex; flex-direction:column; gap:10px; padding:22px; border:1px solid rgba(204,216,230,.72); border-radius:16px; text-decoration:none; color:inherit; transition:.18s var(--ease-out); }
.teaser-card:hover { border-color:#9bbcf0; transform:translateY(-2px); box-shadow:0 12px 30px rgba(10,31,68,.08); }
.teaser-card p { margin:0; color:#334259; font-size:14px; line-height:1.55; }
.teaser-card svg { color:#2868d8; }
.differentiator-strip { padding:8px clamp(20px,5vw,72px) 56px; }
.differentiator-strip h2 { font-family:var(--font-serif), Georgia, serif; margin:0 0 22px; color:var(--editorial-navy-900); font-size:clamp(24px,3vw,30px); }
.differentiator-strip > div { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-bottom:22px; }
.differentiator-strip article strong { display:block; margin-bottom:6px; color:var(--editorial-navy-800); font-size:15px; }
.differentiator-strip article p { margin:0; color:#536277; font-size:13px; line-height:1.55; }
@media (max-width: 860px) {
  .homepage-teasers, .differentiator-strip > div { grid-template-columns:1fr; }
}
```

`hero-photo` reuses the existing `.marketing-hero` grid (already `grid-template-columns:minmax(0,1fr) minmax(440px,.82fr)` per the current CSS) as its second column, so no changes to `.marketing-hero` itself are needed — only the new `.hero-photo`/`img` styling for what goes inside that second column.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Manual verify**

Start the dev server. Visit `/` while signed out — confirm it's no longer redirected to `/login` (this exercises Task 2's fix). Confirm the nav shows all 7 links plus Client Login/Agent Login. Confirm the hero photo, motif divider, teaser cards, differentiator strip, and closing CTA all render. Click "Create account" — confirm it lands on `/login` with the sign-up tab active (exercises Task 4). Resize to a narrow viewport — confirm the nav collapses behind the menu toggle and the toggle actually opens/closes it.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/globals.css
git commit -m "Rebuild the homepage: informative hero, real photography, nav-based logins"
```

---

### Task 7: Mission and Manifesto pages

**Files:**
- Create: `app/mission/page.tsx`
- Create: `app/manifesto/page.tsx`

- [ ] **Step 1: Create `app/mission/page.tsx`**

```tsx
import { MarketingNav, MarketingFooter } from "../components/marketing-shell";

export const metadata = { title: "Mission | InsurSuite" };

export default function MissionPage() {
  return (
    <main className="marketing-page">
      <MarketingNav />
      <section className="editorial-content">
        <span className="editorial-kicker">Mission</span>
        <h1>Insurance should be legible before it&apos;s urgent.</h1>
        <p>InsurSuite exists to make insurance feel organized, explainable, and human before life forces the issue. Most people find out how their coverage actually works at the worst possible moment — after a loss, during a claim, in the middle of a life change nobody planned for.</p>
        <p>We think that&apos;s backwards. So we built a place where you and your agent can see the same picture at the same time: what you have, what it covers, who it protects, and what still needs attention. Not a portal you check once a year and forget. A working system.</p>
        <h2>Who this is for</h2>
        <p>Families who want to actually understand their own coverage. Agents who want a real relationship with their clients, not a spreadsheet and a renewal reminder. People who are tired of digging through email threads and filing cabinets to answer a question that should take thirty seconds.</p>
        <p>We are building this for the people who protect a family for a living, and the families who trust them to do it right.</p>
      </section>
      <MarketingFooter />
    </main>
  );
}
```

- [ ] **Step 2: Create `app/manifesto/page.tsx`**

```tsx
import { MarketingNav, MarketingFooter } from "../components/marketing-shell";

export const metadata = { title: "Manifesto | InsurSuite" };

const beliefs = [
  "Insurance should be legible before it is urgent.",
  "Every household deserves one trusted place for policies, people, documents, and next steps.",
  "You should never have to search through emails, drawers, and carrier portals to understand what protects your family.",
  "Your agent should know your family, not just your policy number.",
  "A good system disappears into the background until the day you need it most — and then it makes everything simple.",
];

export default function ManifestoPage() {
  return (
    <main className="marketing-page">
      <MarketingNav />
      <section className="editorial-content">
        <span className="editorial-kicker">Manifesto</span>
        <h1>Coverage is a promise. The system around it should act like one.</h1>
        <p>A few things we believe, plainly stated:</p>
        {beliefs.map((line, index) => (
          <p key={line} style={{ marginTop: index === 0 ? 28 : 18 }}><strong style={{ color: "var(--editorial-navy-accent)", marginRight: 10 }}>{String(index + 1).padStart(2, "0")}</strong>{line}</p>
        ))}
      </section>
      <MarketingFooter />
    </main>
  );
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Manual verify**

Visit `/mission` and `/manifesto` while signed out — confirm both render (not redirected), confirm the serif headline font is visibly applied, confirm the nav/footer are present and match the homepage.

- [ ] **Step 5: Commit**

```bash
git add app/mission/page.tsx app/manifesto/page.tsx
git commit -m "Add Mission and Manifesto pages"
```

---

### Task 8: How It Works and How We're Different pages

**Files:**
- Create: `app/how-it-works/page.tsx`
- Create: `app/how-we-differ/page.tsx`

- [ ] **Step 1: Create `app/how-it-works/page.tsx`**

```tsx
import { MarketingNav, MarketingFooter } from "../components/marketing-shell";

export const metadata = { title: "How It Works | InsurSuite" };

const steps = [
  { title: "Create your account", detail: "Sign up with your email — takes under a minute. No policy numbers or paperwork required to start." },
  { title: "A short protection profile", detail: "A few short questions about your household, goals, and beneficiaries. Skip anything you're not ready to answer yet." },
  { title: "Add your existing policies", detail: "Upload what you have and Document Intelligence organizes it — or your agent can add it on your behalf." },
  { title: "Your agent has the full picture", detail: "Your assigned agent sees the same coverage file you do, so every conversation starts from the same information." },
  { title: "Ongoing support and reviews", detail: "Ask questions, request changes, and get reminded when it's time for an annual review — all tracked in one place." },
];

export default function HowItWorksPage() {
  return (
    <main className="marketing-page">
      <MarketingNav />
      <section className="editorial-content">
        <span className="editorial-kicker">How It Works</span>
        <h1>From signup to a real working coverage file.</h1>
        <p>InsurSuite isn&apos;t an insurance carrier — it&apos;s the place where your coverage information actually lives and stays current. Here&apos;s what actually happens, step by step.</p>
        {steps.map((step, index) => (
          <div key={step.title} style={{ marginTop: 30 }}>
            <h2 style={{ margin: "0 0 8px" }}>{index + 1}. {step.title}</h2>
            <p>{step.detail}</p>
          </div>
        ))}
        <p className="content-note">Uploading documents or answering profile questions doesn&apos;t itself change your policy — changes to your actual coverage always go through your carrier and your agent.</p>
      </section>
      <MarketingFooter />
    </main>
  );
}
```

- [ ] **Step 2: Create `app/how-we-differ/page.tsx`**

```tsx
import { MarketingNav, MarketingFooter } from "../components/marketing-shell";

export const metadata = { title: "How We're Different | InsurSuite" };

export default function HowWeDifferPage() {
  return (
    <main className="marketing-page">
      <MarketingNav />
      <section className="editorial-content">
        <span className="editorial-kicker">How We&apos;re Different</span>
        <h1>Compared to a traditional broker relationship.</h1>
        <p style={{ fontStyle: "italic", color: "#697890" }}>This page is a first draft — replace with your own specifics before it ships publicly.</p>
        <h2>One agent, not a call center</h2>
        <p>Your questions go to the person who actually knows your household and your history, not a rotating queue of whoever picks up.</p>
        <h2>A real document vault, not a filing cabinet</h2>
        <p>Every policy, form, and statement lives in one place you and your agent can both see — not scattered across email threads, paper files, and carrier portals you have to log into separately.</p>
        <h2>No cold-call renewal pressure</h2>
        <p>We answer questions and flag what genuinely needs attention. We don&apos;t chase you with sales calls to hit a renewal quota.</p>
        <h2>Your coverage picture, visible any time</h2>
        <p>You shouldn&apos;t have to wait for your annual renewal call to find out what you&apos;re actually covered for. It&apos;s visible in your account whenever you want to check.</p>
      </section>
      <MarketingFooter />
    </main>
  );
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Manual verify**

Visit `/how-it-works` and `/how-we-differ` while signed out — confirm both render correctly with nav/footer and serif headlines.

- [ ] **Step 5: Commit**

```bash
git add app/how-it-works/page.tsx app/how-we-differ/page.tsx
git commit -m "Add How It Works and How We're Different pages"
```

---

### Task 9: Talk with an Agent and FAQ pages

**Files:**
- Create: `app/talk-to-an-agent/page.tsx`
- Create: `app/faq/page.tsx`

- [ ] **Step 1: Create `app/talk-to-an-agent/page.tsx`**

```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingNav, MarketingFooter } from "../components/marketing-shell";

export const metadata = { title: "Talk with an Agent | InsurSuite" };

export default function TalkToAnAgentPage() {
  return (
    <main className="marketing-page">
      <MarketingNav />
      <section className="editorial-content">
        <span className="editorial-kicker">Talk with an Agent</span>
        <h1>A real conversation, with someone who knows your file.</h1>
        <p>Once you create an account, you&apos;re assigned a real agent who can see your coverage picture — the same one you see. No cold transfers, no re-explaining your situation from scratch every time you call.</p>
        <h2>What to expect</h2>
        <p>No sales pressure. No pushed upgrades. Your agent is there to answer real questions — about a claim, a life change, a beneficiary update, or just making sure you understand what you already have.</p>
        <h2>How to start</h2>
        <p>Create your account, and a request or question sent from inside the portal goes straight to your assigned agent — tracked, not lost in an inbox.</p>
        <Link className="primary-button" href="/login?mode=signup" style={{ marginTop: 20, width: "max-content", textDecoration: "none" }}>Create your account<ArrowRight size={17} /></Link>
      </section>
      <MarketingFooter />
    </main>
  );
}
```

- [ ] **Step 2: Create `app/faq/page.tsx`**

```tsx
import { MarketingNav, MarketingFooter } from "../components/marketing-shell";

export const metadata = { title: "FAQ | InsurSuite" };

const faqs = [
  { q: "Is InsurSuite an insurance carrier?", a: "No. InsurSuite is a client portal that helps you and your agent organize policy information, documents, and communication. Your actual coverage is with your carrier — InsurSuite doesn't issue or underwrite policies." },
  { q: "Does uploading a document or updating my profile change my policy?", a: "No. Nothing you do inside InsurSuite itself changes, cancels, or creates coverage — those changes still go through your carrier and your agent, same as always." },
  { q: "What information do you collect, and why?", a: "Enough to help your agent service your coverage — contact info, household and beneficiary details, income range, coverage goals, and any documents you choose to upload. See our Privacy Policy for the full breakdown." },
  { q: "How do I talk to my agent?", a: "Once you have an account, requests and questions sent from inside the portal go directly to your assigned agent. See the Talk with an Agent page for more." },
  { q: "How do I stop using InsurSuite?", a: "Contact your agent directly. Your actual insurance coverage is unaffected either way — it lives with your carrier, not with this portal." },
];

export default function FaqPage() {
  return (
    <main className="marketing-page">
      <MarketingNav />
      <section className="editorial-content">
        <span className="editorial-kicker">FAQ</span>
        <h1>Common questions.</h1>
        {faqs.map((item) => (
          <div key={item.q} style={{ marginTop: 28 }}>
            <h2 style={{ margin: "0 0 8px" }}>{item.q}</h2>
            <p>{item.a}</p>
          </div>
        ))}
      </section>
      <MarketingFooter />
    </main>
  );
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Manual verify**

Visit `/talk-to-an-agent` — confirm the "Create your account" button links to `/login?mode=signup` and actually lands on the sign-up tab. Visit `/faq` — confirm all 5 questions render.

- [ ] **Step 5: Commit**

```bash
git add app/talk-to-an-agent/page.tsx app/faq/page.tsx
git commit -m "Add Talk with an Agent and FAQ pages"
```

---

### Task 10: About page

**Files:**
- Create: `app/about/page.tsx`

- [ ] **Step 1: Create `app/about/page.tsx`**

```tsx
import { MarketingNav, MarketingFooter } from "../components/marketing-shell";

export const metadata = { title: "About | InsurSuite" };

export default function AboutPage() {
  return (
    <main className="marketing-page">
      <MarketingNav />
      <section className="editorial-content">
        <span className="editorial-kicker">About</span>
        <h1>Built by someone who thinks insurance should be easier to understand.</h1>
        <p>InsurSuite is early — right now, that means a small, hands-on team working directly with the first clients using it. As the product and the team grow, this page will grow with it.</p>
        <p>If you have questions about who&apos;s behind InsurSuite, ask your agent directly.</p>
      </section>
      <MarketingFooter />
    </main>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Manual verify**

Visit `/about` — confirm it renders.

- [ ] **Step 4: Commit**

```bash
git add app/about/page.tsx
git commit -m "Add About page"
```

---

### Task 11: Retire `/landing`

**Files:**
- Delete: `app/landing/page.tsx`

- [ ] **Step 1: Delete the file**

```bash
git rm app/landing/page.tsx
```

- [ ] **Step 2: Confirm no remaining references**

Run: `grep -rn "landing" app/ --include="*.tsx" --include="*.ts"` (excluding this deleted file) — expect no internal links pointing at `/landing` anywhere in the app (nothing referenced it before this plan; this is a final confirmation, not an expected fix).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0. `/landing` no longer appears in the route list.

- [ ] **Step 4: Manual verify**

Visit `/landing` — confirm it 404s (via the styled `not-found.tsx` page from the earlier MVP-checklist work).

- [ ] **Step 5: Commit**

```bash
git commit -m "Retire the redundant /landing page"
```

---

## Final verification (after all 11 tasks)

- [ ] `npm run build` one more time from a clean state.
- [ ] Full signed-out browser pass: `/`, `/mission`, `/manifesto`, `/how-it-works`, `/how-we-differ`, `/talk-to-an-agent`, `/faq`, `/about`, `/terms`, `/privacy` — every one should render, none should redirect to `/login`. Click every nav link from the homepage. Click both "Client Login" and "Agent Login" — confirm they land on `/login` and `/staff/login` respectively. Confirm `/login?mode=signup` (reached via any "Create account" CTA) actually opens on the sign-up tab.
- [ ] Signed-in pass: visit `/` while signed in — confirm the authenticated dashboard still renders correctly, unaffected by the middleware change.
- [ ] Resize to mobile width on the homepage and one content page — confirm the nav collapses behind the menu toggle and the toggle works.
