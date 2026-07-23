-- Phase 5: organization_invitations gained status/role/expiry in Phase 4
-- but had no way to pre-assign the invited member to a location,
-- department, or team on acceptance, and no way to attach an optional
-- personal message — both explicitly required by this phase's invitation
-- flow. Also extends organization_invitations_insert/select to honor a
-- manager's scoped member.invite grant (added in 20260719140001),
-- matching the same department-scope rule organization_members_update
-- uses.

alter table organization_invitations
  add column location_id uuid references organization_locations(id),
  add column department_id uuid references departments(id),
  add column team_id uuid references teams(id),
  add column personal_message text;

create index organization_invitations_department_idx
  on organization_invitations(department_id)
  where department_id is not null;

drop policy organization_invitations_select on organization_invitations;
create policy organization_invitations_select on organization_invitations
  for select
  using (
    organization_id = current_org_id()
    and has_scoped_permission('member.invite', department_id, null, null)
  );

drop policy organization_invitations_insert on organization_invitations;
create policy organization_invitations_insert on organization_invitations
  for insert
  with check (
    organization_id = current_org_id()
    and has_scoped_permission('member.invite', department_id, null, null)
  );

drop policy organization_invitations_update on organization_invitations;
create policy organization_invitations_update on organization_invitations
  for update
  using (
    organization_id = current_org_id()
    and has_scoped_permission('member.invite', department_id, null, null)
  )
  with check (
    organization_id = current_org_id()
    and has_scoped_permission('member.invite', department_id, null, null)
  );
