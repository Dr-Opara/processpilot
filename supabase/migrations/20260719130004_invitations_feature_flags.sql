-- organization_invitations, feature_flags.

create table organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  clerk_invitation_id text unique,
  email text not null,
  role_id uuid references roles(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz
);

create trigger organization_invitations_set_updated_at
  before update on organization_invitations
  for each row
  execute function set_updated_at();

create index organization_invitations_organization_id_idx on organization_invitations(organization_id);
create unique index organization_invitations_pending_email_idx
  on organization_invitations(organization_id, lower(email))
  where status = 'pending';

alter table organization_invitations enable row level security;

create policy organization_invitations_select on organization_invitations
  for select
  using (organization_id = current_org_id() and has_permission('member.invite'));

create policy organization_invitations_insert on organization_invitations
  for insert
  with check (organization_id = current_org_id() and has_permission('member.invite'));

create policy organization_invitations_update on organization_invitations
  for update
  using (organization_id = current_org_id() and has_permission('member.invite'))
  with check (organization_id = current_org_id() and has_permission('member.invite'));

revoke all on organization_invitations from anon, public, authenticated;
grant select, insert, update on organization_invitations to authenticated;

-- feature_flags: per-organization overrides. Build-wide flags (e.g.
-- NEXT_PUBLIC_ENABLE_DESIGN_SYSTEM) stay env-var-driven per
-- docs/development/environment-variables.md — this table is only for
-- flags that vary per tenant at runtime.
create table feature_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  key text not null,
  enabled boolean not null default false,
  value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  unique (organization_id, key)
);

create trigger feature_flags_set_updated_at
  before update on feature_flags
  for each row
  execute function set_updated_at();

-- No separate index on organization_id alone: the `unique
-- (organization_id, key)` constraint above already provides one via its
-- leading column.

alter table feature_flags enable row level security;

create policy feature_flags_select on feature_flags
  for select
  using (organization_id = current_org_id());

create policy feature_flags_insert on feature_flags
  for insert
  with check (organization_id = current_org_id() and has_permission('organization.settings'));

create policy feature_flags_update on feature_flags
  for update
  using (organization_id = current_org_id() and has_permission('organization.settings'))
  with check (organization_id = current_org_id() and has_permission('organization.settings'));

revoke all on feature_flags from anon, public, authenticated;
grant select, insert, update on feature_flags to authenticated;
