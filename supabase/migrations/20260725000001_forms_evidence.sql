-- Phase 9 (Forms and evidence management): reusable dynamic forms and
-- governed evidence capture, layered on top of Phase 8's `tasks.output`
-- per workflow-engine.ts's header comment ("form/evidence execute
-- exactly like human_task this phase ... Structured, validated field
-- capture and evidence file upload are Phase 9's job, layered on top of
-- this same tasks.output column later").
--
-- Two independent governed entities, each following the same
-- mutable-shell/immutable-version split ADR-0011 established for
-- Process and Document:
--
-- 1. forms/form_versions — a form is authored, versioned, and
--    published; a published version can never be edited in place
--    (only superseded by publishing the next one). No separate review
--    stage this phase (unlike knowledge_documents/processes) — form.edit
--    and form.publish are still distinct permissions so authoring and
--    publishing stay separable duties.
-- 2. form_submissions — a runtime fact: one member's answers to one
--    published form_version, always tied to the exact workflow instance
--    and task that required it (never a standalone/unlinked
--    submission). A submitted (non-draft) row is immutable; an
--    amendment creates a new row (amends_submission_id) and points the
--    old row at it (superseded_by_submission_id) rather than mutating
--    history, the same "replacement creates a new record" rule
--    file-storage.md principle 3 already applies to evidence.
--
-- evidence/evidence_events is the private file-upload side: evidence
-- rows carry the file's own metadata and a sha256 integrity hash;
-- evidence_events is the append-only chain-of-custody log (upload,
-- download, accept, reject, replace, expire) — same
-- workflow_history/task_history shape from Phase 8, applied here to
-- file custody instead of workflow state.

insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

create table forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  title text not null,
  description text,
  category text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  current_version_id uuid,
  owner_member_id uuid references organization_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  archived_at timestamptz
);

create trigger forms_set_updated_at
  before update on forms
  for each row
  execute function set_updated_at();

create index forms_organization_id_idx on forms(organization_id);
create index forms_department_id_idx on forms(department_id) where department_id is not null;

alter table forms enable row level security;

create policy forms_select on forms
  for select
  using (organization_id = current_org_id() and has_scoped_permission('form.view', department_id, null, null));

create policy forms_insert on forms
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('form.create', department_id, null, null));

-- Coarse gate — form.edit (metadata/archive) or form.publish
-- (current_version_id/status update publishFormVersion() makes); the
-- specific transition is enforced by forms.ts, same layering
-- processes_update (20260719150003) already established.
create policy forms_update on forms
  for update
  using (
    organization_id = current_org_id()
    and (
      has_scoped_permission('form.edit', department_id, null, null)
      or has_scoped_permission('form.publish', department_id, null, null)
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      has_scoped_permission('form.edit', department_id, null, null)
      or has_scoped_permission('form.publish', department_id, null, null)
    )
  );

revoke all on forms from anon, public, authenticated;
grant select, insert, update on forms to authenticated;

create table form_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  form_id uuid not null references forms(id) on delete cascade,
  department_id uuid references departments(id),
  version_number integer not null,
  title text not null,
  -- { fields: FormFieldDefinition[] } — see src/lib/services/form-schema.ts.
  -- Each field carries its own type, validation rules, and optional
  -- `visibleWhen` conditional-visibility expression.
  definition jsonb not null default '{"fields": []}',
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded')),
  published_by uuid references organization_members(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  unique (form_id, version_number)
);

alter table forms
  add constraint forms_current_version_id_fkey
  foreign key (current_version_id) references form_versions(id);

create index form_versions_organization_id_idx on form_versions(organization_id);

create or replace function set_form_version_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from forms where id = new.form_id;
  return new;
end;
$$;

create trigger form_versions_set_department_id
  before insert on form_versions
  for each row
  execute function set_form_version_department_id();

