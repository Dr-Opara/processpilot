# Permissions Matrix

Permissions are the atomic, enforceable unit of authorization in
ProcessPilot. They must be enforced **server-side**, on every request that
touches a protected resource — never through UI visibility alone. See
[authentication and authorization](../docs/architecture/authentication-and-authorization.md).

## Permission catalog

| Permission              | Description                                                               |
| ----------------------- | ------------------------------------------------------------------------- |
| `organization.manage`   | Create, rename, or delete the organization; manage top-level settings.    |
| `organization.settings` | Edit organization-wide configuration short of deletion/billing.           |
| `billing.manage`        | View and change subscription plan, payment method, and invoices.          |
| `member.invite`         | Invite new members to the organization.                                   |
| `member.manage`         | Edit, suspend, or remove existing members.                                |
| `role.manage`           | Create custom roles or change role-permission assignments.                |
| `location.manage`       | Create, edit, or remove locations.                                        |
| `department.manage`     | Create, edit, or remove departments.                                      |
| `team.manage`           | Create, edit, or remove teams.                                            |
| `knowledge.view`        | View knowledge documents within scope.                                    |
| `knowledge.create`      | Create new knowledge documents.                                           |
| `knowledge.edit`        | Edit draft knowledge documents.                                           |
| `knowledge.review`      | Review knowledge documents submitted for approval.                        |
| `knowledge.publish`     | Publish a new version of a knowledge document.                            |
| `process.view`          | View processes within scope.                                              |
| `process.create`        | Create new draft processes.                                               |
| `process.edit`          | Edit draft processes.                                                     |
| `process.review`        | Review processes submitted for approval.                                  |
| `process.publish`       | Publish a new version of a process.                                       |
| `workflow.start`        | Start a new workflow instance from a published process.                   |
| `workflow.assign`       | Assign a workflow or its tasks to members, teams, or external users.      |
| `workflow.complete`     | Complete tasks within an assigned workflow.                               |
| `workflow.manage`       | Cancel, reassign, or administratively modify a running workflow.          |
| `form.submit`           | Submit a form as part of a task.                                          |
| `evidence.upload`       | Upload evidence files against a task or approval.                         |
| `evidence.review`       | Review uploaded evidence for adequacy.                                    |
| `approval.review`       | Approve or reject an approval step.                                       |
| `exception.create`      | Flag or record a new exception.                                           |
| `exception.manage`      | Triage, assign, and resolve exceptions and corrective actions.            |
| `training.view`         | View own or scoped training assignments and certifications.               |
| `training.manage`       | Create courses, assign training, and manage certifications.               |
| `analytics.view`        | View operational analytics and dashboards within scope.                   |
| `audit.view`            | View audit events within scope.                                           |
| `audit.export`          | Export audit events and records for external review.                      |
| `integration.manage`    | Configure and manage third-party integrations.                            |
| `ai.use`                | Use AI-assisted features (drafting, summarizing, suggesting).             |
| `ai.configure`          | Configure AI feature settings (sources, guardrails) for the organization. |

## Role-permission matrix

`✓` = granted by default. `Scoped` = granted within the role's bounded
scope (department/location/team/owned resources) as defined in
[user roles](user-roles.md). Blank = not granted by default; may be added
via a custom role if `role.manage` is used to do so.

| Permission            | organization_owner | organization_admin | process_owner | manager | employee      | auditor | external_user |
| --------------------- | ------------------ | ------------------ | ------------- | ------- | ------------- | ------- | ------------- |
| organization.manage   | ✓                  |                    |               |         |               |         |               |
| organization.settings | ✓                  | ✓                  |               |         |               |         |               |
| billing.manage        | ✓                  |                    |               |         |               |         |               |
| member.invite         | ✓                  | ✓                  |               | Scoped  |               |         |               |
| member.manage         | ✓                  | ✓                  |               | Scoped  |               |         |               |
| role.manage           | ✓                  | ✓                  |               |         |               |         |               |
| location.manage       | ✓                  | ✓                  |               |         |               |         |               |
| department.manage     | ✓                  | ✓                  |               | Scoped  |               |         |               |
| team.manage           | ✓                  | ✓                  |               | Scoped  |               |         |               |
| knowledge.view        | ✓                  | ✓                  | Scoped        | Scoped  | Scoped        | Scoped  |               |
| knowledge.create      |                    | ✓                  | Scoped        |         |               |         |               |
| knowledge.edit        |                    | ✓                  | Scoped        |         |               |         |               |
| knowledge.review      |                    | ✓                  | Scoped        |         |               |         |               |
| knowledge.publish     |                    | ✓                  | Scoped        |         |               |         |               |
| process.view          | ✓                  | ✓                  | Scoped        | Scoped  | Scoped        | Scoped  |               |
| process.create        |                    | ✓                  | ✓             |         |               |         |               |
| process.edit          |                    | ✓                  | Scoped        |         |               |         |               |
| process.review        |                    | ✓                  | Scoped        |         |               |         |               |
| process.publish       |                    |                    | Scoped        |         |               |         |               |
| workflow.start        |                    | ✓                  | Scoped        | Scoped  |               |         |               |
| workflow.assign       |                    | ✓                  | Scoped        | Scoped  |               |         |               |
| workflow.complete     |                    |                    |               | Scoped  | ✓             |         | Scoped        |
| workflow.manage       |                    | ✓                  | Scoped        | Scoped  |               |         |               |
| form.submit           |                    |                    |               | Scoped  | ✓             |         | Scoped        |
| evidence.upload       |                    |                    |               | Scoped  | ✓             |         | Scoped        |
| evidence.review       |                    |                    | Scoped        | Scoped  |               | Scoped  |               |
| approval.review       |                    |                    | Scoped        | Scoped  |               |         | Scoped        |
| exception.create      |                    | ✓                  | Scoped        | Scoped  | ✓             |         |               |
| exception.manage      |                    | ✓                  | Scoped        | Scoped  |               |         |               |
| training.view         | ✓                  | ✓                  |               | Scoped  | Scoped (self) | Scoped  |               |
| training.manage       |                    | ✓                  |               | Scoped  |               |         |               |
| analytics.view        | ✓                  | ✓                  | Scoped        | Scoped  |               | Scoped  |               |
| audit.view            | ✓                  | ✓                  |               | Scoped  |               | Scoped  |               |
| audit.export          | ✓                  | ✓                  |               |         |               | Scoped  |               |
| integration.manage    | ✓                  | ✓                  |               |         |               |         |               |
| ai.use                | ✓                  | ✓                  | Scoped        | Scoped  |               |         |               |
| ai.configure          | ✓                  |                    |               |         |               |         |               |

## Enforcement rules

1. Every API route and server action that touches a protected resource
   must check the caller's effective permissions server-side before
   acting — the client never self-reports its own authorization.
2. Scope checks (organization, location, department, resource ownership)
   are evaluated together with the permission, not as a separate,
   optional step — a `manager` with `workflow.manage` in Location A must
   never be able to manage a workflow in Location B.
3. Permission checks and PostgreSQL Row-Level Security are defense in
   depth, not substitutes for each other. See
   [multi-tenancy](../docs/architecture/multi-tenancy.md).
4. Removing a role or suspending a member takes effect immediately —
   no cached or session-level permission may outlive the change.
5. Custom roles (via `role.manage`) can only grant permissions the
   granting admin's own role already holds — no privilege escalation via
   custom role creation.

## Related documents

- [User roles](user-roles.md)
- [Authentication and authorization](../docs/architecture/authentication-and-authorization.md)
- [Multi-tenancy](../docs/architecture/multi-tenancy.md)
