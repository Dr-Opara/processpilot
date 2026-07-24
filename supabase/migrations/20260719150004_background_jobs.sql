-- Phase 8 (Workflow execution engine), first slice: the provider-neutral
-- background-job queue ADR-0009 defers to Phase 8 design. Backed by this
-- table + Vercel Cron for now (no external queue vendor/credentials);
-- src/lib/jobs/ is written so a dedicated provider (Trigger.dev, Inngest,
-- QStash) can replace the polling worker later without workflow domain
-- logic (job handlers, enqueue call sites) changing — see
-- src/lib/jobs/README.md.
--
-- Every job belongs to exactly one organization (ADR-0009's security
-- note: job handlers process tenant-scoped data). Claiming, completing,
-- failing, and reclaiming are worker-only operations performed through
-- the service-role admin client (src/lib/db/client-admin.ts), which
-- bypasses RLS entirely — the policies below govern the two things
-- regular tenant-scoped request code is allowed to do: enqueue a job for
-- its own org, and read job status for its own org (diagnostics).
create table background_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  job_type text not null,
  payload jsonb not null default '{}',
  -- Scoped per-organization rather than globally unique: two different
  -- organizations legitimately enqueueing logically-"same" work (e.g.
  -- both starting a workflow at the same instant) must not collide.
  idempotency_key text not null,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'succeeded', 'failed', 'dead_letter')
  ),
  -- Higher runs first. Ties broken by scheduled_at (older first).
  priority integer not null default 0,
  scheduled_at timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  last_error_at timestamptz,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index background_jobs_idempotency_key_idx
  on background_jobs (organization_id, idempotency_key);

-- Serves the worker's claim query directly: pending jobs due to run,
-- cheapest-first ordering baked into the index itself.
create index background_jobs_claim_idx
  on background_jobs (priority desc, scheduled_at asc)
  where status = 'pending';

-- Serves stale-lock recovery: processing jobs, oldest lock first.
create index background_jobs_locked_idx
  on background_jobs (locked_at)
  where status = 'processing';

create index background_jobs_organization_id_idx on background_jobs (organization_id);

create trigger background_jobs_set_updated_at
  before update on background_jobs
  for each row
  execute function set_updated_at();

alter table background_jobs enable row level security;

-- Enqueueing is a side effect of ordinary tenant-scoped actions (e.g.
-- starting a workflow), not a separately-permissioned one — the job's
-- eventual handler enforces whatever permission its actual side effect
-- needs when it runs, the same way a queued email send doesn't require
-- the enqueuer to hold a separate "send email" permission.
create policy background_jobs_insert on background_jobs
  for insert
  with check (organization_id = current_org_id());

-- Diagnostics read only — gated on workflow.manage (org-wide grant only;
-- see 20260719130002) rather than exposing job-queue internals to every
-- member who can merely start or complete workflow tasks.
create policy background_jobs_select on background_jobs
  for select
  using (organization_id = current_org_id() and has_permission('workflow.manage'));

-- No update/delete policy for the `authenticated` role: claiming,
-- completing, failing, dead-lettering, and stale-lock recovery are
-- worker-only operations through the admin client, which bypasses RLS
-- rather than needing a policy here.

-- Supabase's project template grants ALL privileges to `authenticated` by
-- default on every new table — revoke that before granting narrowly, per
-- 20260719130006_fix_authenticated_default_privileges.sql. No `update`/
-- `delete` grant: worker mutations go through the admin client, which
-- isn't the `authenticated` role at all.
revoke all on background_jobs from anon, public, authenticated;
grant select, insert on background_jobs to authenticated;
