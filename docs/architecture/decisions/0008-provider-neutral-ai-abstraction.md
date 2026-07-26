# ADR-0008: Provider-neutral AI abstraction

## Status

Accepted. Implemented in Phase 13 (AI ingestion and copilot) —
`src/lib/ai/adapter.ts` (the interface), `src/lib/ai/providers/
anthropic-provider.ts` (the initial concrete provider), and
`src/lib/ai/get-provider.ts` (the one factory function every ai-*.ts
feature service calls). See
[ai-architecture.md](../ai-architecture.md) for the governance-boundary
detail this decision exists to protect.

## Context

ProcessPilot's AI features (see [ai-architecture.md](../ai-architecture.md))
carry strict governance boundaries — AI may draft and suggest but never
independently publish, approve, or close records
([product-principles.md — humans stay in charge](../../../product/product-principles.md)).
That boundary must be enforced consistently regardless of which AI model
or vendor is behind any given feature, and the initial model vendor
should be swappable as the market and product needs evolve.

## Decision

Implement AI features behind a provider-neutral adapter interface defined
in the application layer, initially backed by the Claude API. Governance
logic (what AI output is allowed to do, how it's surfaced as a draft,
audit tagging of AI-assisted actions) lives in the adapter-consuming
application code, not duplicated inside provider-specific integration
code.

## Alternatives considered

- **Direct, feature-by-feature calls to a specific vendor's SDK.**
  Rejected: scatters governance-boundary enforcement across every feature
  that touches AI, increasing the risk that one feature is implemented
  without the same safeguards as the others.
- **A third-party AI orchestration platform.** Considered; deferred as
  unnecessary complexity for the current scope — a direct, in-house
  adapter is sufficient and keeps governance logic under ProcessPilot's
  own control rather than a third party's abstraction choices.

## Consequences

- Switching or adding AI model vendors touches the adapter
  implementation, not every feature that uses AI.
- Governance rules (see [ai-architecture.md](../ai-architecture.md)) are
  enforced and testable in one place.
- Slightly more upfront design work than calling a vendor SDK directly
  from each feature — accepted as necessary given the governance
  requirement is non-negotiable.

## Security implications

Centralizing AI calls through one adapter makes it feasible to enforce
organization-scoped grounding (see
[ai-architecture.md — grounding](../ai-architecture.md)) and audit
tagging consistently, reducing the risk of an AI feature accidentally
bypassing multi-tenancy or governance rules.

## Revisit conditions

Revisit if the initial adapter design proves insufficient for a specific
AI capability's requirements during Phase 13 implementation, or if model
vendor economics/capability shifts materially during that phase's design.
