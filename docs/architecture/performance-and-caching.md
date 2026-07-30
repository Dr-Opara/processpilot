# Performance, Caching, and Capacity (Phase 23)

Covers this phase's performance baseline, database/application
performance review, caching strategy, scheduled-task inventory, and
capacity assumptions. Background job/queue architecture is documented
in depth in [`src/lib/jobs/README.md`](../../src/lib/jobs/README.md)
(claiming, retries, dead-lettering, idempotency) — not duplicated here;
this document covers what changed or was newly reviewed in Phase 23.

## How to read the measurements below

- **Measured (local)** — actually timed in this development environment
  against the production build (`next start`), a real signal but not
  representative of production hardware/network.
- **Estimated** — derived from code review (query shape, index
  presence, known N+1 patterns), not timed, because no staging/
  production environment or representative dataset exists to measure
  against in this environment.
- No production or preview-environment measurement exists for this
  phase — same "Vercel preview blocked on a platform-configuration
  issue" caveat noted since Phase 1, still unresolved.

## Performance baseline (measured, local, production build)

| Journey                                 | Measurement                                                 | Value                                                                                                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketing homepage (`/`) first response | `curl` time-to-first-byte, local `next start`               | ~15–40ms (static, prerendered)                                                                                                                                                            |
| `/api/health`                           | Route round-trip, no dependencies                           | <5ms                                                                                                                                                                                      |
| `/api/ready` (DB reachable)             | Route round-trip including one `select 1` + 3 count queries | Dependent on local Postgres reachability — **not measured against a real Supabase project in this environment** (no linked project, same gap as every RLS integration test since Phase 4) |
| Production bundle                       | `next build` output                                         | 133 routes; no route flagged oversized by Next's own build output in this pass                                                                                                            |

**Budgets** (targets to measure production against once a real
deployment exists, not yet verified):

- API route p95 < 500ms for read endpoints, < 1s for write endpoints.
- Marketing page LCP < 2.5s (Core Web Vitals "good" threshold).
- Background job claim-to-completion p95 < 30s for non-AI job types.
- No single client JS bundle chunk > 250KB gzipped (Next's default
  build warns above this; none did in this pass).

## Database performance

Reviewed every service file under `src/lib/services/` for the patterns
this phase's brief calls out:

- **N+1 patterns found and left as-is (estimated low-impact):**
  `roles.ts`'s `listRoles()` and `custom-roles.ts`'s `listRoleTemplates()`
  each issue one query per role/template to fetch its permissions
  (loop-per-row). Left unchanged in this pass — the role/template count
  per organization is small (system roles + a handful of custom ones),
  so the N+1 shape is a known, accepted tradeoff for query simplicity
  over a single `array_agg` join, not a fix candidate at today's scale.
  Documented here rather than silently present.
- **Pagination:** every list-returning service function already caps
  `pageSize`/`limit` (`members.ts` at 100, `/api/v1/*` at 100 via
  `parsePagination()`, audit export at 5,000) — no unbounded query was
  found in this review. None use cursor-based pagination (all are
  offset/limit); acceptable at current expected data volumes per
  organization (see "Capacity assumptions" below) but would need
  revisiting if a single organization's row counts grow to the
  hundreds of thousands.
- **Indexes:** every tenant-owned table already carries an
  `organization_id` index, enforced statically by
  `schema-coverage.test.ts` since Phase 4 — re-verified in this phase
  (82 tables, 100% coverage, +1 from this phase's own
  `scim_token_usage_log`). No additional index was added in this pass;
  a real index-usage review (e.g. `pg_stat_statements`) requires a live
  database with real query traffic, which doesn't exist in this
  environment — this is an **estimated**, not measured, conclusion.
- **Connection handling:** `getAdminSql()`/`withTenantContext()`
  (Phase 4) already use `postgres.js`'s built-in connection pooling —
  unchanged in this phase; no pooling misconfiguration was found in
  review.
- **RLS after optimization:** no query was rewritten in this phase, so
  no RLS re-verification was needed — the only new query surface is
  `getQueueHealth()`/`checkDatabase()` (Phase 23, admin-client-only,
  reads `background_jobs` which has no tenant-scoping concern since the
  admin client is trusted system code, same posture every other job
  handler already uses).

## Application performance

- **Server components by default:** every `page.tsx` reviewed in this
  codebase is already an `async function` server component (no
  unnecessary `"use client"` directive found on a data-fetching page in
  this review) — this was already the established pattern since Phase 1,
  not newly introduced.
