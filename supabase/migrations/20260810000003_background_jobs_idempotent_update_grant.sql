-- Fixes a real, previously-unverified bug in enqueueJob()'s idempotent
-- re-enqueue path (src/lib/jobs/enqueue.ts), first surfaced by actually
-- running background-jobs.integration.test.ts against a live Postgres
-- engine (previously never verified — see
-- docs/operations/production-configuration-matrix.md).
--
-- enqueueJob() always issues `insert ... on conflict (organization_id,
-- idempotency_key) do update set updated_at = background_jobs.updated_at`
-- — the `do update` clause exists only so `returning *` gives back the
-- existing row on a repeat call, never to change anything meaningful.
-- Postgres requires UPDATE privilege on the target table for the
-- statement to even parse/execute an ON CONFLICT DO UPDATE clause,
-- checked before Row-Level Security is evaluated, regardless of whether
-- a given call actually hits the conflict path. 20260719150004's
-- `grant select, insert on background_jobs to authenticated` (worker
-- mutations — claim/complete/fail/reclaim — deliberately go through the
-- service-role admin client instead, per that migration's own comment)
-- means every call to enqueueJob() from ordinary tenant-scoped request
-- code — i.e. nearly every real call site — has always failed outright
-- with "permission denied for table background_jobs", not merely on an
-- actual idempotency collision.
--
-- Fixed narrowly rather than by granting a general UPDATE: a
-- column-level grant restricted to `updated_at` (the only column this
-- path ever sets) plus an UPDATE policy scoped the same way as every
-- other policy on this table, so `authenticated` still cannot set
-- status/attempts/payload/last_error — the worker-only mutation
-- boundary this table's design deliberately preserves — even though it
-- can now complete the idempotent no-op update ON CONFLICT requires.

grant update (updated_at) on background_jobs to authenticated;

create policy background_jobs_update_idempotent_reenqueue on background_jobs
  for update
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());
