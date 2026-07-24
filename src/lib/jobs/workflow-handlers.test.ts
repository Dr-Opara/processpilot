import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client-admin", () => ({ getAdminSql: vi.fn() }));
vi.mock("@/lib/services/workflow-engine", () => ({
  advanceFrom: vi.fn().mockResolvedValue(undefined),
  buildGraphIndex: vi
    .fn()
    .mockReturnValue({ nodeById: new Map(), outgoing: new Map(), incoming: new Map() }),
}));

import { getAdminSql } from "@/lib/db/client-admin";
import { advanceFrom } from "@/lib/services/workflow-engine";
import { getJobHandler } from "@/lib/jobs/registry";
import { createFakeSql, asSql, type FakeQueryHandler } from "@/lib/db/test-helpers/fake-sql";
import type { BackgroundJobRow } from "@/lib/db/database.types";

import "./workflow-handlers";

function job(overrides: Partial<BackgroundJobRow> = {}): BackgroundJobRow {
  return {
    id: "job-1",
    organization_id: "org-1",
    job_type: "workflow-timer-advance",
    payload: {},
    idempotency_key: "key-1",
    priority: 0,
    status: "processing",
    attempts: 1,
    max_attempts: 5,
    scheduled_at: new Date().toISOString(),
    last_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  } as BackgroundJobRow;
}

function wireAdminSql(handlers: FakeQueryHandler[]) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(getAdminSql).mockReturnValue(asSql(fakeSql));
  return fakeSql;
}

describe("workflow-timer-advance handler", () => {
  beforeEach(() => vi.mocked(advanceFrom).mockClear());

  it("is a no-op when the task was already advanced, cancelled, or is a stale retry", async () => {
    const sql = wireAdminSql([
      {
        match: (t) => t.includes("select * from tasks where id"),
        respond: () => [{ id: "task-1", status: "completed", node_type: "timer" }],
      },
    ]);

    await getJobHandler("workflow-timer-advance")!({
      job: job({ payload: { workflowId: "wf-1", taskId: "task-1" } }),
    });

    expect(sql.calls.some((c) => c.text.includes("update tasks set status = 'completed'"))).toBe(
      false,
    );
    expect(advanceFrom).not.toHaveBeenCalled();
  });

  it("is a no-op when the workflow was suspended/cancelled/failed since the timer was scheduled", async () => {
    wireAdminSql([
      {
        match: (t) => t.includes("select * from tasks where id"),
        respond: () => [{ id: "task-1", status: "in_progress", node_type: "timer" }],
      },
      {
        match: (t) => t.includes("select * from workflows where id"),
        respond: () => [{ id: "wf-1", status: "suspended" }],
      },
    ]);

    await getJobHandler("workflow-timer-advance")!({
      job: job({ payload: { workflowId: "wf-1", taskId: "task-1" } }),
    });

    expect(advanceFrom).not.toHaveBeenCalled();
  });

  it("completes the timer task and advances the graph on the happy path", async () => {
    wireAdminSql([
      {
        match: (t) => t.includes("select * from tasks where id"),
        respond: () => [
          { id: "task-1", status: "in_progress", node_type: "timer", node_id: "timer-1" },
        ],
      },
      {
        match: (t) => t.includes("select * from workflows where id"),
        respond: () => [{ id: "wf-1", status: "running", process_version_id: "pv-1" }],
      },
      {
        match: (t) => t.includes("update tasks set status = 'completed'"),
        respond: () => [{ id: "task-1", status: "completed", node_id: "timer-1" }],
      },
      {
        match: (t) => t.includes("select definition from process_versions where id"),
        respond: () => [{ definition: { nodes: [], edges: [] } }],
      },
      { match: (t) => t.includes("insert into task_history"), respond: () => [] },
    ]);

    await getJobHandler("workflow-timer-advance")!({
      job: job({ payload: { workflowId: "wf-1", taskId: "task-1" } }),
    });

    expect(advanceFrom).toHaveBeenCalledTimes(1);
  });

  it("re-running the same job after it already completed does nothing twice (idempotent retry / crash recovery)", async () => {
    const handlers: FakeQueryHandler[] = [
      {
        match: (t) => t.includes("select * from tasks where id"),
        respond: () => [
          { id: "task-1", status: "in_progress", node_type: "timer", node_id: "timer-1" },
        ],
      },
      {
        match: (t) => t.includes("select * from workflows where id"),
        respond: () => [{ id: "wf-1", status: "running", process_version_id: "pv-1" }],
      },
      {
        match: (t) => t.includes("update tasks set status = 'completed'"),
        respond: () => [{ id: "task-1", status: "completed", node_id: "timer-1" }],
      },
      {
        match: (t) => t.includes("select definition from process_versions where id"),
        respond: () => [{ definition: { nodes: [], edges: [] } }],
      },
      { match: (t) => t.includes("insert into task_history"), respond: () => [] },
    ];
    wireAdminSql(handlers);
    await getJobHandler("workflow-timer-advance")!({
      job: job({ payload: { workflowId: "wf-1", taskId: "task-1" } }),
    });
    expect(advanceFrom).toHaveBeenCalledTimes(1);

    // Simulate the retry: this time the task is already completed.
    wireAdminSql([
      {
        match: (t) => t.includes("select * from tasks where id"),
        respond: () => [{ id: "task-1", status: "completed", node_type: "timer" }],
      },
    ]);
    await getJobHandler("workflow-timer-advance")!({
      job: job({ payload: { workflowId: "wf-1", taskId: "task-1" } }),
    });

    expect(advanceFrom).toHaveBeenCalledTimes(1); // still just once
  });
});

describe("workflow-deadline-check handler", () => {
  it("is a no-op when the workflow is not running", async () => {
    const sql = wireAdminSql([
      {
        match: (t) => t.includes("select * from workflows where id"),
        respond: () => [
          { id: "wf-1", status: "suspended", due_at: new Date(Date.now() - 1000).toISOString() },
        ],
      },
    ]);

    await getJobHandler("workflow-deadline-check")!({
      job: job({ job_type: "workflow-deadline-check", payload: { workflowId: "wf-1" } }),
    });

    expect(sql.calls.some((c) => c.text.includes("insert into workflow_history"))).toBe(false);
  });

  it("is a no-op when the due date has not passed yet", async () => {
    const sql = wireAdminSql([
      {
        match: (t) => t.includes("select * from workflows where id"),
        respond: () => [
          { id: "wf-1", status: "running", due_at: new Date(Date.now() + 60_000).toISOString() },
        ],
      },
    ]);

    await getJobHandler("workflow-deadline-check")!({
      job: job({ job_type: "workflow-deadline-check", payload: { workflowId: "wf-1" } }),
    });

    expect(sql.calls.some((c) => c.text.includes("insert into workflow_history"))).toBe(false);
  });

  it("records a breach event and audit entry when a running workflow is past its due date", async () => {
    const sql = wireAdminSql([
      {
        match: (t) => t.includes("select * from workflows where id"),
        respond: () => [
          { id: "wf-1", status: "running", due_at: new Date(Date.now() - 60_000).toISOString() },
        ],
      },
      { match: (t) => t.includes("insert into workflow_history"), respond: () => [] },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);

    await getJobHandler("workflow-deadline-check")!({
      job: job({ job_type: "workflow-deadline-check", payload: { workflowId: "wf-1" } }),
    });

    expect(sql.calls.some((c) => c.text.includes("insert into workflow_history"))).toBe(true);
    expect(sql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });
});