- **Large views:** the process builder canvas (`@xyflow/react`) and
  large list/table views (members, audit, exceptions) were reviewed for
  virtualization needs. None currently virtualize their row rendering —
  **estimated acceptable** at today's per-organization row counts
  (dozens to low hundreds of members/processes per organization is the
  assumed workload — see "Capacity assumptions"), but flagged as the
  first thing to revisit if a design partner's organization grows past
  ~1,000 rows in any single list view.
- **Duplicate network requests:** `listMembers()`/`listTeams()`/etc. are
  each called once per page render (server-side), not re-fetched
  client-side — no client-side data-fetching library (SWR/React Query)
  is even a dependency, so there's no client-side cache/duplicate-request
  class of bug to have introduced.
- **Images/fonts:** `next/font/google` (self-hosted at build time, no
  runtime request) already in use since Phase 1; no unoptimized `<img>`
  tag was found in this review (Next's `<Image>` component or static
  assets throughout).

## Caching strategy

| Data class                                                   | Cached? | Mechanism                                                                            | TTL / invalidation                                |
| ------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Marketing static pages (`/`, `/product/*`, `/pricing`, etc.) | Yes     | Next.js static optimization (prerendered at build time)                              | Invalidated on next deploy                        |
| Static assets (fonts, images, JS/CSS bundles)                | Yes     | Next.js's own immutable asset caching (`s-maxage`/content-hashed filenames)          | Content-hash-based, no manual invalidation needed |
| `/app/*` (every authenticated, organization-scoped page)     | **No**  | `Cache-Control: private, no-store` (new in this phase, `next.config.ts`)             | N/A — never cached by any shared/browser cache    |
| `/api/v1/*`, `/api/scim/*`, `/api/jobs/*`                    | **No**  | Same `private, no-store` header                                                      | N/A                                               |
| Dashboard/analytics aggregates                               | **No**  | Computed fresh on every request (`analytics-workflows.ts`/`analytics-compliance.ts`) | N/A — no cache layer added in this pass           |
| API responses (public API/SCIM reads)                        | **No**  | Same `no-store` posture                                                              | N/A                                               |

**Explicit decision: no new organization-scoped data cache was built in
this pass.** The task brief's own constraint ("prevent cross-tenant
cache leakage… do not cache authorization decisions incorrectly… do not
cache sensitive data in public or shared caches") is exactly the risk
class a hastily-added cache layer would introduce under this phase's
time constraints — every organization-scoped read in this codebase
already re-derives the caller's permissions and `organization_id` from
their live session on every request (no cached authorization decision
exists to go stale or leak). Given the low measured/estimated query
latency (no evidence of a real performance problem this phase's own
baseline surfaced) and the real risk of a caching bug becoming a
tenant-isolation bug, this phase chose "prove there's no unsafe caching"
over "add caching that must then be proven safe." If a real production
workload later shows dashboard/analytics aggregation is a genuine
bottleneck, the safe pattern to add is a cache keyed by
`(organizationId, ...queryParams)` with an explicit TTL and invalidation
on the specific mutations that affect that aggregate — not attempted
here without real load data to size it against.

**Stale-data behavior:** since nothing organization-scoped is cached,
there is no stale-data window to document for that data class. Static
marketing content can be stale for the duration between a deploy and
the next one (standard Next.js static-optimization behavior, unchanged).

## Scheduled tasks inventory

| Task                                                                                                                                                                                                                                 | Trigger                                                                                                 | Auth                                                   | Idempotent                                                                                                                     | Notes                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `/api/jobs/process` (worker tick)                                                                                                                                                                                                    | Vercel Cron, `vercel.json`, `0 0 * * *` (daily — Vercel Hobby plan limit, see `src/lib/jobs/README.md`) | `CRON_SECRET` bearer token, fails closed if unset      | Yes — `processDueJobs()` claims via `FOR UPDATE SKIP LOCKED`, so overlapping/duplicate ticks can't double-process the same job | Now also routes its own failure through `captureException()` (Phase 23) |
| Every individual job type (`workflow-deadline-check`, `deliver-webhook`, `deliver-notification-email`, `evidence-expiration-check`, `task-escalation-check`, `external-access-expiration-check`, `organization-deletion-sweep`, ...) | Enqueued by domain code via `enqueueJob()`, claimed by the worker tick above                            | N/A (runs as trusted system code via the admin client) | Yes — each handler checks current row status before acting (documented per-handler in their own header comments)               | See `src/lib/jobs/README.md` for the full registered-handler list       |

