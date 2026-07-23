-- Phase 5 (Business onboarding and employee management): the
-- scope-assignment data model docs/architecture/database-schema.md and
-- authentication-and-authorization.md's "known limitations" note said
-- would land in this phase — until now, has_permission() only recognized
-- unscoped ("✓") grants, so a manager's "Scoped" member.manage/
-- department.manage/team.manage grant (product/permissions-matrix.md) was
-- never honored at the RLS layer.
--
-- Design: a manager's scope is the department/location/team they are
-- recorded as owning/managing — no separate generic "scope assignment"
-- table, since product/user-roles.md already calls for a named location
-- manager, department owner, and team manager, and reusing those columns
-- as the scope source avoids a second, potentially-divergent place to
-- track the same fact. has_scoped_permission() below checks the caller's
-- unscoped grant first, then falls back to "does the caller own/manage
-- the specific department/location/team this action touches."
--
-- Also adds employee-profile fields to organization_members
-- (job_title, start_date, location_id, department_id, manager_id) — these
-- didn't exist anywhere in the schema; Phase 4 only modeled membership
-- status, not org-chart placement.

alter table organization_locations
  add column manager_member_id uuid references organization_members(id);

create index organization_locations_manager_idx
  on organization_locations(manager_member_id)
  where manager_member_id is not null;

alter table departments
  add column parent_department_id uuid references departments(id),
  add column owner_member_id uuid references organization_members(id);

create index departments_parent_department_id_idx
  on departments(parent_department_id)
  where parent_department_id is not null;
create index departments_owner_idx
  on departments(owner_member_id)
  where owner_member_id is not null;

-- Walks the parent chain on insert/update, rejecting a self-reference or
-- any cycle. Written as a trigger (not a CHECK constraint) because the
-- check must look at other rows, not just the row being written.
create or replace function prevent_department_cycle()
returns trigger
language plpgsql
as $$
declare
  current_id uuid;
  depth int := 0;
begin
  if new.parent_department_id is null then
    return new;
  end if;

  if new.parent_department_id = new.id then
    raise exception 'a department cannot be its own parent';
  end if;

  current_id := new.parent_department_id;
  while current_id is not null loop
    depth := depth + 1;
    if depth > 100 then
      raise exception 'department hierarchy too deep or malformed';
    end if;
    if current_id = new.id then
      raise exception 'circular department hierarchy detected';
    end if;
    select parent_department_id into current_id from departments where id = current_id;
  end loop;

  return new;
end;
$$;

create trigger departments_prevent_cycle
  before insert or update of parent_department_id on departments
  for each row
  execute function prevent_department_cycle();

alter table teams
  add column manager_member_id uuid references organization_members(id);

create index teams_manager_idx
  on teams(manager_member_id)
  where manager_member_id is not null;

alter table organization_members
  add column job_title text,
  add column start_date date,
  add column location_id uuid references organization_locations(id),
  add column department_id uuid references departments(id),
  add column manager_id uuid references organization_members(id);

create index organization_members_location_idx
  on organization_members(location_id)
  where location_id is not null;
create index organization_members_department_idx
  on organization_members(department_id)
  where department_id is not null;
create index organization_members_manager_idx
  on organization_members(manager_id)
  where manager_id is not null;

-- Re-derives, from the same role_permissions rows current_member_permissions()
-- already reads, whether the caller holds `permission` scoped to a
-- specific department/location/team — true only if a scoped grant exists
-- for one of the caller's roles AND the caller owns/manages the named
-- resource. Falls back to the plain unscoped grant first, so callers that
-- already hold "✓" access don't need to pass any scope argument.
-- SECURITY DEFINER for the same reason current_member_permissions() is:
-- organization_members has its own SELECT policy that would otherwise
-- recurse.
create or replace function has_scoped_permission(
  permission text,
  department_id uuid default null,
  location_id uuid default null,
  team_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  caller_member_id uuid;
  has_scoped_grant boolean;
begin
  if has_permission(permission) then
    return true;
  end if;

  caller_member_id := current_member_id();
  if caller_member_id is null then
    return false;
  end if;

  select exists (
    select 1
    from member_role_assignments mra
    join role_permissions rp on rp.role_id = mra.role_id
    join permissions p on p.id = rp.permission_id
    where mra.organization_member_id = caller_member_id
      and p.key = permission
      and rp.scope = 'scoped'
  ) into has_scoped_grant;

  if not has_scoped_grant then
    return false;
  end if;

  if department_id is not null and exists (
    select 1 from departments d where d.id = department_id and d.owner_member_id = caller_member_id
  ) then
    return true;
  end if;

  if location_id is not null and exists (
    select 1 from organization_locations l where l.id = location_id and l.manager_member_id = caller_member_id
  ) then
    return true;
  end if;

  if team_id is not null and exists (
    select 1 from teams t where t.id = team_id and t.manager_member_id = caller_member_id
  ) then
    return true;
  end if;

  return false;
end;
$$;

-- Extend write policies to honor the scoped grant, in addition to the
-- unscoped one each policy already checked. Each `drop policy` /
-- `create policy` pair replaces (not merges with) the Phase-4 version
-- from the same-named policy in 20260719130003, per this repo's "never
-- edit an already-applied migration in place" rule.
drop policy organization_locations_update on organization_locations;
create policy organization_locations_update on organization_locations
  for update
  using (organization_id = current_org_id() and has_scoped_permission('location.manage', null, id, null))
  with check (organization_id = current_org_id() and has_scoped_permission('location.manage', null, id, null));

drop policy departments_update on departments;
create policy departments_update on departments
  for update
  using (organization_id = current_org_id() and has_scoped_permission('department.manage', id, null, null))
  with check (organization_id = current_org_id() and has_scoped_permission('department.manage', id, null, null));

drop policy teams_update on teams;
create policy teams_update on teams
  for update
  using (organization_id = current_org_id() and has_scoped_permission('team.manage', null, null, id))
  with check (organization_id = current_org_id() and has_scoped_permission('team.manage', null, null, id));

drop policy team_members_insert on team_members;
create policy team_members_insert on team_members
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('team.manage', null, null, team_id));

drop policy team_members_delete on team_members;
create policy team_members_delete on team_members
  for delete
  using (organization_id = current_org_id() and has_scoped_permission('team.manage', null, null, team_id));

-- organization_members_update: a manager's scoped member.manage grant is
-- bound to the *target* member's department (per user-roles.md, a
-- manager's scope is "the department(s), location(s), or team(s) they
-- manage"). department_id is read from the row being updated (`using`
-- inspects the pre-update row); the `with check` re-reads it from the
-- post-update row so a scoped manager can't move a member out of the
-- department that gave them access in the same statement.
drop policy organization_members_update on organization_members;
create policy organization_members_update on organization_members
  for update
  using (
    organization_id = current_org_id()
    and has_scoped_permission('member.manage', department_id, null, null)
  )
  with check (
    organization_id = current_org_id()
    and has_scoped_permission('member.manage', department_id, null, null)
  );
