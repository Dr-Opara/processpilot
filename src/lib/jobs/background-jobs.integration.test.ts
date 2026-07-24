import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getTestSql, withTestClaims } from "@/lib/db/client-test";

// enqueue.ts/worker.ts are "server-only" (correctly, for real app code) —
// that guard trips under this suite's jsdom test environment, which
// simulates `window`. Stubbing it out is safe here: it only disables the
// module-load-time environment check, not any DB behavior this suite
// actually verifies.
vi.mock("server-only", () => ({}));

const { enqueueJob } = await import("./enqueue");
const { claimBatch, completeJob, failJob, reclaimStaleJobs } = await import("./worker");

/**
 * Live-DB proof that the migration + worker SQL actually behave the way
 * worker.test.ts's mocked unit tests assume — idempotent enqueue, tenant
 * isolation on insert, priority/scheduled_at claim ordering, locking,
 * retry backoff, dead-lettering, and stale-lock recovery. Skips itself
 * when SUPABASE_DB_URL is unset, same pattern as
 * tenant-isolation.integration.test.ts. Run for real with `npm run
 * test:integration`.
 */
const sql = getTestSql();

describe.skipIf(!sql)("background jobs (live Supabase Postgres)", () => {
  const db = sql!;
  const suffix = `test_${Date.now()}`;

  let orgA: { id: string };
  let orgB: { id: string };
  let profileA: { id: string; clerk_user_id: string };
  let memberA: { id: string };

  beforeAll(async () => {
    [orgA] = await db<{ id: string }[]>`
      insert into organizations (clerk_org_id, name, slug)
      values (${`org_a_${suffix}`}, 'Test Org A', ${`test-org-a-${suffix}`})
      returning id
    `;
    [orgB] = await db<{ id: string }[]>`
      insert into organizations (clerk_org_id, name, slug)
      values (${`org_b_${suffix}`}, 'Test Org B', ${`test-org-b-${suffix}`})
      returning id
    `;
    [profileA] = await db<{ id: string; clerk_user_id: string }[]>`
      insert into profiles (clerk_user_id, email)
      values (${`user_a_${suffix}`}, ${`a@${suffix}.test`})
      returning id, clerk_user_id
    `;
    [memberA] = await db<{ id: string }[]>`
      insert into organization_members (organization_id, profile_id, clerk_membership_id, status)
      values (${orgA.id}, ${profileA.id}, ${`orgmem_${profileA.id}`}, 'active')
      returning id
    `;
  });

  afterAll(async () => {
    await db`delete from organizations where id in (${orgA.id}, ${orgB.id})`;
    await db.end();
  });

  async function enqueueAsOrgA(input: Parameters<typeof enqueueJob>[2]) {
    return withTestClaims(
      db,
      { clerkUserId: profileA.clerk_user_id, organizationId: orgA.id, memberId: memberA.id },
      (tx) => enqueueJob(tx, orgA.id, input),
    );
  }

  it("is idempotent per (organization_id, idempotency_key)", async () => {
    const key = `idem-${suffix}`;
    const first = await enqueueAsOrgA({
      jobType: "test-job",
      payload: { n: 1 },
      idempotencyKey: key,
    });
    const second = await enqueueAsOrgA({
      jobType: "test-job",
      payload: { n: 2 },
      idempotencyKey: key,
    });

    expect(second.id).toBe(first.id);

    const rows = await db<{ id: string }[]>`
      select id from background_jobs where organization_id = ${orgA.id} and idempotency_key = ${key}
    `;
    expect(rows).toHaveLength(1);

    // claimBatch has no per-org/per-test filter (workers claim globally by
    // design) — leaving this row "pending" would let it get swept into a
    // later test's claim and skew its assertions. Delete it now that this
    // test is done with it.
    await db`delete from background_jobs where id = ${first.id}`;
  });

  it("cannot be enqueued for a different organization than the caller's claimed one", async () => {
    await expect(
      withTestClaims(
        db,
        { clerkUserId: profileA.clerk_user_id, organizationId: orgA.id, memberId: memberA.id },
        (tx) =>
          enqueueJob(tx, orgB.id, {
            jobType: "test-job",
            payload: {},
            idempotencyKey: `cross-org-${suffix}`,
          }),
      ),
    ).rejects.toThrow();

    const rows = await db<{ id: string }[]>`
      select id from background_jobs where organization_id = ${orgB.id} and idempotency_key = ${`cross-org-${suffix}`}
    `;
    expect(rows).toHaveLength(0);
  });

  it("claims due jobs in priority order, locks them, and increments attempts", async () => {
    const workerId = `worker-${suffix}-1`;
    const low = await enqueueAsOrgA({
      jobType: "test-job",
      payload: {},
      idempotencyKey: `priority-low-${suffix}`,
      priority: 0,
    });
    const high = await enqueueAsOrgA({
      jobType: "test-job",
      payload: {},
      idempotencyKey: `priority-high-${suffix}`,
      priority: 10,
    });

    // A generous batch size, not 2: claimBatch has no per-test filter, so
    // this asserts high/low's relative order within whatever else is due,
    // rather than assuming these are the only two pending jobs.
    const claimed = await claimBatch(workerId, 50);
    const claimedIds = claimed.map((j) => j.id);
    expect(claimedIds).toContain(low.id);
    expect(claimedIds).toContain(high.id);
    expect(claimedIds.indexOf(high.id)).toBeLessThan(claimedIds.indexOf(low.id));

    const claimedHigh = claimed.find((j) => j.id === high.id)!;
    expect(claimedHigh.status).toBe("processing");
    expect(claimedHigh.locked_by).toBe(workerId);
    expect(claimedHigh.locked_at).not.toBeNull();
    expect(claimedHigh.attempts).toBe(1);
  });

  it("does not claim a job scheduled in the future", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const job = await enqueueAsOrgA({
      jobType: "test-job",
      payload: {},
      idempotencyKey: `future-${suffix}`,
      scheduledAt: future,
    });

    const claimed = await claimBatch(`worker-${suffix}-future`, 50);
    expect(claimed.some((j) => j.id === job.id)).toBe(false);
  });

  it("does not let a second claim pick up an already-claimed job", async () => {
    const job = await enqueueAsOrgA({
      jobType: "test-job",
      payload: {},
      idempotencyKey: `single-claim-${suffix}`,
    });

    const firstClaim = await claimBatch(`worker-${suffix}-a`, 1);
    expect(firstClaim.some((j) => j.id === job.id)).toBe(true);

    const secondClaim = await claimBatch(`worker-${suffix}-b`, 50);
    expect(secondClaim.some((j) => j.id === job.id)).toBe(false);
  });

  it("marks a job succeeded on completeJob", async () => {
    const job = await enqueueAsOrgA({
      jobType: "test-job",
      payload: {},
      idempotencyKey: `complete-${suffix}`,
    });
    await claimBatch(`worker-${suffix}-complete`, 50);

    await completeJob(job.id);

    const [row] = await db<{ status: string; completed_at: string | null }[]>`
      select status, completed_at from background_jobs where id = ${job.id}
    `;
    expect(row.status).toBe("succeeded");
    expect(row.completed_at).not.toBeNull();
  });

  it("reschedules with backoff on failure while attempts remain", async () => {
    const job = await enqueueAsOrgA({
      jobType: "test-job",
      payload: {},
      idempotencyKey: `retry-${suffix}`,
      maxAttempts: 5,
    });
    const [claimed] = await claimBatch(`worker-${suffix}-retry`, 1);

    await failJob(claimed, "transient failure");

    const [row] = await db<{ status: string; scheduled_at: string; last_error: string | null }[]>`
      select status, scheduled_at, last_error from background_jobs where id = ${job.id}
    `;
    expect(row.status).toBe("pending");
    expect(row.last_error).toBe("transient failure");
    expect(new Date(row.scheduled_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("dead-letters and records an audit event once max_attempts is reached", async () => {
    const job = await enqueueAsOrgA({
      jobType: "test-job",
      payload: {},
      idempotencyKey: `dead-letter-${suffix}`,
      maxAttempts: 1,
    });
    const [claimed] = await claimBatch(`worker-${suffix}-dl`, 1);
    expect(claimed.attempts).toBe(1);

    await failJob(claimed, "permanent failure");

    const [row] = await db<{ status: string }[]>`
      select status from background_jobs where id = ${job.id}
    `;
    expect(row.status).toBe("dead_letter");

    const [event] = await db<{ action: string; resource_id: string }[]>`
      select action, resource_id from audit_events
      where resource_type = 'background_job' and resource_id = ${job.id}
    `;
    expect(event.action).toBe("background_job.dead_lettered");
  });

  it("reclaims a job whose lock has gone stale", async () => {
    const job = await enqueueAsOrgA({
      jobType: "test-job",
      payload: {},
      idempotencyKey: `stale-${suffix}`,
    });
    await claimBatch(`worker-${suffix}-stale`, 50);
    // Simulate a crashed worker: back-date the lock past the staleness threshold directly.
    await db`update background_jobs set locked_at = now() - interval '10 minutes' where id = ${job.id}`;

    const reclaimedCount = await reclaimStaleJobs(5 * 60 * 1000);
    expect(reclaimedCount).toBeGreaterThanOrEqual(1);

    const [row] = await db<{ status: string; locked_at: string | null }[]>`
      select status, locked_at from background_jobs where id = ${job.id}
    `;
    expect(row.status).toBe("pending");
    expect(row.locked_at).toBeNull();
  });
});
