-- organization_members, the roles/permissions/role_permissions reference
-- catalog (seeded here from product/user-roles.md and
-- product/permissions-matrix.md — those documents are the single source
-- of truth; this migration transcribes them, never the other way
-- around), and member_role_assignments.

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid not null references profiles(id),
  clerk_membership_id text not null unique,
  clerk_role text,
  status text not null default 'active' check (status in ('active', 'suspended', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

create trigger organization_members_set_updated_at
  before update on organization_members
  for each row
  execute function set_updated_at();

-- Partial, not a plain composite unique: a profile keeps its historical
-- `removed` row (per docs/architecture/data-ownership.md — deactivate,
-- don't delete) and, if re-invited, gets a new row with a new Clerk
-- membership id. Only one *non-removed* row per (organization, profile)
-- is enforced.
create unique index organization_members_org_profile_active_idx
  on organization_members(organization_id, profile_id)
  where status <> 'removed';
create index organization_members_organization_id_idx on organization_members(organization_id);
create index organization_members_profile_id_idx on organization_members(profile_id);
create index organization_members_active_idx on organization_members(organization_id) where status = 'active';

alter table organization_members enable row level security;

-- Roster visibility: any active member of the org can see the full
-- roster (including suspended/removed rows, so admins can manage them).
-- A suspended/removed caller can't reach this at all — their own
-- current_org_id() is NULL — so this policy doesn't need its own status
-- check.
create policy organization_members_select on organization_members
  for select
  using (organization_id = current_org_id());

create policy organization_members_update on organization_members
  for update
  using (organization_id = current_org_id() and has_permission('member.manage'))
  with check (organization_id = current_org_id() and has_permission('member.manage'));

revoke all on organization_members from anon, public, authenticated;
grant select, update on organization_members to authenticated;

-- Now that organization_members exists, extend profile visibility to
-- fellow org members (see 20260719130001's profiles_select_self for the
-- self-visibility half — Postgres OR's multiple permissive policies for
-- the same command).
create policy profiles_select_org_members on profiles
  for select
  using (
    id in (
      select om.profile_id
      from organization_members om
      where om.organization_id = current_org_id()
    )
  );

-- permissions: global, immutable reference catalog. No organization_id —
-- not tenant-owned, so the RLS/organization-index schema-coverage check
-- does not apply to it; RLS is still enabled for defense-in-depth with a
-- single permissive read policy.
create table permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text not null,
  created_at timestamptz not null default now()
);

alter table permissions enable row level security;

create policy permissions_select on permissions
  for select
  using (true);

revoke all on permissions from anon, public, authenticated;
grant select on permissions to authenticated;

-- roles: organization_id NULL means a system role (the 7 roles from
-- product/user-roles.md, seeded below). Non-null organization_id is
-- reserved for custom roles (Phase 21, product/permissions-matrix.md —
-- "role.manage" already exists as a permission; the column exists now so
-- that phase isn't a breaking schema change).
create table roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  archived_at timestamptz
);

create trigger roles_set_updated_at
  before update on roles
  for each row
  execute function set_updated_at();

create unique index roles_system_key_idx on roles(key) where organization_id is null;
create unique index roles_org_key_idx on roles(organization_id, key) where organization_id is not null;
create index roles_organization_id_idx on roles(organization_id) where organization_id is not null;

alter table roles enable row level security;

create policy roles_select on roles
  for select
  using (organization_id is null or organization_id = current_org_id());

create policy roles_insert on roles
  for insert
  with check (
    organization_id = current_org_id()
    and organization_id is not null
    and has_permission('role.manage')
  );

create policy roles_update on roles
  for update
  using (
    organization_id = current_org_id()
    and organization_id is not null
    and has_permission('role.manage')
  )
  with check (
    organization_id = current_org_id()
    and organization_id is not null
    and has_permission('role.manage')
  );

revoke all on roles from anon, public, authenticated;
grant select, insert, update on roles to authenticated;

-- role_permissions: join table. scope mirrors permissions-matrix.md's
-- "✓" (scope = null, organization-wide grant) vs. "Scoped" (scope =
-- 'scoped', narrowed to the role's bounded department/location/team/
-- owned-resource scope per product/user-roles.md — the tables needed to
-- fully resolve that narrowing (locations/departments/teams land later
-- in this same migration set; resource ownership like process_owner's
-- assigned processes doesn't exist until Phase 7) are applied in the
-- application authorization layer, not this column alone).
create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  scope text check (scope in ('scoped')),
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

alter table role_permissions enable row level security;

create policy role_permissions_select on role_permissions
  for select
  using (
    exists (
      select 1 from roles r
      where r.id = role_permissions.role_id
        and (r.organization_id is null or r.organization_id = current_org_id())
    )
  );

create policy role_permissions_insert on role_permissions
  for insert
  with check (
    exists (
      select 1 from roles r
      where r.id = role_permissions.role_id
        and r.organization_id = current_org_id()
        and has_permission('role.manage')
    )
  );

create policy role_permissions_delete on role_permissions
  for delete
  using (
    exists (
      select 1 from roles r
      where r.id = role_permissions.role_id
        and r.organization_id = current_org_id()
        and has_permission('role.manage')
    )
  );

revoke all on role_permissions from anon, public, authenticated;
grant select, insert, delete on role_permissions to authenticated;

-- member_role_assignments: which member holds which role, within which
-- org. The WITH CHECK below enforces permissions-matrix.md enforcement
-- rule 5 ("no self-escalation") at the database layer, independent of
-- the identical check the application layer also performs — a role can
-- only be assigned if every permission it grants is already held by the
-- assigning caller.
create table member_role_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  organization_member_id uuid not null references organization_members(id) on delete cascade,
  role_id uuid not null references roles(id),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  unique (organization_member_id, role_id)
);

create index member_role_assignments_organization_id_idx on member_role_assignments(organization_id);
-- No separate index on organization_member_id alone: the `unique
-- (organization_member_id, role_id)` constraint above already provides
-- one via its leading column.

alter table member_role_assignments enable row level security;

create policy member_role_assignments_select on member_role_assignments
  for select
  using (organization_id = current_org_id());

create policy member_role_assignments_insert on member_role_assignments
  for insert
  with check (
    organization_id = current_org_id()
    and has_permission('role.manage')
    and not exists (
      select 1
      from role_permissions rp
      join permissions p on p.id = rp.permission_id
      where rp.role_id = member_role_assignments.role_id
        and not (p.key = any(current_member_permissions()))
    )
  );

create policy member_role_assignments_delete on member_role_assignments
  for delete
  using (organization_id = current_org_id() and has_permission('role.manage'));

revoke all on member_role_assignments from anon, public, authenticated;
grant select, insert, delete on member_role_assignments to authenticated;

-- Seed: permission catalog (product/permissions-matrix.md).
insert into permissions (key, description) values
  ('organization.manage', 'Create, rename, or delete the organization; manage top-level settings.'),
  ('organization.settings', 'Edit organization-wide configuration short of deletion/billing.'),
  ('billing.manage', 'View and change subscription plan, payment method, and invoices.'),
  ('member.invite', 'Invite new members to the organization.'),
  ('member.manage', 'Edit, suspend, or remove existing members.'),
  ('role.manage', 'Create custom roles or change role-permission assignments.'),
  ('location.manage', 'Create, edit, or remove locations.'),
  ('department.manage', 'Create, edit, or remove departments.'),
  ('team.manage', 'Create, edit, or remove teams.'),
  ('knowledge.view', 'View knowledge documents within scope.'),
  ('knowledge.create', 'Create new knowledge documents.'),
  ('knowledge.edit', 'Edit draft knowledge documents.'),
  ('knowledge.review', 'Review knowledge documents submitted for approval.'),
  ('knowledge.publish', 'Publish a new version of a knowledge document.'),
  ('process.view', 'View processes within scope.'),
  ('process.create', 'Create new draft processes.'),
  ('process.edit', 'Edit draft processes.'),
  ('process.review', 'Review processes submitted for approval.'),
  ('process.publish', 'Publish a new version of a process.'),
  ('workflow.start', 'Start a new workflow instance from a published process.'),
  ('workflow.assign', 'Assign a workflow or its tasks to members, teams, or external users.'),
  ('workflow.complete', 'Complete tasks within an assigned workflow.'),
  ('workflow.manage', 'Cancel, reassign, or administratively modify a running workflow.'),
  ('form.submit', 'Submit a form as part of a task.'),
  ('evidence.upload', 'Upload evidence files against a task or approval.'),
  ('evidence.review', 'Review uploaded evidence for adequacy.'),
  ('approval.review', 'Approve or reject an approval step.'),
  ('exception.create', 'Flag or record a new exception.'),
  ('exception.manage', 'Triage, assign, and resolve exceptions and corrective actions.'),
  ('training.view', 'View own or scoped training assignments and certifications.'),
  ('training.manage', 'Create courses, assign training, and manage certifications.'),
  ('analytics.view', 'View operational analytics and dashboards within scope.'),
  ('audit.view', 'View audit events within scope.'),
  ('audit.export', 'Export audit events and records for external review.'),
  ('integration.manage', 'Configure and manage third-party integrations.'),
  ('ai.use', 'Use AI-assisted features (drafting, summarizing, suggesting).'),
  ('ai.configure', 'Configure AI feature settings (sources, guardrails) for the organization.');

-- Seed: the 7 system roles (product/user-roles.md).
insert into roles (key, name, is_system) values
  ('organization_owner', 'Organization owner', true),
  ('organization_admin', 'Organization admin', true),
  ('process_owner', 'Process owner', true),
  ('manager', 'Manager', true),
  ('employee', 'Employee', true),
  ('auditor', 'Auditor', true),
  ('external_user', 'External user', true);

-- Seed: role -> permission grants, transcribed exactly from
-- product/permissions-matrix.md's role-permission matrix. scope = null
-- means "✓" (unscoped); scope = 'scoped' means "Scoped".
insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, v.scope
from (values
  ('organization_owner', 'organization.manage', null),
  ('organization_owner', 'organization.settings', null),
  ('organization_owner', 'billing.manage', null),
  ('organization_owner', 'member.invite', null),
  ('organization_owner', 'member.manage', null),
  ('organization_owner', 'role.manage', null),
  ('organization_owner', 'location.manage', null),
  ('organization_owner', 'department.manage', null),
  ('organization_owner', 'team.manage', null),
  ('organization_owner', 'knowledge.view', null),
  ('organization_owner', 'process.view', null),
  ('organization_owner', 'training.view', null),
  ('organization_owner', 'analytics.view', null),
  ('organization_owner', 'audit.view', null),
  ('organization_owner', 'audit.export', null),
  ('organization_owner', 'integration.manage', null),
  ('organization_owner', 'ai.use', null),
  ('organization_owner', 'ai.configure', null),

  ('organization_admin', 'organization.settings', null),
  ('organization_admin', 'member.invite', null),
  ('organization_admin', 'member.manage', null),
  ('organization_admin', 'role.manage', null),
  ('organization_admin', 'location.manage', null),
  ('organization_admin', 'department.manage', null),
  ('organization_admin', 'team.manage', null),
  ('organization_admin', 'knowledge.view', null),
  ('organization_admin', 'knowledge.create', null),
  ('organization_admin', 'knowledge.edit', null),
  ('organization_admin', 'knowledge.review', null),
  ('organization_admin', 'knowledge.publish', null),
  ('organization_admin', 'process.view', null),
  ('organization_admin', 'process.create', null),
  ('organization_admin', 'process.edit', null),
  ('organization_admin', 'process.review', null),
  ('organization_admin', 'workflow.start', null),
  ('organization_admin', 'workflow.assign', null),
  ('organization_admin', 'workflow.manage', null),
  ('organization_admin', 'exception.create', null),
  ('organization_admin', 'exception.manage', null),
  ('organization_admin', 'training.view', null),
  ('organization_admin', 'training.manage', null),
  ('organization_admin', 'analytics.view', null),
  ('organization_admin', 'audit.view', null),
  ('organization_admin', 'audit.export', null),
  ('organization_admin', 'integration.manage', null),
  ('organization_admin', 'ai.use', null),

  ('process_owner', 'knowledge.view', 'scoped'),
  ('process_owner', 'knowledge.create', 'scoped'),
  ('process_owner', 'knowledge.edit', 'scoped'),
  ('process_owner', 'knowledge.review', 'scoped'),
  ('process_owner', 'knowledge.publish', 'scoped'),
  ('process_owner', 'process.view', 'scoped'),
  ('process_owner', 'process.create', null),
  ('process_owner', 'process.edit', 'scoped'),
  ('process_owner', 'process.review', 'scoped'),
  ('process_owner', 'process.publish', 'scoped'),
  ('process_owner', 'workflow.start', 'scoped'),
  ('process_owner', 'workflow.assign', 'scoped'),
  ('process_owner', 'workflow.manage', 'scoped'),
  ('process_owner', 'evidence.review', 'scoped'),
  ('process_owner', 'approval.review', 'scoped'),
  ('process_owner', 'exception.create', 'scoped'),
  ('process_owner', 'exception.manage', 'scoped'),
  ('process_owner', 'analytics.view', 'scoped'),
  ('process_owner', 'ai.use', 'scoped'),

  ('manager', 'member.invite', 'scoped'),
  ('manager', 'member.manage', 'scoped'),
  ('manager', 'department.manage', 'scoped'),
  ('manager', 'team.manage', 'scoped'),
  ('manager', 'knowledge.view', 'scoped'),
  ('manager', 'process.view', 'scoped'),
  ('manager', 'workflow.start', 'scoped'),
  ('manager', 'workflow.assign', 'scoped'),
  ('manager', 'workflow.complete', 'scoped'),
  ('manager', 'workflow.manage', 'scoped'),
  ('manager', 'form.submit', 'scoped'),
  ('manager', 'evidence.upload', 'scoped'),
  ('manager', 'evidence.review', 'scoped'),
  ('manager', 'approval.review', 'scoped'),
  ('manager', 'exception.create', 'scoped'),
  ('manager', 'exception.manage', 'scoped'),
  ('manager', 'training.view', 'scoped'),
  ('manager', 'training.manage', 'scoped'),
  ('manager', 'analytics.view', 'scoped'),
  ('manager', 'audit.view', 'scoped'),
  ('manager', 'ai.use', 'scoped'),

  ('employee', 'knowledge.view', 'scoped'),
  ('employee', 'process.view', 'scoped'),
  ('employee', 'workflow.complete', null),
  ('employee', 'form.submit', null),
  ('employee', 'evidence.upload', null),
  ('employee', 'exception.create', null),
  ('employee', 'training.view', 'scoped'),

  ('auditor', 'knowledge.view', 'scoped'),
  ('auditor', 'process.view', 'scoped'),
  ('auditor', 'evidence.review', 'scoped'),
  ('auditor', 'training.view', 'scoped'),
  ('auditor', 'analytics.view', 'scoped'),
  ('auditor', 'audit.view', 'scoped'),
  ('auditor', 'audit.export', 'scoped'),

  ('external_user', 'workflow.complete', 'scoped'),
  ('external_user', 'form.submit', 'scoped'),
  ('external_user', 'evidence.upload', 'scoped'),
  ('external_user', 'approval.review', 'scoped')
) as v(role_key, permission_key, scope)
join roles r on r.key = v.role_key and r.organization_id is null
join permissions p on p.key = v.permission_key;

-- Real versions of current_org_id()/current_member_id()/
-- current_member_permissions(), replacing 20260719130001's bootstrap
-- versions now that organization_members/member_role_assignments/
-- role_permissions/permissions all exist. See that migration's header
-- comment for the full rationale. Every policy in this migration set —
-- including ones already created above and in 20260719130001 — calls
-- these functions by name, so they automatically pick up this stronger
-- behavior; nothing else needs to change.
--
-- SECURITY DEFINER: runs as this migration's owning role (bypassing
-- organization_members'/member_role_assignments' own RLS), which is
-- required to avoid infinite recursion — organization_members' own
-- SELECT policy calls current_org_id(), so current_org_id() cannot itself
-- run as the `authenticated` role and re-trigger that same policy.
-- `set search_path = public` pins name resolution regardless of the
-- caller's search_path, standard practice for SECURITY DEFINER functions.
create or replace function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select om.organization_id
  from organization_members om
  where om.id = claimed_member_id()
    and om.organization_id = claimed_org_id()
    and om.status = 'active'
  limit 1;
$$;

create or replace function current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select om.id
  from organization_members om
  where om.id = claimed_member_id()
    and om.organization_id = claimed_org_id()
    and om.status = 'active'
  limit 1;
$$;

-- Re-derives permissions from member_role_assignments/role_permissions on
-- every call, rather than trusting a claim — the claims object set by
-- withTenantContext() no longer even carries a permissions field (see
-- 20260719130001's header comment).
create or replace function current_member_permissions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct p.key), array[]::text[])
  from member_role_assignments mra
  join role_permissions rp on rp.role_id = mra.role_id
  join permissions p on p.id = rp.permission_id
  where mra.organization_member_id = current_member_id()
    and rp.scope is null;
$$;