-- Same authoritative backstop as prevent_published_version_mutation
-- (20260719150001): once a version is 'published', the only further
-- transition is to 'superseded', and even that transition may not
-- change any other column.
create or replace function prevent_published_form_version_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'published' and new.status <> 'superseded' then
    raise exception 'a published form version cannot be modified';
  end if;
  if old.status = 'published' and new.status = 'superseded' then
    if new.title <> old.title or new.definition is distinct from old.definition then
      raise exception 'a published form version cannot be modified';
    end if;
  end if;
  return new;
end;
$$;

create trigger form_versions_prevent_published_mutation
  before update on form_versions
  for each row
  execute function prevent_published_form_version_mutation();

alter table form_versions enable row level security;

create policy form_versions_select on form_versions
  for select
  using (organization_id = current_org_id() and has_scoped_permission('form.view', department_id, null, null));

create policy form_versions_insert on form_versions
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('form.edit', department_id, null, null));

create policy form_versions_update on form_versions
  for update
  using (
    organization_id = current_org_id()
    and (
      has_scoped_permission('form.edit', department_id, null, null)
      or has_scoped_permission('form.publish', department_id, null, null)
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      has_scoped_permission('form.edit', department_id, null, null)
      or has_scoped_permission('form.publish', department_id, null, null)
    )
  );

revoke all on form_versions from anon, public, authenticated;
grant select, insert, update on form_versions to authenticated;

-- A 'form' node's task snapshots the exact published form_version it
-- was created against here — same immutable-version-reference pattern
-- as workflows.process_version_id, so a form published mid-instance
-- never changes what an in-flight task renders.
alter table tasks add column form_version_id uuid references form_versions(id);
create index tasks_form_version_id_idx on tasks(form_version_id) where form_version_id is not null;

create table form_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  workflow_id uuid not null references workflows(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  process_version_id uuid not null references process_versions(id),
  form_version_id uuid not null references form_versions(id),
  member_id uuid not null references organization_members(id),
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  answers jsonb not null default '{}',
  -- Set only on a row created by amendForm() — the reason is mandatory
  -- there (form-submissions.ts), never set on an original submission.
  amendment_reason text,
  amends_submission_id uuid references form_submissions(id),
  -- Set on the *old* row once amendForm() creates its replacement —
  -- the one mutation a submitted row is still allowed, see the trigger
  -- below. Never set on a draft.
  superseded_by_submission_id uuid references form_submissions(id),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create index form_submissions_organization_id_idx on form_submissions(organization_id);
create index form_submissions_task_id_idx on form_submissions(task_id);
create index form_submissions_workflow_id_idx on form_submissions(workflow_id);
create index form_submissions_member_id_idx on form_submissions(member_id);

create or replace function set_form_submission_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from tasks where id = new.task_id;
  return new;
end;
$$;

create trigger form_submissions_set_department_id
  before insert on form_submissions
  for each row
  execute function set_form_submission_department_id();

-- Mirrors prevent_published_form_version_mutation's shape: once a
-- submission is 'submitted' it is immutable, except for the single
-- one-time transition of superseded_by_submission_id from null to a
-- value (amendForm() marking this row superseded by its replacement).
create or replace function prevent_submitted_form_submission_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'submitted' then
    if new.status <> 'submitted' or new.answers is distinct from old.answers then
      raise exception 'a submitted form submission cannot be modified';
    end if;
    if old.superseded_by_submission_id is not null and new.superseded_by_submission_id is distinct from old.superseded_by_submission_id then
      raise exception 'a submitted form submission cannot be modified';
    end if;
  end if;
  return new;
end;
$$;

create trigger form_submissions_prevent_submitted_mutation
  before update on form_submissions
  for each row
  execute function prevent_submitted_form_submission_mutation();

alter table form_submissions enable row level security;

create policy form_submissions_select on form_submissions
  for select
  using (
    organization_id = current_org_id()
    and (
      member_id = current_member_id()
      or has_scoped_permission('workflow.manage', department_id, null, null)
      or has_scoped_permission('workflow.assign', department_id, null, null)
      or exists (
        select 1 from tasks t where t.id = form_submissions.task_id and t.assignee_member_id = current_member_id()
      )
    )
  );

create policy form_submissions_insert on form_submissions
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('form.submit', department_id, null, null));

