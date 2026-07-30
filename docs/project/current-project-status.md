# Current Project Status

Live snapshot of where ProcessPilot's implementation actually stands. This
document is updated whenever a phase's status changes — it is a snapshot,
not a plan; see [phase-tracker.md](phase-tracker.md) for entry/exit
criteria and [milestones.md](milestones.md) for the outcome-level grouping.

**Last updated:** 2026-08-06.

## Where we are

- **Current milestone:** [Milestone 2 — Core Platform](milestone-2-core-platform.md),
  In Progress. Milestone 3 (Execution governance) and Milestone 4
  (Intelligence) are both complete; Milestone 5 (Commercial readiness)
  is progressing via Phases 16–23.
- **Current phase:** Phase 23 — Reliability and observability,
  completing on `feature/phase-23-performance-observability`; Phase 24
  (Complete QA) is next.
- **Milestone 1 (Foundation):** In Progress — Phases -1 through 3 all have
  shipped implementation; Phase -1 is `Complete`, Phases 0–3 remain
  `In Progress` pending a Vercel-preview visual/WCAG review step (blocked on
  a platform-configuration issue noted in the phase tracker, not on
  outstanding implementation work).
- **Phases 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, and 23**
  (business onboarding/employee management, knowledge management,
  process builder, workflow execution engine, forms and evidence,
  approvals/SLAs/escalations, exceptions/CAPA, training/certifications,
  AI copilot, analytics, audit and compliance center, notifications,
  billing and entitlements, integrations, external portal, responsive
  PWA, advanced organization administration, security hardening,
  reliability and observability) are `Complete` per the phase tracker —
  Phase 9 merged via PR #12 (commit `5427118`); Phase 10 merged via PR
  #13; Phase 11 merged via PR #14; Phase 12 merged via PR #15; Phase 13
  merged via PR #16; Phase 14 merged via PR #17; Phase 15 merged via PR
  #18; Phase 16 merged via PR #19; Phase 17 merged via PR #20; Phase 18
  merged via the `feature/phase-18-integrations` and
  `feature/phase-18-integrations-api-webhooks` PRs; Phase 19 merged via
  PR #23; Phase 20 merged via PR #24; Phase 21 merged via PR #26;
  Phase 22 merged via PR #27; Phase 23's implementation is complete on
  `feature/phase-23-performance-observability`, pending its PR merge.
  Phase 4 (database and tenant isolation) remains recorded as `In
Progress` in
  the tracker; this document does not re-audit that
  status.

## What's built

- Marketing site: all 30 public routes from
  [product/information-architecture.md](../../product/information-architecture.md).
- Authentication: Clerk sign-up/sign-in, organization creation and
  invitation at `/app/*`, server-side session gating via `requireAuth()`.
- Database schema: 62 tables in
  [docs/architecture/database-schema.md](../architecture/database-schema.md),
  committed as SQL migrations with Row-Level Security enabled and at
  least one policy on every table — statically enforced by
  `src/lib/db/schema-coverage.test.ts` on every change.
- Clerk↔Supabase identity sync: `/api/webhooks/clerk` persists
  user/organization/membership events idempotently (see
  [clerk-supabase-identity-sync.md](../architecture/clerk-supabase-identity-sync.md)).
  Role assignment resolves against real
  `roles`/`role_permissions`/`member_role_assignments` tables.
- Server-side authorization (`src/lib/authz.ts`): `getCurrentProfile()`,
  `getCurrentOrganization()`, `getCurrentMembership()`,
  `requirePermission()`, including department-scoped permission checks.
- Organization structure and people: locations, departments, teams,
  member directory, invitations, bulk member import (`/app/*`).
- Knowledge management: document upload/authoring, versioning, review
  workflow (`/app/knowledge/*`).
- Process builder: visual drag-and-drop process editor over a graph
  definition, three-stage review pipeline, server-side graph validation,
  immutable published versions (`/app/processes/*`).
