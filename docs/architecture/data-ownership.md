# Data Ownership

## Tenant ownership

Every tenant-scoped table has exactly one owning `Organization`, tracked
via a required `organization_id`. This is the foundation
[multi-tenancy](multi-tenancy.md) is built on. There is no concept of a
record shared by reference across two organizations — cross-organization
collaboration (e.g. a franchise parent and its franchisees, or an external
auditor) is modeled as explicit, scoped grants (see
[user roles — external_user](../../product/user-roles.md) and
[user roles — auditor](../../product/user-roles.md)), never as shared
row ownership.

## Record-level ownership vs. organization ownership

Two distinct concepts, both real, both enforced:

- **Organization ownership** — which tenant a record belongs to (always
  present, always enforced by RLS).
- **Resource ownership/assignment** — which specific member(s) are
  accountable for or assigned to a record within that tenant (e.g. a
  `process_owner` on a `Process`, an `employee` assigned to a `Task`).
  This is an application-level concept layered on top of, not a
  replacement for, organization ownership.

## Immutable vs. mutable records

| Record type                                          | Mutability                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `DocumentVersion`, `ProcessVersion`                  | Immutable once published. Edits create a new version.                                                                                      |
| `AuditEvent`                                         | Immutable, append-only, no update or delete path exposed.                                                                                  |
| `FormSubmission`, `Evidence`, `Approval` decision    | Immutable once submitted/recorded — corrections happen via a new, linked record (e.g. a superseding submission), never by editing history. |
| `Member`, `Role` assignment, `Organization` settings | Mutable, with changes producing an `AuditEvent`.                                                                                           |
| Draft `KnowledgeDocument`, draft `Process`           | Mutable until published.                                                                                                                   |

Immutability of published/executed records is what makes
[audit and compliance](../../product/feature-catalog.md) possible — see
[product principles — evidence, not assertions](../../product/product-principles.md).

## Data residency and deletion

- Deleting an `Organization` (account closure) is a deliberate, admin-gated
  operation, not a cascading side effect of any other action. The exact
  retention/export window is defined operationally in Phase 25 (Legal and
  trust readiness) — not yet decided as of Phase 0.
- Removing a `Member` does not delete records they authored, approved, or
  were assigned — historical accountability (who did what) must survive
  the person's departure from the organization. The member record is
  deactivated, not deleted, to preserve referential integrity of audit
  and workflow history.

## Related documents

- [Domain model](domain-model.md)
- [Multi-tenancy](multi-tenancy.md)
- [Event model](event-model.md)
- [Database schema](database-schema.md) — `archived_at`/`status` lifecycle columns and `audit_events`' append-only enforcement as implemented in Phase 4.
