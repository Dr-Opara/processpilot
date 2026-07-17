# Workflow Engine

The workflow engine turns a published `ProcessVersion` into a running
`Workflow` composed of `Task` records, per the entities defined in the
[domain model](domain-model.md). Implemented in Phase 8.

## Responsibilities

1. **Instantiation** — given a `ProcessVersion` and a target (member,
   team, location, or schedule), create a `Workflow` and its initial
   `Task`(s).
2. **Sequencing** — advance tasks through linear, parallel, and
   conditional-branch paths as defined by the process version.
3. **Assignment resolution** — resolve role- or team-based assignment
   rules (defined at the process level) into specific member assignments
   at instantiation or task-start time.
4. **Deadline tracking** — monitor task/workflow deadlines and emit
   escalation events (`exception.created`) on breach, via the
   [event model](event-model.md).
5. **Completion evaluation** — determine when a `Workflow` is fully
   complete (all required tasks done, all required approvals decided).

## Start triggers

| Trigger         | Description                                                                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manual          | A permitted member starts a workflow on demand (`workflow.start`).                                                                                                                                                         |
| Scheduled       | A recurring schedule (e.g. daily, weekly) defined on the process configuration.                                                                                                                                            |
| Event-triggered | A workflow starts in response to another system event (e.g. a new employee's onboarding workflow starts on `member.invited`). Scope of which trigger events are supported is finalized during Phase 8 design, not Phase 0. |

## Task sequencing model

- **Linear** — tasks complete in a fixed order; a task is not available
  to act on until its predecessor completes.
- **Parallel** — multiple tasks are simultaneously available; the
  workflow advances once all parallel tasks in a stage complete.
- **Conditional branch** — the path taken depends on a prior task's
  outcome (e.g. a form answer or an approval decision).

## Relationship to approvals and evidence

Approval and evidence requirements are properties of a `Task` (or a step
within one), not a separate execution path — an approval-gated task
blocks workflow advancement the same way an incomplete required task
does. See [terminology](../../product/terminology.md) for the distinction
between `Task`, `Approval`, and `Evidence`.

## Immutability guarantee

A running or completed `Workflow` always references the specific
`ProcessVersion` it was instantiated from. If the parent `Process` is
later published as a new version, in-flight workflows are unaffected —
they continue executing against the version they started with. This is
what makes historical workflow instances a reliable audit record even
after the underlying process has since changed.

## Related documents

- [Event model](event-model.md)
- [Domain model](domain-model.md)
- [ADR-0010: Event-driven workflow execution](decisions/0010-event-driven-workflow-execution.md)
- [ADR-0011: Immutable published document and process versions](decisions/0011-immutable-published-versions.md)
