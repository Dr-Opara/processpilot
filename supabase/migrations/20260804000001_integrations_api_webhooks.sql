-- Phase 18 continuation (Integrations, public API, and webhooks):
-- organization-scoped third-party connections, a versioned public API
-- gated by API keys, outbound webhook delivery (reusing the existing
-- background-job worker for retry/backoff/dead-letter — see ADR-0009 —
-- rather than reinventing it), and an inbound-webhook idempotency
-- table generalized across providers. See
-- docs/architecture/integration-architecture.md and
-- docs/architecture/public-api.md.

-- integration_connections: one row per organization-provider pair.
-- Credentials (OAuth tokens or an API key the provider issued to us)
-- are stored as an application-layer-encrypted blob (AES-256-GCM, see
-- src/lib/crypto/secret-box.ts) — the database itself never sees
-- plaintext, and INTEGRATION_ENCRYPTION_KEY lives only in server
-- environment variables, never committed. No RLS select policy ever
-- exposes encrypted_credentials to the authenticated role from a
-- client-readable column list; the service layer explicitly selects
-- the columns it returns to a page instead of `select *` wherever
-- credentials are involved.
create table integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider text not null,
  status text not null default 'disconnected'
    check (status in ('connected', 'disconnected', 'degraded', 'error')),
  auth_type text not null check (auth_type in ('oauth2', 'api_key')),
  -- AES-256-GCM ciphertext (base64: iv || authTag || ciphertext) of a
  -- JSON blob (access_token, refresh_token, expires_at, or api_key) —
  -- never plaintext, never returned by any select this app performs
  -- against the authenticated role.
  encrypted_credentials text,
  scopes text[] not null default '{}',
  external_account_label text,
  last_verified_at timestamptz,
  last_error text,
  connected_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index integration_connections_org_provider_idx
  on integration_connections(organization_id, provider);
create index integration_connections_organization_id_idx on integration_connections(organization_id);

create trigger integration_connections_set_updated_at
  before update on integration_connections
  for each row execute function set_updated_at();

alter table integration_connections enable row level security;

create policy integration_connections_select on integration_connections
  for select
  using (organization_id = current_org_id() and has_permission('integration.manage'));
create policy integration_connections_insert on integration_connections
  for insert
  with check (organization_id = current_org_id() and has_permission('integration.manage'));
create policy integration_connections_update on integration_connections
  for update
  using (organization_id = current_org_id() and has_permission('integration.manage'))
  with check (organization_id = current_org_id() and has_permission('integration.manage'));
create policy integration_connections_delete on integration_connections
  for delete
  using (organization_id = current_org_id() and has_permission('integration.manage'));

revoke all on integration_connections from anon, public, authenticated;
grant select, insert, update, delete on integration_connections to authenticated;

-- api_keys: the public API's auth credential. Only key_hash (sha256)
-- is stored — the raw key is shown to the admin exactly once, at
-- creation, and is unrecoverable afterward, same posture password
-- storage uses industry-wide. key_prefix (first 8 chars of the raw
-- key) is stored in the clear purely so a UI can show "pp_live_a1b2..."
-- for identification without ever re-displaying the full key.
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index api_keys_organization_id_idx on api_keys(organization_id);
create index api_keys_key_hash_idx on api_keys(key_hash) where status = 'active';

alter table api_keys enable row level security;

create policy api_keys_select on api_keys
  for select
  using (organization_id = current_org_id() and has_permission('integration.manage'));
create policy api_keys_insert on api_keys
  for insert
  with check (organization_id = current_org_id() and has_permission('integration.manage'));
create policy api_keys_update on api_keys
  for update
  using (organization_id = current_org_id() and has_permission('integration.manage'))
  with check (organization_id = current_org_id() and has_permission('integration.manage'));

revoke all on api_keys from anon, public, authenticated;
grant select, insert, update on api_keys to authenticated;

