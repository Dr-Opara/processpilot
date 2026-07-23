-- Phase 6 (Knowledge management): the document import/authoring/
-- governance loop. Two tables mirroring the Process/ProcessVersion
-- split ADR-0011 mandates for Process: knowledge_documents is the
-- mutable "draft shell" (current status, owner, scope), and
-- document_versions is the immutable-once-published history — a
-- published version is never edited in place; editing again creates a
-- new draft version, and publishing that supersedes (not overwrites)
-- the prior one. department_id is denormalized onto both tables (not
-- just the parent) so every RLS policy below can check
-- has_scoped_permission() directly against a plain column, matching
-- organization_members_update's pattern from 20260719140001, rather
-- than a subquery per row.
--
-- File storage itself (docs/architecture/file-storage.md) is
-- deliberately NOT modeled as Storage-level RLS here: the
-- knowledge-documents bucket stays fully private (no policies on
-- storage.objects at all, so only the service-role key can read/write
-- it), and every read/write is mediated by the application's own
-- requirePermission()/has_scoped_permission() checks before a
-- short-lived signed URL is ever issued — see
-- src/lib/services/storage.ts. This avoids a second, parallel
-- authorization system living in Storage policies.

insert into storage.buckets (id, name, public)
values ('knowledge-documents', 'knowledge-documents', false)
on conflict (id) do nothing;

create table knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  category text,
  tags text[] not null default '{}',
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

create trigger knowledge_documents_set_updated_at
  before update on knowledge_documents
  for each row
  execute function set_updated_at();

create index knowledge_documents_organization_id_idx on knowledge_documents(organization_id);
create index knowledge_documents_department_id_idx on knowledge_documents(department_id) where department_id is not null;
create index knowledge_documents_tags_idx on knowledge_documents using gin(tags);

alter table knowledge_documents enable row level security;

create policy knowledge_documents_select on knowledge_documents
  for select
  using (organization_id = current_org_id() and has_scoped_permission('knowledge.view', department_id, null, null));

create policy knowledge_documents_insert on knowledge_documents
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('knowledge.create', department_id, null, null));

create policy knowledge_documents_update on knowledge_documents
  for update
  using (organization_id = current_org_id() and has_scoped_permission('knowledge.edit', department_id, null, null))
  with check (organization_id = current_org_id() and has_scoped_permission('knowledge.edit', department_id, null, null));

revoke all on knowledge_documents from anon, public, authenticated;
grant select, insert, update on knowledge_documents to authenticated;

create table document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  document_id uuid not null references knowledge_documents(id) on delete cascade,
  department_id uuid references departments(id),
  version_number integer not null,
  title text not null,
  source text not null check (source in ('authored', 'uploaded')),
  content text,
  storage_path text,
  original_filename text,
  mime_type text,
  file_size_bytes integer,
  extracted_text text,
  -- No real malware scanner is wired up yet (file-storage.md defers the
  -- mechanism to "the phase that implements upload" — this phase, but
  -- no vendor/credential has been chosen). Every upload sits at
  -- 'pending_scan' indefinitely for now; the column exists so a future
  -- scanner integration is a status update, not a schema change, and
  -- document-versions.ts's getDownloadUrl() already blocks on 'flagged'.
  scan_status text not null default 'pending_scan' check (
    scan_status in ('pending_scan', 'clean', 'flagged')
  ),
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
  unique (document_id, version_number)
);

alter table knowledge_documents
  add constraint knowledge_documents_current_version_id_fkey
  foreign key (current_version_id) references document_versions(id);

create index document_versions_organization_id_idx on document_versions(organization_id);
-- No separate index on document_id alone: the `unique (document_id,
-- version_number)` constraint above already provides one via its
-- leading column.

-- Copies the parent document's department_id onto every version at
-- insert time — application code never sets document_versions.department_id
-- directly (see document-versions.ts), so this is the single source of
-- truth keeping the denormalized column correct rather than trusting
-- every insert call site to get it right independently.
create or replace function set_document_version_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from knowledge_documents where id = new.document_id;
  return new;
end;
$$;

create trigger document_versions_set_department_id
  before insert on document_versions
  for each row
  execute function set_document_version_department_id();

-- Authoritative enforcement of ADR-0011's "no published version is
-- ever edited in place": once a version's status is 'published', the
-- only further transition allowed is to 'superseded' (fired by
-- publishing the next version) — every other field or status change
-- is rejected here regardless of what application code attempts,
-- matching prevent_department_cycle's role from 20260719140001 as the
-- authoritative backstop behind document-versions.ts's own pre-checks.
create or replace function prevent_published_version_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'published' and new.status <> 'superseded' then
    raise exception 'a published document version cannot be modified';
  end if;
  if old.status = 'published' and new.status = 'superseded' then
    if new.title <> old.title or new.content is distinct from old.content
      or new.storage_path is distinct from old.storage_path
      or new.extracted_text is distinct from old.extracted_text then
      raise exception 'a published document version cannot be modified';
    end if;
  end if;
  return new;
end;
$$;

create trigger document_versions_prevent_published_mutation
  before update on document_versions
  for each row
  execute function prevent_published_version_mutation();

alter table document_versions enable row level security;

create policy document_versions_select on document_versions
  for select
  using (organization_id = current_org_id() and has_scoped_permission('knowledge.view', department_id, null, null));

create policy document_versions_insert on document_versions
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('knowledge.edit', department_id, null, null));

-- Coarse RLS gate: caller must hold *some* knowledge governance
-- permission in scope. Which specific transition is allowed (editing a
-- draft vs. reviewing vs. publishing) is the finer-grained rule
-- document-versions.ts's own requirePermission() calls enforce before
-- ever reaching this UPDATE — the same layering Phase 5 used (e.g.
-- invitations.ts's assertRoleAssignable on top of role.manage's RLS
-- grant).
create policy document_versions_update on document_versions
  for update
  using (
    organization_id = current_org_id()
    and (
      has_scoped_permission('knowledge.edit', department_id, null, null)
      or has_scoped_permission('knowledge.review', department_id, null, null)
      or has_scoped_permission('knowledge.publish', department_id, null, null)
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      has_scoped_permission('knowledge.edit', department_id, null, null)
      or has_scoped_permission('knowledge.review', department_id, null, null)
      or has_scoped_permission('knowledge.publish', department_id, null, null)
    )
  );

revoke all on document_versions from anon, public, authenticated;
grant select, insert, update on document_versions to authenticated;
