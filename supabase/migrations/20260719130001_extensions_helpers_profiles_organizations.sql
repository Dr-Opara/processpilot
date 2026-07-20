-- Extensions, shared trigger/claims helpers, and the two root tables
-- (profiles, organizations) plus organization_settings.
--
-- RLS/session-context model (see docs/architecture/multi-tenancy.md and
-- docs/architecture/clerk-supabase-identity-sync.md): trusted server code
-- verifies the caller via Clerk, resolves which organization_members row
-- they are, then opens a transaction that sets the standard Supabase
-- `request.jwt.claims` GUC for that transaction only (SET LOCAL — safe
-- under PgBouncer/Supavisor transaction pooling). RLS policies read that
-- GUC through the helper functions below. No table query is ever run
-- outside that wrapper for request-scoped (non-admin) access.
--
-- Claims shape set by src/lib/db/tenant-context.ts's withTenantContext():
--   { "sub": "<clerk_user_id>", "org_id": "<organizations.id>", "member_id": "<organization_members.id>" }
--
-- Deliberately minimal — no status or permissions claim. current_org_id()/
-- current_member_id()/current_member_permissions() are *redefined* in
-- 20260719130002 (once organization_members/role_permissions exist) to
-- independently re-verify the claimed member_id against a real, currently
-- `active` organization_members row and re-derive permissions from
-- member_role_assignments — never trusting a claim's own assertion of
-- status or permissions. This is deliberate defense-in-depth per
-- multi-tenancy.md principle 7 and permissions-matrix.md enforcement rule
-- 3: even a bug that puts a stale or fabricated claim in front of RLS
-- (wrong member_id, membership since suspended/removed, permissions
-- claim that drifted from reality) still yields zero access, because RLS
-- re-derives the truth from the tables themselves rather than trusting
-- the claim. (CREATE OR REPLACE changes a function's body in place —
-- every policy defined in this migration that calls current_org_id()
-- automatically picks up the stronger version once 20260719130002 runs,
-- with no policy needing to change.)
--
-- IMPORTANT — scoped vs. unscoped permissions: current_member_permissions()
-- (defined in 20260719130002) returns only the caller's *unscoped* ("✓")
-- grants from product/permissions-matrix.md, never "Scoped" ones. Scoped
-- grants (e.g. a manager's department.manage) require narrowing to the
-- specific department/location/team/resource the member manages — the
-- scope-assignment data model for that doesn't exist until Phase 5
-- (Business onboarding and employee management). Until then,
-- has_permission() deliberately under-grants (a manager gets no RLS-layer
-- department.manage write access at all, rather than incorrectly
-- organization-wide access) — see
-- docs/architecture/authentication-and-authorization.md's "known
-- limitations" note. This is intentional, not an oversight.

create extension if not exists pgcrypto;

-- Shared updated_at trigger, applied to every table below that has the
-- column, so "last modified" is never hand-maintained by callers.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function current_claims()
returns json
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::json;
$$;

create or replace function current_clerk_user_id()
returns text
language sql
stable
as $$
  select current_claims()->>'sub';
$$;

create or replace function claimed_member_id()
returns uuid
language sql
stable
as $$
  select nullif(current_claims()->>'member_id', '')::uuid;
$$;

create or replace function claimed_org_id()
returns uuid
language sql
stable
as $$
  select nullif(current_claims()->>'org_id', '')::uuid;
$$;

-- Bootstrap versions only — sufficient for this migration's own tables
-- (profiles, organizations, organization_settings), which exist before
-- organization_members does. Redefined for real in 20260719130002; see
-- this file's header comment for why.
create or replace function current_org_id()
returns uuid
language sql
stable
as $$
  select claimed_org_id();
$$;

create or replace function current_member_id()
returns uuid
language sql
stable
as $$
  select claimed_member_id();
$$;

-- Bootstrap version only — always empty, since nothing in this migration
-- has permissions to derive yet (member_role_assignments/role_permissions
-- don't exist until 20260719130002, which redefines this for real).
create or replace function current_member_permissions()
returns text[]
language sql
stable
as $$
  select array[]::text[];
$$;

create or replace function has_permission(permission text)
returns boolean
language sql
stable
as $$
  select permission = any(current_member_permissions());
$$;

-- profiles: one row per Clerk user, independent of any single
-- organization (a person can belong to multiple orgs via
-- organization_members). Never deleted on Clerk's user.deleted event —
-- marked deleted_at so authorship/audit references stay valid, per
-- docs/architecture/data-ownership.md.
create table profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  email text not null,
  first_name text,
  last_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row
  execute function set_updated_at();

alter table profiles enable row level security;

-- A profile is always visible to itself. A second policy, added in
-- 20260719130002 once organization_members exists, additionally exposes
-- fellow org members' profiles (needed for people directories, assignment
-- pickers) — Postgres OR's multiple permissive policies for the same
-- command together, so this policy doesn't need to change when that one
-- is added.
create policy profiles_select_self on profiles
  for select
  using (clerk_user_id = current_clerk_user_id());

revoke all on profiles from anon, public, authenticated;
grant select on profiles to authenticated;

-- organizations: the tenant root. clerk_org_id is the Clerk identity;
-- id is the internal identity everything else references.
create table organizations (
  id uuid primary key default gen_random_uuid(),
  clerk_org_id text not null unique,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  archived_at timestamptz
);

create trigger organizations_set_updated_at
  before update on organizations
  for each row
  execute function set_updated_at();

-- No separate index on clerk_org_id: its `unique` constraint above
-- already creates one.

alter table organizations enable row level security;

-- A request is always scoped to exactly one active organization (Clerk's
-- "active organization" concept) — current_org_id() already encodes that,
-- so this is a single-row-or-nothing policy, not a general membership
-- list.
create policy organizations_select on organizations
  for select
  using (id = current_org_id());

create policy organizations_update on organizations
  for update
  using (id = current_org_id() and has_permission('organization.settings'))
  with check (id = current_org_id() and has_permission('organization.settings'));

revoke all on organizations from anon, public, authenticated;
grant select, update on organizations to authenticated;

-- organization_settings: 1:1 extension of organizations for
-- infrequently-read configuration, kept separate so the hot
-- organizations row stays small. settings is an extensible jsonb bag so
-- new toggles don't require a migration each time.
create table organization_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id) on delete cascade,
  timezone text not null default 'UTC',
  locale text not null default 'en-US',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

create trigger organization_settings_set_updated_at
  before update on organization_settings
  for each row
  execute function set_updated_at();

-- No separate index on organization_id: its `unique` constraint above
-- already creates one.

alter table organization_settings enable row level security;

create policy organization_settings_select on organization_settings
  for select
  using (organization_id = current_org_id());

create policy organization_settings_insert on organization_settings
  for insert
  with check (organization_id = current_org_id() and has_permission('organization.settings'));

create policy organization_settings_update on organization_settings
  for update
  using (organization_id = current_org_id() and has_permission('organization.settings'))
  with check (organization_id = current_org_id() and has_permission('organization.settings'));

revoke all on organization_settings from anon, public, authenticated;
grant select, insert, update on organization_settings to authenticated;