-- api_key_usage_log: one row per public-API request — the "API usage
-- logs" deliverable. Deliberately no request/response body captured
-- (only method/path/status), consistent with never persisting
-- resource payloads outside the tables that already own them, and
-- written exclusively by the admin client (the API route handler runs
-- outside any single organization's authenticated-role transaction,
-- same reasoning as every other admin-client-only write path).
create table api_key_usage_log (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references api_keys(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  method text not null,
  path text not null,
  status_code int not null,
  created_at timestamptz not null default now()
);

create index api_key_usage_log_api_key_id_idx on api_key_usage_log(api_key_id, created_at desc);
create index api_key_usage_log_organization_id_idx on api_key_usage_log(organization_id);

alter table api_key_usage_log enable row level security;

create policy api_key_usage_log_select on api_key_usage_log
  for select
  using (organization_id = current_org_id() and has_permission('integration.manage'));

revoke all on api_key_usage_log from anon, public, authenticated;
grant select on api_key_usage_log to authenticated;

-- webhook_subscriptions: an organization-configured outbound webhook
-- endpoint. `secret` signs every delivery (HMAC-SHA256, see
-- src/lib/webhooks/signing.ts) — stored application-layer-encrypted,
-- same as integration_connections' credentials.
create table webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  target_url text not null,
  event_types text[] not null,
  encrypted_secret text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index webhook_subscriptions_organization_id_idx on webhook_subscriptions(organization_id);

create trigger webhook_subscriptions_set_updated_at
  before update on webhook_subscriptions
  for each row execute function set_updated_at();

alter table webhook_subscriptions enable row level security;

create policy webhook_subscriptions_select on webhook_subscriptions
  for select
  using (organization_id = current_org_id() and has_permission('integration.manage'));
create policy webhook_subscriptions_insert on webhook_subscriptions
  for insert
  with check (organization_id = current_org_id() and has_permission('integration.manage'));
create policy webhook_subscriptions_update on webhook_subscriptions
  for update
  using (organization_id = current_org_id() and has_permission('integration.manage'))
  with check (organization_id = current_org_id() and has_permission('integration.manage'));
create policy webhook_subscriptions_delete on webhook_subscriptions
  for delete
  using (organization_id = current_org_id() and has_permission('integration.manage'));

revoke all on webhook_subscriptions from anon, public, authenticated;
grant select, insert, update, delete on webhook_subscriptions to authenticated;

-- webhook_deliveries: one row per (subscription, event) delivery
-- attempt series. Actual retry/backoff/dead-lettering is the existing
-- background_jobs worker's job (src/lib/jobs/worker.ts) — this table
-- tracks outcome/history for the admin UI's delivery log and replay
-- action, it does not reimplement scheduling.
create table webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references webhook_subscriptions(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'delivered', 'failed', 'dead_letter')),
  attempt_count int not null default 0,
  last_attempt_at timestamptz,
  last_response_status int,
  last_error text,
  created_at timestamptz not null default now()
);

create index webhook_deliveries_subscription_id_idx on webhook_deliveries(subscription_id, created_at desc);
create index webhook_deliveries_organization_id_idx on webhook_deliveries(organization_id);

alter table webhook_deliveries enable row level security;

create policy webhook_deliveries_select on webhook_deliveries
  for select
  using (organization_id = current_org_id() and has_permission('integration.manage'));

revoke all on webhook_deliveries from anon, public, authenticated;
grant select on webhook_deliveries to authenticated;

-- inbound_webhook_events: idempotency + audit trail for events
-- *received* from a third-party provider (e.g. a Slack event
-- callback), generalized across providers — the same partial-unique-
-- on-processed shape as webhook_events (Clerk) and
-- billing_webhook_events (Stripe), parameterized by provider this
-- time instead of a dedicated table per integration.
create table inbound_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  organization_id uuid references organizations(id),
  event_type text,
  status text not null default 'processed' check (status in ('processed', 'ignored', 'failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

create unique index inbound_webhook_events_processed_idx
  on inbound_webhook_events(provider, external_event_id)
  where status = 'processed';
create index inbound_webhook_events_provider_event_idx on inbound_webhook_events(provider, external_event_id);
create index inbound_webhook_events_organization_id_idx
  on inbound_webhook_events(organization_id)
  where organization_id is not null;

alter table inbound_webhook_events enable row level security;

create policy inbound_webhook_events_select on inbound_webhook_events
  for select
  using (organization_id = current_org_id() and has_permission('integration.manage'));

revoke all on inbound_webhook_events from anon, public, authenticated;
grant select on inbound_webhook_events to authenticated;
