-- Phase 7 rebuild (Visual Process Builder): extends 20260719150002's
-- processes/process_versions tables rather than replacing them —
-- never edit an already-applied migration in place. Three changes:
--
-- 1. Process-level metadata the visual builder's required scope adds
--    beyond the original title/owner/department shell: description,
--    category, tags, location/team scope, SLA default, effective
--    date range, and source knowledge documents the process was
--    authored from.
-- 2. process_versions.status gains an 'approved' state between
--    'in_review' and 'published' — a reviewer approving a version
--    (process.review) is now a distinct, separate action from
--    publishing it (process.publish), so an approved version can be
--    held back (e.g. pending its effective date) without re-review.
--    The immutability trigger from 20260719150002 is untouched: it
--    only restricts rows already 'published', which this change
--    doesn't affect.
-- 3. A new process.manage permission for process-record housekeeping
--    (archive/restore, editing process-level metadata, template
--    management) — kept distinct from process.edit, which governs
--    editing a draft version's graph content.

alter table processes
  add column description text,
  add column category text,
  add column tags text[] not null default '{}',
  add column location_id uuid references organization_locations(id),
  add column team_id uuid references teams(id),
  add column sla_hours integer,
  add column effective_from date,
  add column effective_until date,
  add column source_document_ids uuid[] not null default '{}';

create index processes_tags_idx on processes using gin(tags);
create index processes_location_id_idx on processes(location_id) where location_id is not null;
create index processes_team_id_idx on processes(team_id) where team_id is not null;

alter table process_versions drop constraint process_versions_status_check;
alter table process_versions add constraint process_versions_status_check check (
  status in ('draft', 'in_review', 'approved', 'published', 'superseded', 'rejected')
);

insert into permissions (key, description) values
  ('process.manage', 'Archive/restore a process and edit its metadata (category, tags, scope, SLA, effective dates) — distinct from editing a draft version''s content.');

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, v.scope
from (values
  ('organization_owner', 'process.manage', null),
  ('organization_admin', 'process.manage', null),
  ('process_owner', 'process.manage', 'scoped')
) as v(role_key, permission_key, scope)
join roles r on r.key = v.role_key and r.organization_id is null
join permissions p on p.key = v.permission_key;

-- Broaden processes_update (20260719150002) to also accept
-- process.manage (metadata/archive) or process.publish (the
-- current_version_id/status update publishVersion() makes) — not
-- just process.edit. Replaces, not merges with, the prior version of
-- this same-named policy, per this repo's "never edit an
-- already-applied migration in place" rule.
drop policy processes_update on processes;
create policy processes_update on processes
  for update
  using (
    organization_id = current_org_id()
    and (
      has_scoped_permission('process.edit', department_id, null, null)
      or has_scoped_permission('process.manage', department_id, null, null)
      or has_scoped_permission('process.publish', department_id, null, null)
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      has_scoped_permission('process.edit', department_id, null, null)
      or has_scoped_permission('process.manage', department_id, null, null)
      or has_scoped_permission('process.publish', department_id, null, null)
    )
  );
