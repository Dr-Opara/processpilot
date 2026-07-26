-- Phase 12 (Training and certifications): course authoring/versioning,
-- assignment (role/department/team/individual), completion tracking
-- (with an optional embedded assessment), and certification issuance
-- with expiry/renewal, per docs/architecture/domain-model.md's
-- `TrainingCourse -> TrainingAssignment -> Certification` relationship.
--
-- `training_courses`/`training_course_versions` follow the same
-- mutable-shell/immutable-published-version split ADR-0011 established
-- for Document/Process/Form (`forms`/`form_versions`,
-- 20260725000001) — a course version's `content`/`assessment_questions`
-- can never change once published; republishing supersedes it and
-- repoints `training_courses.current_version_id`, exactly like a form.
--
-- `training_assignments` fans a course version out to one row per
-- resolved assignee (role/department/team/individual — see
-- src/lib/services/training.ts's resolveTrainingAssignees(), the
-- training-specific counterpart to Phase 10's
-- resolveMemberIdsForRule()), one row per (course_version, assignee)
-- so a retake updates the same row rather than creating a duplicate.
-- `training_assignment_history` is the append-only log of every status
-- change, same shape as `task_history`/`workflow_history`/
-- `exception_history`.
--
-- `certifications` are issued from a passed assignment, each with a
-- required `expires_at` (nullable only for non-expiring
-- certifications, an explicit choice at issuance — never silently
-- permanent by omission) and a `renewed_from_certification_id` chain so
-- a renewal's full history stays traceable.

create table training_courses (
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
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index training_courses_organization_id_idx on training_courses(organization_id);

alter table training_courses enable row level security;

create policy training_courses_select on training_courses
  for select
  using (organization_id = current_org_id() and has_scoped_permission('training.view', department_id, null, null));

create policy training_courses_insert on training_courses
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('training.manage', department_id, null, null));

create policy training_courses_update on training_courses
  for update
  using (organization_id = current_org_id() and has_scoped_permission('training.manage', department_id, null, null))
  with check (organization_id = current_org_id() and has_scoped_permission('training.manage', department_id, null, null));

revoke all on training_courses from anon, public, authenticated;
grant select, insert, update on training_courses to authenticated;

create table training_course_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  course_id uuid not null references training_courses(id) on delete cascade,
  department_id uuid references departments(id),
  version_number integer not null,
  title text not null,
  -- Markdown/plain-text course material, or a URL to external content
  -- (e.g. a linked knowledge document) — deliberately a single text
  -- field rather than a structured content model, since this phase's
  -- deliverables call for "course authoring/import" content, not a
  -- full authoring/media pipeline.
  content text not null default '',
  has_assessment boolean not null default false,
  -- [{ id, prompt, options: [{ key, label }], correctOptionKey }, ...]
  -- — see src/lib/services/training-assessment.ts for the schema and
  -- scoring logic. Multiple-choice only, deliberately not a general
  -- assessment engine.
  assessment_questions jsonb not null default '[]',
  passing_score_percent integer check (passing_score_percent between 0 and 100),
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded')),
  published_by uuid references organization_members(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  unique (course_id, version_number),
  constraint training_course_versions_assessment_check check (
    (has_assessment = false) or (passing_score_percent is not null)
  )
);

alter table training_courses
  add constraint training_courses_current_version_id_fkey
  foreign key (current_version_id) references training_course_versions(id);

create index training_course_versions_organization_id_idx on training_course_versions(organization_id);
create index training_course_versions_course_id_idx on training_course_versions(course_id);

create or replace function set_training_course_version_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from training_courses where id = new.course_id;
  return new;
end;
$$;

create trigger training_course_versions_set_department_id
  before insert on training_course_versions
  for each row
  execute function set_training_course_version_department_id();

-- Same authoritative backstop as prevent_published_form_version_mutation
-- (20260725000001): once a version is 'published', the only further
-- transition is to 'superseded', and even that transition may not
-- change any other column.
create or replace function prevent_published_training_course_version_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'published' and new.status <> 'superseded' then
    raise exception 'a published training course version cannot be modified';
  end if;
  if old.status = 'published' and new.status = 'superseded' then
    if new.title <> old.title
      or new.content <> old.content
      or new.assessment_questions is distinct from old.assessment_questions
      or new.passing_score_percent is distinct from old.passing_score_percent
    then
      raise exception 'a published training course version cannot be modified';
    end if;
  end if;
  return new;
end;
$$;

create trigger training_course_versions_prevent_published_mutation
  before update on training_course_versions
  for each row
  execute function prevent_published_training_course_version_mutation();

alter table training_course_versions enable row level security;

create policy training_course_versions_select on training_course_versions
  for select
  using (organization_id = current_org_id() and has_scoped_permission('training.view', department_id, null, null));

create policy training_course_versions_insert on training_course_versions
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('training.manage', department_id, null, null));

create policy training_course_versions_update on training_course_versions
  for update
  using (organization_id = current_org_id() and has_scoped_permission('training.manage', department_id, null, null))
  with check (organization_id = current_org_id() and has_scoped_permission('training.manage', department_id, null, null));

revoke all on training_course_versions from anon, public, authenticated;
grant select, insert, update on training_course_versions to authenticated;

create table training_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  course_version_id uuid not null references training_course_versions(id),
  assignee_member_id uuid not null references organization_members(id),
  assigned_via text not null check (assigned_via in ('individual', 'role', 'department', 'team')),
  due_at timestamptz,
  status text not null default 'assigned' check (
    status in ('assigned', 'in_progress', 'completed', 'overdue', 'waived')
  ),
  attempt_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  score_percent integer check (score_percent between 0 and 100),
  passed boolean,
  answers jsonb not null default '{}',
  waived_reason text,
  waived_by uuid references organization_members(id),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  unique (course_version_id, assignee_member_id)
);

