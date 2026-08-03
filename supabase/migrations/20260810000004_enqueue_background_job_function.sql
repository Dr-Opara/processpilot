-- Replaces enqueueJob()'s raw `insert ... on conflict do update` with a
-- security-definer function, after live testing
-- (background-jobs.integration.test.ts against a real Postgres engine —
-- previously never verified, see
-- docs/operations/production-configuration-matrix.md) surfaced a real
-- PostgreSQL RLS limitation: `INSERT ... ON CONFLICT DO UPDATE` requires
-- its conflict-detection scan to be evaluated under the table's SELECT
-- policy, and background_jobs_select is deliberately restrictive
-- (gated on unscoped workflow.manage — diagnostics only, see
-- 20260719150004's own comment). An ordinary enqueuer without
-- workflow.manage cannot see *any* background_jobs row through that
-- policy, so Postgres cannot safely resolve whether a real conflict
-- exists and rejects the statement outright with "new row violates
-- row-level security policy" — even for a genuinely fresh insert with
-- no existing row at all. 20260810000003's column-scoped UPDATE
-- grant/policy addressed the privilege-check half of this (still
-- correct, left in place) but not this second, independent limitation.
--
-- A security-definer function sidesteps the RLS/ON CONFLICT interaction
-- entirely — the same pattern current_org_id()/has_permission()/
-- has_scoped_permission() already use — while enforcing the one
-- invariant that actually matters here itself: the caller may only
-- enqueue into their own organization.

create or replace function enqueue_background_job(
  p_organization_id uuid,
  p_job_type text,
  p_payload jsonb,
  p_idempotency_key text,
  p_priority integer,
  p_scheduled_at timestamptz,
  p_max_attempts integer
)
returns background_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  result background_jobs;
begin
  if p_organization_id is distinct from current_org_id() then
    raise exception 'cannot enqueue a job for a different organization';
  end if;

  insert into background_jobs (
    organization_id, job_type, payload, idempotency_key, priority, scheduled_at, max_attempts
  ) values (
    p_organization_id, p_job_type, p_payload, p_idempotency_key, p_priority, p_scheduled_at, p_max_attempts
  )
  on conflict (organization_id, idempotency_key)
  do update set updated_at = background_jobs.updated_at
  returning * into result;

  return result;
end;
$$;

revoke all on function enqueue_background_job(uuid, text, jsonb, text, integer, timestamptz, integer) from public;
grant execute on function enqueue_background_job(uuid, text, jsonb, text, integer, timestamptz, integer) to authenticated;
