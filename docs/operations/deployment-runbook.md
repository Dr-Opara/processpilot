# Deployment Runbook (Phase 26)

Status: **Documents the intended procedure** — no production deployment
has ever been performed in this environment (Vercel/Supabase/Clerk
production projects are not provisioned). See
[production-configuration-matrix.md](production-configuration-matrix.md)
for exactly what's provisioned vs. not.

## Prerequisites (one-time setup, not yet done)

1. Register `useprocesspilot.com` (or confirm existing registration).
2. Create production Vercel, Supabase, and Clerk projects — separate
   from any development/preview projects.
3. Configure DNS per [dns-records.md](dns-records.md).
4. Set every required production environment variable in Vercel's
   Production scope — see
   [environment-variables.md](../development/environment-variables.md).
5. Apply every migration in `supabase/migrations/` to the production
   Supabase project, in order, and verify with
   `schema-coverage.test.ts` plus the live-Postgres integration suites.
6. Verify `/api/ready` returns `ok` against the new production
   deployment before pointing real traffic at it.

## Routine deployment (once production exists)

1. Merge an approved pull request into `develop`.
2. When ready to release, open a pull request from `develop` into
   `main` — this is the promotion step (see
   [release-management.md](release-management.md)).
3. CI runs the full `npm run phase:commit`-equivalent suite against the
   `main`-bound PR.
4. On merge, Vercel automatically builds and deploys `main` to
   Production.
5. Run the [post-deployment verification checklist](post-deployment-verification-checklist.md).
6. Monitor `/api/ready` and (once configured) error-reporting/uptime
   tooling for the first 30 minutes after deployment.

## Rollback

1. In the Vercel dashboard, find the last known-good production
   deployment and select "Promote to Production" — this is immediate
   and doesn't require a new build.
2. Separately, revert the offending commit(s) on `main` via a normal PR
   so `main`'s history matches what's actually deployed going forward
   — the dashboard rollback is a stopgap, not a substitute for this.
3. If the issue involves a database migration, do **not** attempt an
   in-place schema rollback — migrations are forward-only; see
   [disaster-recovery-plan.md](disaster-recovery-plan.md)'s migration
   scenario for the real recovery path (restore from backup).

## Related documents

- [Deployment architecture](../architecture/deployment-architecture.md)
- [Release management](release-management.md)
- [Post-deployment verification checklist](post-deployment-verification-checklist.md)
- [Incident response plan](incident-response-plan.md)
