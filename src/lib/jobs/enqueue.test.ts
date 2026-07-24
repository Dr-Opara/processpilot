import { describe, it, expect, vi } from "vitest";
import { createFakeSql, asTransactionSql } from "@/lib/db/test-helpers/fake-sql";
import { enqueueJob } from "./enqueue";

vi.mock("server-only", () => ({}));

function fakeJobsSql() {
  return createFakeSql([
    {
      match: (t) => t.includes("insert into background_jobs"),
      respond: (values) => [
        {
          id: "job-1",
          organization_id: values[0],
          job_type: values[1],
          payload: values[2],
          idempotency_key: values[3],
          priority: values[4],
          scheduled_at: values[5] instanceof Date ? values[5].toISOString() : values[5],
          attempts: 0,
          max_attempts: values[6],
          status: "pending",
          locked_at: null,
          locked_by: null,
          last_error: null,
          last_error_at: null,
          created_by: null,
          created_at: "2026-07-24T00:00:00Z",
          updated_at: "2026-07-24T00:00:00Z",
          completed_at: null,
        },
      ],
    },
  ]);
}

describe("enqueueJob", () => {
  it("inserts a job scoped to the given organization with the provided fields", async () => {
    const fake = fakeJobsSql();

    const job = await enqueueJob(asTransactionSql(fake), "org-1", {
      jobType: "workflow-deadline-check",
      payload: { workflowId: "wf-1" },
      idempotencyKey: "workflow-deadline-check:wf-1",
    });

    expect(job.organization_id).toBe("org-1");
    expect(job.job_type).toBe("workflow-deadline-check");
    expect(job.idempotency_key).toBe("workflow-deadline-check:wf-1");
    expect(job.status).toBe("pending");
  });

  it("defaults priority to 0 and max_attempts to 5 when not provided", async () => {
    const fake = fakeJobsSql();

    const job = await enqueueJob(asTransactionSql(fake), "org-1", {
      jobType: "notify",
      payload: {},
      idempotencyKey: "notify:1",
    });

    expect(job.priority).toBe(0);
    expect(job.max_attempts).toBe(5);
  });

  it("passes through an explicit priority, scheduledAt, and maxAttempts", async () => {
    const fake = fakeJobsSql();
    const scheduledAt = new Date("2026-08-01T00:00:00Z");

    const job = await enqueueJob(asTransactionSql(fake), "org-1", {
      jobType: "notify",
      payload: {},
      idempotencyKey: "notify:2",
      priority: 10,
      scheduledAt,
      maxAttempts: 3,
    });

    expect(job.priority).toBe(10);
    expect(job.scheduled_at).toBe(scheduledAt.toISOString());
    expect(job.max_attempts).toBe(3);
  });

  it("uses an on-conflict upsert so re-enqueueing the same idempotency key doesn't error", async () => {
    const fake = fakeJobsSql();

    await enqueueJob(asTransactionSql(fake), "org-1", {
      jobType: "notify",
      payload: {},
      idempotencyKey: "notify:3",
    });

    expect(fake.calls[0].text).toContain("on conflict");
    expect(fake.calls[0].text).toContain("organization_id, idempotency_key");
  });
});
