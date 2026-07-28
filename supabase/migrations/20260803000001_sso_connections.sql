-- Phase 18 (Integrations): SSO/SAML — the initial concrete integration
-- target. Deliberately holds no IdP secret material (certificate,
-- client secret, metadata) — Clerk's Enterprise Connections API
-- (@clerk/backend's clerkClient.enterpriseConnections) is both the
-- SAML/OIDC implementation and the credential store, per ADR-0003's
-- decision to delegate identity entirely to Clerk. Storing a second
-- copy of that material here would be a redundant, weaker-security
-- duplicate, not a improvement — see
-- docs/architecture/integration-architecture.md. This table is purely
-- a local index/label for ProcessPilot's own admin UI and audit trail:
-- "which Clerk enterprise connection did this organization register."

create table sso_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  clerk_connection_id text not null unique,
  name text not null,
  -- Mirrors Clerk's provider identifiers ('saml_custom', 'oidc_custom',
  -- 'saml_google', 'saml_microsoft', 'saml_okta') — free text, not a
  -- check constraint, so a new Clerk-supported provider never needs a
  -- migration here.
  provider text not null,
  domain text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

create unique index sso_connections_org_domain_idx on sso_connections(organization_id, domain);
create index sso_connections_organization_id_idx on sso_connections(organization_id);

create trigger sso_connections_set_updated_at
  before update on sso_connections
  for each row execute function set_updated_at();

alter table sso_connections enable row level security;

-- integration.manage (organization_owner/organization_admin, unscoped)
-- is the only permission that can view or change SSO configuration —
-- product/permissions-matrix.md.
create policy sso_connections_select on sso_connections
  for select
  using (organization_id = current_org_id() and has_permission('integration.manage'));

create policy sso_connections_insert on sso_connections
  for insert
  with check (organization_id = current_org_id() and has_permission('integration.manage'));

create policy sso_connections_update on sso_connections
  for update
  using (organization_id = current_org_id() and has_permission('integration.manage'))
  with check (organization_id = current_org_id() and has_permission('integration.manage'));

create policy sso_connections_delete on sso_connections
  for delete
  using (organization_id = current_org_id() and has_permission('integration.manage'));

revoke all on sso_connections from anon, public, authenticated;
grant select, insert, update, delete on sso_connections to authenticated;
