# Phase Tracker

Authoritative, sequenced record of every planned phase of ProcessPilot
work. A phase does not start until its dependencies are `Complete`, and
does not close until its exit criteria are verifiably met — not merely
attempted. See [product/roadmap.md](../../product/roadmap.md) for the
narrative grouping of these phases into horizons.

**Status legend:** `Complete` · `In Progress` · `Not Started`

## Summary

| Phase | Name                                        | Status      |
| ----- | ------------------------------------------- | ----------- |
| -1    | Cloud/CI foundation                         | Complete    |
| 0     | Product and engineering foundation          | In Progress |
| 1     | Repository and design foundation            | In Progress |
| 2     | Marketing website                           | In Progress |
| 3     | Authentication and organizations            | In Progress |
| 4     | Database and tenant isolation               | Not Started |
| 5     | Business onboarding and employee management | Not Started |
| 6     | Knowledge management                        | Not Started |
| 7     | Process builder                             | Not Started |
| 8     | Workflow execution engine                   | Not Started |
| 9     | Forms and evidence                          | Not Started |
| 10    | Approvals and escalations                   | Not Started |
| 11    | Exception management                        | Not Started |
| 12    | Training and certifications                 | Not Started |
| 13    | AI ingestion and copilot                    | Not Started |
| 14    | Analytics                                   | Not Started |
| 15    | Audit and compliance center                 | Not Started |
| 16    | Notifications                               | Not Started |
| 17    | Billing and entitlements                    | Not Started |
| 18    | Integrations                                | Not Started |
| 19    | External portal                             | Not Started |
| 20    | Responsive PWA                              | Not Started |
| 21    | Organization administration                 | Not Started |
| 22    | Security hardening                          | Not Started |
| 23    | Reliability and observability               | Not Started |
| 24    | Complete QA                                 | Not Started |
| 25    | Legal and trust readiness                   | Not Started |
| 26    | Deployment                                  | Not Started |
| 27    | Internal support console                    | Not Started |
| 28    | Demo workspace                              | Not Started |
| 29    | Final product and design audit              | Not Started |
| 30    | Release candidate                           | Not Started |

## Phase -1: Cloud/CI foundation

- **Goal:** Establish the remote-first development environment and CI/CD
  scaffolding before any product or documentation work begins.
- **Deliverables:** Devcontainer, GitHub Actions CI/security workflows,
  Prettier/ESLint/TypeScript/Vitest/Playwright configuration, PR/issue
  templates, CODEOWNERS, Dependabot, base Next.js app, `docs/development/`.
- **Dependencies:** None.
- **Entry criteria:** Empty repository.
- **Exit criteria:** `npm run phase:commit` passes; Codespace boots and
  serves the app; CI is green.
- **Status:** Complete.
- **Risks:** None outstanding.

## Phase 0: Product and engineering foundation

- **Goal:** Establish the permanent product, architecture, engineering,
  security, and design documentation required before implementing any
  product feature.
- **Deliverables:** `product/` (16 docs), `docs/architecture/` (14 docs +
  12 ADRs), `design/` (branding, colors, typography, spacing, components,
  layouts, accessibility, content style), this phase tracker, updated
  `CLAUDE.md` engineering rules, GitHub issue-template phase mapping,
  updated `README.md`.
- **Dependencies:** Phase -1.
- **Entry criteria:** Cloud/CI foundation complete and repository
  inspected.
- **Exit criteria:** All documents listed above exist, cross-reference
  consistently, contain no contradictions, and pass the Phase 0
  completion audit (link validation, secret scan, no product code
  introduced). `npm run phase:commit` remains green.
- **Status:** In Progress.
- **Risks:** Documentation drifting out of sync with implementation once
  later phases begin — mitigated by requiring each phase's PR to update
  the relevant `product/`/`docs/architecture/` files it affects, and by
  keeping this tracker as the single status source of truth.

## Phase 1: Repository and design foundation

- **Goal:** Turn the design documentation from Phase 0 into a working
  design-token and component foundation (Tailwind theme, base primitives)
  without building product screens yet.
