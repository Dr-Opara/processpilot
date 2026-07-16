# ADR-0010: Event-driven workflow execution

## Status

Proposed — not yet implemented. Implemented in Phase 8 (Workflow
execution engine).

## Context

Workflow execution (see [workflow-engine.md](../workflow-engine.md))
includes requirements that are not driven by a single user request:
scheduled workflow starts, deadline-based escalation into exceptions, and
multi-step approval chains where one step's completion should trigger
notification/advancement without the original actor's request driving it.

## Decision

Model workflow execution and its side effects (notifications, escalation,
scheduled starts) as events, per
[event-model.md](../event-model.md), consumed asynchronously through the
provider-neutral background-job adapter
([ADR-0009](0009-provider-neutral-background-jobs.md)), rather than as
purely synchronous logic embedded in request handlers.

## Alternatives considered

- **Purely synchronous state machine, checked on each relevant request.**
  Rejected: cannot naturally express time-based triggers (a deadline
  passing with no user making a request) without a separate polling/cron
  mechanism bolted on anyway — the event model subsumes that need
  cleanly instead of layering two different mechanisms.
- **A dedicated, separate workflow-orchestration service/platform (e.g. a
  standalone orchestration engine).** Rejected for the current stage as
  unnecessary operational complexity; an in-application event model is
  sufficient for the required sequencing (linear, parallel, conditional —
  see [workflow-engine.md](../workflow-engine.md)) without standing up a
  separate service to operate and secure.

## Consequences

- Time-based and multi-actor sequencing (escalation, chained approvals)
  are modeled naturally as event flows instead of special-cased polling
  logic.
- Requires event handlers to be idempotent (see
  [event-model.md — reliability expectations](../event-model.md)), adding
  discipline requirements to every handler author.
- Debugging a workflow's behavior requires reasoning about an event
  timeline, not just a single request's code path — mitigated by the
  audit trail requirement (every governance-relevant event produces an
  `AuditEvent`).

## Security implications

Event handlers often run outside a user's request-scoped session and
must independently enforce [multi-tenancy](../multi-tenancy.md) scoping
— this is called out explicitly so it isn't missed during Phase 8
implementation.

## Revisit conditions

Revisit if event-handling latency or complexity becomes a measured
usability problem (e.g. escalations not firing promptly enough) during
Phase 8 implementation or later scale testing.
