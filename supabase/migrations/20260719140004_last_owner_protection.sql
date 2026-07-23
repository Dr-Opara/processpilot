-- Phase 5: "prevent removing the last owner" and "secure ownership
-- transfer" are both security requirements, not just UI copy — enforced
-- here at the database layer so no application code path (including a
-- future one nobody has written a check for yet) can leave an
-- organization with zero organization_owner holders.
--
-- Ownership transfer works *with* this trigger, not around it: the
-- application layer (src/lib/services/members.ts) assigns the
-- organization_owner role to the new owner and only then removes it from
-- the old owner, inside a single withTenantContext() transaction — by
-- the time the old owner's row is deleted, the new owner's row already
-- satisfies "at least one active owner remains."

create or replace function organization_owner_role_id(org_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from roles where key = 'organization_owner' and organization_id is null limit 1;
$$;

create or replace function count_active_owners(org_id uuid, excluding_member_id uuid default null)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from member_role_assignments mra
  join organization_members om on om.id = mra.organization_member_id
  where mra.organization_id = org_id
    and mra.role_id = organization_owner_role_id(org_id)
    and om.status = 'active'
    and (excluding_member_id is null or om.id <> excluding_member_id);
$$;

create or replace function prevent_last_owner_role_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role_id = organization_owner_role_id(old.organization_id)
    and count_active_owners(old.organization_id, old.organization_member_id) < 1
  then
    raise exception 'cannot remove the organization''s last owner';
  end if;
  return old;
end;
$$;

create trigger member_role_assignments_prevent_last_owner_removal
  before delete on member_role_assignments
  for each row
  execute function prevent_last_owner_role_removal();

create or replace function prevent_last_owner_deactivation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner boolean;
begin
  if old.status = 'active' and new.status <> 'active' then
    select exists (
      select 1 from member_role_assignments mra
      where mra.organization_member_id = old.id
        and mra.role_id = organization_owner_role_id(old.organization_id)
    ) into is_owner;

    if is_owner and count_active_owners(old.organization_id, old.id) < 1 then
      raise exception 'cannot suspend or remove the organization''s last owner';
    end if;
  end if;
  return new;
end;
$$;

create trigger organization_members_prevent_last_owner_deactivation
  before update of status on organization_members
  for each row
  execute function prevent_last_owner_deactivation();