- **Deliverables:** Tailwind configuration matching
  [design/colors.md](../../design/colors.md) and
  [design/typography.md](../../design/typography.md); base accessible
  component primitives per [design/components.md](../../design/components.md);
  logo/icon assets in `design/logo/` and `design/icons/`; an internal
  `/design-system` gallery route (gated by
  `NEXT_PUBLIC_ENABLE_DESIGN_SYSTEM`, see
  [environment-variables.md](../development/environment-variables.md)); a
  minimal marketing shell (header/footer, homepage) exercising the
  primitives, brought forward to support Phase 2.
- **Dependencies:** Phase 0.
- **Entry criteria:** Design documentation complete and reviewed.
- **Exit criteria:** A component gallery/preview route renders the base
  primitives correctly in light of accessibility requirements; visual
  review done via Vercel preview, not local screenshots.
- **Status:** In Progress — implementation complete, `npm run phase:commit`
  green; visual review via Vercel preview still outstanding (Vercel
  deployment is currently failing for platform-configuration reasons
  unrelated to this phase's code — see Phase 0's notes). No approved logo
  or icon asset exists yet, so the marketing shell uses a text-only
  wordmark per [design/branding.md](../../design/branding.md) rather than
  a fabricated mark.
- **Risks:** Premature component abstraction before real product screens
  exist to validate against — mitigated by keeping the primitive set
  minimal. Marketing shell/homepage were pulled forward into this phase
  (rather than deferred entirely to Phase 2) because the two phases were
  developed in parallel — Phase 2 builds the remaining marketing pages on
  top of this shell.

## Phase 2: Marketing website

- **Goal:** Build processpilot.com per
  [product/information-architecture.md](../../product/information-architecture.md).
- **Deliverables:** All 30 required public routes — homepage; a Product
  hub and 7 product pages; a Solutions hub and 5 solution pages; an
  Industries hub and 5 industry pages; Pricing, Security, Resources,
  Company; Request demo, Start trial, Sign in; Privacy, Terms — built
  with shared, content-driven page templates (`ProductPageTemplate`,
  `SolutionPageTemplate`, `IndustryPageTemplate`) rather than one-off
  page components. Request demo, Start trial, and Sign in are full
  development-mode forms (react-hook-form + zod, client- and
  server-side validated) posting to isolated `/api/*` routes — nothing
  is persisted, no email is sent, every response says so explicitly —
  rather than static stubs, since Phase 3 (real auth/persistence)
  hadn't landed when this phase was built.
- **Dependencies:** Phase 1.
- **Entry criteria:** Design foundation available.
- **Exit criteria:** All pages listed exist, are responsive, meet WCAG 2.1
  AA, and contain no fabricated statistics/testimonials/logos per
  [product/product-principles.md](../../product/product-principles.md).
- **Status:** In Progress — implementation complete: homepage's 14
  required sections (sticky nav, hero, business problem, operating loop,
  product pillars, role-preview tabs, procedure-to-workflow demo, AI
  capabilities with human-review framing, multi-location, governance/
  security, pricing preview, FAQ accordion, final CTA, footer); Security
  page states only planned/designed controls and explicitly disclaims
  SOC 2/ISO 27001/HIPAA/FedRAMP/HITRUST/GDPR/PCI certification; per-page
  SEO metadata, OpenGraph/Twitter tags, `sitemap.ts`, `robots.ts`;
  keyboard-operable nav dropdowns/mobile menu/tabs/accordion with ARIA
  wiring; 17 Vitest + 48 Playwright tests. `npm run phase:commit` green.
  Visual/WCAG review via Vercel preview still outstanding — same
  platform-configuration blocker noted under Phase 1. Demo content
  consistently uses one fictional company (Northstar Property Group),
  labeled as product demonstration data throughout; no product
  screenshots or competitor assets used.
- **Risks:** Content requiring real legal review (Privacy, Terms) before
  public launch — tracked against Phase 25.

## Phase 3: Authentication and organizations

- **Goal:** Integrate Clerk identity and organization membership.
- **Deliverables:** Sign-up/sign-in flows, organization creation and
  invitation, Clerk↔ProcessPilot member/role sync per
  [docs/architecture/authentication-and-authorization.md](../architecture/authentication-and-authorization.md).
- **Dependencies:** Phase 2 (shared layout/design system), ADR-0003.
- **Entry criteria:** Clerk account provisioned; environment variables
  documented in `docs/development/environment-variables.md`.
