# Current Project Status

Live snapshot of where ProcessPilot's implementation actually stands. This
document is updated whenever a phase's status changes — it is a snapshot,
not a plan; see [phase-tracker.md](phase-tracker.md) for entry/exit
criteria and [milestones.md](milestones.md) for the outcome-level grouping.

**Last updated:** 2026-07-19.

## Where we are

- **Current milestone:** [Milestone 2 — Core Platform](milestone-2-core-platform.md),
  In Progress.
- **Current phase:** Phase 4 — Database and tenant isolation, In Progress
  (branch `feature/phase-4-database-tenancy`).
- **Milestone 1 (Foundation):** In Progress — Phases -1 through 3 all have
  shipped implementation; Phase -1 is `Complete`, Phases 0–3 remain
  `In Progress` pending a Vercel-preview visual/WCAG review step (blocked on
  a platform-configuration issue noted in the phase tracker, not on
  outstanding implementation work).

## What's built

- Marketing site: all 30 public routes from
  [product/information-architecture.md](../../product/information-architecture.md).
- Authentication: Clerk sign-up/sign-in, organization creation and
  invitation at `/app/*`, server-side session gating via `requireAuth()`.
- Database schema: all 17 tables in
  [docs/architecture/database-schema.md](../architecture/database-schema.md),
  committed as SQL migrations with Row-Level Security enabled and at
  least one policy on every table — statically enforced by
  `src/lib/db/schema-coverage.test.ts` on every change.
- Clerk↔Supabase identity sync: `/api/webhooks/clerk` persists
  user/organization/membership events idempotently (see
  [clerk-supabase-identity-sync.md](../architecture/clerk-supabase-identity-sync.md)),
  replacing Phase 3's log-only handler. Role assignment now resolves
  against real `roles`/`role_permissions`/`member_role_assignments`
  tables instead of Clerk's built-in `org:admin`/`org:member` roles.
- Server-side authorization (`src/lib/authz.ts`): `getCurrentProfile()`,
  `getCurrentOrganization()`, `getCurrentMembership()`,
  `requirePermission()`.
- Audit foundation: `recordAuditEvent()`, called from every identity-sync
  path.
- CI: format/lint/typecheck/unit-test/build gate (`ci.yml`), CodeQL +
  secret scanning + dependency review (`security.yml`), Playwright smoke
  tests against Vercel previews (`preview-checks.yml`), plus Phase 4's new
  service-role client-bundle leak check
  (`npm run check:bundle-secrets`, wired into `phase:commit`).
- **Not yet applied anywhere real:** no Supabase project has been
  provisioned, so none of the above has run against a live database —
  see [supabase-setup.md](../development/supabase-setup.md) for the
  manual steps that unblock this.

## What's not built yet

- Scoped (non-organization-wide) permission enforcement — e.g. a
  `manager`'s department-scoped `department.manage` — deferred to Phase 5,
  which builds the location/department/team scope-assignment model this
  needs. See
  [authentication-and-authorization.md — known limitations](../architecture/authentication-and-authorization.md#known-limitations).
- No knowledge management, process builder, or workflow execution (Phases
  6–8).
- No billing, analytics, AI, notifications, integrations, or external
  portal (later milestones).

## Immediate next steps

1. Provision a Supabase project (dev + preview) — manual dashboard step,
   see [supabase-setup.md](../development/supabase-setup.md). Blocks
   applying the committed migrations, regenerating real database types,
   and running the live-DB tenant-isolation tests for real.
2. Phase 4 audit, once requested.
3. Phase 5: business onboarding and employee management, once Phase 4 is
   marked `Complete`.

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
