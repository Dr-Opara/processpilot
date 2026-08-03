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
  // Calls enqueue_background_job() (supabase/migrations/
  // 20260810000004_enqueue_background_job_function.sql) rather than a raw
  // `insert ... on conflict do update` — PostgreSQL's RLS requires the
  // ON CONFLICT arbiter's conflict-detection scan to satisfy the table's
  // SELECT policy, which background_jobs' deliberately-restrictive
  // SELECT policy (diagnostics only, gated on workflow.manage) fails for
  // an ordinary enqueuer even on a genuinely fresh insert. The
  // security-definer function enforces the one invariant that matters
  // (organization_id must match the caller's own) itself, bypassing that
  // RLS/ON CONFLICT interaction entirely.
  const [job] = await sql<BackgroundJobRow[]>`
    select * from enqueue_background_job(
      ${organizationId}, ${input.jobType}, ${sql.json(input.payload as unknown as postgres.JSONValue)},
      ${input.idempotencyKey}, ${input.priority ?? 0}, ${input.scheduledAt ?? new Date()},
      ${input.maxAttempts ?? 5}
    )
  `;
  return job;
}