-- Coarse gate; form-submissions.ts enforces that only the owning
-- member may save/submit their own draft, and that amendments are
-- created as new rows, never in-place edits of a submitted one (the
-- trigger above is the authoritative backstop for that specific rule).
create policy form_submissions_update on form_submissions
  for update
  using (
    organization_id = current_org_id()
    and (member_id = current_member_id() or has_scoped_permission('workflow.manage', department_id, null, null))
  )
  with check (
    organization_id = current_org_id()
    and (member_id = current_member_id() or has_scoped_permission('workflow.manage', department_id, null, null))
  );

revoke all on form_submissions from anon, public, authenticated;
grant select, insert, update on form_submissions to authenticated;

create table evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  workflow_id uuid references workflows(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  form_submission_id uuid references form_submissions(id) on delete cascade,
  -- Which form field this came from, when uploaded via a form's file-
  -- upload field rather than directly against an 'evidence' task node.
  field_key text,
  uploaded_by uuid references organization_members(id),
  original_filename text not null,
  mime_type text not null,
  file_size_bytes integer not null,
  storage_path text not null,
  -- Integrity hash computed server-side from the actual uploaded bytes
  -- (see evidence.ts) — never trusts a client-supplied hash.
  sha256_hash text not null,
  -- Same "no real scanner wired up yet" posture as
  -- document_versions.scan_status (20260719150001).
  scan_status text not null default 'pending_scan' check (
    scan_status in ('pending_scan', 'clean', 'flagged')
  ),
  status text not null default 'pending_review' check (
    status in ('pending_review', 'accepted', 'rejected', 'expired', 'replaced')
  ),
  reviewed_by uuid references organization_members(id),
  reviewed_at timestamptz,
  review_notes text,
  expires_at timestamptz,
  -- Set on the *new* row when it replaces a rejected/expired one — the
  -- old row is never overwritten (file-storage.md principle 3); its own
  -- status instead moves to 'replaced' by the same call.
  replaces_evidence_id uuid references evidence(id),
  created_at timestamptz not null default now(),
  constraint evidence_attached_to_something check (task_id is not null or form_submission_id is not null)
);

create index evidence_organization_id_idx on evidence(organization_id);
create index evidence_task_id_idx on evidence(task_id) where task_id is not null;
create index evidence_form_submission_id_idx on evidence(form_submission_id) where form_submission_id is not null;
create index evidence_uploaded_by_idx on evidence(uploaded_by) where uploaded_by is not null;
create index evidence_expires_at_idx on evidence(expires_at) where status = 'accepted' and expires_at is not null;

create or replace function set_evidence_department_id()
returns trigger
language plpgsql
as $$
begin
  if new.task_id is not null then
    select department_id into new.department_id from tasks where id = new.task_id;
  elsif new.form_submission_id is not null then
    select department_id into new.department_id from form_submissions where id = new.form_submission_id;
  end if;
  return new;
end;
$$;

create trigger evidence_set_department_id
  before insert on evidence
  for each row
  execute function set_evidence_department_id();

-- The file itself (bytes/hash/name/size/path) is immutable once
-- recorded, per file-storage.md principle 3 — only the review/
-- lifecycle columns (status, scan_status, reviewed_*, expires_at,
-- replaces_evidence_id) may change after insert. A replacement upload
-- always goes through evidence.ts's replaceEvidence(), which inserts a
-- new row rather than mutating this one.
create or replace function prevent_evidence_file_mutation()
returns trigger
language plpgsql
as $$
begin
  if new.storage_path <> old.storage_path
    or new.sha256_hash <> old.sha256_hash
    or new.original_filename <> old.original_filename
    or new.mime_type <> old.mime_type
    or new.file_size_bytes <> old.file_size_bytes then
    raise exception 'an evidence file cannot be modified once uploaded';
  end if;
  return new;
end;
$$;

create trigger evidence_prevent_file_mutation
  before update on evidence
  for each row
  execute function prevent_evidence_file_mutation();

alter table evidence enable row level security;

