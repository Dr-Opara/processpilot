# ADR-0009: Provider-neutral background jobs

## Status

Proposed — not yet integrated. Implemented starting Phase 8 (Workflow
execution engine), which is the first phase requiring scheduled/
asynchronous execution.

## Context

The [workflow engine](../workflow-engine.md) and [event model](../event-model.md)
require scheduled and asynchronous execution (recurring workflow starts,
deadline escalation, notification delivery, training-expiry checks) that
cannot be driven by a single synchronous request/response cycle.

## Decision

Implement background/scheduled processing behind a provider-neutral
adapter interface, so the underlying queue/scheduler technology can
change without rewriting the business logic that publishes or consumes
events.

## Alternatives considered

- **Direct coupling to one queue vendor's SDK throughout the codebase.**
  Rejected: same reasoning as [ADR-0008](0008-provider-neutral-ai-abstraction.md)
  — ties every event-producing and event-consuming feature to one
  vendor's API shape, making a future migration a full rewrite instead of
  an adapter swap.
- **Cron scripts scattered per feature (e.g. a Vercel Cron Job per
  concern).** Rejected as the sole mechanism: works for simple time
  triggers but doesn't cleanly model event-driven consumption (e.g.
  `approval.decided` triggering the next workflow step) described in
  [event-model.md](../event-model.md).

## Consequences

- Event producers and consumers depend on a stable internal interface,
  not a specific vendor's queue API.
- The specific queue/scheduler provider is selected during Phase 8
  design based on Vercel-compatible options available at that time — not
  decided in Phase 0.
- Adds an abstraction layer that must be kept genuinely provider-neutral
  in practice (not just in name) as features are built against it.

## Security implications

Background job handlers process events that may include tenant-scoped
data; they must apply the same [multi-tenancy](../multi-tenancy.md)
scoping as any other code path, since these handlers often run with
elevated (service-role-adjacent) credentials rather than a user's
request-scoped session.

## Revisit conditions

Revisit if the chosen queue/scheduler provider (selected during Phase 8)
cannot meet reliability or idempotency requirements from
[event-model.md — reliability expectations](../event-model.md).
