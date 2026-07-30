-- Phase 27 (Internal support and platform administration): a
-- cross-tenant, platform-level admin surface, deliberately built as a
-- SEPARATE trust boundary from every tenant's own role/permission
-- system — platform-admin status is never grantable through an
-- organization's roles (see src/lib/platform-admin.ts: it's an
-- allowlist read from PLATFORM_ADMIN_EMAILS, an environment variable,
-- not a database-stored grant any tenant admin could manipulate).
--
-- These tables therefore have NO organization_id-scoped RLS policy in
-- the usual sense — they're intentionally readable/writable only by
-- the admin client (src/lib/db/client-admin.ts), the same "trusted
-- system code, not a tenant-scoped transaction" pattern background job
-- handlers already use, since a platform-admin action is by definition
-- not scoped to any one caller's organization_id. Every write is
-- audited via platform_admin_audit_log, itself select-only for the
-- authenticated role (written exclusively by the admin client).

create table platform_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references profiles(id),
  action text not null,
  target_organization_id uuid references organizations(id),
  target_profile_id uuid references profiles(id),
  reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index platform_admin_audit_log_actor_idx on platform_admin_audit_log(actor_profile_id);
create index platform_admin_audit_log_target_org_idx on platform_admin_audit_log(target_organization_id)
  where target_organization_id is not null;
create index platform_admin_audit_log_created_at_idx on platform_admin_audit_log(created_at desc);

alter table platform_admin_audit_log enable row level security;

-- No policy grants the `authenticated` role any access at all — this
-- log is readable only through the admin client, from
-- src/app/app/(platform-admin)/* routes that have already verified
-- isPlatformAdmin() server-side. Explicit revoke, matching every other
-- admin-client-only table's convention in this codebase.
revoke all on platform_admin_audit_log from anon, public, authenticated;

create table platform_suspensions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  suspended_by uuid not null references profiles(id),
  suspended_at timestamptz not null default now(),
  reason text not null,
  reactivated_by uuid references profiles(id),
  reactivated_at timestamptz
);

create index platform_suspensions_organization_id_idx on platform_suspensions(organization_id);
-- Only one active (not-yet-reactivated) suspension per organization.
create unique index platform_suspensions_active_idx
  on platform_suspensions(organization_id)
  where reactivated_at is null;

alter table platform_suspensions enable row level security;

-- No table-level privilege is granted to `authenticated` at all (see
-- the revoke below), so this policy is never actually reachable by a
-- normal session — it exists so schema-coverage.test.ts's "every
-- tenant-owned (organization_id) table has at least one RLS policy"
-- check has something real to find, documenting the intent (always
-- deny) rather than relying on the missing grant alone.
create policy platform_suspensions_deny_all on platform_suspensions
  for select
  using (false);

revoke all on platform_suspensions from anon, public, authenticated;

create table platform_support_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  author_profile_id uuid not null references profiles(id),
  note text not null,
  created_at timestamptz not null default now()
);

create index platform_support_notes_organization_id_idx on platform_support_notes(organization_id);

alter table platform_support_notes enable row level security;

create policy platform_support_notes_deny_all on platform_support_notes
  for select
  using (false);

revoke all on platform_support_notes from anon, public, authenticated;
