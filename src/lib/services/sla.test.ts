import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import {
  createFakeSql,
  asSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { pauseTaskSla, recalculateTaskDueAt, resolveDueAt, resumeTaskSla } from "./sla";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

const catchAllAudit: FakeQueryHandler = {
  match: (t) => t.includes("insert into audit_events"),
  respond: () => [{ id: "audit-1" }],
};

const pausableTask = {
  id: "task-1",
  organization_id: "org-1",
  department_id: null,
  sla_definition_id: "sla-1",
  due_at: "2026-07-27T12:00:00.000Z",
  sla_paused_at: null,
};

describe("resolveDueAt", () => {
  it("returns null when the SLA definition doesn't resolve (missing or archived)", async () => {
    const sql = asSql(
      createFakeSql([{ match: (t) => t.includes("from sla_definitions"), respond: () => [] }]),
    );
    expect(await resolveDueAt(sql, "org-1", "sla-1")).toBeNull();
  });

  it("computes a naive due date when the definition has no business calendar", async () => {
    const handlers: FakeQueryHandler[] = [
      {
        match: (t) => t.includes("from sla_definitions"),
        respond: () => [
          {
            id: "sla-1",
            organization_id: "org-1",
            target_minutes: 120,
            business_calendar_id: null,
            status: "active",
          },
        ],
      },
    ];
    const sql = asSql(createFakeSql(handlers));
    const from = new Date("2026-07-27T10:00:00Z");

    const result = await resolveDueAt(sql, "org-1", "sla-1", from);

    expect(result?.dueAt.toISOString()).toBe("2026-07-27T12:00:00.000Z");
    expect(result?.definition.id).toBe("sla-1");
  });

  it("computes a calendar-aware due date when a business calendar is configured", async () => {
    const handlers: FakeQueryHandler[] = [
      {
        match: (t) => t.includes("from sla_definitions"),
        respond: () => [
          {
            id: "sla-1",
            organization_id: "org-1",
            target_minutes: 120,
            business_calendar_id: "cal-1",
            status: "active",
          },
        ],
      },
      {
        match: (t) => t.includes("from business_calendars"),
        respond: () => [
          {
            id: "cal-1",
            timezone: "UTC",
            work_days: [1, 2, 3, 4, 5],
            work_start_minutes: 540,
            work_end_minutes: 1020,
          },
        ],
      },
      { match: (t) => t.includes("from business_calendar_holidays"), respond: () => [] },
    ];
    const sql = asSql(createFakeSql(handlers));
    // Friday 16:00 UTC + 120 minutes: 1h left Friday -> Monday 09:00 + 1h = 10:00.
    const from = new Date("2026-07-31T16:00:00Z");

    const result = await resolveDueAt(sql, "org-1", "sla-1", from);

    expect(result?.dueAt.toISOString()).toBe("2026-08-03T10:00:00.000Z");
  });
});

describe("pauseTaskSla / resumeTaskSla", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it("pauses a task's SLA clock", async () => {
    const preCheck = makeMembership();
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    const membership = makeMembership({ permissions: ["sla.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("select * from tasks where id"), respond: () => [pausableTask] },
      {
        match: (t) => t.includes("update tasks set sla_paused_at = now()"),
        respond: () => [{ ...pausableTask, sla_paused_at: "2026-07-27T11:00:00.000Z" }],
      },
      catchAllAudit,
    ]);

    const updated = await pauseTaskSla("task-1");

    expect(updated.sla_paused_at).toBe("2026-07-27T11:00:00.000Z");
    expect(
      fakeSql.calls.some((c) => c.text.includes("update tasks set sla_paused_at = now()")),
    ).toBe(true);
  });

  it("rejects pausing a task with no SLA", async () => {
    const preCheck = makeMembership();
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from tasks where id"),
        respond: () => [{ ...pausableTask, sla_definition_id: null, due_at: null }],
      },
    ]);

    await expect(pauseTaskSla("task-1")).rejects.toThrow("no SLA to pause");
  });

  it("shifts due_at forward by the elapsed paused duration on resume", async () => {
    const preCheck = makeMembership();
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    const membership = makeMembership({ permissions: ["sla.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const pausedTenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from tasks where id"),
        respond: () => [{ ...pausableTask, sla_paused_at: pausedTenMinutesAgo }],
      },
      {
        match: (t) => t.includes("update tasks set") && t.includes("sla_paused_at = null"),
        respond: (values) => [{ ...pausableTask, sla_paused_at: null, due_at: values[0] }],
      },
      catchAllAudit,
    ]);

    const updated = await resumeTaskSla("task-1");

    expect(updated.sla_paused_at).toBeNull();
    expect(new Date(updated.due_at as string).getTime()).toBeGreaterThan(
      new Date(pausableTask.due_at).getTime(),
    );
    expect(
      fakeSql.calls.some((c) =>
        c.text.includes("sla_paused_minutes_total = sla_paused_minutes_total"),
      ),
    ).toBe(true);
  });

  it("rejects resuming a task that isn't paused", async () => {
    const preCheck = makeMembership();
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    wireTenantContext([
      { match: (t) => t.includes("select * from tasks where id"), respond: () => [pausableTask] },
    ]);

    await expect(resumeTaskSla("task-1")).rejects.toThrow("is not paused");
  });
});

describe("recalculateTaskDueAt", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it("re-resolves due_at from the task's snapshotted SLA definition", async () => {
    const preCheck = makeMembership();
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    const membership = makeMembership({ permissions: ["sla.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("select * from tasks where id"), respond: () => [pausableTask] },
      {
        match: (t) => t.includes("from sla_definitions"),
        respond: () => [
          {
            id: "sla-1",
            organization_id: "org-1",
            target_minutes: 60,
            business_calendar_id: null,
            status: "active",
          },
        ],
      },
      {
        match: (t) => t.includes("update tasks set due_at"),
        respond: () => [
          { ...pausableTask, due_at: "2026-07-27T13:00:00.000Z", sla_paused_at: null },
        ],
      },
      catchAllAudit,
    ]);

    const updated = await recalculateTaskDueAt("task-1");

    expect(updated.due_at).toBe("2026-07-27T13:00:00.000Z");
    expect(fakeSql.calls.some((c) => c.text.includes("update tasks set due_at"))).toBe(true);
  });

  it("rejects a task with no SLA definition to recalculate against", async () => {
    const preCheck = makeMembership();
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from tasks where id"),
        respond: () => [{ ...pausableTask, sla_definition_id: null }],
      },
    ]);

    await expect(recalculateTaskDueAt("task-1")).rejects.toThrow("no SLA definition");
  });
});
