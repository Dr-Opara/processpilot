-- Phase 5: CSV employee-import history. Two tables — one row per import
-- attempt (member_import_batches) and one row per source CSV row within
-- that attempt (member_import_rows) — so "preserve import history",
-- "partial success", and "download error report" all have somewhere real
-- to read from instead of being computed transiently and discarded.
-- Gated on member.invite (importing creates invitations), same
-- permission the single/multi-invite flow uses.

create table member_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  status text not null default 'processing' check (
    status in ('processing', 'completed', 'failed', 'partially_failed')
  ),
  total_rows integer not null default 0,
  succeeded_rows integer not null default 0,
  failed_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  original_filename text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references profiles(id)
);

create index member_import_batches_organization_id_idx on member_import_batches(organization_id);

alter table member_import_batches enable row level security;

create policy member_import_batches_select on member_import_batches
  for select
  using (organization_id = current_org_id() and has_permission('member.invite'));

create policy member_import_batches_insert on member_import_batches
  for insert
  with check (organization_id = current_org_id() and has_permission('member.invite'));

create policy member_import_batches_update on member_import_batches
  for update
  using (organization_id = current_org_id() and has_permission('member.invite'))
  with check (organization_id = current_org_id() and has_permission('member.invite'));

revoke all on member_import_batches from anon, public, authenticated;
grant select, insert, update on member_import_batches to authenticated;

create table member_import_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  batch_id uuid not null references member_import_batches(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null,
  status text not null default 'pending' check (
    status in ('pending', 'succeeded', 'failed', 'duplicate_skipped')
  ),
  error_message text,
  invitation_id uuid references organization_invitations(id),
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create index member_import_rows_organization_id_idx on member_import_rows(organization_id);
-- No separate index on batch_id alone: the `unique (batch_id, row_number)`
-- constraint above already provides one via its leading column.

alter table member_import_rows enable row level security;

create policy member_import_rows_select on member_import_rows
  for select
  using (organization_id = current_org_id() and has_permission('member.invite'));

create policy member_import_rows_insert on member_import_rows
  for insert
  with check (organization_id = current_org_id() and has_permission('member.invite'));

create policy member_import_rows_update on member_import_rows
  for update
  using (organization_id = current_org_id() and has_permission('member.invite'))
  with check (organization_id = current_org_id() and has_permission('member.invite'));

revoke all on member_import_rows from anon, public, authenticated;
grant select, insert, update on member_import_rows to authenticated;
