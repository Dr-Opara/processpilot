import "server-only";
import type postgres from "postgres";
import type { BackgroundJobRow } from "@/lib/db/database.types";
import type { EnqueueJobInput } from "./types";

/**
 * The provider-neutral call site business logic uses to schedule work —
 * takes the same sql/transaction handle recordAuditEvent() does, so a
 * caller inside withTenantContext() can enqueue a job atomically with
 * the action that triggered it (e.g. a workflow row insert and its
 * first deadline-check job commit or roll back together).
 *
 * Idempotent by (organization_id, idempotency_key): re-enqueueing with
 * the same key returns the existing row rather than erroring or
 * duplicating — the "do update set updated_at = updated_at" is a no-op
 * write that exists only to make `returning *` give back the existing
 * row through the same statement.
 */
export async function enqueueJob(
  sql: postgres.Sql | postgres.TransactionSql,
  organizationId: string,
  input: EnqueueJobInput,
): Promise<BackgroundJobRow> {
  const [job] = await sql<BackgroundJobRow[]>`
    insert into background_jobs (
      organization_id, job_type, payload, idempotency_key, priority, scheduled_at, max_attempts
    ) values (
      ${organizationId}, ${input.jobType}, ${sql.json(input.payload as unknown as postgres.JSONValue)},
      ${input.idempotencyKey}, ${input.priority ?? 0}, ${input.scheduledAt ?? new Date()},
      ${input.maxAttempts ?? 5}
    )
    on conflict (organization_id, idempotency_key)
    do update set updated_at = background_jobs.updated_at
    returning *
  `;
  return job;
}
