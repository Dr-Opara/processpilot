# Personas

Each persona below maps to one or more [user roles](user-roles.md). Roles
are the enforceable, technical concept; personas are the human context
behind them, used to guide design and prioritization decisions.

## Business owner

Owns or runs a company evaluating or buying ProcessPilot. Cares about ROI,
risk reduction, and whether the product will actually get adopted by
frontline staff. Usually not a daily user once onboarded — delegates
day-to-day ownership to an organization owner or administrator.

## Organization owner

The primary account holder for the organization. Responsible for billing,
top-level configuration, and the decision to add or remove seats and
features. Maps to `organization_owner`.

## Organization administrator

Manages people, locations, departments, teams, roles, and integrations
day-to-day. The primary operator of the account once it's live. Maps to
`organization_admin`.

## Operations leader

Cares about cross-process visibility: completion rates, exception trends,
audit readiness, and where operational risk is concentrated. Primary
consumer of analytics and audit views. Typically holds `manager` or
`organization_admin` with broad `analytics.view` and `audit.view` scope.

## Process owner

Accountable for the correctness and currency of one or more specific
processes. Reviews AI-drafted process proposals, approves publication,
and is the point of contact when a process needs to change. Maps to
`process_owner`.

## Department manager

Runs a specific department, location, or team. Assigns workflows, resolves
exceptions for their scope, and reviews team completion and training
status. Maps to `manager`.

## Employee

The frontline user who executes tasks: completing checklists, submitting
forms, uploading evidence, taking training. The highest-volume persona by
user count and the persona most sensitive to interface simplicity. Maps to
`employee`.

## Compliance professional

Responsible for ensuring the organization's processes meet internal policy
and external regulatory obligations. Reviews evidence, approvals, and
exception resolution; manages training-to-certification requirements.
Typically holds `manager` or a specialized `organization_admin` scope with
strong `audit.view` and `audit.export` needs.

## Auditor

An internal or external reviewer who needs read access to a defined scope
of processes, workflows, evidence, and audit events — typically for a
finite engagement window. Maps to `auditor`. Never has edit or execution
permissions.

## External user

A person outside the organization (a contractor, vendor, franchisee,
customer) who must complete a specific, narrowly scoped piece of work —
one form, one approval, one workflow — without full organizational access.
Maps to `external_user`.

## ProcessPilot support employee

An employee of ProcessPilot (the vendor), not the customer organization.
Uses the internal support console (Phase 27) to assist customers,
troubleshoot issues, and — under strict, audited, and time-boxed access
controls — view customer data only when necessary and authorized. Never
holds a standing organizational role inside a customer's tenant.

## Related documents

- [User roles](user-roles.md)
- [Permissions matrix](permissions-matrix.md)
- [User journeys](user-journeys.md)
