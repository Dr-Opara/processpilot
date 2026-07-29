# Advanced Organization Administration (Phase 21)

Deepens organization-level administration beyond Phase 5's basics
(locations/departments/teams/members/invitations) and Phase 17/18's
billing/SSO. See
[permissions-matrix.md](../../product/permissions-matrix.md) for the
permission catalog and enforcement rules this phase builds directly on
top of, especially rule 5 ("custom roles can only grant permissions the
granting admin's own role already holds").

## Scope note

Most of this phase's requirement list — organization profile, locations/
departments/teams/hierarchy, members/invitations/suspension/removal,
ownership transfer, bulk member import, administrative audit history,
usage/entitlement visibility — was already delivered in Phases 5, 15, and
17 (`src/lib/services/organizations.ts`, `departments.ts`, `locations.ts`,
`teams.ts`, `members.ts`, `invitations.ts`, `member-import.ts`,
`audit.ts`, `billing.ts`). This phase's real net-new surface is: custom
roles, role templates, group-based (team) role assignment, delegated
administration, bulk member **export**, approved-domain verification,
branding/localization/security/retention preference storage, SCIM-ready
scaffolding, and tenant-safe organization deletion. What follows
documents only the new pieces; see each named phase's own tracker entry
for what it already covers.

## Custom roles (`src/lib/services/custom-roles.ts`)

`roles`/`role_permissions`/`member_role_assignments` (Phase 4) already
supported organization-scoped custom roles at the schema level — this
phase adds the first application code that writes to them.

**Security-critical fix in this phase:** `role_permissions_insert`'s RLS
policy previously checked only that the caller held `role.manage`, not
that they held the permissions being attached to the role itself. That
let an `organization_admin` define a custom role granting a permission
they don't personally hold (e.g. `billing.manage`) and then assign it to
themselves via the _already_-guarded `member_role_assignments_insert`
policy — a two-step bypass of permissions-matrix.md's rule 5. Fixed by
migration `20260806000001_organization_administration.sql`, which adds
the identical "caller must already hold every permission being granted"
check `member_role_assignments_insert` already had. `custom-roles.ts`
duplicates this check at the application layer too (clear error message
before the write, not just a raw RLS rejection) — same defense-in-depth
posture as every other permission boundary in this codebase.

- **Create/update** — `createCustomRole()`/`updateCustomRole()`. A
  system role (`is_system = true`) can never be edited or archived.
- **Archive** — blocked while any member currently holds the role
  (`archiveCustomRole()` checks `member_role_assignments` first) rather
  than a soft-archive-with-dangling-assignments model.
- **Role templates** — `role_templates`/`role_template_permissions`
  (global, system-seeded, same `organization_id is null` pattern as
  system roles) give an admin a one-click starting point
  (`createCustomRoleFromTemplate()`). Three seeded templates: Department
  admin, Read-only auditor, Billing manager.
- UI: `/app/roles`, `/app/roles/new`, `/app/roles/[roleId]/edit`.

## Group-based access management (`src/lib/services/team-role-assignments.ts`)

Uses the existing **Team** as the "group" unit rather than introducing a
new, overlapping concept — `product/terminology.md` requires "process,"
"workflow," and "task" to stay distinct, and the same discipline applies
here: a second "Group" entity would duplicate Team.

`team_role_assignments` records that a role is granted "via" a team;
`assignRoleToTeam()` fans that role out to every current team member in
one transaction, bound by the same self-escalation check as custom
roles. **Known gap:** the fan-out runs at assignment time only — a
member added to the team afterward does not automatically receive the
team's roles until an admin calls `syncTeamRoleAssignments()` (exposed
as a re-sync, not wired to `team_members` writes automatically, to avoid
changing `setTeamMembers()`'s existing, tested behavior in this pass).
UI: the "Roles granted to this team" section on `/app/teams/[teamId]`.

## Delegated administrators (`src/lib/services/delegated-admins.ts`)

Not a new grant mechanism — a thin, one-action wrapper around two
already-existing ones: recording a member as a department's
`owner_member_id` / a location's `manager_member_id` / a team's
`manager_member_id` (the same scope source
`has_scoped_permission()` already reads, from Phase 5), combined with
assigning them a role via `member_role_assignments`. The self-escalation
bound is enforced by the existing `member_role_assignments_insert` RLS
policy — this module deliberately does not duplicate that check, to
avoid two independently-maintained copies of the same security rule.
UI: the "Delegate administration" section on `/app/members/[memberId]`.

## Bulk member export (`src/lib/services/member-export.ts`)

The read-side complement to Phase 5's `member-import.ts`. Queries the
full roster directly rather than reusing `listMembers()`, whose
`pageSize` is capped at 100 for the paginated directory view — an export
has no such cap. UI: "Export CSV" on `/app/members`, downloading via
`/app/members/export`.

## Approved domains and real domain verification (`src/lib/services/approved-domains.ts`)

Genuinely live-verifiable without any external credential: an admin
publishes a DNS TXT record
(`_processpilot-verify.<domain> TXT "processpilot-verify=<token>"`), and
`verifyApprovedDomain()` performs a real `dns.resolveTxt()` lookup — not
a simulated one, and never marks a domain verified without a matching
record actually resolving. This is the one piece of this phase's
domain-verification/SSO-adjacent surface that required no vendor,
unlike the OAuth-based integrations in
[public-api.md](public-api.md).

**Known gap:** `requireVerifiedDomainSignup` (below) is a stored
preference only — no sign-up flow in this codebase currently checks it.
Wiring it in is future work, not attempted as a half-built stub here.

## Branding, security, and data-retention preferences (`src/lib/services/organization-settings-extended.ts`)

Stored in `organization_settings.settings` (jsonb, unused before this
phase), namespaced by concern (`branding`/`security`/`dataRetention`),
rather than three new single-purpose tables.

**Honesty note, load-bearing for this section:**

- `security.sessionIdleTimeoutMinutes` is **advisory/display-only**.
  Session lifetime is actually governed by Clerk at the instance level
  (ADR-0003), not per-organization — this codebase has no mechanism to
  enforce a per-org session timeout yet.
- `dataRetention.*RetentionDays` fields are **stored preferences, not
  enforced**. No purge job reads them in this pass — audit events remain
  governed by Phase 15's immutability guarantee regardless of what's
  stored here.

Neither is presented in the UI as an active control; both are labeled
"stored preferences" / "not yet enforced" on
`/app/organization/settings`.

## SCIM-ready provisioning scaffolding (`src/lib/services/scim.ts`)

A real, minimal SCIM 2.0 Users **list** resource
(`GET /api/scim/v2/Users`), authenticated by a dedicated bearer token
(`scim_tokens` — same hash-only-storage pattern as `api_keys`, see
[public-api.md](public-api.md)). **Never validated against a real
identity-provider SCIM client** (Okta, Azure AD, OneLogin) — this is
scaffolding, not a claim of live interoperability. Deliberately bounded:
no `POST`/`PATCH`/`DELETE`, no Groups resource, no
`/ServiceProviderConfig` endpoint. A future phase that needs write
provisioning or a specific IdP's exact SCIM dialect should treat this as
a starting point, not a finished implementation. UI: `/app/integrations/scim`.

## Tenant-safe organization deletion and offboarding (`src/lib/services/organization-deletion.ts`)

A cancellable, 14-day-grace-period request — never an immediate delete.
`requestOrganizationDeletion()` requires `organization.manage` (owner
only, same bound as `transferOwnership()`) **and** the caller must type
the organization's exact current name as an elevated-confirmation step,
matching this phase's "require elevated confirmation for destructive or
ownership-changing actions" requirement. The request can be cancelled
any time before the grace period elapses.

The finalization sweep (`src/lib/jobs/organization-deletion-handlers.ts`,
job type `organization-deletion-sweep`, scheduled via the existing
background-job worker per ADR-0009) is gated by
`ORGANIZATION_DELETION_ENABLED` — **unset in every environment this was
built in**, so the sweep records that it ran and skipped rather than
either deleting anything or retrying forever. Setting the flag to `true`
without the dedicated security review this phase's own task brief calls
for is unsupported: the handler throws in that case rather than
performing an actual, unreviewed cascade delete of tenant data. This
mirrors this codebase's established "credential/flag absent → fail safe,
not fake success" posture (Phase 17's Stripe keys, Phase 18's
`INTEGRATION_ENCRYPTION_KEY`, Phase 13's AI provider key). UI: the
"Danger zone" section on `/app/organization/settings`.

## Security

- **Server-side authorization everywhere** — every new service function
  calls `requirePermission()`; there is no UI-only gate in this surface.
- **Tenant isolation** — every new table (`role_templates`/
  `role_template_permissions` are global reference data, matching
  `permissions`'/`roles`' own pattern) carries `organization_id` and RLS,
  verified statically by `src/lib/db/schema-coverage.test.ts`.
- **No self-escalation** — custom role creation/editing, team role
  assignment, and delegated administration all either directly enforce
  or transitively rely on the "caller must already hold every permission
  being granted" rule, both at the RLS layer and (for custom roles) the
  application layer.
- **Protected self-actions** — `changeMemberRole()`/`suspendMember()`/
  `removeMember()` (Phase 5) already reject a caller acting on their own
  membership; `delegateAdministrator()` adds the same self-check for its
  own action.
- **Elevated confirmation for destructive actions** — organization
  deletion requires typing the exact organization name; ownership
  transfer requires `organization.manage` and is a single, clearly
  scoped write.
- **Audit** — every write in this surface calls `recordAuditEvent()`
  with a new, phase-specific `AuditAction`/`AuditResourceType` entry
  (see `src/lib/db/audit-actions.ts`'s "Phase 21" section).
- **Negative-authorization and cross-tenant test posture** — this
  phase's unit tests (`custom-roles.test.ts`, `delegated-admins.test.ts`,
  `team-role-assignments.test.ts`, `organization-deletion.test.ts`,
  `approved-domains.test.ts`) cover the self-escalation and
  forbidden-propagation paths directly. Consistent with Phases 18/19's
  own documented posture, no new cases were added to the live-Postgres
  `tenant-isolation.integration.test.ts` suite — that suite has not been
  run against a real Supabase project in this environment for any recent
  phase, so RLS-layer cross-tenant proof for this phase's new tables
  remains, like every prior phase's, unverified against a live database
  engine; the RLS policies themselves follow the exact same
  `organization_id = current_org_id() and has_permission(...)` shape
  every other table in this codebase uses, and are covered by
  `schema-coverage.test.ts`'s static check.

## Known gaps

- Team-role fan-out doesn't auto-apply to members added after the
  initial grant (see "Group-based access management" above).
- `requireVerifiedDomainSignup` and the session/retention preferences
  are stored but not enforced anywhere yet.
- SCIM is list-only; no write provisioning, no Groups resource, never
  validated against a real IdP.
- Organization-deletion finalization is not implemented — the flag-gated
  path intentionally throws rather than deleting anything, pending a
  dedicated security review.
- Bulk import already existed (Phase 5); this phase added export but not
  a combined "sync" operation.

## Related documents

- [Permissions matrix](../../product/permissions-matrix.md)
- [Multi-tenancy](multi-tenancy.md)
- [Authentication and authorization](authentication-and-authorization.md)
- [Public API, webhooks, and the integration catalog](public-api.md)
- [Backlog](../project/backlog.md)
