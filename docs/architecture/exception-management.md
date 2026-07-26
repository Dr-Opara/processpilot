# Exception Management

Automatic and manual exception creation, triage, investigation,
containment, root-cause analysis, corrective/preventive action (CAPA)
plans, and temporary waivers, per
[domain-model.md](domain-model.md)'s `Workflow -> Exception ->
CorrectiveAction` relationship and
[product/terminology.md](../../product/terminology.md)'s definitions.
Implemented in Phase 11
([src/lib/services/exceptions.ts](../../src/lib/services/exceptions.ts),
[exception-root-cause.ts](../../src/lib/services/exception-root-cause.ts),
[exception-containment.ts](../../src/lib/services/exception-containment.ts),
[exception-recurrence.ts](../../src/lib/services/exception-recurrence.ts),
[capa.ts](../../src/lib/services/capa.ts),
[waivers.ts](../../src/lib/services/waivers.ts)).

## Exception lifecycle

`status` progresses through `reported` → `triaged` →
`under_investigation` → `containment_in_progress` /
`action_plan_required` / `remediation_in_progress` →
`pending_verification` → `closed`, with `rejected` and `reopened` as
side exits (`exceptions.ts`'s `rejectException()`/`reopenException()`).
`closeException()` refuses to close without a documented root cause
(`root_cause_analyses.primary_root_cause` not null) unless the caller
explicitly passes `allowClosureWithoutRootCause` with its own reason —
"prevent closure without a documented root cause unless an authorized
exception is recorded," verbatim.

### Intake

`exceptions.exception_type` (process deviation, policy exception,
control failure, missed SLA, evidence deficiency, task failure, security
issue, training deficiency, vendor issue, data-quality issue, other) is
independent of `exceptions.source` (employee/manager submission,
workflow failure, task failure, missed SLA, failed approval, evidence
rejection, form submission, audit finding, integration event, system-
detected, administrative entry) — a manual report always has one of the
three manual sources; every other source is set by
`exceptions.ts`'s `createSystemException()`, called from within an
already-open transaction by:

- `workflow-engine.ts`'s `failWorkflow()` — every workflow failure
  (decision with no matching branch, unconfigured subprocess, rejected
  required approval) becomes an exception, not just a
  `workflow.failed` history/audit event.
- `escalation.ts`'s `checkTaskEscalations()` — reaching the
  `escalate_admin` level (every lower escalation attempt already
  failed) creates a `missed_sla` exception.
- `evidence.ts`'s `reviewEvidence()` — rejecting evidence creates an
  `evidence_deficiency` exception.

`createSystemException()` is idempotent: it checks for an already-open
exception matching the same source and target (task/workflow/evidence
id) before inserting, so a retried job or a crash-recovered handler
never fans out into duplicate exceptions for the same underlying
failure.

### Severity and priority

`severity` (low/moderate/high/critical) is set directly by whoever
triages the exception. `priority` is calculated by
`exceptions.ts`'s `calculatePriority()` — severity is the starting
point; each aggravating input (high likelihood, high impact, regulatory
impact, recurrence, an SLA breach, customer impact) counts as one
"boost," and every two boosts raises priority one level, capped at
`critical`. A deliberately simple, documented function, not a
proprietary risk model — `triageException()`'s `priorityOverride` lets
an authorized triager replace the calculated value outright, but only
with a `priorityOverrideReason`.

## Root-cause analysis

One `root_cause_analyses` row per exception (`unique (exception_id)` —
upserted, not append-only, since investigation is iterative), holding a
`method` (`five_whys`/`fishbone`/`other`), an optional fishbone
category, a `primary_root_cause`, and free-text investigator notes.
`root_cause_factors` holds ordered detail rows under it (Five-Whys
steps, secondary root causes, contributing factors) — this part _is_
append-only, since each step in an investigation is its own record.

## Containment

`exception_containment_actions` — immediate steps tracked independently
of the exception's own status/root-cause/CAPA flow, each with an owner,
optional due date, and completion/verification notes. Creating one
moves the parent exception to `containment_in_progress` if it's still
in an early status.

## CAPA plans

A `capa_plans` row is a corrective/preventive action plan against an
exception: owner, sponsor, completion criteria, an effectiveness-check
method/date, and a verification owner. Lifecycle: `draft` →
`pending_approval` → `approved` → `in_progress` →
`pending_verification` → `effective`/`ineffective` → `closed` (or
`canceled`/`reopened`). `capa_actions` are individual corrective/
preventive line items (each with its own owner, due date, optional
dependency on another action, and an optional `requires_evidence` flag
that `completeCapaAction()` enforces — an evidence-required action
cannot be marked complete without an evidence id). `capa_approvals`
records each approve/reject decision; `capa_effectiveness_checks`
records each verification outcome, which is what actually flips the
plan to `effective`/`ineffective`. `closeCapaPlan()` only allows closing
a plan already verified `effective`.

## Temporary waivers

`temporary_waivers` are time-bound risk acceptances against an
exception: business justification, compensating controls, risk
acceptance, and a **required** `expires_at` — never optional, so a
waiver can never silently become permanent. Lifecycle: `requested` →
`active` (approved) / `rejected`, with `renewed`, `revoked`, and
`expired` as further transitions. `waiver_approvals` records each
decision; `waiver_renewals` records each extension (always logging the
previous and new expiration together). The `waiver-expiration-check`
background job (`src/lib/jobs/waiver-handlers.ts`) flips an
active/renewed waiver to `expired` once its `expires_at` passes,
scheduled per-waiver at approval/renewal time (same pattern as Phase
9's `evidence-expiration-check`) — idempotent, since it's a no-op for a
waiver already renewed (with a new job scheduled against the new
expiry) or otherwise no longer expirable.

## Recurrence matching

`exceptions.ts`'s `createException()`/`createSystemException()` call
`exception-recurrence.ts`'s `findRecurrenceMatches()`, which logs a
`recurrence_matches` row for every other exception (within a 180-day
lookback) that shares an exception type, process, department, location,
tag, or a substring-overlapping title. Deliberately a plain heuristic,
not fuzzy text matching or ML — a recall aid for triage, explicitly
**not** a duplicate-detection guarantee.

## Routes

Consolidated relative to a fully separate route per concern: exception
overview/investigation/containment/root-cause/linked-CAPA/linked-waiver
content all live on one `/app/exceptions/[exceptionId]` detail page
rather than as `/edit`, `/investigation`, `/capa`, `/waiver` sub-routes,
and the "dashboard" views (open/overdue/high-and-critical/by-type) are
query-param-filtered views of `/app/exceptions` and `/app/capa` rather
than separate `/dashboard` route files. `/app/exceptions`,
`/app/exceptions/new`, `/app/exceptions/[exceptionId]`, `/app/capa`,
`/app/capa/[capaId]`, `/app/waivers`, `/app/waivers/[waiverId]` are the
routes that actually exist.

## Tenant isolation, RLS, and authorization

All 15 new tables have RLS enabled and an `organization_id` policy,
following [multi-tenancy.md](multi-tenancy.md). New permissions:
`exceptions.view`/`create`/`edit`/`triage`/`investigate`/`close`/
`manage`, `capa.view`/`create`/`edit`/`approve`/`verify`/`close`,
`waivers.view`/`create`/`approve`/`manage` — see
[product/permissions-matrix.md](../../product/permissions-matrix.md).
These replace the coarser `exception.create`/`exception.manage`
placeholder rows the matrix had reserved since Phase 0 but no migration
or service had ever used — removed in the same migration that adds the
replacements, not left duplicated. Every mutating service call goes
through `requirePermission()` before `withTenantContext()`; the
exceptions created from engine/job code (`createSystemException()`) are
the one exception, matching the same "no separate permission gate for
system-generated rows, tenant match is enough" posture Phase 10's
`escalation_events` already established.

## Known gaps

Attachments on exceptions/CAPA/waivers reuse the same evidence-upload
path Phase 9/10 established, with the same deferred malware-scanning
posture. No automated effectiveness-check scheduling beyond the
optional `effectiveness_check_date` field on a CAPA plan — recording
the check itself is manual. Recurrence matching is the plain heuristic
described above, not guaranteed duplicate detection. Notification
delivery (new assignment, approaching due date, overdue, CAPA approval
required, waiver expiring, ...) is Phase 16's job, same deferred
posture as every other phase's notification-shaped event.
