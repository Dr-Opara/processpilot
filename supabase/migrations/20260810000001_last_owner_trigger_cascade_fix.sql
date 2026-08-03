-- Fixes a real interaction bug between 20260719140004's last-owner
-- protection trigger and any full-organization delete (cascade), first
-- surfaced by actually running tenant-isolation.integration.test.ts
-- against a live Postgres engine (previously never verified — see
-- docs/operations/production-configuration-matrix.md) rather than
-- edited in place per docs/development/database-migrations.md's "never
-- edit an already-applied migration" rule.
--
-- member_role_assignments_prevent_last_owner_removal fires on every
-- delete from member_role_assignments, including the one
-- `organizations(id) on delete cascade` performs when the whole
-- organization row is deleted. That is not "removing the owner but
-- keeping the org running" — the case this trigger exists to block
-- (see prevent_last_owner_deactivation for the equivalent suspend/
-- remove-membership guard) — it is the organization itself going away,
-- and must not be blocked. Without this fix, any future org-deletion
-- finalization (Phase 21's env-flag-gated sweep, currently a deliberate
-- no-op pending its own security review) or any other direct
-- `delete from organizations` would always fail with "cannot remove the
-- organization's last owner", since every organization by definition
-- has an owner.

create or replace function prevent_last_owner_role_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The organization itself is gone (mid-cascade from `delete from
  -- organizations`) — nothing left to protect an owner seat on.
  if not exists (select 1 from organizations where id = old.organization_id) then
    return old;
  end if;

  if old.role_id = organization_owner_role_id(old.organization_id)
    and count_active_owners(old.organization_id, old.organization_member_id) < 1
  then
    raise exception 'cannot remove the organization''s last owner';
  end if;
  return old;
end;
$$;
