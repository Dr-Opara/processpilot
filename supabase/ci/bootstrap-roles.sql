-- Bootstraps a vanilla PostgreSQL instance (used only by
-- .github/workflows/migration-validation.yml's ephemeral service
-- container) to look enough like a real Supabase project for
-- supabase/migrations/*.sql to apply cleanly and for RLS to be
-- exercised exactly as it is in production:
--
-- - `anon`/`authenticated`/`service_role` are roles Supabase's own
--   project template creates automatically; every migration's
--   `revoke ... / grant ... to authenticated` statements assume they
--   already exist. `service_role` gets `bypassrls` to mirror Supabase's
--   real behavior (this repo's own service-role access instead goes
--   through the Postgres superuser via SUPABASE_DB_URL — see
--   src/lib/db/client-admin.ts — but declaring the role keeps this
--   bootstrap accurate to a real project's role set).
-- - `storage.buckets` is stubbed with only the columns this repo's
--   migrations actually reference (`insert into storage.buckets (id,
--   name, public) ...`). `storage.objects` is deliberately NOT stubbed
--   here — no migration in this repo creates policies on it (private
--   buckets, service-role-only access; see
--   20260719150001_knowledge_documents.sql's header comment), so it is
--   not needed for the migrations to apply or for RLS to be proven.
--
-- Not a substitute for eventually running this same migration sequence
-- against a real Supabase project (Phase 26's own unmet exit
-- criterion) — this validates the SQL applies cleanly and that RLS
-- policies behave correctly against a real Postgres engine, which is
-- the part that was previously never verified anywhere in this
-- environment.

create extension if not exists pgcrypto;

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);