- Workflow execution engine (Phase 8, complete): token-based execution
  over a published process version's graph
  (`src/lib/services/workflow-engine.ts`), the workflow/task service
  layer (`src/lib/services/workflows.ts`), two background jobs (timer
  advance, deadline breach detection —
  `src/lib/jobs/workflow-handlers.ts`), and routes for the workflow list/
  detail and the task inbox/detail (`/app/workflows/*`, `/app/tasks/*`).
  See [workflow-engine.md](../architecture/workflow-engine.md) for the
  node-type/state-machine detail and known gaps (manual start only;
  `system_action` nodes unsupported; deadline breach is detection-only,
  not full escalation).
- Forms and evidence (Phase 9, complete): governed, versioned form
  authoring with an 8-type field/validation/conditional-visibility
  engine (`src/lib/services/form-schema.ts`), structured submissions
  with draft save, final submit, and immutable amendments
  (`src/lib/services/form-submissions.ts`), and private evidence upload
  with sha256 integrity hashing, review, replacement, expiration, and
  full chain-of-custody logging (`src/lib/services/evidence.ts`).
  `workflow-engine.ts`'s `form` node type now snapshots a linked
  published form version at task-creation time. Routes:
  `/app/forms/*`, the task-detail form renderer/evidence panel,
  `/app/evidence/upload`, `/app/evidence/[evidenceId]/download`. See
  [forms-and-evidence.md](../architecture/forms-and-evidence.md) for the
  full model and known gaps (no malware scanning; evidence acceptance
  doesn't gate workflow advancement).
- Approvals, SLAs, and escalations (Phase 10, complete): configurable
  multi-approver chains (sequential/parallel/unanimous/majority/
  first-response/any-one strategies; user/role/manager/department-owner/
  process-owner/location-manager/team-manager/runtime-expression approver
  assignment; delegation; administrative override; self-approval
  prevention; approve/reject/request-changes with comments and
  attachments) in `src/lib/services/approval-policies.ts`,
  `approval-resolution.ts`, and `approvals.ts`; business-calendar- and
  time-zone-aware SLA due-date resolution with holiday support, pause/
  resume, and explicit recalculation (`business-calendar.ts`,
  `sla-config.ts`, `sla.ts`); numbered escalation levels (reminders,
  reassignment, manager/process-owner/admin escalation) via the
  self-rescheduling `task-escalation-check` background job
  (`escalation.ts`, `src/lib/jobs/escalation-handlers.ts`).
  `workflow-engine.ts`'s `approval` node type now snapshots a linked
  policy and resolves a linked SLA definition at task-creation time.
  Routes: `/app/approval-policies/*`, `/app/sla/*`, the task-detail
  chained-approval/attachment/SLA-control panels. See
  [approvals-and-slas.md](../architecture/approvals-and-slas.md) for the
  full model and known gaps (no malware scanning on attachments, same
  deferred posture as Phase 9; SLA pause/resume is a manual, explicit
  action only).
- Exceptions and CAPA (Phase 11, complete): exception intake (11 types,
  12 sources, manual and automatic), full lifecycle (reported → triaged
  → under investigation → containment/action-plan/remediation → pending
  verification → closed, plus rejected/reopened), calculated severity/
  priority with required-reason manual override, root-cause analysis
  that gates closure, containment actions, CAPA plans (draft through
  approval, in-progress actions, effectiveness verification, and
  closure), temporary waivers with required expiration and a background
  expiration job, and heuristic recurrence matching
  (`src/lib/services/exceptions.ts`, `exception-root-cause.ts`,
  `exception-containment.ts`, `exception-recurrence.ts`, `capa.ts`,
  `waivers.ts`). Automatically created from workflow failures, missed-
  SLA admin escalation, and evidence rejection. Routes:
  `/app/exceptions/*`, `/app/capa/*`, `/app/waivers/*`. See
  [exception-management.md](../architecture/exception-management.md)
  for the full model and known gaps (consolidated route scope; no
  automated effectiveness-check scheduling; recurrence matching is a
  plain heuristic, not a duplicate-detection guarantee).
- Training and certifications (Phase 12, complete): course authoring/
  versioning (mutable shell + immutable published version, same
  pattern as Phase 9's forms) with an optional embedded multiple-choice
  assessment, assignment by individual/role/department/team,
  completion tracking with assessment scoring and automatic overdue
  detection, and certification issuance/renewal/revocation with a
  required-choice expiry and a background expiry job
  (`src/lib/services/training-courses.ts`, `training-assessment.ts`,
  `training-assignments.ts`, `certifications.ts`). New
  `training.complete` permission alongside the existing
  `training.view`/`training.manage`. Routes: `/app/training/*`,
  `/app/certifications`. See
  [training-and-certifications.md](../architecture/training-and-certifications.md)
  for the full model and known gaps (single-text course content, not a
  structured authoring/media pipeline; no reminder emails before a due
  date).
- AI copilot (Phase 13, complete): a provider-neutral adapter
  (`src/lib/ai/adapter.ts`, `providers/anthropic-provider.ts`,
  `get-provider.ts`, per ADR-0008) backing six governed capabilities —
  grounded Q&A with citation validation, process-step extraction from a
  knowledge document, draft training content, document-version
  comparison, exception summarization, and process-improvement
  suggestions grounded in real exception history
  (`src/lib/services/ai-qa.ts`, `ai-process-extraction.ts`,
  `ai-training-draft.ts`, `ai-document-comparison.ts`,
  `ai-exception-summary.ts`, `ai-process-improvement.ts`). Every
  capability only imports read functions from the rest of the codebase
  (never publish/approve/close/certify) — enforced structurally and
  verified by a static import-scan test
  (`src/lib/services/ai-governance.test.ts`) — and every output is
  persisted as a pending `ai_drafts` row requiring an explicit human
  accept/dismiss action. Environment-level (`isAiConfigured()`) and
  organization-level (`isAiCopilotEnabledForOrg()`) availability are
  distinct and both gate every feature. Routes: `/app/ai`,
  `/app/ai/settings`. See
  [ai-architecture.md](../architecture/ai-architecture.md) for the full
  model and known gaps (live Claude API output is unverified in this
  environment — only a placeholder credential exists; keyword-based,
  not semantic, retrieval).
- Analytics (Phase 14, complete): live operational dashboards computed
  directly over existing tenant-scoped tables — no snapshot/cache table.
  Per-process completion rate, median cycle time, and exception rate
  (`src/lib/services/analytics-workflows.ts`); a 12-week zero-filled
  workflow trend; audit readiness (evidence-gap detection, scoped to
  evidence because a required approval's rejection already fails the
  workflow before it can complete); training on-time completion and
  certification currency, CAPA closure rate and median days to close
  (`analytics-compliance.ts`); AI draft acceptance rate
  (`ai-drafts.ts`'s `getAiDraftAcceptanceStats()`). Every rate is
  `number | null` — `/app/analytics` renders "No data yet" rather than a
  fabricated zero when the denominator is zero, gated on `analytics.view`
  (scoped by department for `process_owner`/`manager`). See
  [analytics.md](../architecture/analytics.md) for the full model and
  known gaps (no draft-to-publish time delta yet; adoption/commercial/
  platform-health metrics are out of scope for this customer-facing
  surface).
- Audit and compliance center (Phase 15, complete): `recordAuditEvent()`
  coverage was already comprehensive across Phases 5–13's mutating
  service-layer actions going into this phase; Phase 15's own scope was
  the read/scope/export layer — `src/lib/services/audit.ts`'s
  `listAuditEvents()`/`exportAuditEvents()`, `/app/audit`. Found and
  fixed a real pre-existing bug: `audit_events_select`'s RLS policy
  checked only an _unscoped_ `audit.view` grant, so `manager`'s/
  `auditor`'s seeded **scoped** grants were functionally inert (no
  `department_id` column existed to check them against) —
  `20260730000001_audit_scoped_views.sql` adds the column and switches
  the policy to `has_scoped_permission`, and `department_id` is now
  populated for the exception/CAPA/waiver and training/certification
  domains (which also surfaced and fixed a second bug: those tables'
  own `department_id` columns were never populated on insert, despite
  their own scoped-permission checks depending on them). `audit.export`
  is capped at 5,000 rows and itself produces an audit event. See
  [audit-and-compliance.md](../architecture/audit-and-compliance.md) for
  full detail and known gaps (department tagging not yet extended to
  every resource type; historical events pre-dating the migration remain
  visible only to an unscoped holder).
- Notifications (Phase 16, complete): provider-neutral email adapter
  (`src/lib/notifications/adapter.ts`, `providers/resend-provider.ts`,
  `get-provider.ts`, mirroring ADR-0008's AI adapter pattern), an in-app
  notification feed (`notifications`), per-channel delivery tracking
  (`notification_deliveries`), and per-member/org-default preferences
  (`notification_preferences`). Delivery is always scheduled through the
  existing background-job worker (`deliver-notification-email`), never
  sent synchronously — idempotent by delivery id, retried through the
  worker's own backoff on a real provider failure, marked
  `skipped_not_configured` (never a fabricated success) when no real
  `EMAIL_PROVIDER_API_KEY` exists. Wired at one representative trigger
  per named category: task assignment, approval request, deadline
  reminder/breach, and exception owner assignment. No real email
  provider is configured in this environment — live Resend delivery is
  unverified end-to-end. Routes: `/app/notifications`,
  `/app/notifications/preferences`. See
  [notifications.md](../architecture/notifications.md) for full detail
  and known gaps (bounded trigger coverage; no digest/batching; in-app
  visibility not itself preference-gated).
- Billing and entitlements (Phase 17, complete — pricing not committed):
  provider-neutral billing adapter (`src/lib/billing/adapter.ts`,
  `providers/stripe-provider.ts`, `get-provider.ts`, mirroring ADR-0008's
  AI/notification adapter pattern), Stripe as the sole writer of
  `subscriptions` via an idempotent webhook handler
  (`src/app/api/webhooks/stripe/route.ts`), derived (not persisted)
  entitlement resolution defaulting an unsubscribed organization to the
  Starter tier, seat-limit enforcement at `invitations.ts`'s
  `createInvitation()`, read-only AI-usage tracking via the existing
  `ai_usage_events` table, `/app/billing`. This phase's own entry
  criteria required committed pricing, which
  `product/pricing-hypotheses.md` explicitly still lacks — built anyway
  per explicit instruction, using the hypothesis tiers only as
  swappable configuration (`src/lib/billing/plans.ts`), never surfaced
  as real customer-facing pricing. No real Stripe credentials exist in
  this environment — live billing is unverified end-to-end. See
  [billing-architecture.md](../architecture/billing-architecture.md) for
  full detail, how to replace hypothesis pricing with committed pricing,
  and known gaps (AI-usage quota tracked but not enforced; no past_due
  degraded-access state; bulk member import isn't seat-gated).
- Integrations (Phase 18, complete — SSO/SAML): `src/lib/services/sso.ts`
  is a thin admin wrapper over Clerk's Enterprise Connections API
  (`@clerk/backend`), not a from-scratch SAML/OIDC implementation —
  Clerk (already the sole identity provider, ADR-0003) performs the
  handshake and stores the IdP credential material itself, so
  `sso_connections` holds no secret material at all, only a label for
  `/app/sso`'s admin UI and the audit trail. No new environment
  variable is needed — it reuses the already-real `CLERK_SECRET_KEY`.
  This phase's own entry criteria required a customer-identified
  integration target, which doesn't exist pre-launch — SSO was chosen
  deliberately (matches `product/user-roles.md`'s `external_user` role
  and the Enterprise-tier pricing hypothesis) rather than sourced from
  feedback. See
  [integration-architecture.md](../architecture/integration-architecture.md)
  for full detail and known gaps (only `saml_custom`/`oidc_custom`
  provider types in the UI; untested against a real Clerk Enterprise
  Connections-enabled instance).
- Public API, webhooks, and integration catalog (Phase 18 continuation,
  complete — a much larger follow-up scope added on explicit
  instruction): versioned public REST API (`/api/v1/processes`,
  `/api/v1/workflows`) authenticated by organization-scoped, hashed API
  keys with scopes/rate-limiting/usage logging; outbound webhooks
  (HMAC-signed, retried/dead-lettered through the existing
  `background_jobs` worker, replayable, SSRF-guarded); inbound webhooks
  with one real signature-verified adapter (Slack); a 7-provider
  catalog (Slack implemented, the other 6 explicit unimplemented
  placeholders, never faked); AES-256-GCM credential encryption
  (`src/lib/crypto/secret-box.ts`). Admin UI: `/app/integrations`,
  `/app/integrations/api-keys`, `/app/integrations/webhooks`. No real
  `INTEGRATION_ENCRYPTION_KEY`/`SLACK_*` credentials exist in this
  environment. See
  [public-api.md](../architecture/public-api.md) for full detail and a
  long, explicit known-gaps list.
- External portal (Phase 19, complete): resource-scoped, invitation-based
  access for the `external_user` role — a staff member holding
  `workflow.assign` invites one external collaborator to exactly one
  open task, for a limited (1–30 day) window, without a new RLS layer
  (the existing own-resource `assignee_member_id = current_member_id()`
  clauses from Phases 8/9 already provide exactly the scoped access
  needed once the external user becomes that task's assignee).
  `src/lib/services/external-access.ts` handles invite/activate/revoke/
  expire; activation is wired into the existing Clerk-invitation-accept
  webhook path (`src/lib/db/identity-sync.ts`); expiration reuses the
  `background_jobs` worker. External-role members are excluded from the
  regular people directory (`listMembers()`). Admin UI at
  `/app/tasks/[taskId]/external-access`. See
  [external-portal.md](../architecture/external-portal.md) for full
  detail and known gaps (no dedicated minimal external-session shell
  yet; privilege-escalation coverage is unit-test-level only, same
  unverified-against-live-Postgres posture as every other RLS claim in
  this environment).
- Responsive layout and installable PWA (Phase 20, complete): a
  primary navigation shell that didn't previously exist at all
  (`src/lib/app-nav.ts`, `src/components/app/AppNav.tsx`) — role-aware,
  a persistent sidebar at the `md` breakpoint and a zero-JS `<details>`
  disclosure below it, omitted entirely for `external_user` sessions; a
  card-view responsive collapse for the My Work task list
  (`/app/tasks`); an installable PWA service worker
  (`public/app-sw.js`, scoped to `/app/`) with an offline fallback page
  and an offline-status banner (`src/components/app/AppPwaClient.tsx`).
  See [responsive-pwa.md](../architecture/responsive-pwa.md) for full
  detail and known gaps (no offline mutation queueing; only the My Work
  list got the card-view treatment, not the ~25 other, more
  administrative table views; no real mobile-device/Lighthouse
  verification in this environment).
- CI: format/lint/typecheck/unit-test/build gate (`ci.yml`), CodeQL +
  secret scanning + dependency review (`security.yml`), Playwright smoke
  tests against Vercel previews (`preview-checks.yml`), plus the
  service-role client-bundle leak check
  (`npm run check:bundle-secrets`, wired into `phase:commit`).
- **Not yet applied anywhere real:** no Supabase project has been
  provisioned, so none of the above has run against a live database —
  see [supabase-setup.md](../development/supabase-setup.md) for the
  manual steps that unblock this. The live-RLS
  `tenant-isolation.integration.test.ts` suite is written but unverified
  against a real Postgres engine for this reason (carried forward since
  Phase 4).

## What's not built yet

- Scheduled/event-triggered workflow starts (Phase 8 supports manual
  start only) and `system_action` node execution.
- Malware/virus scanning for evidence/approval-attachment uploads
  (deferred since Phase 6, same posture); an `evidence` node's task
  completion isn't gated on evidence acceptance.
- A dedicated minimal external-session UI shell (Phase 19 lists it as a
  deliverable; external users currently see the same `/app` layout as
  any other member, correctly scoped by RLS but not yet redirected
  straight to their one assigned task, and now correctly see no
  primary navigation at all per Phase 20).
- True offline task completion (queued mutations replayed on
  reconnect) — Phase 20 deliberately shipped installability and
  graceful offline degradation only, not a background-sync queue.
- Card-view responsive treatment for the ~25 administrative table
  views (Processes, Members, Audit, Analytics, etc.) beyond the My
  Work task list Phase 20 covered.
- Live-verified AI output — the AI copilot's code is complete and
  tested against deterministic mocked providers, but no real
  `ANTHROPIC_API_KEY` has been supplied in this environment yet, so
  actual Claude API responses remain unverified end-to-end.
- Live-verified email delivery — Phase 16's notification code is
  complete and tested against deterministic mocks, but no real
  `EMAIL_PROVIDER_API_KEY` has been supplied in this environment yet, so
  actual Resend delivery remains unverified end-to-end.
- Live-verified billing — Phase 17's code is complete and tested
  against deterministic mocks, but no real `STRIPE_SECRET_KEY`/
  `STRIPE_WEBHOOK_SECRET` has been supplied, so actual Stripe checkout/
  portal/webhook processing remains unverified end-to-end. Pricing
  itself also remains uncommitted — see billing-architecture.md.
- Live-verified SSO — Phase 18's code is complete and tested against
  mocked Clerk API calls, but has not been exercised against a real
  Clerk organization with Enterprise Connections enabled, so actual
  SAML/OIDC sign-in remains unverified end-to-end.

## Immediate next steps

1. Provision a Supabase project (dev + preview) — manual dashboard step,
   see [supabase-setup.md](../development/supabase-setup.md). Blocks
   applying the committed migrations, regenerating real database types,
   and running the live-DB tenant-isolation tests for real.
2. Supply a real `ANTHROPIC_API_KEY`, `EMAIL_PROVIDER_API_KEY`/
   `EMAIL_FROM_ADDRESS`, and `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`
   (Codespaces/CI/Vercel secrets, per
   [environment-variables.md](../development/environment-variables.md))
   to verify live AI output, email delivery, and billing for real, then
   re-run the Phase 13, Phase 16, and Phase 17 test suites against them.
3. Commit real pricing (promote `product/pricing-hypotheses.md` out of
   "hypotheses" per its own open questions) and update
   `src/lib/billing/plans.ts`'s `PLAN_ENTITLEMENTS` and the
   `STRIPE_PRICE_ID_*` environment variables accordingly — see
   [billing-architecture.md](../architecture/billing-architecture.md).
4. Verify SSO against a real Clerk organization with Enterprise
   Connections enabled (may require a Clerk plan upgrade) before
   relying on `/app/sso` in production.
5. Begin Phase 19 (external portal) on `feature/phase-19-external-portal`.

## Known risks carried forward

- RLS policy-authoring mistakes are flagged in the phase tracker as the
  single highest-severity risk category in the roadmap — the static
  schema-coverage test and hand-written policies are unverified against a
  live Postgres engine until a Supabase project exists; the live-DB
  `tenant-isolation.integration.test.ts` suite must actually run (not just
  compile) before Phase 4 can be considered proven, not just written.
- Vercel preview/visual review has been blocked since Phase 1 by a
  platform-configuration issue unrelated to application code — carried
  forward, not yet resolved.

## Related documents

- [Milestones](milestones.md)
- [Roadmap](roadmap.md)
- [Phase tracker](phase-tracker.md)
- [Milestone 2: Core Platform](milestone-2-core-platform.md)
- [Repository map](repository-map.md)
