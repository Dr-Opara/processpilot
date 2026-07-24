import type { JobHandler } from "./types";

/**
 * Provider-neutral. Business logic (future workflow/task services)
 * registers handlers by job_type once, at module load; the worker looks
 * them up by the same string it read off a claimed job row. Swapping the
 * queue provider later means swapping what calls a handler, never the
 * registry or the handlers themselves.
 */
const handlers = new Map<string, JobHandler>();

export function registerJobHandler(jobType: string, handler: JobHandler): void {
  if (handlers.has(jobType)) {
    throw new Error(`A job handler is already registered for "${jobType}".`);
  }
  handlers.set(jobType, handler);
}

export function getJobHandler(jobType: string): JobHandler | undefined {
  return handlers.get(jobType);
}
