-- Corrective migration. Every earlier migration's `revoke all on <table>
-- from anon, public;` never included `authenticated`, so it did nothing
-- to remove the ALL-privileges grant Supabase's own project template
-- applies to `authenticated` by default (via `ALTER DEFAULT PRIVILEGES`)
-- for every new table in the public schema — confirmed live via
-- information_schema.role_table_grants after applying migrations 1-5,
-- which showed `authenticated` holding SELECT/INSERT/UPDATE/DELETE/
-- TRUNCATE/TRIGGER/REFERENCES on every one of these 17 tables,
-- regardless of each table's much narrower intended `grant ... to
-- authenticated` statement (GRANT is additive, never subtractive, so
-- those narrower grants layered on top of the pre-existing default
-- rather than replacing it).
--
-- This is a real, live-verified finding, not a hypothetical: it meant
-- audit_events (intended: select, insert only) actually allowed
-- `authenticated` to UPDATE/DELETE append-only audit rows, and similarly
-- for every other table's unintended extra privileges — RLS policies
-- still filtered which *rows* were affected, but the privilege-layer
-- backstop (e.g. "no update/delete grant exists at all" for
-- append-only/read-only tables) was not actually in effect.
--
-- Source migrations (20260719130001-005) are fixed for any future fresh
-- apply (their revoke statements now include `authenticated`) — this
-- migration corrects the database instance those were already applied
-- to, per docs/development/database-migrations.md's "never edit an
-- already-applied migration in place" rule.

revoke all on profiles from authenticated;
grant select on profiles to authenticated;

revoke all on organizations from authenticated;
grant select, update on organizations to authenticated;

revoke all on organization_settings from authenticated;
grant select, insert, update on organization_settings to authenticated;

revoke all on organization_members from authenticated;
grant select, update on organization_members to authenticated;

revoke all on permissions from authenticated;
grant select on permissions to authenticated;

revoke all on roles from authenticated;
grant select, insert, update on roles to authenticated;

revoke all on role_permissions from authenticated;
grant select, insert, delete on role_permissions to authenticated;

revoke all on member_role_assignments from authenticated;
grant select, insert, delete on member_role_assignments to authenticated;

revoke all on organization_locations from authenticated;
grant select, insert, update on organization_locations to authenticated;

revoke all on departments from authenticated;
grant select, insert, update on departments to authenticated;

revoke all on teams from authenticated;
grant select, insert, update on teams to authenticated;

revoke all on team_members from authenticated;
grant select, insert, delete on team_members to authenticated;

revoke all on organization_invitations from authenticated;
grant select, insert, update on organization_invitations to authenticated;

revoke all on feature_flags from authenticated;
grant select, insert, update on feature_flags to authenticated;

revoke all on audit_events from authenticated;
grant select, insert on audit_events to authenticated;

revoke all on webhook_events from authenticated;
grant select on webhook_events to authenticated;

revoke all on idempotency_keys from authenticated;
grant select, insert, update on idempotency_keys to authenticated;
