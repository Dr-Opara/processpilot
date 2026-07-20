-- audit_events (append-only), webhook_events, idempotency_keys.

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_profile_id uuid references profiles(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  correlation_id text,
  source text not null default 'app' check (source in ('app', 'webhook', 'system')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_organization_id_idx on audit_events(organization_id);
create index audit_events_organization_created_idx on audit_events(organization_id, created_at desc);
create index audit_events_resource_idx on audit_events(resource_type, resource_id) where resource_id is not null;
create index audit_events_correlation_idx on audit_events(correlation_id) where correlation_id is not null;

alter table audit_events enable row level security;

create policy audit_events_select on audit_events
  for select
  using (organization_id = current_org_id() and has_permission('audit.view'));

-- Insert-only, no permission gate beyond org scoping: recordAuditEvent()
-- (src/lib/db/audit.ts) is only ever called by trusted server code
-- immediately after the primary action it's recording has already been
-- permission-checked, inside the same transaction (withTenantContext) —
-- so the audit row commits or rolls back atomically with the action it
-- describes. There is deliberately no update or delete grant/policy at
-- all: this table is append-only by omission, not just convention, per
-- docs/architecture/data-ownership.md.
create policy audit_events_insert on audit_events
  for insert
  with check (organization_id = current_org_id());

revoke all on audit_events from anon, public, authenticated;
grant select, insert on audit_events to authenticated;

-- webhook_events: internal processing log, written exclusively by the
-- service-role admin client (Clerk webhook requests are authenticated by
-- Standard Webhooks signature, not a Clerk session, so they never carry
-- tenant claims to open an authenticated-role transaction with). RLS is
-- still enabled with a narrow read policy — mirroring audit_events — so
-- an org's own admins can see their org's webhook processing history for
-- support/debugging; there is no write policy for the authenticated role
-- at all.
-- clerk_event_id is deliberately NOT a plain unique column: a failed
-- attempt still gets its own row (useful history, and "record failures"
-- is an explicit requirement), and a *different* row for the same event
-- id representing a later, successful retry must still be insertable.
-- Only one 'processed' row per clerk_event_id is ever allowed — that's
-- the actual idempotency guarantee, enforced by the partial unique index
-- below, not a plain column-level unique constraint.
create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  clerk_event_id text not null,
  event_type text not null,
  status text not null default 'processed' check (status in ('processed', 'rejected', 'failed')),
  organization_id uuid references organizations(id),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

create unique index webhook_events_processed_idx
  on webhook_events(clerk_event_id)
  where status = 'processed';
create index webhook_events_clerk_event_id_idx on webhook_events(clerk_event_id);
create index webhook_events_organization_id_idx on webhook_events(organization_id) where organization_id is not null;
create index webhook_events_received_idx on webhook_events(received_at desc);

alter table webhook_events enable row level security;

create policy webhook_events_select on webhook_events
  for select
  using (organization_id = current_org_id() and has_permission('audit.view'));

revoke all on webhook_events from anon, public, authenticated;
grant select on webhook_events to authenticated;

-- idempotency_keys: general-purpose idempotent-operation guard (e.g.
-- Phase 8's task-completion idempotency), distinct from
-- webhook_events.clerk_event_id, which is the actual dedupe key for
-- webhook processing specifically. organization_id is nullable because
-- some idempotent operations (webhook receipt itself) precede resolving
-- an organization.
create table idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  scope text not null,
  key text not null,
  response_snapshot jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (scope, key)
);

create index idempotency_keys_organization_id_idx on idempotency_keys(organization_id) where organization_id is not null;
create index idempotency_keys_expires_idx on idempotency_keys(expires_at) where expires_at is not null;

alter table idempotency_keys enable row level security;

create policy idempotency_keys_select on idempotency_keys
  for select
  using (organization_id is null or organization_id = current_org_id());

create policy idempotency_keys_insert on idempotency_keys
  for insert
  with check (organization_id is null or organization_id = current_org_id());

create policy idempotency_keys_update on idempotency_keys
  for update
  using (organization_id is null or organization_id = current_org_id())
  with check (organization_id is null or organization_id = current_org_id());

revoke all on idempotency_keys from anon, public, authenticated;
grant select, insert, update on idempotency_keys to authenticated;
