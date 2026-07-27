-- Phase 15 (Audit and compliance center): adds department_id to
-- audit_events so a department-scoped audit.view/audit.export grant
-- (manager, auditor — see role_permissions, 20260719130002) can resolve
-- to real, visible rows. Previously audit_events_select only called
-- has_permission('audit.view'), which — per current_member_permissions()'s
-- "where rp.scope is null" filter — only ever returns true for an
-- *unscoped* grant (organization_owner, organization_admin). A scoped
-- grant was therefore functionally inert: manager/auditor held the
-- permission per the seeded matrix but could never select a single row.
-- Switching to has_scoped_permission(department_id) is a strict
-- superset — it falls back to has_permission() first — so this is a
-- widening, not a narrowing, of access.
alter table audit_events add column department_id uuid references departments(id);

create index audit_events_department_idx
  on audit_events(department_id)
  where department_id is not null;

drop policy audit_events_select on audit_events;

create policy audit_events_select on audit_events
  for select
  using (
    organization_id = current_org_id()
    and has_scoped_permission('audit.view', department_id, null, null)
  );

-- department_id is not retroactively backfilled for rows recorded before
-- this migration, nor for every resource type going forward (see
-- src/lib/db/audit.ts's RecordAuditEventInput doc comment and
-- docs/architecture/audit-and-compliance.md's known gaps) — those rows
-- remain visible only to an unscoped audit.view/audit.export holder,
-- exactly as before this migration. This is a widening of access, never
-- a narrowing, so it does not need to run as a backfill migration.
