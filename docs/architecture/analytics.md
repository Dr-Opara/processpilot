# Analytics

Operational analytics dashboards computed live over existing tenant-
scoped tables — no snapshot/cache table, no precomputed or scheduled
rollup. Implemented in Phase 14
([src/lib/services/analytics-workflows.ts](../../src/lib/services/analytics-workflows.ts),
[analytics-compliance.ts](../../src/lib/services/analytics-compliance.ts),
[ai-drafts.ts](../../src/lib/services/ai-drafts.ts)'s
`getAiDraftAcceptanceStats()`) per
[product/success-metrics.md](../../product/success-metrics.md)'s
"operational value" and "AI-assist quality" metric groups.

## Access

Every query gates on the `analytics.view` permission, scoped by
`departmentId` where a filter is supplied — the same
`requirePermission("analytics.view", { scope: { departmentId } })`
posture every other Phase 10–13 read path uses. `organization_owner`
and `organization_admin` hold it unscoped; `process_owner` and
`manager` hold it scoped to their own departments (see
`supabase/migrations/20260719130002_membership_roles_permissions.sql`).
There is no separate `analytics.export` capability yet — export is
Phase 15's `audit.export` concern, not this phase's.

## No fabricated figures

Per [product/product-principles.md](../../product/product-principles.md)
and success-metrics.md's closing principle, every rate in this phase is
`number | null`, never a fabricated `0%`/`100%` when the denominator is
zero. `/app/analytics` renders "No data yet" for a `null` rate rather
than a number that would misrepresent an empty state as a measured
result.

## Metrics implemented

**`listProcessAnalytics()`** — per-process workflow counts (started,
completed), completion rate, median cycle time (`percentile_cont(0.5)`
over `completed_at - started_at`, minutes), exception count and rate.

**`getWorkflowTrend()`** — weekly time series (default 12, max 52
weeks) of started/completed/exception counts, zero-filled for weeks
with no activity via a `generate_series` weeks CTE left-joined against
independently-grouped `started_counts`/`completed_counts`/
`exception_counts` CTEs. Started and completed counts must be computed
from separate `group by` clauses on their own respective timestamp
columns (`started_at` vs. `completed_at`) — collapsing both into one
CTE grouped by `started_at` would silently misattribute a workflow's
completion to the week it started rather than the week it finished.

**`getAuditReadiness()`** — the percentage of `completed` workflows
with no required-evidence gap. Scoped deliberately to evidence, not
approvals: [workflow-engine.ts](workflow-engine.md)'s `failWorkflow()`
fires whenever a required approval is rejected, so a workflow can never
reach `completed` with an undecided or rejected required approval — the
approval trail is structurally complete by construction. A required
`evidence` task, by contrast, completes generically regardless of
whether evidence was ever uploaded and accepted
([forms-and-evidence.md](forms-and-evidence.md)) — that is the one gap
this metric has to detect.

**`getTrainingCompliance()`** (`analytics-compliance.ts`) — on-time
completion rate for `training_assignments` (`completed_at <= due_at`,
or no due date) and certification currency rate
(`active / (active + expired)` for `certifications`).

**`getCapaClosureStats()`** — CAPA closure rate and median days to
close (`percentile_cont(0.5)` over `closed_at - created_at`, days) for
`capa_plans`.

**`getAiDraftAcceptanceStats()`** — acceptance rate across every
`ai_drafts` row that has been decided (`accepted / (accepted +
dismissed)`), generalized across every AI draft type rather than
process-extraction drafts alone.

## Known gaps

- **Draft-to-publish time delta** (success-metrics.md's second AI-assist
  metric, comparing AI-assisted vs. manually authored process
  draft-to-publish time) is not implemented — it needs a join between
  `ai_drafts.accepted_resource_id` and the resulting process version's
  publish timestamp that doesn't cleanly generalize the way the
  acceptance-rate query does, and is left for a follow-up once there is
  enough AI-assisted publish volume to make the comparison meaningful.
- **Adoption, commercial, and platform-health metrics** (time-to-first-
  published-process, trial-to-paid conversion, uptime, and so on) are
  out of scope for this phase's customer-facing dashboards — they are
  cross-tenant/platform-internal figures that would require access
  beyond a single organization's data and belong to internal
  admin/billing tooling, not `/app/analytics`.
- **Query performance at scale** is an explicitly flagged risk in
  [phase-tracker.md](../project/phase-tracker.md)'s Phase 14 entry,
  deferred to Phase 23 observability follow-up.

## UI

`/app/analytics` (`src/app/app/(protected)/analytics/page.tsx`) is a
server component: department/location filter form (GET query params),
an organization-wide overview, training/CAPA/AI-draft summary cards, a
per-process table, and a 12-week trend table. No charting library is
introduced — the rest of the app renders tabular data with plain HTML
tables, and this phase follows that precedent rather than adding a new
client-side dependency for its first chart. The location filter's
option list is fetched independently of the rest of the page's data: it
calls `listLocations()`, which requires `location.manage` (a narrower
permission than `analytics.view`), so a viewer without it still sees
the full dashboard — just without location names to pick from.
