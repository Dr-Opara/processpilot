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
  Role assignment still uses Clerk's built-in `org:admin`/`org:member`
  roles as an interim stand-in — Phase 4's job to replace.
- `/api/webhooks/clerk`: signature-verified, currently log-only (no
  persistence yet — that's Phase 4's identity-mapping work).
- CI: format/lint/typecheck/unit-test/build gate (`ci.yml`), CodeQL +
  secret scanning + dependency review (`security.yml`), Playwright smoke
  tests against Vercel previews (`preview-checks.yml`).

## What's not built yet

- No database. No `Organization`/`Member`/`Role`/`Permission` schema exists
  outside Clerk's own model. No Row-Level Security. No audit log. All of
  this is Phase 4 scope — see
  [milestone-2-core-platform.md](milestone-2-core-platform.md).
- No knowledge management, process builder, or workflow execution (Phases
  6–8).
- No billing, analytics, AI, notifications, integrations, or external
  portal (later milestones).

## Immediate next steps

1. Phase 4: Supabase Postgres schema, Clerk↔database identity sync,
   Row-Level Security, server-side authorization services, foundational
   audit events, cross-tenant isolation tests. Requires a Supabase project
   to be provisioned (manual dashboard step — tracked as a Phase 4
   blocker, not fabricated).
2. Phase 5: business onboarding and employee management, once Phase 4's
   schema and authorization layer exist to build on.

## Known risks carried forward

- RLS policy-authoring mistakes are flagged in the phase tracker as the
  single highest-severity risk category in the roadmap — Phase 4 cannot
  close without dedicated cross-tenant isolation test coverage.
- Vercel preview/visual review has been blocked since Phase 1 by a
  platform-configuration issue unrelated to application code — carried
  forward, not yet resolved.

## Related documents

- [Milestones](milestones.md)
- [Roadmap](roadmap.md)
- [Phase tracker](phase-tracker.md)
- [Milestone 2: Core Platform](milestone-2-core-platform.md)
- [Repository map](repository-map.md)
