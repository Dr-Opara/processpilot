import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client-admin", () => ({ getAdminSql: vi.fn() }));
vi.mock("@/lib/jobs/enqueue", () => ({ enqueueJob: vi.fn().mockResolvedValue({}) }));

import { getAdminSql } from "@/lib/db/client-admin";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { getJobHandler } from "@/lib/jobs/registry";
import { createFakeSql, asSql, type FakeQueryHandler } from "@/lib/db/test-helpers/fake-sql";
import type { BackgroundJobRow } from "@/lib/db/database.types";

import "./escalation-handlers";

function job(overrides: Partial<BackgroundJobRow> = {}): BackgroundJobRow {
  return {
    id: "job-1",
    organization_id: "org-1",
    job_type: "task-escalation-check",
    payload: { taskId: "task-1" },
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

const openTask = {
  id: "task-1",
  organization_id: "org-1",
  department_id: null,
  workflow_id: "wf-1",
  status: "assigned",
  sla_definition_id: "sla-1",
  due_at: new Date(Date.now() - 60_000).toISOString(),
};

describe("task-escalation-check handler", () => {
  beforeEach(() => vi.mocked(enqueueJob).mockClear());

  it("is a no-op when the task is no longer open", async () => {
    const fakeSql = wireAdminSql([
      {
        match: (t) => t.includes("select * from tasks where id"),
        respond: () => [{ ...openTask, status: "completed" }],
      },
    ]);

    await getJobHandler("task-escalation-check")!({ job: job() });

    expect(fakeSql.calls.some((c) => c.text.includes("escalation"))).toBe(false);
  });

  it("reschedules a periodic recheck without firing anything while the task's SLA is paused", async () => {
    wireAdminSql([
      {
        match: (t) => t.includes("select * from tasks where id"),
        respond: () => [{ ...openTask, sla_paused_at: new Date().toISOString() }],
      },
    ]);

    await getJobHandler("task-escalation-check")!({ job: job() });

    expect(enqueueJob).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      expect.objectContaining({ jobType: "task-escalation-check", payload: { taskId: "task-1" } }),
    );
  });

  it("checks escalations and does not reschedule once every configured level has fired", async () => {
    wireAdminSql([
      { match: (t) => t.includes("select * from tasks where id"), respond: () => [openTask] },
      {
        match: (t) => t.includes("from escalation_rules"),
        respond: () => [
          {
            id: "rule-1",
            level: 1,
            trigger_after_minutes_past_due: 0,
            action: "remind",
            reassign_target: null,
          },
        ],
      },
      {
        match: (t) => t.includes("select escalation_rule_id from escalation_events"),
        respond: () => [{ escalation_rule_id: "rule-1" }],
      },
    ]);

    await getJobHandler("task-escalation-check")!({ job: job() });

    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it("reschedules itself for the next unfired escalation level", async () => {
    wireAdminSql([
      { match: (t) => t.includes("select * from tasks where id"), respond: () => [openTask] },
      {
        match: (t) => t.includes("from escalation_rules"),
        respond: () => [
          {
            id: "rule-1",
            level: 1,
            trigger_after_minutes_past_due: 0,
            action: "remind",
            reassign_target: null,
          },
          {
            id: "rule-2",
            level: 2,
            trigger_after_minutes_past_due: 60,
            action: "escalate_admin",
            reassign_target: null,
          },
        ],
      },
      {
        match: (t) => t.includes("select escalation_rule_id from escalation_events"),
        respond: () => [{ escalation_rule_id: "rule-1" }],
      },
    ]);

    await getJobHandler("task-escalation-check")!({ job: job() });

    expect(enqueueJob).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      expect.objectContaining({ jobType: "task-escalation-check", payload: { taskId: "task-1" } }),
    );
  });
});
