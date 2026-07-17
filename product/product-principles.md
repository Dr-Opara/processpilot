# Product Principles

These principles guide every product and design decision in ProcessPilot.
When a tradeoff isn't obvious, resolve it by asking which option this list
supports.

## 1. Humans stay in charge

AI accelerates drafting, summarizing, and suggesting. It never has
unilateral authority over publishing, approving, closing, or certifying.
Every consequential action has a named, accountable human behind it. See
[AI governance](../docs/architecture/ai-architecture.md).

## 2. Governed beats convenient

A process that is easy to change but impossible to audit is a liability,
not a feature. Published processes and documents are versioned and
immutable; changes create new versions, not silent edits. Traceability is
never sacrificed for short-term convenience.

## 3. Evidence, not assertions

"Someone probably did this" is not good enough for regulated and
operationally serious businesses. Workflow completion, approvals, and
exceptions must be backed by durable, timestamped, attributable evidence —
not just a checkbox with no record behind it.

## 4. Server-enforced, not UI-suggested

Permissions, tenant isolation, and business rules are enforced in the
server and database layers. The UI reflects what a user is allowed to do;
it never is the only thing preventing what a user isn't allowed to do. See
[authentication and authorization](../docs/architecture/authentication-and-authorization.md).

## 5. Calm operational software, not a toy

The product is used by people whose job depends on getting it right —
often under time pressure, sometimes in safety-critical contexts. Interfaces
are precise, predictable, and low-drama. No gamification, no dark patterns,
no manufactured urgency. See [brand personality](../design/branding.md).

## 6. Every organization is an island until it opts to connect

Tenant data is isolated by default. Sharing across organizations (e.g. an
external auditor, a franchise parent company) is explicit, scoped, and
revocable — never implicit.

## 7. Terminology is precise and consistent

"Process," "workflow," and "task" are distinct concepts with distinct
meanings throughout the product, documentation, and code. See
[terminology](terminology.md). Precision in language prevents ambiguity in
a system whose entire purpose is removing ambiguity from work.

## 8. Build for the audit, not just the workflow

Assume every material action will eventually be reviewed by someone who
was not in the room when it happened — an auditor, a new manager, a
regulator. Design the audit trail as a first-class output of the system,
not a debugging log.

## 9. Progressive disclosure over feature sprawl

The product serves personas with very different needs (an employee
completing a task vs. a compliance professional running an audit). Default
views are simple; power and configuration are available but not forced on
everyone.

## 10. Real numbers or no numbers

Never fabricate statistics, testimonials, customer logos, or certifications
in product surfaces, marketing, or documentation. See
[design guidelines](../design/branding.md) for the same rule applied to
visual design.

## Related documents

- [Vision](vision.md)
- [Assumptions and risks](assumptions-and-risks.md)
- [AI architecture](../docs/architecture/ai-architecture.md)
