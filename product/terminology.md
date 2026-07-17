# Terminology

This is the single source of truth for domain vocabulary. Use these terms
consistently in product copy, documentation, and code (type names, table
names, route names). Do not introduce synonyms for these concepts.

The most important discipline: **"process," "workflow," and "task" are not
interchangeable.** A process is a governed definition. A workflow is a
running instance of that definition. A task is one unit of work within a
workflow instance.

| Term                    | Definition                                                                                                                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Organization**        | The top-level tenant. One company/customer account. Owns all its data exclusively.                                                                                                                                                                               |
| **Workspace**           | An optional subdivision of an organization used to separate large business units (e.g. distinct brands under one parent company) that need their own configuration while sharing billing and top-level ownership. Most organizations have exactly one workspace. |
| **Location**            | A physical or logical site within an organization (a store, a clinic, a warehouse) used for scoping processes, workflows, and reporting.                                                                                                                         |
| **Department**          | A functional grouping within an organization or location (e.g. Kitchen, Front Desk, Accounts Payable) used to scope processes and permissions.                                                                                                                   |
| **Team**                | A named group of members, generally smaller and more fluid than a department, used for assignment (e.g. "Night shift crew").                                                                                                                                     |
| **Member**              | A person who belongs to an organization with an account and at least one role.                                                                                                                                                                                   |
| **Role**                | A named set of permissions assigned to a member (see [user roles](user-roles.md)).                                                                                                                                                                               |
| **Permission**          | A single, atomic authorization to perform one action (see [permissions matrix](permissions-matrix.md)).                                                                                                                                                          |
| **Knowledge document**  | A source of institutional knowledge (a policy, SOP, form template, or other reference) imported or authored in ProcessPilot.                                                                                                                                     |
| **Document version**    | An immutable snapshot of a knowledge document at a point in time. Editing a published document creates a new version; it never mutates a published one.                                                                                                          |
| **Process**             | A governed, versioned definition of a repeatable body of work — the steps, roles, forms, and approvals required to complete it correctly. A process is a _definition_, not an instance of work.                                                                  |
| **Process version**     | An immutable, published snapshot of a process. Workflows are always started from a specific process version, never from a mutable "current" process.                                                                                                             |
| **Workflow**            | A _running instance_ of a process version, created when a process is assigned or triggered. A workflow has a status (e.g. in progress, complete, exception) and belongs to one organization.                                                                     |
| **Workflow instance**   | Synonym used interchangeably with "workflow" when disambiguation from "process" is needed in technical contexts; prefer "workflow" in product copy.                                                                                                              |
| **Task**                | A single unit of work within a workflow instance, assigned to a member or team, with its own status. A workflow is composed of one or more tasks executed in sequence or in parallel.                                                                            |
| **Form**                | A structured data-capture definition attached to a process step or task.                                                                                                                                                                                         |
| **Form submission**     | A specific, timestamped, attributable set of answers submitted against a form as part of a task.                                                                                                                                                                 |
| **Approval**            | A recorded decision (approve/reject, with optional comment) made by an authorized member at a defined point in a workflow.                                                                                                                                       |
| **Evidence**            | A file, photo, signature, or other artifact uploaded to substantiate that a task or approval was genuinely completed.                                                                                                                                            |
| **Exception**           | A recorded deviation from the expected path of a workflow (missed deadline, failed check, rejected approval, manually flagged issue) that requires triage and resolution.                                                                                        |
| **Corrective action**   | A tracked remediation step created in response to an exception, with an owner and a due date.                                                                                                                                                                    |
| **Training course**     | A structured learning unit (content plus, optionally, an assessment) that can be assigned to members.                                                                                                                                                            |
| **Training assignment** | A specific requirement for a specific member to complete a specific training course, with a due date and status.                                                                                                                                                 |
| **Certification**       | A time-bound credential granted to a member after completing required training, subject to expiry and renewal.                                                                                                                                                   |
| **Audit event**         | An immutable record of a significant action taken in the system (who, what, when, on what record), retained for compliance and forensic review.                                                                                                                  |
| **Integration**         | A configured connection between ProcessPilot and an external system (e.g. an identity provider, a storage system, a communication tool).                                                                                                                         |
| **Entitlement**         | A specific capability or usage limit granted to an organization by its subscription plan (e.g. seat count, feature access, storage quota).                                                                                                                       |

## Usage discipline

- A **process** is authored once and reused many times; a **workflow** is
  created every time that process runs.
- A **task** never exists outside a workflow; there is no such thing as a
  standalone task disconnected from a process.
- **Publish** always means: create an immutable version and make it the
  active version going forward. It never means silently editing something
  already live.
- **Member** refers to an internal, authenticated participant in an
  organization. See [user roles](user-roles.md) for the distinct,
  more limited concept of an **external user**.

## Related documents

- [Domain model](../docs/architecture/domain-model.md)
- [User roles](user-roles.md)
- [Feature catalog](feature-catalog.md)