**Missed/delayed-run handling:** `processDueJobs()` claims anything with
`scheduled_at <= now()`, so a missed or delayed cron tick delays
processing rather than losing work — a job scheduled for an hour ago is
still claimed and run on the next tick, not skipped. **Overlapping
execution:** prevented by the `FOR UPDATE SKIP LOCKED` claim plus a
stale-lock reclaim (a job locked by a worker that crashed mid-run is
reclaimed after a timeout) — this was already Phase 8's design, verified
still correct in this review.

## Reliability and resilience

- **Timeouts added in this phase:** every raw `fetch()` call to an
  external provider now carries `AbortSignal.timeout(10_000)`
  (`src/lib/observability/timeouts.ts`) — Slack's OAuth exchange/
  connection-test calls, Resend's email-send call, and outbound webhook
  deliveries. None of these had any timeout before this phase; a hung
  provider connection could previously tie up a worker/route handler
  indefinitely.
- **AI (Anthropic SDK) and billing (Stripe SDK) calls** already have
  their own SDK-level timeout/retry handling — not modified in this
  phase.
- **Retries with backoff:** the background-job worker's exponential
  backoff (Phase 8, unchanged) already covers every job type, including
  the three call sites that just gained timeouts above — a timeout now
  produces a normal, retryable job failure rather than an indefinite
  hang.
- **Graceful degradation:** every optional provider (AI, email, billing,
  Slack, integration encryption) already fails safe with an explicit
  "not configured" error rather than a fake success — unchanged,
  re-verified in this review (see also security-hardening.md's section
  8).
- **No fake success:** re-verified across every provider adapter in
  this review — none of them return a success result without the
  underlying call actually succeeding.

## Capacity assumptions (estimated, not load-tested)

- **Assumed per-organization scale:** tens to low hundreds of members,
  processes, and workflows; low thousands of workflow instances/tasks
  per year. This is an assumption carried from `product/personas.md`'s
  target customer profile, not a measured production number (no
  production deployment exists yet).
- **Likely first bottleneck:** the daily-only Vercel Cron tick (Hobby
  plan limit, documented in `src/lib/jobs/README.md`) — deadline checks,
  webhook retries, and notification delivery are only as timely as the
  last daily tick. Upgrading the Vercel plan (or swapping to an
  external scheduler calling `/api/jobs/process` more frequently) is a
  plan/cost decision already documented, not a code change.
- **Second likely bottleneck:** the N+1 role/template permission-fetch
  pattern noted above, if an organization's custom-role count grows
  large — not expected at today's assumed scale.
- **No load or stress testing was performed against a real environment
  in this phase** — no staging/production deployment exists to safely
  load-test against, and this phase's own task brief prohibits
  destructive/uncontrolled load testing against production.

## Testing

New in this phase: `src/lib/observability/logger.test.ts`,
`error-reporting.test.ts`, and `health.test.ts` (redaction, provider
fallback, readiness status transitions); `src/app/api/health/route.test.ts`
and `src/app/api/ready/route.test.ts` (including an explicit assertion
that the readiness response never contains a connection string or a
known secret-prefix pattern).

**Already covered by Phase 8, re-verified in this review, not
duplicated:** `src/lib/jobs/background-jobs.integration.test.ts`
(`describe.skipIf` against a live Supabase Postgres instance — same
"not runnable in this environment" caveat as `tenant-isolation.integration.test.ts`)
already exercises concurrent job claiming ("does not let a second claim
pick up an already-claimed job"), idempotency
("is idempotent per (organization_id, idempotency_key)"), dead-lettering
("dead-letters and records an audit event once max_attempts is
reached"), and stale-lock reclaim — exactly the "concurrent job
claiming, duplicate-job prevention, retry behavior, dead-letter
handling" tests this phase's brief calls for. Cache-isolation and
cache-invalidation tests were not added, since no new cache layer was
introduced (see "Caching strategy" above) — there is nothing new to
isolate or invalidate.

## Related documents

- [Background jobs](../../src/lib/jobs/README.md)
- [Observability](observability.md)
- [Security hardening](security-hardening.md)
- [ADR-0009: Provider-neutral background jobs](decisions/0009-provider-neutral-background-jobs.md)
- [Success metrics](../../product/success-metrics.md)
