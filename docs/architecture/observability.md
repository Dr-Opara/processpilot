# Observability (Phase 23)

Implements the requirements this document defined as a placeholder since
Phase 0. Everything below is provider-neutral, mirroring the existing
AI/notification/billing adapter pattern (ADR-0008): one interface, one
"get the concrete provider" function, a real fallback (never a silent
no-op) when no external credential is configured.

## Structured logging

`src/lib/observability/logger.ts` — `logger.debug/info/warn/error()`
emit a single JSON line per call (`{level, message, timestamp,
...context}`) rather than free text, so any log aggregator (Vercel's own
log drain, or a future third-party sink) can query by field. `redact()`
strips any context key that looks secret-shaped
(`password`/`secret`/`token`/`authorization`/`apiKey`, case-insensitive,
recursively through nested objects/arrays) before serialization —
defense in depth on top of every caller already being expected to avoid
passing raw secrets.

**Known gap:** existing `console.error(message, error)` call sites from
Phases 3–22 were not retrofitted to this logger in this pass (dozens of
call sites across every service/route file) — this module is the
foundation new and touched call sites use going forward, not a
completed migration. `toSafeErrorResponse()` (`src/lib/errors.ts`) is
the one call site updated in this phase, since every unhandled server
error already flows through it.

## Correlation identifiers

`generateCorrelationId()` (uuid v4). `audit_events.correlation_id`
(schema column, pre-existing since Phase 4) is available for
call-chain tracing but is not populated by every write path yet — same
"foundation, not full migration" posture as the logger above.

## Error tracking

`src/lib/observability/error-reporting.ts` — `ErrorReportingProvider`
interface, `captureException(error, context)`, `getErrorReportingProvider()`.
`isErrorReportingConfigured()` checks for `SENTRY_DSN`. **No real
Sentry (or equivalent) SDK is added as a dependency in this pass** —
doing so would mean provisioning a real DSN and source-map/release
config this environment has no credentials to verify against, the same
class of decision Phase 13/16/17/18 all made explicitly rather than
half-wiring an unverifiable integration. Every environment today uses
`ConsoleErrorReportingProvider`, which logs a redacted, structured error
event through the same `logger` every other observability surface
uses — a real, working fallback, not a stub. `toSafeErrorResponse()`
calls `captureException()` on every unhandled server error.

## Health and readiness

- `GET /api/health` — liveness. Always `200 { status: "ok" }`, no
  dependency checks — a liveness probe that itself depends on the
  database would make an orchestrator restart a healthy instance during
  a transient DB blip.
