# Milestones

A milestone groups a contiguous run of [phases](phase-tracker.md) around one
externally-meaningful outcome — something a real customer or design partner
could see or use — rather than one phase's internal deliverable. Milestones
are a coarser lens on the same sequenced work the phase tracker already
governs: they do not replace phase entry/exit criteria, and a milestone
cannot close until every phase inside it is `Complete` by the phase
tracker's own definition.

**Status legend:** `Complete` · `In Progress` · `Not Started`

## Milestone 1: Foundation

- **Outcome:** A deployable Next.js application with real authentication,
  organization creation, and a complete public marketing site — the ground
  every later milestone is built on. No persisted product data yet.
- **Phases:** -1 (Cloud/CI foundation), 0 (Product and engineering
  foundation), 1 (Repository and design foundation), 2 (Marketing website),
  3 (Authentication and organizations).
- **Status:** In Progress — Phase -1 is `Complete`; Phases 0–3 are
  `In Progress` per the [phase tracker](phase-tracker.md) (each has shipped
  implementation but is still awaiting a visual/Vercel-preview review step
  outstanding since Phase 1, tracked there, not duplicated here).

## Milestone 2: Core Platform

- **Outcome:** The first secure, customer-testable ProcessPilot core
  platform — a design partner can create an account, structure their
  organization, publish a policy and a process, run a workflow, and see it
  through to completion, on a stable Vercel staging deployment.
- **Phases:** 4 (Database and tenant isolation), 5 (Business onboarding and
  employee management), 6 (Knowledge management), 7 (Process builder), 8
  (Workflow execution engine), 8.5 (MVP staging and design-partner
  validation).
- **Status:** In Progress — Phase 4 started.
- **Detail:** [milestone-2-core-platform.md](milestone-2-core-platform.md).

## Milestone 3: Execution governance

- **Outcome:** The core loop gains the accountability layer real
  operational customers require: structured evidence, multi-step approvals,
  exception handling, and training/certification tracking.
- **Phases:** 9 (Forms and evidence), 10 (Approvals and escalations), 11
  (Exception management), 12 (Training and certifications).
- **Status:** Complete — Phases 9–12 are all `Complete` per the
  [phase tracker](phase-tracker.md).

## Milestone 4: Intelligence

- **Outcome:** AI assists across the product loop under a verified
  governance boundary, and operational data becomes analytics and an audit
  trail customers can rely on.
- **Phases:** 13 (AI ingestion and copilot), 14 (Analytics), 15 (Audit and
  compliance center).
- **Status:** Complete — Phases 13–15 are all `Complete` per the
  [phase tracker](phase-tracker.md). Live AI output remains unverified
  end-to-end (no real `ANTHROPIC_API_KEY` in this environment) — the
  code is complete and tested against deterministic mocks, but this
  milestone's "customers can rely on it" outcome is not yet proven
  against a live provider.

## Milestone 5: Commercial readiness

- **Outcome:** The product is sellable — billed, notifiable, integrable,
  usable by external collaborators, and usable on mobile.
- **Phases:** 16 (Notifications), 17 (Billing and entitlements), 18
  (Integrations), 19 (External portal), 20 (Responsive PWA).
- **Status:** In Progress — Phase 16, Phase 17, and Phase 18 are
  `Complete` per the [phase tracker](phase-tracker.md) (live email
  delivery, live billing, and live SSO all similarly unverified — no
  real `EMAIL_PROVIDER_API_KEY`, `STRIPE_SECRET_KEY`/
  `STRIPE_WEBHOOK_SECRET`, or Clerk Enterprise Connections-enabled
  organization exercised in this environment; Phase 17's pricing is
  also still an unvalidated hypothesis, not committed pricing, and
  Phase 18's SSO/SAML target wasn't sourced from customer feedback,
  since none exists pre-launch — see
  [billing-architecture.md](../architecture/billing-architecture.md)
  and
  [integration-architecture.md](../architecture/integration-architecture.md));
  Phases 19–20 have not started. This milestone's "billed, integrable"
  outcomes are not yet actually proven — they're built and
  mocked-tested, not verified against a real Stripe account, a real
  Clerk Enterprise Connections-enabled organization, or a real
  commercial pricing decision.

## Milestone 6: General availability (planned)

- **Outcome:** Hardened, observable, legally reviewed, and ready for a
  general-availability release.
- **Phases:** 21 (Organization administration) through 30 (Release
  candidate).
- **Status:** Not Started.

## Related documents

- [Phase tracker](phase-tracker.md) — authoritative phase-level detail.
- [Roadmap](roadmap.md) — milestone sequencing and dependencies.
- [Current project status](current-project-status.md)
- [product/roadmap.md](../../product/roadmap.md) — the earlier,
  phase-horizon framing this milestone view supersedes for
  progress-reporting purposes; phase horizons and milestones describe the
  same phase sequence from two angles and are kept consistent by design.
