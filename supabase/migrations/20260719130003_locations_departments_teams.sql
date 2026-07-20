-- organization_locations, departments, teams, team_members. Structural
-- org-chart tables that Phase 5 (Business onboarding and employee
-- management) builds the management UI on top of. Write access here is
-- has_permission()-gated, which — per 20260719130001's note — only
-- recognizes org_owner/org_admin's unscoped grants in this phase; a
-- manager's "Scoped" department.manage/team.manage grant isn't yet
-- enforceable at the RLS layer (no scope-assignment model exists until
-- Phase 5) and is intentionally not honored here rather than
-- over-granted.

create table organization_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  archived_at timestamptz
);

create trigger organization_locations_set_updated_at
  before update on organization_locations
  for each row
  execute function set_updated_at();

create index organization_locations_organization_id_idx on organization_locations(organization_id);
create unique index organization_locations_org_name_idx
  on organization_locations(organization_id, lower(name))
  where archived_at is null;

alter table organization_locations enable row level security;

create policy organization_locations_select on organization_locations
  for select
  using (organization_id = current_org_id());

create policy organization_locations_insert on organization_locations
  for insert
  with check (organization_id = current_org_id() and has_permission('location.manage'));

create policy organization_locations_update on organization_locations
  for update
  using (organization_id = current_org_id() and has_permission('location.manage'))
  with check (organization_id = current_org_id() and has_permission('location.manage'));

revoke all on organization_locations from anon, public, authenticated;
grant select, insert, update on organization_locations to authenticated;

create table departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references organization_locations(id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  archived_at timestamptz
);

create trigger departments_set_updated_at
  before update on departments
  for each row
  execute function set_updated_at();

create index departments_organization_id_idx on departments(organization_id);
create index departments_location_id_idx on departments(location_id) where location_id is not null;
create unique index departments_org_name_idx
  on departments(organization_id, lower(name))
  where archived_at is null;

alter table departments enable row level security;

create policy departments_select on departments
  for select
  using (organization_id = current_org_id());

create policy departments_insert on departments
  for insert
  with check (organization_id = current_org_id() and has_permission('department.manage'));

create policy departments_update on departments
  for update
  using (organization_id = current_org_id() and has_permission('department.manage'))
  with check (organization_id = current_org_id() and has_permission('department.manage'));

revoke all on departments from anon, public, authenticated;
grant select, insert, update on departments to authenticated;

create table teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  location_id uuid references organization_locations(id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  archived_at timestamptz
);

create trigger teams_set_updated_at
  before update on teams
  for each row
  execute function set_updated_at();

create index teams_organization_id_idx on teams(organization_id);
create index teams_department_id_idx on teams(department_id) where department_id is not null;
create unique index teams_org_name_idx
  on teams(organization_id, lower(name))
  where archived_at is null;

alter table teams enable row level security;

create policy teams_select on teams
  for select
  using (organization_id = current_org_id());

create policy teams_insert on teams
  for insert
  with check (organization_id = current_org_id() and has_permission('team.manage'));

create policy teams_update on teams
  for update
  using (organization_id = current_org_id() and has_permission('team.manage'))
  with check (organization_id = current_org_id() and has_permission('team.manage'));

revoke all on teams from anon, public, authenticated;
grant select, insert, update on teams to authenticated;

create table team_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  organization_member_id uuid not null references organization_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  unique (team_id, organization_member_id)
);

create index team_members_organization_id_idx on team_members(organization_id);
-- No separate index on team_id alone: the `unique (team_id,
-- organization_member_id)` constraint above already provides one via its
-- leading column.
create index team_members_member_idx on team_members(organization_member_id);

alter table team_members enable row level security;

create policy team_members_select on team_members
  for select
  using (organization_id = current_org_id());

create policy team_members_insert on team_members
  for insert
  with check (organization_id = current_org_id() and has_permission('team.manage'));

create policy team_members_delete on team_members
  for delete
  using (organization_id = current_org_id() and has_permission('team.manage'));

revoke all on team_members from anon, public, authenticated;
grant select, insert, delete on team_members to authenticated;
