# Audit and Compliance Center

Read/export surface over `audit_events` — the append-only log every
phase's mutating service action has written to since Phase 4/5, via
[src/lib/db/audit.ts](../../src/lib/db/audit.ts)'s `recordAuditEvent()`.
Implemented in Phase 15
([src/lib/services/audit.ts](../../src/lib/services/audit.ts)), per
[data-ownership.md](data-ownership.md)'s immutability table and
[docs/project/phase-tracker.md](../project/phase-tracker.md)'s Phase 15
entry.

## What this phase is, and is not

`audit_events` capture across governance-relevant actions (publish,
approval decision, exception resolution, permission change, and so on)
was already comprehensive going into this phase — every phase from 5
through 13 calls `recordAuditEvent()` from its mutating service actions;
see [audit-actions.ts](../../src/lib/db/audit-actions.ts)'s
action/resource-type catalog for the full inventory. Phase 15's job is
therefore the **read, scope, and export** layer on top of that existing
write path, not a rewrite of it — plus one real, pre-existing gap this
phase found and fixed (below).

## The scoped-access gap this phase fixed

`audit_events_select`'s RLS policy originally read:

```sql
using (organization_id = current_org_id() and has_permission('audit.view'))
```

`has_permission()` checks `current_member_permissions()`, which —
per its own definition — only includes **unscoped** (`rp.scope is
null`) grants. Per `role_permissions`
(`supabase/migrations/20260719130002_membership_roles_permissions.sql`),
`organization_owner` and `organization_admin` hold `audit.view`/
`audit.export` unscoped; `manager` and `auditor` hold them **scoped**.
Because `audit_events` had no `department_id` column for
`has_scoped_permission()` to check against, a scoped grant was
functionally inert — a manager or auditor held the permission per the
seeded matrix but could never select a single row. A page built on top
of that RLS policy without noticing would have looked complete while
silently returning nothing for exactly the roles the permissions matrix
names as this feature's core audience.

`supabase/migrations/20260730000001_audit_scoped_views.sql` fixes this:
adds a nullable `audit_events.department_id`, and changes the policy to
`has_scoped_permission('audit.view', department_id, null, null)` — a
strict superset of the old check (it falls back to `has_permission()`
first), so this is a widening of access, never a narrowing.

`recordAuditEvent()` (`src/lib/db/audit.ts`) gained an optional
`departmentId` input to populate the new column. It is wired through
for every call site in the exception/CAPA/waiver domain
(`exceptions.ts`, `capa.ts`, `waivers.ts`) and the training/
certification domain (`training-assignments.ts`, `certifications.ts`) —
the two domains this phase's "compliance center" audience most directly
cares about. Wiring it up surfaced a second, related bug in three of
those domains: `capa_plans`, `temporary_waivers`, and
`training_assignments`/`certifications` all already had a
`department_id` column that their own scoped-permission checks
(`requirePermission(..., { scope: { departmentId: plan.department_id
} } )`) depended on, but none of their `insert` statements ever
populated it — every CAPA plan, waiver, training assignment, and
certification was silently created with `department_id = null`,
making every one of _those_ scoped grants inert too, independent of
the audit-log issue. Both bugs are fixed together in this phase's
diff, since the audit-scoping fix would have had nothing to display for
these domains otherwise.

## Known gap: not every resource type is department-tagged

`department_id` is **not** backfilled for audit events recorded before
this migration, and is not yet wired through the ~20 remaining
`recordAuditEvent()` call sites outside the exception/CAPA/waiver and
training/certification domains (organization onboarding, knowledge
management, process builder, workflow engine, forms/evidence,
approvals/SLAs, AI copilot). Those events remain visible only to an
unscoped `audit.view`/`audit.export` holder (`organization_owner`,
`organization_admin`) — exactly as before this phase, not a regression.
The `/app/audit` UI's empty state says so explicitly rather than
presenting a scoped viewer with an unexplained blank table. Extending
department tagging to the remaining resource types is follow-up work,
not attempted here for the sake of shipping a bounded, correctly-scoped
phase rather than a very large, harder-to-verify diff touching every
service file in the codebase.

## Read and export

**`listAuditEvents(filters, pagination)`** — row visibility is left
entirely to `audit_events_select`'s RLS; the service calls
`getCurrentMembership()` (not `requirePermission()`), the same "RLS
does the filtering" posture Phase 11's `listExceptions()`/
`listCapaPlans()` already established. An org_owner/admin's unscoped
grant sees every event; a scoped manager/auditor sees only
department-tagged events for departments they own; anyone else sees an
empty result, not an error. `hasMore` is a plain "is there another page"
boolean (fetches `limit + 1` rows) rather than a separate `count(*)`
query. Filters: `action`, `resourceType`, `departmentId`,
`actorProfileId`, `dateFrom`/`dateTo`.

**`exportAuditEvents(filters)`** — gated by
`requirePermission("audit.export", { scope: { departmentId } })`, so an
export additionally requires the caller to actually hold `audit.export`
(narrower than `audit.view` — `manager` has only the latter) and, for a
scoped holder, to name the department they're exporting. Capped at
5,000 rows per export (`AppError("conflict", ...)` above the cap,
telling the caller to narrow the range) — there is no
streaming/background-job export for larger histories yet; that is
follow-up work for whenever an organization's audit history outgrows
this limit. Every export itself writes an `audit_events.exported` audit
event (who exported what filter set, when, and how many rows) — an
export of the audit log is exactly the kind of action the audit log
exists to answer questions about.

## UI

`/app/audit` (`src/app/app/(protected)/audit/page.tsx`) — filterable
table (action, resource type, department, date range) with pager
(`offset`/`limit` query params) and a CSV export link, shown only when
the signed-in member holds `audit.export`. Same "GET query params drive
a server component" pattern established across every prior phase's list
page; no client-side state.

## Related documents

- [Data ownership](data-ownership.md)
- [Event model](event-model.md)
- [Exception management](exception-management.md)
- [Training and certifications](training-and-certifications.md)
