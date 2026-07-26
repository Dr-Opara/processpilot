import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));

import { requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { getAuditReadiness, getWorkflowTrend, listProcessAnalytics } from "./analytics-workflows";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

beforeEach(() => {
  vi.mocked(requirePermission).mockReset();
});

describe("listProcessAnalytics", () => {
  it("returns null rates rather than fabricated zeros when nothing has run yet", async () => {
    vi.mocked(requirePermission).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("from processes p"),
        respond: () => [
          {
            process_id: "process-1",
            process_title: "Vendor onboarding",
            workflows_started: "0",
            workflows_completed: "0",
            median_cycle_time_minutes: null,
            exception_count: "0",
          },
        ],
      },
    ]);

    const [result] = await listProcessAnalytics();

    expect(result.completionRate).toBeNull();
    expect(result.exceptionRate).toBeNull();
    expect(result.medianCycleTimeMinutes).toBeNull();
  });

  it("computes completion and exception rates from real counts", async () => {
    vi.mocked(requirePermission).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("from processes p"),
        respond: () => [
          {
            process_id: "process-1",
            process_title: "Vendor onboarding",
            workflows_started: "10",
            workflows_completed: "8",
            median_cycle_time_minutes: 42.5,
            exception_count: "2",
          },
        ],
      },
    ]);

    const [result] = await listProcessAnalytics();

    expect(result.completionRate).toBeCloseTo(0.8);
    expect(result.exceptionRate).toBeCloseTo(0.25);
    expect(result.medianCycleTimeMinutes).toBe(42.5);
  });
});

describe("getWorkflowTrend", () => {
  it("fills every week in the range, even weeks with no activity", async () => {
    vi.mocked(requirePermission).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("from weeks w"),
        respond: () => [
          { week_start: "2026-07-06", started: "3", completed: "2", exceptions: "0" },
          { week_start: "2026-07-13", started: "0", completed: "0", exceptions: "0" },
        ],
      },
    ]);

    const trend = await getWorkflowTrend({ weeks: 2 });

    expect(trend).toEqual([
      { weekStart: "2026-07-06", started: 3, completed: 2, exceptions: 0 },
      { weekStart: "2026-07-13", started: 0, completed: 0, exceptions: 0 },
    ]);
  });
});

describe("getAuditReadiness", () => {
  it("returns null readiness rate when no workflow has completed yet", async () => {
    vi.mocked(requirePermission).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("completed_total"),
        respond: () => [{ completed_total: "0", with_gaps: "0" }],
      },
    ]);

    const result = await getAuditReadiness();

    expect(result.readinessRate).toBeNull();
  });

  it("computes readiness as (completed - gapped) / completed", async () => {
    vi.mocked(requirePermission).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("completed_total"),
        respond: () => [{ completed_total: "20", with_gaps: "3" }],
      },
    ]);

    const result = await getAuditReadiness();

    expect(result.completedWorkflows).toBe(20);
    expect(result.workflowsWithGaps).toBe(3);
    expect(result.readinessRate).toBeCloseTo(0.85);
  });
});
