-- Fixes a real cross-tenant RLS gap in team_members_insert/
-- team_members_delete, first surfaced by actually running
-- tenant-isolation.integration.test.ts's "test 12" against a live
-- Postgres engine (previously never verified — see
-- docs/operations/production-configuration-matrix.md).
--
-- has_scoped_permission(permission, department_id, location_id, team_id)
-- returns true immediately for a caller holding an *unscoped* grant of
-- `permission` (see 20260719140001's has_scoped_permission — the
-- `if has_permission(permission) then return true` fast path), without
-- ever checking whether the specific team_id/department_id/location_id
-- argument actually belongs to the caller's own organization. For a
-- policy like teams_update/departments_update/organization_locations_
-- update, the id passed is the row's own primary key, already
-- constrained by that same policy's `organization_id = current_org_id()`
-- clause, so this is harmless there. But team_members_insert/_delete
-- passed team_id — a *different* table's foreign key, not the row under
-- policy — so an organization_owner/admin (who holds unscoped
-- `team.manage`) could insert a team_members row with organization_id
-- set to their own org (satisfying the policy's own check) and team_id
-- pointing at a **different organization's** team, associating one
-- org's member with another org's team. Exploiting this in practice
-- requires already knowing a foreign organization's team_id (team rows
-- are themselves organization-scoped by RLS, so it is not enumerable
-- through this application), but it is a real tenant-boundary gap, not
-- just a data-integrity one, and is fixed here rather than left as a
-- documented risk.
--
-- Fix: require team_id to resolve to a team row inside the caller's own
-- organization *before* has_scoped_permission is even asked to check
-- it — additive and strictly narrower than the previous policy, so it
-- cannot newly allow anything; it can only reject what was previously
-- (incorrectly) allowed.

drop policy team_members_insert on team_members;
create policy team_members_insert on team_members
  for insert
  with check (
    organization_id = current_org_id()
    and exists (
      select 1 from teams t
      where t.id = team_id and t.organization_id = current_org_id()
    )
    and has_scoped_permission('team.manage', null, null, team_id)
  );

drop policy team_members_delete on team_members;
create policy team_members_delete on team_members
  for delete
  using (
    organization_id = current_org_id()
    and exists (
      select 1 from teams t
      where t.id = team_id and t.organization_id = current_org_id()
    )
    and has_scoped_permission('team.manage', null, null, team_id)
  );
