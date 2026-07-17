# Domain Model

This is the conceptual entity model behind ProcessPilot. It mirrors
[product/terminology.md](../../product/terminology.md) exactly — if a term
needs redefining, change it there first and update this document to match,
never the other way around. No schema exists yet in the repository; this
is the model Phase 4 (Database and tenant isolation) implements.

## Entity relationship overview

```
Organization
 ├─ Workspace (optional subdivision)
 ├─ Location
 ├─ Department
 ├─ Team
 ├─ Member ──── holds ──── Role ──── grants ──── Permission
 │
 ├─ KnowledgeDocument ──has many── DocumentVersion
 │
 ├─ Process ──has many── ProcessVersion
 │                          │
 │                          └─ (published version) ──instantiated as──> Workflow
 │
 ├─ Workflow (instance of one ProcessVersion)
 │    ├─ Task (one or more, sequenced or parallel)
 │    │    ├─ FormSubmission (if the task has a form)
 │    │    ├─ Evidence (if the task requires evidence)
 │    │    └─ Approval (if the task includes an approval step)
 │    └─ Exception (zero or more, linked to the workflow or a specific task)
 │         └─ CorrectiveAction
 │
 ├─ TrainingCourse ──has many── TrainingAssignment ──may yield── Certification
 │
 ├─ AuditEvent (immutable, references any of the above by type + id)
 │
 ├─ Integration (organization-scoped configuration)
 │
 └─ Entitlement (organization-scoped, sourced from the billing plan)
```

## Ownership rules

- Every entity below `Organization` carries an explicit
  `organization_id` — there is no tenant-owned entity without one. See
  [data ownership](data-ownership.md).
- `Process` and `KnowledgeDocument` are mutable only in draft state.
  Publishing creates an immutable `ProcessVersion` / `DocumentVersion`;
  the parent record then points at the current published version but
  every prior version remains retrievable.
- `Workflow` always references a specific, immutable `ProcessVersion` —
  never the mutable parent `Process` — so a running or historical
  workflow's definition can never change out from under it.
- `Task` belongs to exactly one `Workflow` and is never shared across
  workflows.
- `Exception` may reference a `Workflow` as a whole or a specific `Task`
  within it.
- `AuditEvent` is append-only: no update or delete operation is exposed
  for this entity at any layer.

## Scoping model

Entities are scoped along up to three axes simultaneously, all enforced
together (see [permissions matrix — enforcement rules](../../product/permissions-matrix.md)):

1. **Organization** — the tenant boundary, always required.
2. **Structural scope** — Location, Department, or Team, where relevant
   (e.g. a `manager`'s effective access to `Workflow` records).
3. **Resource ownership/assignment** — direct ownership (a `process_owner`
   on a specific `Process`) or direct assignment (an `employee`'s
   assigned `Task`).

## Why this model, not a simpler one

A simpler model might collapse `Process`/`ProcessVersion` into one mutable
record, or skip a distinct `Task` entity in favor of tracking status
directly on `Workflow`. Both were rejected:

- Collapsing versions would make published processes editable in place,
  violating [product principles — governed beats convenient](../../product/product-principles.md)
  and breaking auditability.
- Collapsing `Task` into `Workflow` would prevent per-person, per-step
  tracking required for parallel task assignment and partial completion,
  which the [core workflow-execution requirements](../../product/requirements.md)
  depend on.

## Related documents

- [Terminology](../../product/terminology.md)
- [Multi-tenancy](multi-tenancy.md)
- [Data ownership](data-ownership.md)
- [Workflow engine](workflow-engine.md)
- [Event model](event-model.md)
