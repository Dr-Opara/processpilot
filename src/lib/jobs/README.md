# Background jobs

Provider-neutral background/scheduled execution per
[ADR-0009](../../../docs/architecture/decisions/0009-provider-neutral-background-jobs.md).
Backed by a `background_jobs` table in Postgres + Vercel Cron for now —
no external queue vendor or credentials required, so this is fully
testable locally and in CI.

Vercel's Hobby plan allows cron jobs no more frequent than once a day
(see [Vercel's cron usage limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)),
so `vercel.json` ticks the worker once daily rather than every few
minutes. The worker and its callers are unaffected by tick frequency —
`processDueJobs()` claims anything with `scheduled_at <= now()`, so a
coarser tick delays processing rather than breaking correctness — but a
daily tick means workflow deadline checks and retries are only as timely
as the last tick. Moving to a paid Vercel plan (or an external scheduler
that calls `/api/jobs/process` more often, e.g. a provider swap per the
section below) would tighten that latency; that's a plan/cost decision,
not a code change.

## What's provider-neutral

Workflow domain logic (and anything else that schedules work) only ever
touches:

- `registerJobHandler(jobType, handler)` (`registry.ts`) — register what
  a job type does.
- `enqueueJob(sql, organizationId, input)` (`enqueue.ts`) — schedule one.

Both stay exactly the same if the Postgres-polling worker is later
replaced by a dedicated provider (Trigger.dev, Inngest, QStash): a
provider's SDK would call the same registered handlers, and `enqueueJob`
would become a thin wrapper around that provider's "send event" call
instead of an `insert`.

## What's Postgres-specific

`worker.ts` — claiming (`FOR UPDATE SKIP LOCKED`), completing, failing
with exponential backoff, dead-lettering, and stale-lock recovery. Only
`src/app/api/jobs/process/route.ts` (the Vercel Cron-triggered worker
endpoint) imports this file. If the queue provider changes, this file is
the one that gets replaced or deleted — no other file in this directory
should need to.

## Registering a handler

```ts
// In the module that owns the job's meaning (e.g. a future
// src/lib/services/workflows.ts):
import { registerJobHandler } from "@/lib/jobs/registry";

registerJobHandler("workflow-deadline-check", async ({ job }) => {
  // job.payload is whatever enqueueJob() was called with.
});
```

Register handlers at module load (top-level, not inside a function) so
the worker route sees them regardless of which job types actually ran
that tick — import the registering module from
`src/app/api/jobs/process/route.ts` for its side effect.

## Enqueueing

```ts
await enqueueJob(tx, organizationId, {
  jobType: "workflow-deadline-check",
  payload: { workflowId },
  idempotencyKey: `workflow-deadline-check:${workflowId}`,
});
```

Call this inside the same `withTenantContext()` transaction as the
action that triggers it where possible, so the job and its trigger
commit or roll back together.
