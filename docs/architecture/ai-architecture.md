# AI Architecture

## Governance boundary (authoritative)

AI is an assistant throughout the [product loop](../../product/vision.md),
never an independent authority. This boundary is a product requirement,
not merely a design preference, and must be enforced in server-side code
— never left to prompt instructions or client-side omission alone.

### AI may

- Extract proposed process steps from source knowledge documents.
- Answer questions using approved organizational sources only (not open
  web knowledge presented as organizational fact).
- Generate draft training content.
- Compare document versions and summarize material differences.
- Summarize exceptions for managers or compliance professionals.
- Suggest process improvements grounded in real exception/analytics
  history.

### AI may not, independently

- Publish processes.
- Approve requests.
- Change permissions.
- Close exceptions.
- Mark training complete.
- Modify approved policies.
- Send irreversible communications.
- Make binding employment, financial, compliance, or safety decisions.

**Human approval remains authoritative** for every action in the second
list. Every AI output that feeds one of those actions is surfaced as a
draft/suggestion requiring an explicit human action (e.g. `process.publish`,
`approval.review`) to take effect — the AI adapter has no code path that
calls those mutations directly.

## Provider-neutral adapter

AI features are implemented behind a provider-neutral adapter interface
(see [ADR-0008](decisions/0008-provider-neutral-ai-abstraction.md)),
initially backed by the Claude API. Business logic (governance boundaries,
prompt construction, output handling) lives in the application layer, not
inside a provider-specific SDK call scattered across features — this keeps
the governance boundary enforceable in one place regardless of which
model or vendor is behind the adapter at any given time.

## Grounding

Question-answering and summarization features are grounded in the
organization's own approved knowledge/process sources (see
[domain model](domain-model.md)) — retrieval is scoped to the caller's
organization and their permitted access scope, following the same
[multi-tenancy](multi-tenancy.md) rules as every other data access path.
AI must never surface another organization's data, even indirectly
through a shared model context.

## Auditability of AI actions

Every AI-generated draft that is subsequently accepted (e.g. a process
published from an AI-drafted proposal) is traceable in the
`AuditEvent` trail as AI-assisted, so the audit record reflects that a
draft originated from AI and was published by a specific human — never
presented as if a human authored it from scratch, and never presented as
if the AI published it unassisted.

## Related documents

- [Product principles — humans stay in charge](../../product/product-principles.md)
- [Feature catalog — AI copilot](../../product/feature-catalog.md)
- [ADR-0008: Provider-neutral AI abstraction](decisions/0008-provider-neutral-ai-abstraction.md)
