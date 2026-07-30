# Disaster Recovery Plan

Status: **Draft, not yet drilled.** No production Supabase project exists
in this environment to actually test a restore against (the same gap
documented since Phase 4's own migration-verification notes) — this plan
describes the intended procedure, not a proven one.

## Recovery objectives (targets, not yet measured)

- **RPO (Recovery Point Objective):** target ≤24 hours of data loss,
  matching Supabase's default daily backup cadence on paid tiers. Not
  verified against a real production Supabase project.
- **RTO (Recovery Time Objective):** target ≤4 hours to restore database
  service from a backup. Not measured — no real restore has been timed.

## Scenarios

1. **Database corruption/data loss** — restore from the most recent
   Supabase backup (see [backup-and-restoration.md](backup-and-restoration.md)),
   verify against `schema-coverage.test.ts` and the live-Postgres
   integration suites once restored, then resume traffic.
2. **Accidental destructive migration** — every migration in
   `supabase/migrations/` is forward-only per this repo's convention
   ("never edit an already-applied migration in place"); recovery from a
   bad migration means restoring from backup, not attempting an in-place
   schema rollback.
3. **Total loss of the Vercel project** — redeploy from the `main`
   branch to a new Vercel project, re-attach the existing Supabase/Clerk/
   Stripe credentials (see [environment-variables.md](../development/environment-variables.md)),
   re-point DNS.
4. **Loss of the GitHub repository** — every contributor's local clone
   is a full mirror of history; recovery is a `git push` from any recent
   clone to a newly created remote.

## What has NOT been done

- No restore has ever been performed against real data — this is the
  single most important gap to close before claiming production
  readiness (see
  [legal-operational-readiness-checklist.md](legal-operational-readiness-checklist.md)).
- No cross-region or multi-cloud failover exists.

## Related documents

- [Business continuity plan](business-continuity-plan.md)
- [Backup and restoration](backup-and-restoration.md)
