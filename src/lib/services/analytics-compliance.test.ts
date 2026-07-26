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
import { getCapaClosureStats, getTrainingCompliance } from "./analytics-compliance";

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

describe("getTrainingCompliance", () => {
  it("returns null rates when there is no data yet", async () => {
    vi.mocked(requirePermission).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("from training_assignments"),
        respond: () => [{ total: "0", on_time: "0" }],
      },
      {
        match: (t) => t.includes("from certifications"),
        respond: () => [{ active: "0", expired: "0" }],
      },
    ]);

    const result = await getTrainingCompliance();

    expect(result.onTimeCompletionRate).toBeNull();
    expect(result.certificationCurrencyRate).toBeNull();
  });

  it("computes on-time completion and certification currency rates", async () => {
    vi.mocked(requirePermission).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("from training_assignments"),
        respond: () => [{ total: "10", on_time: "7" }],
      },
      {
        match: (t) => t.includes("from certifications"),
        respond: () => [{ active: "8", expired: "2" }],
      },
    ]);

    const result = await getTrainingCompliance();

    expect(result.onTimeCompletionRate).toBeCloseTo(0.7);
    expect(result.certificationCurrencyRate).toBeCloseTo(0.8);
  });
});

describe("getCapaClosureStats", () => {
  it("returns null closure rate when there are no CAPA plans yet", async () => {
    vi.mocked(requirePermission).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("from capa_plans"),
        respond: () => [{ total: "0", closed: "0", median_days: null }],
      },
    ]);

    const result = await getCapaClosureStats();

    expect(result.closureRate).toBeNull();
    expect(result.medianDaysToClose).toBeNull();
  });

  it("computes closure rate and median days to close", async () => {
    vi.mocked(requirePermission).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("from capa_plans"),
        respond: () => [{ total: "5", closed: "3", median_days: 4.5 }],
      },
    ]);

    const result = await getCapaClosureStats();

    expect(result.closureRate).toBeCloseTo(0.6);
    expect(result.medianDaysToClose).toBe(4.5);
  });
});
