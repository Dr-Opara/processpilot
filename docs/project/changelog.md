# Project Documentation Changelog

Tracks material changes to the documents in `docs/project/`. This is a
documentation changelog, not an application release changelog — see
[phase tracker](phase-tracker.md) for implementation status and
[product/changelog.md](../../product/changelog.md) for changes to
`product/`.

## 2026-07-31 — Phase 15 documentation and status update

Added [audit-and-compliance.md](../architecture/audit-and-compliance.md)
describing the Phase 15 implementation: `src/lib/services/audit.ts`'s
`listAuditEvents()`/`exportAuditEvents()` and `/app/audit`, built on
`recordAuditEvent()` coverage that was already comprehensive across
Phases 5–13. Documents a real pre-existing bug this phase found and
fixed — `audit_events_select`'s RLS policy checked only an unscoped
`audit.view` grant, making `manager`'s/`auditor`'s seeded scoped grants
functionally inert — fixed by `20260730000001_audit_scoped_views.sql`
(adds `audit_events.department_id`, switches the policy to
`has_scoped_permission`) plus wiring `department_id` through
`recordAuditEvent()` for the exception/CAPA/waiver and training/
certification domains, which also surfaced and fixed a second bug in
those same domains' own unpopulated `department_id` columns. Updated
[database-schema.md](../architecture/database-schema.md) with the new
column. Updated [phase-tracker.md](phase-tracker.md): Phase 14 marked
`Complete` (merged via PR #17); Phase 15 marked `Complete` with
implementation detail, built on
`feature/phase-15-audit-compliance-center`. Rewrote
[current-project-status.md](current-project-status.md)'s snapshot
accordingly.

## 2026-07-30 — Phase 14 documentation and status update

Added [analytics.md](../architecture/analytics.md) describing the Phase
14 analytics implementation: live queries over existing tenant-scoped
tables (no cache/snapshot table), the `analytics.view` permission gate,
the null-vs-fabricated-zero rate convention, each metric's definition
(per-process/cross-process workflow stats, 12-week trend, audit
readiness, training/CAPA compliance, AI draft acceptance rate), and
known gaps (no draft-to-publish time delta yet; adoption/commercial/
platform-health metrics deliberately out of scope for this
customer-facing surface). Updated [phase-tracker.md](phase-tracker.md):
Phase 13 marked `Complete` (merged via PR #16); Phase 14 marked
`Complete` with implementation detail, built on
`feature/phase-14-analytics`. Rewrote
[current-project-status.md](current-project-status.md)'s snapshot
accordingly.

## 2026-07-29 — Phase 13 documentation and status update

Rewrote [ai-architecture.md](../architecture/ai-architecture.md) with an
"Implementation" section describing the actual provider-neutral adapter
(`src/lib/ai/adapter.ts`, `providers/anthropic-provider.ts`,
`get-provider.ts`), the environment-vs-organization availability split,
the structural governance-boundary enforcement (a static import scan in
`ai-governance.test.ts`), prompt-injection defenses, and grounding/usage-
tracking detail, built on `feature/phase-13-ai-copilot`. Updated
[ADR-0008](../architecture/decisions/0008-provider-neutral-ai-abstraction.md)
from "Proposed" to "Accepted." Updated
[database-schema.md](../architecture/database-schema.md) with the 2 new
tables (`ai_drafts`, `ai_usage_events`). Updated
[environment-variables.md](../development/environment-variables.md) to
move `ANTHROPIC_API_KEY` from "planned" to "current," documenting its
placeholder-detection and optional-at-boot behavior. Updated
[phase-tracker.md](phase-tracker.md): Phase 12 marked `Complete` (merged
via PR #15); Phase 13 added with implementation/testing detail and
known gaps (live Claude API output unverified — only the documented
placeholder credential exists in this environment). Rewrote
[current-project-status.md](current-project-status.md)'s snapshot
accordingly.

## 2026-07-28 — Phase 12 documentation and status update

Added
[training-and-certifications.md](../architecture/training-and-certifications.md)
documenting course authoring/versioning (the same immutable-published-
version pattern as Phase 9's forms), the embedded multiple-choice
assessment model, role/department/team/individual assignment,
completion tracking, and certification issuance/renewal/revocation
built on `feature/phase-12-training-certifications`. Updated
[database-schema.md](../architecture/database-schema.md) with the 5 new
tables. Updated [phase-tracker.md](phase-tracker.md): Phase 11 marked
`Complete` (merged via PR #14); Phase 12 added with implementation/
testing detail and known gaps. Rewrote
[current-project-status.md](current-project-status.md)'s snapshot
accordingly.

## 2026-07-27 — Phase 11 documentation and status update

Added [exception-management.md](../architecture/exception-management.md)
documenting the exception/CAPA/waiver model built on
`feature/phase-11-exceptions-capa`: exception intake and lifecycle,
severity/priority calculation, root-cause analysis, containment
actions, CAPA plans through approval/verification/closure, temporary
waivers, and heuristic recurrence matching. Updated
[database-schema.md](../architecture/database-schema.md) with the 15
new tables. Updated
[authentication-and-authorization.md](../architecture/authentication-and-authorization.md)
to note the `exceptions.*`/`capa.*`/`waivers.*` permission families,
which replaced the coarser `exception.create`/`exception.manage`
placeholder rows the matrix had reserved (but never used) since Phase 0.
Updated [phase-tracker.md](phase-tracker.md): Phase 10 marked `Complete`
(merged via PR #13); Phase 11 added with implementation/testing detail
and known gaps (consolidated route scope; deferred effectiveness-
automation and fuzzy recurrence matching). Rewrote
[current-project-status.md](current-project-status.md)'s snapshot
accordingly. Updated [roadmap.md](roadmap.md) and
[repository-map.md](repository-map.md) for the new routes/services.

## 2026-07-26 — Phase 10 documentation and status update (retroactive)

Phase 10 (approvals, SLAs, and escalations) shipped and merged via PR
#13 without a changelog entry at the time — recorded here for
continuity. Added
[approvals-and-slas.md](../architecture/approvals-and-slas.md)
documenting configurable multi-approver chains, business-calendar-aware
SLA due dates, and numbered escalation levels. Updated
[workflow-engine.md](../architecture/workflow-engine.md)'s `approval`
node-type entry and deadline-tracking description accordingly.

## 2026-07-25 — Phase 9 documentation and status update

Added [forms-and-evidence.md](../architecture/forms-and-evidence.md)
documenting the form authoring/versioning model, the field-type/
validation/conditional-visibility engine, structured submissions
(draft/submit/amend), and the evidence upload/review/chain-of-custody
model, per `feature/phase-9-forms-evidence`. Updated
[workflow-engine.md](../architecture/workflow-engine.md)'s node-type
table for the `form` node's new form-linkage behavior. Updated
[file-storage.md](../architecture/file-storage.md) to describe the
`evidence` bucket alongside `knowledge-documents` rather than saying
storage was unimplemented. Updated [phase-tracker.md](phase-tracker.md):
Phase 8 marked `Complete` (merged via PR #10), Phase 9 moved to
`In Progress` with implementation/testing detail and known gaps.
Rewrote [current-project-status.md](current-project-status.md)'s
snapshot accordingly.

## 2026-07-24 — Phase 8 documentation and status update

Rewrote [workflow-engine.md](../architecture/workflow-engine.md) to
describe the engine as actually implemented on
`feature/phase-8-workflow-execution` (token-based execution, the
per-node-type behavior table, the decision condition grammar, the
workflow/task state machines, the two background jobs, and the new
`/app/workflows/*` and `/app/tasks/*` routes) rather than the
Phase-0-era forward-looking design. Updated
[phase-tracker.md](phase-tracker.md): Phase 8 moved from `Not Started` to
`In Progress` with implementation/testing detail and known gaps; also
corrected stale `Not Started` summary-table rows for Phases 5–7, which
their own detail sections already recorded as `Complete`. Rewrote
[current-project-status.md](current-project-status.md)'s snapshot, which
had been left at its Phase 4 (2026-07-19) state despite Phases 5–7
shipping since.

## 2026-07-19 — Milestone 2 documentation initialized

Introduced the milestone framing that sits alongside the existing
[phase tracker](phase-tracker.md): [milestones.md](milestones.md) (defines
Milestone 1 through Milestone 6, grouping the tracker's 31 phases around
externally-meaningful outcomes), [roadmap.md](roadmap.md) (milestone
sequencing and dependencies), [repository-map.md](repository-map.md)
(directory-level map, more detailed than README's), this changelog, and
[current-project-status.md](current-project-status.md) (live snapshot).
Added [milestone-2-core-platform.md](milestone-2-core-platform.md): goal,
12-step customer journey, included phases (4 through the new Phase 8.5),
explicit MVP exclusions, and definition of done for Milestone 2 (Core
Platform). Updated [phase-tracker.md](phase-tracker.md) to add Phase 8.5
(MVP staging and design-partner validation) and cross-reference the new
milestone documents. No application code changed in this update — Phase 4
implementation follows separately.

## Related documents

- [Phase tracker](phase-tracker.md)
- [Milestones](milestones.md)