- **Exit criteria:** A member can sign up, create/join an organization,
  and be assigned a role; server-side session verification covers every
  protected route; automated tests cover unauthenticated/unauthorized
  access rejection.
- **Status:** In Progress — sign-up/sign-in, organization creation, and
  invitation (via Clerk's `<OrganizationProfile>`) are implemented at
  `/app/*`, re-themed to design/components.md. `requireAuth()`
  (`src/lib/auth.ts`) gates every route under
  `src/app/app/(protected)/`, server-side. `/api/webhooks/clerk`
  verifies and acknowledges Clerk events (signature-verified, log-only —
  persistence is Phase 4). Role assignment uses Clerk's built-in
  `org:admin`/`org:member` roles as an interim stand-in for the full
  7-role model — real `Member`/`Role` sync is explicitly Phase 4's job,
  not this phase's (see authentication-and-authorization.md). Unit tests
  cover the auth guard and webhook signature verification; e2e coverage
  for unauthenticated redirect and full sign-in/sign-out
  (`e2e/app-auth.spec.ts`) requires real Clerk test-mode keys plus one
  pre-created test user to actually run — see that file's header comment.
  `npm run phase:commit` green.
- **Risks:** External-user auth flow (Phase 19) must not be bolted on
  awkwardly — the base auth design should anticipate it without
  implementing it yet. Clerk's `createRouteMatcher`-based middleware auth
  is deprecated in the installed SDK version, so route protection is
  done per-layout instead (see deployment-architecture.md) — worth
  re-checking against Clerk's migration guide if this SDK is upgraded.

## Phase 4: Database and tenant isolation

- **Goal:** Stand up Supabase PostgreSQL with the
  [domain model](../architecture/domain-model.md) schema and Row-Level
  Security per [ADR-0005](../architecture/decisions/0005-postgresql-row-level-security.md).
- **Deliverables:** Core schema (Organization, Member, Role, Location,
  Department, Team), RLS policies, cross-tenant isolation test suite,
  data-access layer.
- **Dependencies:** Phase 3.
- **Entry criteria:** Supabase project provisioned.
- **Exit criteria:** Cross-tenant isolation tests pass at 100%; every
  tenant-owned table has an RLS policy; no query path bypasses
  organization scoping.
- **Status:** Not Started.
- **Risks:** RLS policy authoring mistakes are the single highest-severity
  risk category in the whole roadmap — mandates dedicated test coverage
  before this phase can close, per
  [product/assumptions-and-risks.md](../../product/assumptions-and-risks.md).

## Phase 5: Business onboarding and employee management

- **Goal:** Let an organization owner set up their organization structure
  and invite employees.
- **Deliverables:** Organization setup flow, location/department/team
  management, member invitation and role assignment UI backed by
  [product/permissions-matrix.md](../../product/permissions-matrix.md).
- **Dependencies:** Phase 4.
- **Entry criteria:** Tenant isolation verified.
- **Exit criteria:** An admin can fully structure an organization and
  invite members with correct role/permission enforcement, server-verified.
- **Status:** Not Started.
- **Risks:** None beyond standard permission-boundary test coverage.

## Phase 6: Knowledge management

- **Goal:** Implement the knowledge document import, authoring, and
  governance loop.
- **Deliverables:** Document upload/authoring, versioning, review
  workflow, access scoping, per
  [product/feature-catalog.md — knowledge import/governance](../../product/feature-catalog.md).
- **Dependencies:** Phase 5.
- **Entry criteria:** People/roles in place to own and review documents.
- **Exit criteria:** A document can be uploaded, reviewed, published as an
  immutable version, and superseded by a new version without losing
  history, per [ADR-0011](../architecture/decisions/0011-immutable-published-versions.md).
- **Status:** Not Started.
- **Risks:** File storage private-access rules (Phase 4 dependency +
  [file-storage.md](../architecture/file-storage.md)) must be correct
  before real customer documents are uploaded.

## Phase 7: Process builder

- **Goal:** Implement process authoring, review, and publishing.
- **Deliverables:** Process editor (steps, roles, forms, approvals,
  evidence requirements), review/publish workflow, process templates.
- **Dependencies:** Phase 6.
- **Entry criteria:** Knowledge governance available as a process input.
- **Exit criteria:** A process can be authored, reviewed, and published as
  an immutable `ProcessVersion`; AI-assisted draft extraction (manual
  trigger only — full AI copilot lands in Phase 13) is stubbed or deferred
  explicitly if not ready.
- **Status:** Not Started.
- **Risks:** Scope creep into full AI drafting before Phase 13 — this
  phase should ship manual authoring first and treat AI extraction as an
  explicit, separately-scoped addition.

## Phase 8: Workflow execution engine

- **Goal:** Implement the event-driven workflow engine per
  [docs/architecture/workflow-engine.md](../architecture/workflow-engine.md).
- **Deliverables:** Workflow instantiation, task sequencing (linear/
  parallel/conditional), assignment resolution, deadline tracking,
  provider-neutral background-job adapter ([ADR-0009](../architecture/decisions/0009-provider-neutral-background-jobs.md)).
- **Dependencies:** Phase 7.
- **Entry criteria:** Published processes exist to instantiate from.
- **Exit criteria:** A workflow can be started (manual/scheduled),
  progress through tasks, and reach completion, with escalation on
  deadline breach; idempotent event handling verified by tests.
- **Status:** Not Started.
- **Risks:** Highest architectural complexity phase to date — event
  idempotency bugs would silently corrupt operational data if untested.

## Phase 9: Forms and evidence

- **Goal:** Implement structured form capture and evidence upload within
  tasks.
- **Deliverables:** Form field types, form submission recording, evidence
  upload (photo/file/signature) with private storage.
- **Dependencies:** Phase 8.
- **Entry criteria:** Tasks exist to attach forms/evidence to.
- **Exit criteria:** Form submissions and evidence are immutable once
  recorded, tenant-isolated, and linked to the originating task/workflow.
- **Status:** Not Started.
- **Risks:** Untrusted file upload handling — malware/virus scanning
  requirement from [file-storage.md](../architecture/file-storage.md)
  must be resolved before this phase closes.

## Phase 10: Approvals and escalations

- **Goal:** Implement configurable approval steps and chains.
- **Deliverables:** Named/role-based approvers, multi-step approval
  chains, decision recording, escalation on non-response.
- **Dependencies:** Phase 9.
- **Entry criteria:** Workflow engine and notifications-capable event
  model available.
- **Exit criteria:** An approval step blocks workflow advancement until
  decided; decisions are immutable and auditable.
- **Status:** Not Started.
- **Risks:** None beyond standard permission-boundary coverage
  (`approval.review` scoping).

## Phase 11: Exception management

- **Goal:** Implement automatic and manual exception creation, triage,
  and corrective-action tracking.
- **Deliverables:** Exception queue, severity/ownership assignment,
  corrective-action tracking to closure.
- **Dependencies:** Phase 10.
- **Entry criteria:** Deadline breach and rejected-approval events
  available to trigger automatic exceptions.
- **Exit criteria:** Exceptions can be created (automatically and
  manually), triaged, and closed with a linked corrective action and
  audit trail.
- **Status:** Not Started.
- **Risks:** AI exception summarization (Phase 13 dependency) must not be
  required for this phase's manual triage flow to function.

## Phase 12: Training and certifications

- **Goal:** Implement training course authoring, assignment, and
  certification tracking.
- **Deliverables:** Course authoring/import, assignment rules
  (role/department/individual), completion tracking, certification
  issuance/expiry.
- **Dependencies:** Phase 5 (roles/departments), Phase 4 (schema).
- **Entry criteria:** Organizational structure available to drive
  assignment rules.
- **Exit criteria:** A course can be assigned, completed, and result in a
  certification with a tracked expiry/renewal date.
- **Status:** Not Started.
- **Risks:** None beyond standard scoping coverage.

## Phase 13: AI ingestion and copilot

- **Goal:** Implement the governed AI copilot across the product loop per
  [docs/architecture/ai-architecture.md](../architecture/ai-architecture.md).
- **Deliverables:** Provider-neutral AI adapter ([ADR-0008](../architecture/decisions/0008-provider-neutral-ai-abstraction.md)),
  process-step extraction, grounded Q&A, draft training content,
  document-version comparison, exception summarization, process
  improvement suggestions.
- **Dependencies:** Phases 6, 7, 11 (sources for grounding and
  suggestions).
- **Entry criteria:** Governance boundary requirements reviewed and
  agreed against [product/product-principles.md](../../product/product-principles.md).
- **Exit criteria:** Every AI capability is verifiably incapable of
  independently publishing, approving, closing, or certifying — covered
  by tests asserting the governance boundary, not just documentation.
- **Status:** Not Started.
- **Risks:** The single highest product-trust risk in the roadmap if the
  governance boundary is not enforced server-side — mandatory
  security-review gate before this phase can close.

## Phase 14: Analytics

- **Goal:** Implement operational analytics dashboards per
  [product/success-metrics.md](../../product/success-metrics.md).
- **Deliverables:** Per-process and cross-process dashboards, training
  compliance views, trend views scoped by location/department.
- **Dependencies:** Phases 8–12 (data sources to analyze).
- **Entry criteria:** Sufficient workflow/exception/training data model
  in place to aggregate meaningfully.
- **Exit criteria:** Dashboards render real, correctly-scoped data with no
  fabricated or placeholder figures in any customer-facing view.
- **Status:** Not Started.
- **Risks:** Query performance at scale — flagged for Phase 23
  observability follow-up if aggregation becomes slow.

## Phase 15: Audit and compliance center

- **Goal:** Implement the audit event log and export per
  [docs/architecture/data-ownership.md](../architecture/data-ownership.md).
- **Deliverables:** Immutable audit event capture across all
  governance-relevant actions, scoped audit views, export.
- **Dependencies:** Phases 6–13 (actions to audit).
- **Entry criteria:** Event model producing the required audit-triggering
  events.
- **Exit criteria:** Every publish, approval, exception resolution, and
  permission change produces a verifiable, immutable audit event;
  `audit.export` produces a complete, correctly-scoped export.
- **Status:** Not Started.
- **Risks:** Retroactive audit-event gaps are unrecoverable — this phase
  must audit prior phases' event coverage, not just add new logging going
  forward.

## Phase 16: Notifications

- **Goal:** Implement the provider-neutral email adapter and notification
  delivery for assignments, approvals, deadlines, and exceptions.
- **Deliverables:** Email adapter, notification templates, delivery
  triggers tied to the event model.
- **Dependencies:** Phase 8 (event model producing notification triggers).
- **Entry criteria:** Email provider selected and provisioned.
- **Exit criteria:** Notifications are delivered reliably and are
  idempotent (no duplicate sends) per
  [docs/architecture/event-model.md](../architecture/event-model.md).
- **Status:** Not Started.
- **Risks:** None beyond standard idempotency testing.

## Phase 17: Billing and entitlements

- **Goal:** Integrate Stripe billing per
  [docs/architecture/billing-architecture.md](../architecture/billing-architecture.md).
- **Deliverables:** Subscription management, entitlement resolution and
  enforcement, webhook handling.
- **Dependencies:** Phase 5 (organization ownership model), ADR-0007.
- **Entry criteria:** Pricing model validated (promoted out of
  [product/pricing-hypotheses.md](../../product/pricing-hypotheses.md)
  into committed pricing).
- **Exit criteria:** Seat/feature entitlements are enforced server-side;
  Stripe is the verified source of truth for subscription state.
- **Status:** Not Started.
- **Risks:** Cannot start meaningfully until pricing hypotheses are
  validated — tracked as a blocking dependency, not just a phase
  dependency.

## Phase 18: Integrations

- **Goal:** Implement organization-configurable third-party integrations
  per [docs/architecture/integration-architecture.md](../architecture/integration-architecture.md).
- **Deliverables:** Integration configuration UI, credential storage
  (encrypted at rest), initial integration set (scope defined at phase
  start).
- **Dependencies:** Phase 5 (admin permissions), Phase 17 (may gate
  integrations by plan tier).
- **Entry criteria:** At least one concrete integration target identified
  from customer feedback.
- **Exit criteria:** An integration can be configured, used, and safely
  disabled without breaking core product-loop functionality.
- **Status:** Not Started.
- **Risks:** Credential storage security — mandatory security review
  before enabling any integration that stores third-party secrets.

## Phase 19: External portal

- **Goal:** Implement resource-scoped access for `external_user` per
  [product/user-roles.md](../../product/user-roles.md).
- **Deliverables:** Invitation-based, resource-specific auth flow; minimal
  application shell for external sessions.
- **Dependencies:** Phase 3 (auth foundation), Phase 8 (workflows to grant
  access to).
- **Entry criteria:** Core workflow execution stable.
- **Exit criteria:** An external user can complete exactly the resource
  they were invited to and nothing else; automated tests prove no
  privilege escalation path exists.
- **Status:** Not Started.
- **Risks:** Privilege-escalation risk explicitly flagged in
  [product/assumptions-and-risks.md](../../product/assumptions-and-risks.md)
  — mandatory security-review gate.

## Phase 20: Responsive PWA

- **Goal:** Ensure the application is fully usable on mobile devices for
  frontline employees, with installable PWA support.
- **Deliverables:** Responsive layouts for all core views, PWA manifest
  and offline-tolerant behavior for task completion where feasible.
- **Dependencies:** Phases 5–12 (core screens to make responsive).
- **Entry criteria:** Core product loop screens exist.
- **Exit criteria:** Employee-facing flows (My Work, task completion, form
  submission, evidence upload) work correctly on mobile viewports and pass
  accessibility checks at that viewport.
- **Status:** Not Started.
- **Risks:** Offline behavior for evidence upload (unreliable frontline
  connectivity) — scope of true offline support decided at phase start,
  not assumed here.

## Phase 21: Organization administration

- **Goal:** Deepen organization-level administration beyond Phase 5's
  basics (custom roles, advanced settings, branding).
- **Deliverables:** Custom role creation bounded by
  [product/permissions-matrix.md — enforcement rule 5](../../product/permissions-matrix.md),
  organization branding settings, advanced member management.
- **Dependencies:** Phase 5.
- **Entry criteria:** Core roles/permissions proven stable in production
  usage.
- **Exit criteria:** Custom roles cannot exceed the granting admin's own
  permissions (tested); branding settings apply consistently across the
  application shell.
- **Status:** Not Started.
- **Risks:** Custom-role privilege escalation — same class of risk as
  Phase 19, requires equivalent test rigor.

## Phase 22: Security hardening

- **Goal:** Organization-wide security review and hardening pass across
  everything built so far.
- **Deliverables:** Penetration-test-style internal review, dependency and
  configuration hardening, resolution of any findings.
- **Dependencies:** Phases 3–21 (everything security-relevant must exist
  to review it).
- **Entry criteria:** Core product surface area feature-complete.
- **Exit criteria:** No open high/critical security findings; multi-tenancy,
  authorization, and AI-governance boundaries independently re-verified.
- **Status:** Not Started.
- **Risks:** Findings at this stage may require rework in earlier phases
  — budget time accordingly rather than treating this as a quick pass.

## Phase 23: Reliability and observability

- **Goal:** Implement observability per
  [docs/architecture/observability.md](../architecture/observability.md).
- **Deliverables:** Structured logging, error tracking, metrics, alerting
  tied to [product/success-metrics.md](../../product/success-metrics.md)
  platform-health metrics.
- **Dependencies:** Phase 8 (event/job infrastructure to observe).
- **Entry criteria:** Core product loop operating with real usage
  patterns to observe.
- **Exit criteria:** Every background job failure is visible; platform
  health metrics are dashboarded and alertable.
- **Status:** Not Started.
- **Risks:** Tenant-data leakage into shared observability tooling —
  explicit scrubbing/scoping review required before closing.

## Phase 24: Complete QA

- **Goal:** Full regression pass across the entire product surface before
  legal/trust and deployment readiness phases.
- **Deliverables:** Expanded Playwright/Vitest coverage across all
  personas and permission boundaries; manual QA pass.
- **Dependencies:** Phases 5–23.
- **Entry criteria:** Feature set considered complete for initial GA
  scope.
- **Exit criteria:** No known critical or high-severity defects; test
  coverage includes every role in
  [product/user-roles.md](../../product/user-roles.md) and every journey
  in [product/user-journeys.md](../../product/user-journeys.md).
- **Status:** Not Started.
- **Risks:** None beyond standard scheduling risk of a full regression
  pass.

## Phase 25: Legal and trust readiness

- **Goal:** Finalize legal (Privacy, Terms), compliance posture
  statements, and trust-center content referenced in
  [product/information-architecture.md](../../product/information-architecture.md).
- **Deliverables:** Reviewed legal pages, accurate (not fabricated)
  security/compliance claims, data-retention/deletion policy referenced
  by [docs/architecture/data-ownership.md](../architecture/data-ownership.md).
- **Dependencies:** Phase 22 (security posture must be real before it's
  claimed publicly).
- **Entry criteria:** Security hardening complete.
- **Exit criteria:** Legal review complete; no compliance claim on the
  public site exceeds what has actually been verified.
- **Status:** Not Started.
- **Risks:** Requires external legal counsel — outside engineering's
  direct control, tracked as a dependency risk.

## Phase 26: Deployment

- **Goal:** Finalize production deployment configuration per
  [docs/architecture/deployment-architecture.md](../architecture/deployment-architecture.md).
- **Deliverables:** Production Vercel project fully configured, DNS,
  production environment variables, rollback procedure documented and
  tested.
- **Dependencies:** Phases 22–25.
- **Entry criteria:** Security, QA, and legal readiness complete.
- **Exit criteria:** A production deployment and rollback have both been
  successfully executed at least once.
- **Status:** Not Started.
- **Risks:** None beyond standard deployment-cutover risk.

## Phase 27: Internal support console

- **Goal:** Build the internal tool ProcessPilot support employees use to
  assist customers, per
  [product/personas.md — ProcessPilot support employee](../../product/personas.md).
- **Deliverables:** Time-boxed, audited support access mechanism; no
  standing role inside customer tenants.
- **Dependencies:** Phase 15 (audit infrastructure to log support access).
- **Entry criteria:** Customer base large enough to require dedicated
  support tooling.
- **Exit criteria:** Every support-console access to customer data is
  audited, scoped, and time-boxed; verified by test.
- **Status:** Not Started.
- **Risks:** This is itself a privileged cross-tenant access path —
  requires the same security rigor as Phase 19/21.

## Phase 28: Demo workspace

- **Goal:** Build a persistent, realistic (non-fabricated, synthetic)
  demo organization for sales and prospect trials.
- **Deliverables:** Seeded demo organization with representative
  processes/workflows, reset mechanism.
- **Dependencies:** Phases 5–15 (full core loop to populate a realistic
  demo).
- **Entry criteria:** Core loop stable enough to demo reliably.
- **Exit criteria:** Demo workspace resets cleanly and never leaks into or
  from real customer tenants (multi-tenancy rules apply to the demo
  organization exactly as any other).
- **Status:** Not Started.
- **Risks:** None beyond standard tenant-isolation coverage, already
  required elsewhere.

## Phase 29: Final product and design audit

- **Goal:** End-to-end audit of product, architecture, and design
  documentation against the shipped product before release candidate.
- **Deliverables:** Updated `product/`, `docs/architecture/`, and
  `design/` documents reflecting actual shipped behavior; contradiction
  resolution across all documentation.
- **Dependencies:** Phase 24 (QA complete).
- **Entry criteria:** Feature-complete, QA-passed product.
- **Exit criteria:** No contradiction between documentation and shipped
  behavior; this phase tracker accurately reflects reality.
- **Status:** Not Started.
- **Risks:** Documentation debt accumulated across 29 phases — budget
  meaningful time, do not treat as a rubber-stamp pass.

## Phase 30: Release candidate

- **Goal:** Final gate before general availability.
- **Deliverables:** Release-candidate build, go/no-go review against every
  exit criterion in this tracker.
- **Dependencies:** All prior phases.
- **Entry criteria:** Phase 29 complete.
- **Exit criteria:** Explicit go decision recorded; product promoted to
  paid GA per [product/release-plan.md](../../product/release-plan.md).
- **Status:** Not Started.
- **Risks:** None beyond standard release risk, mitigated by every prior
  phase's exit criteria already having been met.

## Related documents

- [Roadmap](../../product/roadmap.md)
- [Release plan](../../product/release-plan.md)
- [Architecture decisions](../architecture/architecture-decisions.md)