create index training_assignments_organization_id_idx on training_assignments(organization_id);
create index training_assignments_assignee_member_id_idx on training_assignments(assignee_member_id);
create index training_assignments_status_idx on training_assignments(organization_id, status);
create index training_assignments_due_at_idx on training_assignments(due_at) where due_at is not null;

create or replace function set_training_assignment_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from training_course_versions where id = new.course_version_id;
  return new;
end;
$$;

create trigger training_assignments_set_department_id
  before insert on training_assignments
  for each row
  execute function set_training_assignment_department_id();

alter table training_assignments enable row level security;

create policy training_assignments_select on training_assignments
  for select
  using (
    organization_id = current_org_id()
    and (
      assignee_member_id = current_member_id()
      or has_scoped_permission('training.view', department_id, null, null)
      or has_scoped_permission('training.manage', department_id, null, null)
    )
  );

create policy training_assignments_insert on training_assignments
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('training.manage', department_id, null, null));

-- The assignee completing/retaking their own assignment (training.complete)
-- is a distinct grant from managing the course/assignment roster
-- (training.manage) — same "own resource, narrower permission" pattern
-- as workflow.complete alongside workflow.manage.
create policy training_assignments_update on training_assignments
  for update
  using (
    organization_id = current_org_id()
    and (
      (assignee_member_id = current_member_id() and has_scoped_permission('training.complete', department_id, null, null))
      or has_scoped_permission('training.manage', department_id, null, null)
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      (assignee_member_id = current_member_id() and has_scoped_permission('training.complete', department_id, null, null))
      or has_scoped_permission('training.manage', department_id, null, null)
    )
  );

revoke all on training_assignments from anon, public, authenticated;
grant select, insert, update on training_assignments to authenticated;

create table training_assignment_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  training_assignment_id uuid not null references training_assignments(id) on delete cascade,
  event_type text not null,
  actor_member_id uuid references organization_members(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index training_assignment_history_assignment_id_idx on training_assignment_history(training_assignment_id);
create index training_assignment_history_organization_id_idx on training_assignment_history(organization_id);

create or replace function set_training_assignment_history_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from training_assignments where id = new.training_assignment_id;
  return new;
end;
$$;

create trigger training_assignment_history_set_department_id
  before insert on training_assignment_history
  for each row
  execute function set_training_assignment_history_department_id();

alter table training_assignment_history enable row level security;

create policy training_assignment_history_select on training_assignment_history
  for select
  using (
    organization_id = current_org_id()
    and (
      has_scoped_permission('training.view', department_id, null, null)
      or has_scoped_permission('training.manage', department_id, null, null)
    )
  );

-- Append-only side effect of every assignment-mutating service call —
-- same posture as escalation_events_insert/exception_history_insert: no
-- separate permission gate beyond tenant match, since every write path
-- already checked a permission before reaching here.
create policy training_assignment_history_insert on training_assignment_history
  for insert
  with check (organization_id = current_org_id());

revoke all on training_assignment_history from anon, public, authenticated;
grant select, insert on training_assignment_history to authenticated;

create table certifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  member_id uuid not null references organization_members(id),
  course_id uuid not null references training_courses(id),
  training_assignment_id uuid references training_assignments(id),
  issued_at timestamptz not null default now(),
  -- Nullable only for a non-expiring certification — an explicit
  -- choice recorded at issuance (issueCertification()'s `expiresAt`
  -- param has no default), never an accidental omission.
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  renewed_from_certification_id uuid references certifications(id),
  revoked_reason text,
  revoked_by uuid references organization_members(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

create index certifications_organization_id_idx on certifications(organization_id);
create index certifications_member_id_idx on certifications(member_id);
create index certifications_expires_at_idx on certifications(expires_at) where status = 'active';

create or replace function set_certification_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from organization_members where id = new.member_id;
  return new;
end;
$$;

create trigger certifications_set_department_id
  before insert on certifications
  for each row
  execute function set_certification_department_id();

alter table certifications enable row level security;

create policy certifications_select on certifications
  for select
  using (
    organization_id = current_org_id()
    and (
      member_id = current_member_id()
      or has_scoped_permission('training.view', department_id, null, null)
      or has_scoped_permission('training.manage', department_id, null, null)
    )
  );

create policy certifications_insert on certifications
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('training.manage', department_id, null, null));

create policy certifications_update on certifications
  for update
  using (organization_id = current_org_id() and has_scoped_permission('training.manage', department_id, null, null))
  with check (organization_id = current_org_id() and has_scoped_permission('training.manage', department_id, null, null));

revoke all on certifications from anon, public, authenticated;
grant select, insert, update on certifications to authenticated;

-- training.complete is new — completing/retaking one's own assignment
-- is a narrower grant than training.manage (creating courses, assigning
-- training to others, issuing/revoking certifications), same
-- distinction workflow.complete draws against workflow.manage.
insert into permissions (key, description) values
  ('training.complete', 'Complete or retake one''s own assigned training.');

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, v.scope
from (values
  ('organization_admin', 'training.complete', null),
  ('manager', 'training.complete', 'scoped'),
  ('employee', 'training.complete', null)
) as v(role_key, permission_key, scope)
join roles r on r.key = v.role_key and r.organization_id is null
join permissions p on p.key = v.permission_key;
