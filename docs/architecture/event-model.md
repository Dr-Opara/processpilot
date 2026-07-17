# Event Model

ProcessPilot uses an event-driven approach for workflow execution and
cross-cutting side effects (notifications, scheduled starts, escalations),
layered on top of — not replacing — direct, synchronous request/response
for standard reads and writes. See
[ADR-0010](decisions/0010-event-driven-workflow-execution.md).

## Why events, not purely synchronous logic

Several product requirements are inherently asynchronous or
time-triggered, not driven by a single request/response cycle:

- Scheduled and recurring workflow starts (a process that should start
  every Monday at a location).
- Deadline-based escalation (a task that becomes an exception if not
  completed by a due time, with no user action triggering the check).
- Training and certification expiry reminders.
- Multi-step approval chains where each step's completion should notify
  the next approver without the original submitter's request driving it.

A purely synchronous model would require polling or ad hoc cron scripts
scattered across the codebase; an explicit event model keeps this logic
centralized and testable.

## Event categories (planned)

| Category            | Example events                                                              | Consumers                                             |
| ------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| Workflow lifecycle  | `workflow.started`, `task.assigned`, `task.completed`, `workflow.completed` | Notifications, analytics, audit log                   |
| Exception lifecycle | `exception.created`, `exception.resolved`                                   | Notifications, analytics, audit log                   |
| Approval lifecycle  | `approval.requested`, `approval.decided`                                    | Notifications, workflow engine (advance to next step) |
| Governance          | `process.published`, `document.published`                                   | Audit log, notifications to stakeholders              |
| Training            | `training.assigned`, `certification.expiring`, `certification.expired`      | Notifications, analytics                              |
| Scheduling          | `schedule.tick` (time-based trigger)                                        | Workflow engine (start scheduled workflows)           |

## Delivery model

- Events are published from the application layer at the point a state
  change is committed — not inferred later from polling the database.
- Consumption happens via the provider-neutral background-job adapter
  (see [ADR-0009](decisions/0009-provider-neutral-background-jobs.md)),
  so the underlying queue/scheduler technology can change without
  rewriting event-producing or event-consuming business logic.
- Every event that represents a governance-relevant action (publish,
  approval decision, exception resolution) also produces an `AuditEvent`
  — the audit log is a required consumer, not an optional one, for that
  event category.

## Reliability expectations

- Event handlers must be idempotent — at-least-once delivery is assumed,
  and a handler processing the same event twice must not double-create
  side effects (e.g. sending a duplicate notification or creating a
  duplicate exception).
- A failed event handler must not silently swallow the failure — it is
  retried per the background-job adapter's retry policy and surfaced in
  [observability](observability.md) if it exhausts retries.

## Related documents

- [Workflow engine](workflow-engine.md)
- [Domain model](domain-model.md)
- [Observability](observability.md)
- [ADR-0010: Event-driven workflow execution](decisions/0010-event-driven-workflow-execution.md)
