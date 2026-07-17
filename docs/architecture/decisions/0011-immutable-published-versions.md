# ADR-0011: Immutable published document and process versions

## Status

Accepted (as a design decision; not yet implemented in schema/code —
implemented in Phases 6–7, Knowledge management and Process builder).

## Context

ProcessPilot's core value proposition depends on processes being
trustworthy records of "the correct way to do this work" that can be
audited after the fact (see
[product-principles.md — governed beats convenient](../../../product/product-principles.md)
and [evidence, not assertions](../../../product/product-principles.md)).
A `Workflow` must always be able to point back to the exact process
definition it was executed against, even after that process has since
changed.

## Decision

`KnowledgeDocument` and `Process` are mutable only while in draft state.
Publishing creates an immutable `DocumentVersion` / `ProcessVersion` (see
[domain-model.md](../domain-model.md)); no published version is ever
edited in place. A `Workflow` always references a specific
`ProcessVersion`, never the mutable parent record.

## Alternatives considered

- **Mutable published processes with a change log.** Rejected: a change
  log describing what changed is weaker than the change itself being
  structurally impossible — an in-place edit to a published process could
  silently alter the definition an in-flight workflow believes it's
  executing against.
- **Soft versioning (a "current" pointer that can be reassigned without a
  new immutable row).** Rejected: doesn't guarantee that a specific
  historical workflow instance's process definition remains retrievable
  exactly as it was at execution time — undermines audit requirements.

## Consequences

- Every edit to a published process/document produces a new version
  rather than modifying history — version history and diffing (see
  [feature-catalog.md](../../../product/feature-catalog.md)) become a
  natural byproduct, not an added feature.
- Storage grows with version count; accepted as necessary for
  auditability, not treated as a cost to optimize away by mutating
  history.
- Requires the application layer and schema to strictly distinguish
  "editing a draft" from "publishing," with no code path that mutates an
  already-published version.

## Security implications

This decision is itself a compliance/audit control: it guarantees the
[audit and compliance center](../../../product/feature-catalog.md) can
reconstruct exactly what process definition governed any historical
workflow, which is often a hard regulatory requirement for the target
market (see [assumptions-and-risks.md](../../../product/assumptions-and-risks.md)).

## Revisit conditions

Not expected to be revisited — this is a foundational guarantee of the
product, not an implementation detail subject to later optimization
tradeoffs.