- `GET /api/ready` — readiness (`src/lib/observability/health.ts`).
  Checks: a real `select 1` against the database (3s timeout), queue
  depth/dead-letter count from `background_jobs`, and the configured/
  not-configured status of every optional provider (AI, email, billing,
  integration encryption, Slack, error reporting). Returns `503` only
  when the database check fails — an unconfigured optional provider is
  `degraded` at worst, matching every provider adapter's own documented
  "fails safe when unconfigured" posture. **Never returns a stack trace,
  connection string, or any tenant-derived value** — only booleans,
  counts, and provider names (verified by
  `src/app/api/ready/route.test.ts`'s explicit "never includes a stack
  trace or connection string" assertion).
- **Administrative visibility:** no dedicated `/app/health` admin page
  was built in this pass — `/api/ready`'s JSON response is the complete,
  correct dataset a future admin dashboard would render; adding the UI
  wrapper is deferred, not the underlying data.

## Metrics this phase surfaces (vs. what's deferred)

**Surfaced today**, via `/api/ready` and existing per-domain services:

- Queue depth, oldest-pending age, dead-letter count (`getQueueHealth()`).
- Per-provider configured/not-configured status.
- API usage counts (`api_key_usage_log`, Phase 18) and SCIM usage counts
  (`scim_token_usage_log`, Phase 22) — both already queryable, though
  neither has a dedicated metrics-export endpoint yet.

**Deferred** — would require either a real metrics backend (Prometheus/
Datadog/etc., a new credential-gated dependency) or non-trivial new
aggregation code, neither attempted in this pass:

- Server/API P50/P95/P99 latency time series (Vercel's own request
  logs carry this implicitly; not re-implemented in application code).
- Database query-level performance metrics beyond what
  `docs/architecture/performance-and-caching.md`'s manual review covers.
- Webhook delivery / notification delivery / AI usage **rate** metrics
  as time series (the underlying event tables — `webhook_deliveries`,
  `notification_deliveries`, `ai_usage_events` — already exist and are
  queryable; turning them into dashboarded rates is future work).
- Authentication/authorization failure **rate** tracking (individual
  failures already produce `AppError("forbidden"/"unauthorized", ...)`
  and, where audited, an `audit_events` row — an aggregated failure-rate
  metric or anomaly detector does not exist).

## Monitoring and alerting design

No live alert delivery exists in this environment (no PagerDuty/
Opsgenie/Slack-alerts credential configured) — the same
credential-gated posture as every other phase. The **conditions** that
should page/alert once a real channel is wired up:

| Condition                                          | Signal source                                                                                                                | Suggested threshold                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Elevated 5xx error rate                            | Vercel request logs / `captureException()` volume                                                                            | >1% of requests over 5 min                                   |
| Repeated authentication failures from one identity | Clerk's own dashboard (identity is fully delegated, ADR-0003)                                                                | Clerk-native, not duplicated here                            |
| Repeated authorization failures from one member    | `AppError("forbidden")` volume per `memberId` (not yet aggregated — see "deferred" above)                                    | N failures in 5 min, N TBD from real usage data              |
| Queue backlog                                      | `/api/ready`'s `queue.pendingCount` / `oldestPendingAgeSeconds`                                                              | Backlog age exceeds 2× the cron tick interval                |
| Repeated job failures                              | `background_jobs.status = 'dead_letter'` count                                                                               | >0 new dead-letters in 24h for a previously-healthy job type |
| Webhook delivery failures                          | `webhook_deliveries.status = 'dead_letter'`                                                                                  | >5% of deliveries dead-lettered in 1h                        |
| Notification delivery failures                     | `notification_deliveries.status = 'failed'`/`skipped_*`                                                                      | >5% of a batch failed (excluding `skipped_not_configured`)   |
| AI provider failures                               | `ai_usage_events` error outcomes (credential-gated — no real provider key in this environment to generate real failure data) | N failures in 5 min                                          |
| Billing sync failures                              | `billing_webhook_events` unprocessed/errored rows                                                                            | Any unprocessed event older than 1h                          |
| Database unavailability                            | `/api/ready`'s `database.status`                                                                                             | Any `unavailable` reading                                    |
| Abnormal usage spike                               | API/SCIM usage-log request volume                                                                                            | >Nx the trailing 7-day average for one key/token             |

This table is the alert **design**, not a claim any of it fires today —
"Live alert delivery may remain credential-gated" per this phase's own
task brief.

## Principles (carried forward from the Phase 0 placeholder)

- No tenant data leaks across organization boundaries into logs/error
  reports — `redact()` plus the discipline (unchanged since Phase 3) of
  never logging full resource payloads, only ids/counts/derived facts.
- Every background job failure that exhausts its retry policy is
  already visible (`background_jobs.status = 'dead_letter'`,
  queryable via `getQueueHealth()`) — this was true before this phase
  (Phase 8's worker design) and is now also surfaced through
  `/api/ready`.
- Audit trail (`AuditEvent`) remains a distinct, product/compliance
  record — never conflated with operational logging.

## Related documents

- [Performance and caching](performance-and-caching.md)
- [Security hardening](security-hardening.md)
- [Threat model](threat-model.md)
- [Event model](event-model.md)
- [Success metrics](../../product/success-metrics.md)
- [Deployment architecture](deployment-architecture.md)
