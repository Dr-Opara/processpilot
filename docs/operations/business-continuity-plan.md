# Business Continuity Plan

Status: **Draft.** Written against the architecture actually deployed
(Vercel + Supabase + Clerk, see
[deployment-architecture.md](../architecture/deployment-architecture.md)),
not against a real production incident history (none exists yet).

## Dependencies and single points of failure

| Dependency          | Role                        | If unavailable                                                                                                                             |
| ------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Vercel              | Hosting, edge network, cron | Site and API unreachable — no alternate hosting is configured                                                                              |
| Supabase (Postgres) | Primary database            | No reads/writes possible; `/api/ready` reports `unavailable`                                                                               |
| Supabase Storage    | Evidence/document files     | Uploads/downloads fail; core workflow data (in Postgres) unaffected                                                                        |
| Clerk               | Authentication              | No sign-in possible; already-authenticated sessions may continue briefly depending on Clerk's own session caching                          |
| Stripe              | Billing                     | Existing subscriptions unaffected (entitlements are cached/derived); new billing changes fail safely (documented "not configured" pattern) |

## Continuity approach

ProcessPilot has no secondary/failover deployment today — this is a
single-region deployment. For each dependency above, the honest posture
is: **detect via `/api/ready`, communicate via the status process (see
[service-status-communication.md](service-status-communication.md)), wait
for the provider's own recovery** (none of Vercel/Supabase/Clerk/Stripe
are self-hosted, so we cannot directly remediate their outages).

## What we control directly

- **Database backups** — see [backup-and-restoration.md](backup-and-restoration.md).
- **Rollback of our own deployments** — see
  [deployment-architecture.md](../architecture/deployment-architecture.md)'s
  rollback section (Phase 26).
- **Background job recovery** — the worker's stale-lock reclaim and
  retry/backoff (Phase 8, documented in
  [src/lib/jobs/README.md](../../src/lib/jobs/README.md)) already handle a
  worker crash mid-job without manual intervention.

## Known gap

No disaster-recovery drill has been run (no production environment exists
to drill against). This is a real, stated gap, not a completed exercise —
see [disaster-recovery-plan.md](disaster-recovery-plan.md)'s own status.

## Related documents

- [Disaster recovery plan](disaster-recovery-plan.md)
- [Backup and restoration](backup-and-restoration.md)
- [Deployment architecture](../architecture/deployment-architecture.md)
