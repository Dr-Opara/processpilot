-- Phase 19 (External portal): resource-scoped access for the
-- external_user role (product/user-roles.md). An external_access_grant
-- ties exactly one Clerk-based invitation to exactly one task — the
-- "single, specific... task... they were explicitly invited to act
-- on" boundary the role definition requires. Actual row-level access
-- to that task (and its parent workflow, form submissions, evidence)
-- needs no new RLS anywhere: every one of those tables' SELECT/UPDATE
-- policies already includes `assignee_member_id = current_member_id()`
-- as an own-resource clause (Phase 8/9), so once this grant's accepted
-- member becomes the task's assignee, existing policies already cover
-- it — external_user's own role_permissions grants (workflow.complete,
-- form.submit, evidence.upload, approval.review — all "scoped", none
-- unscoped) hold no department/location/team-wide access at all, so
-- there is nothing else for this table to widen.

create table external_access_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  -- Copied from the target task at grant-creation time — needed for
  -- has_scoped_permission()'s RLS check below, same "denormalize the
  -- owning department onto the row" pattern Phase 11/12/15 already
  -- established for exceptions/capa_plans/temporary_waivers/etc.
  department_id uuid references departments(id),
  invitation_id uuid not null references organization_invitations(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  -- Set once the Clerk invitation is accepted (see identity-sync.ts's
  -- applyPendingInvitation()) — null while pending.
  member_id uuid references organization_members(id),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'completed', 'revoked', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);

-- At most one live (pending/active) grant per task — inviting a second
-- external collaborator to the same task while one is still pending or
-- active would leave it ambiguous who the task's assignee should
-- become on acceptance.
create unique index external_access_grants_live_task_idx
  on external_access_grants(task_id)
  where status in ('pending', 'active');
create index external_access_grants_organization_id_idx on external_access_grants(organization_id);
create index external_access_grants_invitation_id_idx on external_access_grants(invitation_id);

alter table external_access_grants enable row level security;

-- workflow.assign (organization_owner/organization_admin unscoped;
-- process_owner/manager scoped) — "Assign a workflow or its tasks to
-- members, teams, or external users," per its own seeded description
-- (role_permissions).
create policy external_access_grants_select on external_access_grants
  for select
  using (organization_id = current_org_id() and has_scoped_permission('workflow.assign', department_id, null, null));

create policy external_access_grants_insert on external_access_grants
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('workflow.assign', department_id, null, null));

create policy external_access_grants_update on external_access_grants
  for update
  using (organization_id = current_org_id() and has_scoped_permission('workflow.assign', department_id, null, null))
  with check (organization_id = current_org_id() and has_scoped_permission('workflow.assign', department_id, null, null));

revoke all on external_access_grants from anon, public, authenticated;
grant select, insert, update on external_access_grants to authenticated;
