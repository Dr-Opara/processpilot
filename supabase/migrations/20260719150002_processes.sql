-- Phase 7 (Process builder): the process authoring/review/publish
-- governance loop. Per ADR-0011, KnowledgeDocument/DocumentVersion and
-- Process/ProcessVersion are one identical immutability contract, so
-- this migration mirrors 20260719150001_knowledge_documents.sql's
-- table/trigger/RLS shape exactly — same draft -> in_review ->
-- published -> superseded state machine, same
-- has_scoped_permission()-gated RLS, department_id denormalized onto
-- both tables. The one structural difference: the version payload is
-- a step-array `definition jsonb` (what Phase 8's workflow engine will
-- read to instantiate a Workflow/Task) rather than document
-- content/an uploaded file — nothing is uploaded in this phase.

create table processes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  owner_member_id uuid references organization_members(id),
  department_id uuid references departments(id),
  status text not null default 'draft' check (
    status in ('draft', 'in_review', 'published', 'archived')
  ),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  archived_at timestamptz
);

create trigger processes_set_updated_at
  before update on processes
  for each row
  execute function set_updated_at();

create index processes_organization_id_idx on processes(organization_id);
create index processes_department_id_idx on processes(department_id) where department_id is not null;

alter table processes enable row level security;

create policy processes_select on processes
  for select
  using (organization_id = current_org_id() and has_scoped_permission('process.view', department_id, null, null));

create policy processes_insert on processes
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('process.create', department_id, null, null));

create policy processes_update on processes
  for update
  using (organization_id = current_org_id() and has_scoped_permission('process.edit', department_id, null, null))
  with check (organization_id = current_org_id() and has_scoped_permission('process.edit', department_id, null, null));

revoke all on processes from anon, public, authenticated;
grant select, insert, update on processes to authenticated;

create table process_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  process_id uuid not null references processes(id) on delete cascade,
  department_id uuid references departments(id),
  version_number integer not null,
  title text not null,
  -- Step array: { id, name, sequencing (linear|parallel|conditional),
  -- parallelGroup?, branchOnStepId?, branchCondition?, assigneeType
  -- (role|team), assigneeRoleId?, assigneeTeamId?, required,
  -- requiresForm, formFields[], requiresApproval, approverRoleId?,
  -- requiresEvidence, evidenceDescription? }[] — validated by zod in
  -- process-versions.ts, not by a DB check constraint, same as
  -- document_versions.content having no shape constraint either.
  definition jsonb not null,
  status text not null default 'draft' check (
    status in ('draft', 'in_review', 'published', 'superseded', 'rejected')
  ),
  review_notes text,
  submitted_by uuid references organization_members(id),
  submitted_at timestamptz,
  reviewed_by uuid references organization_members(id),
  reviewed_at timestamptz,
  published_by uuid references organization_members(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  unique (process_id, version_number)
);

alter table processes
  add constraint processes_current_version_id_fkey
  foreign key (current_version_id) references process_versions(id);

create index process_versions_organization_id_idx on process_versions(organization_id);
-- No separate index on process_id alone: the `unique (process_id,
-- version_number)` constraint above already provides one via its
-- leading column.

create or replace function set_process_version_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from processes where id = new.process_id;
  return new;
end;
$$;

create trigger process_versions_set_department_id
  before insert on process_versions
  for each row
  execute function set_process_version_department_id();

-- Same authoritative backstop as prevent_published_version_mutation()
-- (20260719150001) for ADR-0011's "no published version is ever
-- edited in place" — the only transition a published row may undergo
-- is to 'superseded', with title/definition unchanged.
create or replace function prevent_published_process_version_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'published' and new.status <> 'superseded' then
    raise exception 'a published process version cannot be modified';
  end if;
  if old.status = 'published' and new.status = 'superseded' then
    if new.title <> old.title or new.definition is distinct from old.definition then
      raise exception 'a published process version cannot be modified';
    end if;
  end if;
  return new;
end;
$$;

create trigger process_versions_prevent_published_mutation
  before update on process_versions
  for each row
  execute function prevent_published_process_version_mutation();

alter table process_versions enable row level security;

create policy process_versions_select on process_versions
  for select
  using (organization_id = current_org_id() and has_scoped_permission('process.view', department_id, null, null));

create policy process_versions_insert on process_versions
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('process.edit', department_id, null, null));

-- Coarse RLS gate: caller must hold *some* process governance
-- permission in scope. Which specific transition is allowed is the
-- finer-grained rule process-versions.ts's own requirePermission()
-- calls enforce — same layering as document_versions_update
-- (20260719150001). Note process.publish has no unscoped grantee at
-- all (only process_owner, scoped) per product/permissions-matrix.md
-- — narrower than knowledge.publish, which organization_admin also
-- holds unscoped.
create policy process_versions_update on process_versions
  for update
  using (
    organization_id = current_org_id()
    and (
      has_scoped_permission('process.edit', department_id, null, null)
      or has_scoped_permission('process.review', department_id, null, null)
      or has_scoped_permission('process.publish', department_id, null, null)
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      has_scoped_permission('process.edit', department_id, null, null)
      or has_scoped_permission('process.review', department_id, null, null)
      or has_scoped_permission('process.publish', department_id, null, null)
    )
  );

revoke all on process_versions from anon, public, authenticated;
grant select, insert, update on process_versions to authenticated;
