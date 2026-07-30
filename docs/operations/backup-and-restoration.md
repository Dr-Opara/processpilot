# Backup and Restoration Procedures

Status: **Draft, describes intended configuration** — no production
Supabase project is linked in this environment (documented since Phase 4),
so none of the below has been exercised for real.

## What gets backed up

- **Database (Postgres):** Supabase's built-in daily backups (paid tiers)
  or point-in-time recovery, once a paid production project exists. Free-
  tier projects do not include this — production must not run on a free
  tier.
- **File storage:** Supabase Storage's own durability guarantees (no
  separate application-level backup is implemented).
- **Application code and migrations:** GitHub is the source of truth;
  every deployment is built from a specific, tagged commit.

## What is NOT backed up separately

- No cross-provider backup (e.g. exporting Postgres dumps to a second
  cloud provider) is configured. This is a real gap for organizations
  with a stricter RPO than Supabase's own backup tier provides.

## Restoration procedure (untested in this environment)

1. Identify the target restore point (timestamp or specific backup).
2. Restore via Supabase's dashboard/CLI to a new project (never restore
   in-place over a live project without a documented, approved reason).
3. Run `schema-coverage.test.ts` and the live-Postgres integration test
   suites against the restored project to verify RLS/schema integrity.
4. Re-point the application's `SUPABASE_DB_URL` (see
   [environment-variables.md](../development/environment-variables.md))
   to the restored project.
5. Verify `/api/ready` reports `ok` before resuming traffic.

## Restore testing

**Not yet performed.** A real restore drill against a non-production
Supabase project, timed and documented, is required before this procedure
can be called verified — tracked in
[legal-operational-readiness-checklist.md](legal-operational-readiness-checklist.md).

## Related documents

- [Disaster recovery plan](disaster-recovery-plan.md)
- [Business continuity plan](business-continuity-plan.md)
