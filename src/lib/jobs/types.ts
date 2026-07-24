import type { BackgroundJobRow } from "@/lib/db/database.types";

/**
 * The provider-neutral surface (ADR-0009). Everything in this file is
 * safe for workflow domain logic to depend on regardless of which
 * adapter is running underneath — see README.md for exactly where the
 * Postgres-specific boundary starts.
 */
export interface EnqueueJobInput {
  jobType: string;
  payload: Record<string, unknown>;
  /**
   * Unique per organization — enqueueing with a key that already exists
   * for that org returns the existing job instead of creating a
   * duplicate. Callers should derive this from the business fact being
   * scheduled (e.g. `workflow-deadline-check:${workflowId}`), not a
   * random value, or idempotency does nothing.
   */
  idempotencyKey: string;
  /** Higher runs first. Default 0. */
  priority?: number;
  /** Defaults to now — set for a future-scheduled job (e.g. a deadline check). */
  scheduledAt?: Date;
  /** Default 5 — see src/lib/jobs/worker.ts's backoff schedule. */
  maxAttempts?: number;
}

export interface JobHandlerContext {
  job: BackgroundJobRow;
}

/**
 * A job handler is pure business logic: given a job's payload, do the
 * work, throw on failure. It never touches queue mechanics (claiming,
 * locking, retry bookkeeping) — that's the worker's job, so the handler
 * itself doesn't change when the underlying adapter does.
 */
export type JobHandler = (context: JobHandlerContext) => Promise<void>;
