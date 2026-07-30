-- Phase 22 (Security hardening): scim_token_usage_log — closes a gap
-- Phase 21 left open. The public API (api_key_usage_log,
-- 20260804000001) and this SCIM resource are the only two token-bearer-
-- authenticated, cross-tenant-reachable API surfaces in this codebase;
-- api_key_usage_log already doubled as both an audit trail and a rate
-- limit counter (checkRateLimit() in api-keys.ts), but scim_tokens had
-- no equivalent when it shipped in Phase 21 — this migration brings
-- SCIM to parity with the same pattern, same reasoning (written
-- exclusively by the admin client, since the SCIM route runs outside
-- any single organization's authenticated-role transaction).
create table scim_token_usage_log (
  id uuid primary key default gen_random_uuid(),
  scim_token_id uuid not null references scim_tokens(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  method text not null,
  path text not null,
  status_code int not null,
  created_at timestamptz not null default now()
);

create index scim_token_usage_log_token_id_idx on scim_token_usage_log(scim_token_id, created_at desc);
create index scim_token_usage_log_organization_id_idx on scim_token_usage_log(organization_id);

alter table scim_token_usage_log enable row level security;

create policy scim_token_usage_log_select on scim_token_usage_log
  for select
  using (organization_id = current_org_id() and has_permission('integration.manage'));

revoke all on scim_token_usage_log from anon, public, authenticated;
grant select on scim_token_usage_log to authenticated;
