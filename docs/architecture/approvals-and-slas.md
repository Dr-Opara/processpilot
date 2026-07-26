# Approvals, SLAs, and Escalations

Configurable multi-approver chains, business-calendar-aware SLA tracking,
and escalation rules, layered on top of Phase 8's single-assignee
`approval` node per
[workflow-engine.md](workflow-engine.md#node-types) — the same way
[forms-and-evidence.md](forms-and-evidence.md) layers structured capture
onto the generic `form`/`evidence` node types. Implemented in Phase 10
([src/lib/services/approval-policies.ts](../../src/lib/services/approval-policies.ts),
[approval-resolution.ts](../../src/lib/services/approval-resolution.ts),
[approvals.ts](../../src/lib/services/approvals.ts),
[business-calendar.ts](../../src/lib/services/business-calendar.ts),
[sla-config.ts](../../src/lib/services/sla-config.ts),
[sla.ts](../../src/lib/services/sla.ts),
[escalation.ts](../../src/lib/services/escalation.ts),
[src/lib/jobs/escalation-handlers.ts](../../src/lib/jobs/escalation-handlers.ts)).

## Approval chains

An `ApprovalPolicy` (`approval_policies`) is directly editable
configuration — no draft/published version split, closer in spirit to a
role's permission set than to a `Form`/`Process`/`Document`. A
`approval`-type `ProcessNode`'s `data.approvalPolicyId` (optional)
references one; `workflow-engine.ts`'s `activateNode()` snapshots the
policy's current row onto `tasks.approval_policy_id` at task-creation
time — the same immutable-reference pattern `tasks.form_version_id`
already uses, so editing a policy never changes an in-flight approval's
requirements. A snapshotted policy fans the task out into one
`approval_decisions` row per resolved approver
(`approval-resolution.ts`'s `createApprovalDecisions`).

### Strategies

`approval_policies.strategy` (`approvals.ts`'s `toApprovalOutcome`):

- `sequential` — approvers act in `sequence_order`; only the earliest
  still-pending decision is actionable (`isDecisionActionable`). All
  must approve.
- `parallel` — every approver may act at once. All must approve.
- `unanimous` — same aggregation as `parallel`, kept as an explicit
  strategy value for policy authors who want to say so.
- `majority` — resolves the moment a strict majority has approved, or
  the moment approval becomes mathematically impossible.
- `first_response` / `any_one` — the first decision resolves the whole
  step immediately.

### Approver assignment

`approval_policies.approver_rules` is `[{ type, value }, ...]`, resolved
into specific `organization_members` at task-creation time
(`resolveMemberIdsForRule`):

| `type`               | Resolution                                                                                                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`               | `value` is the member id directly.                                                                                                                                                                                                                                      |
| `role`               | Every active member holding the role `value`.                                                                                                                                                                                                                           |
| `manager`            | The workflow starter's `manager_id`.                                                                                                                                                                                                                                    |
| `department_owner`   | The task's department's `owner_member_id`.                                                                                                                                                                                                                              |
| `process_owner`      | The workflow's process's `owner_member_id`.                                                                                                                                                                                                                             |
| `location_manager`   | The location `value`'s `manager_member_id`.                                                                                                                                                                                                                             |
| `team_manager`       | The team `value`'s `manager_member_id`.                                                                                                                                                                                                                                 |
| `runtime_expression` | `value` is a bare `<nodeId>.<key>` field reference (same grammar as [workflow-condition.ts](../../src/lib/services/workflow-condition.ts), minus the operator) read out of an earlier completed task's `output` — e.g. a form field that captured "who requested this." |

Resolved member ids across every rule are de-duplicated
(`Set`-based) before decisions are created. If `prevent_self_approval`
is set on the policy, the workflow's starter is excluded from the
resolved set — never allowed to approve their own request. Resolving to
zero eligible approvers throws rather than stranding the workflow.

### Deciding, delegating, overriding

- **Approve / reject / request changes** — `decideApprovalChain()`
  updates the caller's own `approval_decisions` row (`approved` /
  `rejected` / `changes_requested`) and inserts an immutable
  `task_history` `task.approval_decision_recorded` event for that single
  decision, independent of whether the whole chain has resolved yet.
  Once `toApprovalOutcome()` returns a non-`pending` result, the task
  completes (or fails the workflow, if `required`).
- **Delegation** — `delegateApprovalDecision()`, gated on
  `approval_policies.allow_delegation`. The original decision is marked
  `delegated` (never edited to look like it decided anything); a new row
  is inserted for the delegate. History is preserved, not overwritten.
- **Administrative override** — `overrideApprovalDecision()` requires
  `approval.manage` (never the approver's own `approval.review`) and a
  non-empty `reason`. Resolves every still-pending decision on the step
  at once, each recorded in `task_history` with `isOverride: true`.
- **Self-approval prevention** is enforced at resolution time (above),
  not at decision time — an excluded approver never gets a row to act
  on in the first place.

### Comments and attachments

A decision's `comment` is free text on the `approval_decisions` row.
Attachments reuse the generic evidence-upload path
([evidence.ts](../../src/lib/services/evidence.ts)) against the approval
task's own id, the same way an `evidence` node's task accepts uploads —
the task-detail page's attachment panel is shown for both node types.

## Business calendars, time zones, and holidays

A `BusinessCalendar` (`business_calendars`) is a named, reusable IANA
time zone + work-day/work-hour + holiday definition
(`business_calendar_holidays`). `business-calendar.ts`'s
`addBusinessMinutes()` walks forward from a start instant, skipping
non-work days and holidays and clamping into the configured work window,
entirely in the calendar's own zone (Intl-based offset correction, not a
dependency — correct across DST transitions). No calendar means a 24/7
clock, matching Phase 8's original naive `now() + N minutes` behavior.

## SLA definitions and due-date resolution

An `SlaDefinition` (`sla_definitions`) names a target (`target_minutes`)
for a `task`/`approval`/`workflow`, optionally against a
`BusinessCalendar`, plus `reminder_minutes_before_due` thresholds.
`sla.ts`'s `resolveDueAt()` computes a concrete `due_at` from a start
instant; `workflow-engine.ts`'s `activateNode()` calls it when a node's
`data.slaDefinitionId` is set, snapshotting the resolved
`sla_definition_id` onto the task the same way `approval_policy_id` is
snapshotted, and schedules the first `task-escalation-check` job for
that `due_at`.

### Pause, resume, and recalculation

- **Pause/resume** — `sla.ts`'s `pauseTaskSla()`/`resumeTaskSla()`
  (`sla.manage`) stop and restart a task's clock. Pausing only records
  the pause instant; resuming shifts `due_at` forward by the wall-clock
  duration spent paused (a direct shift, not a business-calendar
  recomputation — the paused interval isn't business time to skip, it's
  time the clock was deliberately stopped). While paused, the
  escalation background job skips the task entirely and re-checks
  hourly rather than firing anything.
- **Due-date recalculation** — `due_at` is otherwise a one-time snapshot
  taken at task-creation time, same posture as
  `approval_policy_id`/`form_version_id`. `sla.ts`'s
  `recalculateTaskDueAt()` (`sla.manage`) is a deliberately explicit,
  separate action for when the definition or its calendar has changed
  after the fact — not an automatic side effect of unrelated events,
  which would be a surprising silent change to a due date someone is
  relying on.

## Escalation rules and events

`EscalationRule` rows (`escalation_rules`) are numbered levels per
`SlaDefinition` (`level`, `trigger_after_minutes_past_due`, `action`).
`action` is one of `remind`, `reassign`, `escalate_manager`,
`escalate_process_owner`, `escalate_admin`; `reassign` requires a
`reassign_target` (the same `{ type, value }` shape as an approver
rule). `escalation.ts`'s `checkTaskEscalations()` evaluates every level
for an overdue task, firing (inserting an append-only `escalation_events`
row, and for `reassign`/`escalate_*`, actually reassigning the task) each
level whose threshold has passed and hasn't already fired — idempotent
by construction, since it checks `escalation_events` before acting.
Reminders (`reminder_minutes_before_due`) are logged the same way as
level-0 events before the due date passes.

`src/lib/jobs/escalation-handlers.ts`'s `task-escalation-check` job is
self-rescheduling rather than one job per level, so rules added after a
task starts are still honored — each run checks every currently
configured rule, then re-enqueues itself for the next unfired threshold
(or a periodic recheck while paused), and stops once every level has
fired. Runs through the admin client with an explicit
`organization_id` filter, same posture as every other Phase 8/9 job
handler — not through `withTenantContext()`, since there's no user
session to scope from.

## Tenant isolation, RLS, and authorization

Every new table (`approval_policies`, `approval_decisions`,
`business_calendars`, `business_calendar_holidays`, `sla_definitions`,
`escalation_rules`, `escalation_events`) has RLS enabled and an
`organization_id` policy, following
[multi-tenancy.md](multi-tenancy.md). Every mutating service call goes
through `requirePermission()` server-side (`approval.review`,
`approval.manage`, `sla.manage`) before `withTenantContext()`; the one
exception is the escalation background job, which runs as the admin
client with an explicit tenant filter, matching the job-handler
precedent already established in Phase 8/9. See
[product/permissions-matrix.md](../../product/permissions-matrix.md) for
the full `approval.manage`/`sla.manage` grant table.

## Known gaps

No malware/virus scanning applies to approval attachments beyond what
`evidence.ts` already deliberately defers (see
[forms-and-evidence.md](forms-and-evidence.md)'s equivalent note). SLA
pause/resume is a manual, explicit action — nothing pauses a clock
automatically (e.g. on a blocked upstream dependency); that remains a
future enhancement if a concrete trigger is identified.