create policy evidence_select on evidence
  for select
  using (
    organization_id = current_org_id()
    and (
      uploaded_by = current_member_id()
      or has_scoped_permission('evidence.review', department_id, null, null)
      or has_scoped_permission('workflow.manage', department_id, null, null)
      or has_scoped_permission('workflow.assign', department_id, null, null)
      or exists (
        select 1 from tasks t where t.id = evidence.task_id and t.assignee_member_id = current_member_id()
      )
    )
  );

create policy evidence_insert on evidence
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('evidence.upload', department_id, null, null));

-- Only a reviewer/admin may transition status (accept/reject/expire/
-- replace) — the uploader's own evidence.upload grant does not appear
-- here, matching evidence-review-is-a-separate-duty-from-uploading per
-- product/permissions-matrix.md.
create policy evidence_update on evidence
  for update
  using (
    organization_id = current_org_id()
    and (
      has_scoped_permission('evidence.review', department_id, null, null)
      or has_scoped_permission('workflow.manage', department_id, null, null)
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      has_scoped_permission('evidence.review', department_id, null, null)
      or has_scoped_permission('workflow.manage', department_id, null, null)
    )
  );

revoke all on evidence from anon, public, authenticated;
grant select, insert, update on evidence to authenticated;

create table evidence_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  evidence_id uuid not null references evidence(id) on delete cascade,
  event_type text not null check (
    event_type in ('uploaded', 'downloaded', 'accepted', 'rejected', 'replaced', 'expired')
  ),
  actor_member_id uuid references organization_members(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index evidence_events_evidence_id_idx on evidence_events(evidence_id, created_at);
create index evidence_events_organization_id_idx on evidence_events(organization_id);

create or replace function set_evidence_event_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from evidence where id = new.evidence_id;
  return new;
end;
$$;

create trigger evidence_events_set_department_id
  before insert on evidence_events
  for each row
  execute function set_evidence_event_department_id();

alter table evidence_events enable row level security;

create policy evidence_events_select on evidence_events
  for select
  using (
    organization_id = current_org_id()
    and (
      has_scoped_permission('evidence.review', department_id, null, null)
      or has_scoped_permission('workflow.manage', department_id, null, null)
      or exists (
        select 1 from evidence e where e.id = evidence_events.evidence_id and e.uploaded_by = current_member_id()
      )
    )
  );

-- Append-only side effect of an already-permission-checked evidence
-- action — same reasoning as workflow_history_insert (20260724000001):
-- no separate permission gate beyond tenant match.
create policy evidence_events_insert on evidence_events
  for insert
  with check (organization_id = current_org_id());

revoke all on evidence_events from anon, public, authenticated;
grant select, insert on evidence_events to authenticated;

-- New form-authoring permissions — form.submit/evidence.upload/
-- evidence.review were already seeded in 20260719130002 (the original
-- permissions matrix anticipated the runtime actions); the builder-side
-- authoring permissions below were not, since Phase 0 didn't yet treat
-- forms as a standalone governed content type. Same incremental-add
-- pattern as process.manage (20260719150003).
insert into permissions (key, description) values
  ('form.view', 'View forms within scope.'),
  ('form.create', 'Create new draft forms.'),
  ('form.edit', 'Edit a draft form version.'),
  ('form.publish', 'Publish a new version of a form.');

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, v.scope
from (values
  ('organization_owner', 'form.view', null),
  ('organization_admin', 'form.view', null),
  ('organization_admin', 'form.create', null),
  ('organization_admin', 'form.edit', null),
  ('process_owner', 'form.view', 'scoped'),
  ('process_owner', 'form.create', null),
  ('process_owner', 'form.edit', 'scoped'),
  ('process_owner', 'form.publish', 'scoped'),
  ('manager', 'form.view', 'scoped'),
  ('employee', 'form.view', 'scoped'),
  ('auditor', 'form.view', 'scoped')
) as v(role_key, permission_key, scope)
join roles r on r.key = v.role_key and r.organization_id is null
join permissions p on p.key = v.permission_key;
