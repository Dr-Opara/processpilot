import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({ withTenantContext: vi.fn() }));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { createBusinessCalendar, createSlaDefinition } from "./sla-config";

function wireTenantContext(handlers: FakeQueryHandler[]) {
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

describe("createBusinessCalendar", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it("rejects a calendar whose work start is not before its work end", async () => {
    await expect(
      createBusinessCalendar({
        name: "Bad calendar",
        timezone: "UTC",
        workDays: [1, 2, 3, 4, 5],
        workStartMinutes: 1000,
        workEndMinutes: 500,
      }),
    ).rejects.toThrow("before work end");
  });

  it("requires sla.manage and inserts the calendar", async () => {
    const membership = makeMembership({ permissions: ["sla.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("insert into business_calendars"),
        respond: () => [{ id: "cal-1", name: "Standard" }],
      },
      catchAllAudit,
    ]);

    const calendar = await createBusinessCalendar({
      name: "Standard",
      timezone: "UTC",
      workDays: [1, 2, 3, 4, 5],
      workStartMinutes: 540,
      workEndMinutes: 1020,
    });

    expect(calendar.id).toBe("cal-1");
    expect(requirePermission).toHaveBeenCalledWith("sla.manage", expect.anything());
  });
});

describe("createSlaDefinition", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it("requires sla.manage and inserts the definition", async () => {
    const membership = makeMembership({ permissions: ["sla.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("insert into sla_definitions"),
        respond: () => [{ id: "sla-1", name: "Fast task" }],
      },
      catchAllAudit,
    ]);

    const definition = await createSlaDefinition({
      name: "Fast task",
      targetType: "task",
      targetMinutes: 60,
      businessCalendarId: null,
      reminderMinutesBeforeDue: [15],
    });

    expect(definition.id).toBe("sla-1");
  });
});
