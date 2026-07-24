# Current Project Status

Live snapshot of where ProcessPilot's implementation actually stands. This
document is updated whenever a phase's status changes — it is a snapshot,
not a plan; see [phase-tracker.md](phase-tracker.md) for entry/exit
criteria and [milestones.md](milestones.md) for the outcome-level grouping.

**Last updated:** 2026-07-25.

## Where we are

- **Current milestone:** [Milestone 2 — Core Platform](milestone-2-core-platform.md),
  In Progress.
- **Current phase:** Phase 9 — Forms and evidence management, In Progress
  (branch `feature/phase-9-forms-evidence`, not yet merged).
- **Milestone 1 (Foundation):** In Progress — Phases -1 through 3 all have
  shipped implementation; Phase -1 is `Complete`, Phases 0–3 remain
  `In Progress` pending a Vercel-preview visual/WCAG review step (blocked on
  a platform-configuration issue noted in the phase tracker, not on
  outstanding implementation work).
- **Phases 5, 6, 7, and 8** (business onboarding/employee management,
  knowledge management, process builder, workflow execution engine) are
  `Complete` per the phase tracker. Phase 4 (database and tenant
  isolation) remains recorded as `In Progress` in the tracker; this
  document does not re-audit that status.

## What's built

- Marketing site: all 30 public routes from
  [product/information-architecture.md](../../product/information-architecture.md).
- Authentication: Clerk sign-up/sign-in, organization creation and
  invitation at `/app/*`, server-side session gating via `requireAuth()`.
- Database schema: 33 tables in
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
- Forms and evidence (Phase 9, in progress): governed, versioned form
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
- Audit foundation: `recordAuditEvent()`, called from every mutating
  service-layer action, including the workflow engine's and Phase 9's.
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
- Malware/virus scanning for evidence uploads (deferred since Phase 6,
  same posture); an `evidence` node's task completion isn't gated on
  evidence acceptance.
- Configurable multi-step approval chains, SLA reminders/escalation
  (Phase 10) — Phase 8 has a single-assignee approval decision and
  deadline-breach _detection_ only.
- Exception/CAPA management, training/certifications, AI copilot,
  analytics, audit/compliance center, notifications, billing,
  integrations, external portal (later phases/milestones).

## Immediate next steps

1. Provision a Supabase project (dev + preview) — manual dashboard step,
   see [supabase-setup.md](../development/supabase-setup.md). Blocks
   applying the committed migrations, regenerating real database types,
   and running the live-DB tenant-isolation tests for real.
2. Merge `feature/phase-9-forms-evidence` into `develop` once reviewed,
   and mark Phase 9 `Complete` in the phase tracker.
3. Phase 10: approvals, SLAs, and escalations, once Phase 9 is merged.

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
