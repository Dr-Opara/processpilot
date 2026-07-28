# External Portal (Phase 19)

Resource-scoped access for the `external_user` role per
[product/user-roles.md](../../product/user-roles.md). Lets a permitted
staff member (`workflow.assign`) invite one external collaborator — a
contractor, auditor, vendor — to complete exactly one open task, without
giving them any other visibility into the organization.

## Why no new RLS was needed

Phases 8/9's own row-level-security policies already grant an
own-resource clause — `assignee_member_id = current_member_id()` — on
`tasks`, `workflows`, `form_submissions`, and `evidence`. Once an
external user becomes a task's `assignee_member_id`, they already have
exactly the row-level access this phase needs: that one task, its parent
workflow, its form submission, and its evidence — nothing else. No new
RLS policy was required for the access itself; the real scope of this
phase is the invitation/activation/revocation/expiration lifecycle
around _becoming_ that assignee.

## Data model

`external_access_grants` (migration
`20260805000001_external_portal.sql`) ties exactly one
`organization_invitations` row to exactly one `tasks` row:

- `status`: `pending` → `active` → `completed` | `revoked` | `expired`.
- A partial unique index on `task_id` where `status in ('pending',
'active')` enforces "one live grant per task" at the database level,
  not just in application code.
- `expires_at` is set at invite time (1–30 days, caller-supplied,
  default 7) and drives both the background expiration job and (once
  accepted) the underlying Clerk invitation's own lifetime.

RLS on `external_access_grants` mirrors every other scoped table in this
codebase: `organization_id = current_org_id() and
has_scoped_permission('workflow.assign', department_id, null, null)`.
The row's `department_id` is populated at insert time from the task's
own `department_id` — the same category of bug (a scoping column
declared but never populated) that was found and fixed in `capa_plans`,
`temporary_waivers`, `training_assignments`, and `certifications` in
earlier phases; this table was built with the fix applied from the
start.

## Invitation flow

1. A staff member with `workflow.assign` (scoped to the task's
   department) calls `inviteExternalUser({ taskId, email,
expiresInDays })` (`src/lib/services/external-access.ts`).
2. The task must be `assigned` or `in_progress`; a task with an
   existing live grant is rejected.
3. `src/lib/services/external-access.ts` creates a Clerk organization
   invitation directly (`clerkClient().organizations.createOrganizationInvitation`),
   bypassing `invitations.ts`'s `createInvitation()`/
   `assertRoleAssignable()` — that gate requires `role.manage` to assign
   any non-`employee` role, which would make external invites an
   owner/admin-only capability. This path is safe without that gate
   because the assigned role is always hardcoded to the seeded
   `external_user` system role, never caller-selectable; the caller only
   needs `workflow.assign`, whose own seeded permission description
   reads "Assign a workflow or its tasks to members, teams, or external
   users."
4. An `organization_invitations` row and the `external_access_grants`
   row (`status: pending`) are written in the same transaction as the
   audit event (`ExternalAccessGranted`).

## Activation on accept

`src/lib/db/identity-sync.ts`'s `applyPendingInvitation()` — the
existing Clerk-webhook-driven path that assigns the invited role on
membership creation — calls
`activateExternalAccessGrant(sql, organizationId, invitation.id,
memberId, correlationId)` immediately after recording its own
`InvitationAccepted` audit event. This is a no-op for every invitation
that isn't tied to a pending external-access grant (the ordinary case
for every other role). When it does match, it:

- Sets the grant to `active`, records `accepted_at`.
- Sets the task's `assignee_member_id` to the new member — the one step
  a normal invitation acceptance doesn't already do.
- Enqueues an `external-access-expiration-check` background job
  scheduled for the grant's `expires_at` (reusing the existing
  `background_jobs` worker rather than a second scheduler).
- Records `ExternalAccessActivated` (`source: "webhook"`).

## Revocation and expiration

- `revokeExternalAccessGrant(grantId)` — staff-initiated, requires
  `workflow.assign`; sets the grant to `revoked` and, if the invitation
  had been accepted, suspends the member (`organization_members.status
= 'suspended'`).
- `expireExternalAccessGrant()` — background-job-only (no permission
  gate, mirrors `expireWaiver`/`expireEvidence`'s idempotent pattern):
  expires a still-live grant past its `expires_at` and suspends the
  member the same way.

## Directory visibility

`listMembers()` (`src/lib/services/members.ts`) excludes any member
holding the `external_user` role from both the paginated result and the
count query, so external collaborators never appear in the regular
people directory.

## UI

`/app/tasks/[taskId]/external-access` — reachable from a link on the
task-detail page — lets a permitted staff member see the task's grants
(status, expiry, revoke action) and invite a new external collaborator
when the task has no live grant.

## Known gaps

- No dedicated "minimal external session shell" (e.g. redirecting an
  `external_user`-role member straight to their one assigned task on
  sign-in, instead of the normal internal dashboard/nav) has been built
  yet — an external user who signs in currently sees the same
  `/app` layout as any other member, scoped only by what RLS actually
  returns for their queries. Their effective data access is already
  correctly scoped (see "Why no new RLS was needed" above); this gap is
  about navigation/UX polish, not access control.
- Privilege-escalation coverage is unit-test-level only
  (`external-access.test.ts`), consistent with this repository's
  existing, documented posture that RLS/tenant-isolation claims are
  unverified against a live Postgres engine in CI (no Supabase project
  has been provisioned in this environment — see
  [supabase-setup.md](../development/supabase-setup.md)). The
  `tenant-isolation.integration.test.ts` suite exercises the same
  own-resource RLS clauses this phase relies on but is itself carried
  forward as unverified against a real engine.
- Whether external-user access consumes a seat, a metered unit, or is
  unlimited is an explicitly open pricing question
  (`product/pricing-hypotheses.md`); `requireSeatAvailable()` is
  deliberately not called for external invites until that's decided.
- Revocation/expiration suspend the member but do not delete their
  Clerk account or their `organization_members` row — consistent with
  how suspension works for internal members elsewhere in the codebase,
  but means a revoked external user's audit trail is preserved rather
  than erased.
