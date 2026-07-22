# InsurSuite Internal Feature Backlog

This is the working product list for features to add over time. Keep it practical: each item should either improve trust, complete an insurance workflow, or make the codebase safer to grow.

## Now

- Refactor shared profile field definitions so onboarding, call intake, scoring, and API validation cannot drift.
- Add tests around client profile field persistence and sanitization.
- Split large screen components out of `app/page.tsx` into feature modules.
- Move coverage readiness and next-best-action logic into a reusable library.
- Add a client timeline model for policy, document, call, support, and review events.

## Next

- Build a full Client Profile editor for all saved onboarding and underwriting facts.
- Add Advisor Review Packet generation from client facts, policies, documents, underwriting notes, and next steps.
- Add call intake templates for life review, final expense, mortgage protection, beneficiary review, claim prep, and annual review.
- Add policy-linked document history with extracted fields beside the PDF preview.
- Add coverage gap explanations: missing contingent beneficiary, no emergency contact, unverified policy documents, stale review, incomplete financial goals, and missing underwriting facts.

## Later

- Add agent console internal notes, client-visible replies, SLA timers, reassignment, canned replies, and request-more-info actions.
- Add a dedicated client timeline screen and per-policy timeline.
- Add household-level coverage review with spouse/dependent needs and emergency contacts.
- Add claim preparation checklist with documents, claimant info, carrier contact, status tracking, and support handoff.
- Add production-grade exports: advisor brief PDF, policy inventory PDF, and call summary PDF.

## Design Debt

- Continue reducing card density by using full-width operational sections where a repeated card is not needed.
- Standardize typography, spacing, radii, status colors, shadows, and touch targets into source-level tokens.
- Give sample, empty, and live-data states stronger visual distinction.
- Keep Call Intake feeling like a live advisor cockpit: current question, notes, saved state, and next action should always be obvious.

## Code Debt

- Create shared field schemas for profile, onboarding, underwriting, service requests, and statuses.
- Normalize service request statuses and priorities into TypeScript unions.
- Add event records instead of assembling activity from documents, policies, and requests.
- Add API tests for access control: document ownership, agent assignment scope, and profile sanitization.
- Replace large inline JSX screens with smaller feature components.
