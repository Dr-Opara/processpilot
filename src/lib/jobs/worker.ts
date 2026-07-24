import "server-only";
import { getAdminSql } from "@/lib/db/client-admin";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { BackgroundJobRow } from "@/lib/db/database.types";
import { getJobHandler } from "./registry";

/**
 * Postgres-specific worker mechanics — claiming, completing, failing,
 * and stale-lock recovery. Nothing outside src/app/api/jobs/process/
 * (the cron-triggered worker route) should import this file; business
 * logic depends only on enqueueJob()/registerJobHandler() from
 * src/lib/jobs/enqueue.ts and registry.ts, which stay the same if this
 * file is ever replaced by a dedicated queue provider's SDK.
 */

const DEFAULT_BATCH_SIZE = 20;
/** A "processing" job whose lock is older than this is treated as an abandoned claim from a crashed/killed worker invocation. */
const STALE_LOCK_MS = 5 * 60 * 1000;
/** 30s, 60s, 120s, 240s, ... capped at 1 hour — attempts is post-increment (1-based) at the point this is called. */
export function computeBackoffMs(attempts: number): number {
  const base = 30_000 * 2 ** Math.max(0, attempts - 1);
  return Math.min(base, 60 * 60 * 1000);
}

/** Resets abandoned "processing" jobs back to "pending" so a crashed worker invocation can't strand a job forever. Returns the number reclaimed. */
export async function reclaimStaleJobs(staleAfterMs: number = STALE_LOCK_MS): Promise<number> {
  const sql = getAdminSql();
  const reclaimed = await sql<{ id: string }[]>`
    update background_jobs
    set status = 'pending', locked_at = null, locked_by = null
    where status = 'processing'
      and locked_at < now() - (${staleAfterMs}::text || ' milliseconds')::interval
    returning id
  `;
  return reclaimed.length;
}

/**
 * Atomically claims up to `batchSize` due jobs for `workerId` — the CTE
 * + FOR UPDATE SKIP LOCKED is what makes this safe under concurrent
 * worker invocations (Vercel Cron overlap, manual retrigger while one is
 * still running): two workers racing on the same row never both win it,
 * and neither blocks waiting on the other's row lock.
 */
export async function claimBatch(
  workerId: string,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<BackgroundJobRow[]> {
  const sql = getAdminSql();
  return sql<BackgroundJobRow[]>`
    with claimed as (
      select id from background_jobs
      where status = 'pending' and scheduled_at <= now()
      order by priority desc, scheduled_at asc
      limit ${batchSize}
      for update skip locked
    )
    update background_jobs
    set status = 'processing', locked_at = now(), locked_by = ${workerId}, attempts = attempts + 1
    from claimed
    where background_jobs.id = claimed.id
    returning background_jobs.*
  `;
}

export async function completeJob(jobId: string): Promise<void> {
  const sql = getAdminSql();
  await sql`
    update background_jobs
    set status = 'succeeded', completed_at = now(), locked_at = null, locked_by = null
    where id = ${jobId}
  `;
}

/**
 * Reschedules with exponential backoff while attempts remain, otherwise
 * dead-letters and records an audit event — dead-lettering is the one
 * job-lifecycle transition worth a durable, queryable record; individual
 * retry attempts are not (see last_error/last_error_at for those).
 */
export async function failJob(job: BackgroundJobRow, error: string): Promise<void> {
  const sql = getAdminSql();
  const truncatedError = error.slice(0, 2000);

  if (job.attempts >= job.max_attempts) {
    await sql`
      update background_jobs
      set status = 'dead_letter', last_error = ${truncatedError}, last_error_at = now(),
        locked_at = null, locked_by = null
      where id = ${job.id}
    `;
    await recordAuditEvent(sql, {
      organizationId: job.organization_id,
      action: AuditAction.BackgroundJobDeadLettered,
      resourceType: AuditResourceType.BackgroundJob,
      resourceId: job.id,
      source: "system",
      reason: truncatedError,
      metadata: { jobType: job.job_type, attempts: job.attempts },
    });
    return;
  }

  const backoffMs = computeBackoffMs(job.attempts);
  await sql`
    update background_jobs
    set status = 'pending', last_error = ${truncatedError}, last_error_at = now(),
      locked_at = null, locked_by = null,
      scheduled_at = now() + (${backoffMs}::text || ' milliseconds')::interval
    where id = ${job.id}
  `;
}

export interface ProcessDueJobsResult {
  reclaimed: number;
  claimed: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
}

/** The whole worker tick: reclaim, claim, run each job's registered handler, record the outcome. Called once per cron invocation. */
export async function processDueJobs(
  workerId: string,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<ProcessDueJobsResult> {
  const reclaimed = await reclaimStaleJobs();
  const jobs = await claimBatch(workerId, batchSize);

  const result: ProcessDueJobsResult = {
    reclaimed,
    claimed: jobs.length,
    succeeded: 0,
    failed: 0,
    deadLettered: 0,
  };

  for (const job of jobs) {
    const handler = getJobHandler(job.job_type);
    if (!handler) {
      await failJob(job, `No handler is registered for job_type "${job.job_type}".`);
      if (job.attempts >= job.max_attempts) result.deadLettered += 1;
      else result.failed += 1;
      continue;
    }

    try {
      await handler({ job });
      await completeJob(job.id);
      result.succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failJob(job, message);
      if (job.attempts >= job.max_attempts) result.deadLettered += 1;
      else result.failed += 1;
    }
  }

  return result;
}
