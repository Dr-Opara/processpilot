# User Roles

Roles are the enforceable unit of authorization in ProcessPilot. Every
member of an organization holds one or more roles. Roles are evaluated
server-side against the [permissions matrix](permissions-matrix.md) on
every request — never inferred from UI state alone. See
[authentication and authorization](../docs/architecture/authentication-and-authorization.md).

A member may hold more than one role (e.g. `manager` and `process_owner`
simultaneously). Effective permissions are the union of all held roles,
further narrowed by scope (organization, location, department, or specific
resource) where applicable.

## organization_owner

**Responsible for:** Billing, subscription plan, top-level organization
settings, and the ability to transfer or revoke ownership itself.

**Boundaries:** Exactly one (or a small, explicit set of) organization
owners per organization. Owning the account does not grant automatic
visibility into every process or workflow — an owner who needs operational
access should also hold `organization_admin` or a scoped role.

**Prohibited:** Cannot access another organization's data under any
circumstance. Cannot bypass approval or publication workflows by virtue of
being the owner.

## organization_admin

**Responsible for:** Managing members, roles, locations, departments,
teams, and integrations. Configures organization-wide settings other than
billing.

**Boundaries:** Administrative scope is organization-wide by default but
can be narrowed. Does not automatically gain `process.publish` or
`approval.review` permissions — those are granted explicitly if the admin
also performs those functions.

**Prohibited:** Cannot alter billing/subscription without `billing.manage`.
Cannot grant itself permissions beyond what its own assigned role allows
(no self-escalation).

## process_owner

**Responsible for:** Creating, editing, reviewing, and publishing specific
processes within their assigned scope. Accountable for keeping owned
processes current and correct.

**Boundaries:** Scoped to the processes explicitly assigned to them, plus
any created by them, unless granted a broader scope. Can start workflows
from their own published processes.

**Prohibited:** Cannot publish a process for which they hold no ownership
or review assignment, unless also granted `process.publish` more broadly.
Cannot manage members or billing.

## manager

**Responsible for:** Assigning workflows, resolving exceptions, reviewing
approvals, and monitoring analytics and training status within their
department, location, or team scope.

**Boundaries:** Scope is bounded to the department(s), location(s), or
team(s) they manage. Cannot act outside that scope without an additional
role.

**Prohibited:** Cannot edit or publish processes unless also holding
`process_owner`. Cannot manage organization-wide settings or billing.

## employee

**Responsible for:** Completing assigned tasks, submitting forms, uploading
requested evidence, and completing assigned training.

**Boundaries:** Access is limited to their own assigned work and their own
training/certification records. Read access to knowledge relevant to their
role, not the full knowledge base by default.

**Prohibited:** Cannot view other employees' task assignments, evidence, or
training records. Cannot create, edit, or publish processes. Cannot review
approvals unless a specific step assigns that approval to them.

## auditor

**Responsible for:** Read-only review of processes, workflows, evidence,
approvals, exceptions, and audit events within an assigned, typically
time-boxed scope.

**Boundaries:** Scope is explicitly granted per engagement (specific
processes, date ranges, or the whole organization for a compliance audit).
Access should be revocable at any time and automatically expire if a
scope end date is set.

**Prohibited:** Cannot create, edit, execute, approve, or delete anything.
Cannot download evidence outside their granted scope. `audit.export` is
granted deliberately, not implied by `audit.view`.

## external_user

**Responsible for:** Completing the single, specific workflow, task, form,
or approval they were explicitly invited to act on.

**Boundaries:** Access is resource-specific and time-boxed by default — an
invitation to one workflow instance, not standing organizational access.
Does not appear in the organization's people directory as a regular
member.

**Prohibited:** Cannot browse the knowledge base, process catalog, other
members' work, or analytics. Cannot be granted organization-wide roles.

## Role summary table

| Role                 | Primary scope                | Can publish processes | Can manage people   | Can approve          | Can execute tasks            |
| -------------------- | ---------------------------- | --------------------- | ------------------- | -------------------- | ---------------------------- |
| `organization_owner` | Organization                 | No (by default)       | Yes                 | No (by default)      | No (by default)              |
| `organization_admin` | Organization                 | No (by default)       | Yes                 | No (by default)      | No (by default)              |
| `process_owner`      | Assigned processes           | Yes (owned scope)     | No                  | No (by default)      | No (by default)              |
| `manager`            | Department / location / team | No (by default)       | Limited (own scope) | Yes (assigned steps) | No (by default)              |
| `employee`           | Self                         | No                    | No                  | No (unless assigned) | Yes                          |
| `auditor`            | Granted scope, read-only     | No                    | No                  | No                   | No                           |
| `external_user`      | One resource                 | No                    | No                  | No (unless assigned) | Yes (assigned resource only) |

"No (by default)" indicates the base role does not include the permission,
but an organization may grant the corresponding permission explicitly via
the [permissions matrix](permissions-matrix.md) — roles are a starting
bundle of permissions, not a hard ceiling enforced by role name alone.

## Related documents

- [Permissions matrix](permissions-matrix.md)
- [Personas](personas.md)
- [Authentication and authorization](../docs/architecture/authentication-and-authorization.md)
