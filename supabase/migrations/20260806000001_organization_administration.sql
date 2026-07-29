-- Phase 21 (Advanced organization administration):
-- 1. Security fix: role_permissions had no self-escalation check, unlike
--    its sibling member_role_assignments (20260719130002) — an
--    organization_admin (role.manage, unscoped) could define a *custom*
--    role granting a permission they don't themselves hold (e.g.
--    billing.manage) and then assign it to themselves via the
--    already-guarded member_role_assignments_insert policy... except that
--    policy only checks the *assignment*, not the role's own definition,
--    so a two-step "define, then assign" path bypassed rule 5
--    (product/permissions-matrix.md, "Custom roles can only grant
--    permissions the granting admin's own role already holds"). Fixed by
--    requiring the caller to already hold each permission being attached
--    to a role, unscoped, before role_permissions will let them attach it
--    to *any* role (their own custom role or another's) — mirrors
--    member_role_assignments_insert's existing check exactly.
-- 2. role_templates: a read-only, system-seeded catalog of common custom
--    role starting points ("clone from template" in the admin UI) —
--    organization_id null, same is_system convention as `roles`.
-- 3. approved_domains: organization-controlled email-domain allowlist with
--    real DNS TXT record verification (no external provider needed —
--    Node's own resolver is the "vendor" here, unlike SSO/OAuth
--    integrations which do need one).
-- 4. team_role_assignments: group-based access management — a role
--    attached to a team, fanned out to the team's current members by the
--    application layer (src/lib/services/team-role-assignments.ts). Not a
--    live trigger on team_members changes in this phase (see that
--    module's header comment for the known gap this leaves).
-- 5. organization_deletion_requests: a cancellable, grace-period offboarding
--    workflow. The sweep job that finalizes a request is env-flag gated
--    (ORGANIZATION_DELETION_ENABLED) and defaults off in every
--    environment without it explicitly set — see
--    docs/architecture/organization-administration.md.
-- 6. scim_tokens: SCIM-ready provisioning scaffolding. Same
--    hash-only-storage pattern as api_keys (20260804000001) — a real,
--    working minimal SCIM 2.0 Users resource, never validated against a
--    real identity provider (see that doc's known gaps).

-- (1) role_permissions self-escalation fix.
drop policy role_permissions_insert on role_permissions;
create policy role_permissions_insert on role_permissions
  for insert
  with check (
    exists (
      select 1 from roles r
      where r.id = role_permissions.role_id
        and r.organization_id = current_org_id()
        and has_permission('role.manage')
    )
    and exists (
      select 1 from permissions p
      where p.id = role_permissions.permission_id
        and p.key = any(current_member_permissions())
    )
  );

-- (2) role_templates.
create table role_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table role_template_permissions (
  role_template_id uuid not null references role_templates(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  scope text check (scope in ('scoped')),
  primary key (role_template_id, permission_id)
);

alter table role_templates enable row level security;
alter table role_template_permissions enable row level security;

create policy role_templates_select on role_templates for select using (true);
create policy role_template_permissions_select on role_template_permissions for select using (true);

revoke all on role_templates from anon, public, authenticated;
revoke all on role_template_permissions from anon, public, authenticated;
grant select on role_templates to authenticated;
grant select on role_template_permissions to authenticated;

insert into role_templates (key, name, description) values
  ('department_admin', 'Department admin', 'Scoped member, department, and team management for one department, without organization-wide settings access.'),
  ('read_only_auditor', 'Read-only auditor', 'View-only access to processes, knowledge, training, analytics, and audit history — no edit or manage permissions.'),
  ('billing_manager', 'Billing manager', 'Manage billing and view organization settings, without member or role management access.');

insert into role_template_permissions (role_template_id, permission_id, scope)
select rt.id, p.id, v.scope
from (values
  ('department_admin', 'member.manage', 'scoped'),
  ('department_admin', 'department.manage', 'scoped'),
  ('department_admin', 'team.manage', 'scoped'),
  ('department_admin', 'knowledge.view', 'scoped'),
  ('department_admin', 'process.view', 'scoped'),
  ('department_admin', 'training.view', 'scoped'),
  ('department_admin', 'analytics.view', 'scoped'),

  ('read_only_auditor', 'knowledge.view', 'scoped'),
  ('read_only_auditor', 'process.view', 'scoped'),
  ('read_only_auditor', 'training.view', 'scoped'),
  ('read_only_auditor', 'analytics.view', 'scoped'),
  ('read_only_auditor', 'audit.view', 'scoped'),

  ('billing_manager', 'billing.manage', null),
  ('billing_manager', 'organization.settings', null)
) as v(template_key, permission_key, scope)
join role_templates rt on rt.key = v.template_key
join permissions p on p.key = v.permission_key;

-- (3) approved_domains.
create table approved_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  domain text not null,
  verification_token text not null,
  verified_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create unique index approved_domains_org_domain_idx on approved_domains(organization_id, domain);
create index approved_domains_organization_id_idx on approved_domains(organization_id);

alter table approved_domains enable row level security;

create policy approved_domains_select on approved_domains
  for select
  using (organization_id = current_org_id() and has_permission('organization.settings'));
create policy approved_domains_insert on approved_domains
  for insert
  with check (organization_id = current_org_id() and has_permission('organization.settings'));
create policy approved_domains_update on approved_domains
  for update
  using (organization_id = current_org_id() and has_permission('organization.settings'))
  with check (organization_id = current_org_id() and has_permission('organization.settings'));
create policy approved_domains_delete on approved_domains
  for delete
  using (organization_id = current_org_id() and has_permission('organization.settings'));

revoke all on approved_domains from anon, public, authenticated;
grant select, insert, update, delete on approved_domains to authenticated;

-- (4) team_role_assignments.
create table team_role_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  role_id uuid not null references roles(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (team_id, role_id)
);

create index team_role_assignments_organization_id_idx on team_role_assignments(organization_id);
create index team_role_assignments_team_id_idx on team_role_assignments(team_id);

alter table team_role_assignments enable row level security;

-- Same self-escalation bound as member_role_assignments_insert: a caller
-- can only attach a role to a team if they already hold every permission
-- that role grants.
create policy team_role_assignments_select on team_role_assignments
  for select
  using (organization_id = current_org_id());

create policy team_role_assignments_insert on team_role_assignments
  for insert
  with check (
    organization_id = current_org_id()
    and has_permission('role.manage')
    and not exists (
      select 1
      from role_permissions rp
      join permissions p on p.id = rp.permission_id
      where rp.role_id = team_role_assignments.role_id
        and not (p.key = any(current_member_permissions()))
    )
  );

create policy team_role_assignments_delete on team_role_assignments
  for delete
  using (organization_id = current_org_id() and has_permission('role.manage'));

revoke all on team_role_assignments from anon, public, authenticated;
grant select, insert, delete on team_role_assignments to authenticated;

-- (5) organization_deletion_requests.
create table organization_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  requested_by uuid not null references profiles(id),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'cancelled', 'completed')),
  scheduled_delete_at timestamptz not null,
  cancelled_by uuid references profiles(id),
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index organization_deletion_requests_organization_id_idx on organization_deletion_requests(organization_id);
-- Only one live (pending) deletion request per organization at a time.
create unique index organization_deletion_requests_pending_idx
  on organization_deletion_requests(organization_id)
  where status = 'pending';

alter table organization_deletion_requests enable row level security;

create policy organization_deletion_requests_select on organization_deletion_requests
  for select
  using (organization_id = current_org_id() and has_permission('organization.manage'));
create policy organization_deletion_requests_insert on organization_deletion_requests
  for insert
  with check (organization_id = current_org_id() and has_permission('organization.manage'));
create policy organization_deletion_requests_update on organization_deletion_requests
  for update
  using (organization_id = current_org_id() and has_permission('organization.manage'))
  with check (organization_id = current_org_id() and has_permission('organization.manage'));

revoke all on organization_deletion_requests from anon, public, authenticated;
grant select, insert, update on organization_deletion_requests to authenticated;

-- (6) scim_tokens — same shape/posture as api_keys (20260804000001).
create table scim_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  token_prefix text not null,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  last_used_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index scim_tokens_organization_id_idx on scim_tokens(organization_id);
create index scim_tokens_token_hash_idx on scim_tokens(token_hash) where status = 'active';

alter table scim_tokens enable row level security;

create policy scim_tokens_select on scim_tokens
  for select
  using (organization_id = current_org_id() and has_permission('integration.manage'));
create policy scim_tokens_insert on scim_tokens
  for insert
  with check (organization_id = current_org_id() and has_permission('integration.manage'));
create policy scim_tokens_update on scim_tokens
  for update
  using (organization_id = current_org_id() and has_permission('integration.manage'))
  with check (organization_id = current_org_id() and has_permission('integration.manage'));

revoke all on scim_tokens from anon, public, authenticated;
grant select, insert, update on scim_tokens to authenticated;
