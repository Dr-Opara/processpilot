# Current Project Status

Live snapshot of where ProcessPilot's implementation actually stands. This
document is updated whenever a phase's status changes — it is a snapshot,
not a plan; see [phase-tracker.md](phase-tracker.md) for entry/exit
criteria and [milestones.md](milestones.md) for the outcome-level grouping.

**Last updated:** 2026-07-28.

## Where we are

- **Current milestone:** [Milestone 2 — Core Platform](milestone-2-core-platform.md),
  In Progress. Milestone 3 (Execution governance) work is progressing in
  parallel via Phases 11–12.
- **Current phase:** Phase 13 — AI ingestion and copilot, starting on
  `feature/phase-13-ai-copilot`.
- **Milestone 1 (Foundation):** In Progress — Phases -1 through 3 all have
  shipped implementation; Phase -1 is `Complete`, Phases 0–3 remain
  `In Progress` pending a Vercel-preview visual/WCAG review step (blocked on
  a platform-configuration issue noted in the phase tracker, not on
  outstanding implementation work).
- **Phases 5, 6, 7, 8, 9, 10, 11, and 12** (business onboarding/employee
  management, knowledge management, process builder, workflow execution
  engine, forms and evidence, approvals/SLAs/escalations, exceptions/CAPA,
  training/certifications) are `Complete` per the phase tracker — Phase 9
  merged via PR #12 (commit `5427118`); Phase 10 merged via PR #13; Phase
  11 merged via PR #14; Phase 12 merged via the
  `feature/phase-12-training-certifications` PR. Phase 4 (database and
  tenant isolation) remains recorded as `In Progress` in the tracker; this
  document does not re-audit that status.

## What's built

- Marketing site: all 30 public routes from
  [product/information-architecture.md](../../product/information-architecture.md).
- Authentication: Clerk sign-up/sign-in, organization creation and
  invitation at `/app/*`, server-side session gating via `requireAuth()`.
- Database schema: 60 tables in
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
- Audit foundation: `recordAuditEvent()`, called from every mutating
  service-layer action, including the workflow engine's and Phase 9's/
  Phase 10's/Phase 11's/Phase 12's.
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
- AI copilot, analytics, audit/compliance center, notifications,
  billing, integrations, external portal (later phases/milestones).

## Immediate next steps

1. Provision a Supabase project (dev + preview) — manual dashboard step,
   see [supabase-setup.md](../development/supabase-setup.md). Blocks
   applying the committed migrations, regenerating real database types,
   and running the live-DB tenant-isolation tests for real.
2. Begin Phase 13 (AI ingestion and copilot) on
   `feature/phase-13-ai-copilot`.

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
