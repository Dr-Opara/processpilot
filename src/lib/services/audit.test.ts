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
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { exportAuditEvents, listAuditEvents } from "./audit";
import { AppError } from "@/lib/errors";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

function auditEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    organization_id: "org-1",
    actor_profile_id: "profile-1",
    action: "exception.closed",
    resource_type: "exception",
    resource_id: "exception-1",
    department_id: "dept-1",
    correlation_id: null,
    source: "app",
    reason: null,
    metadata: {},
    created_at: "2026-07-30T00:00:00.000Z",
    actor_first_name: "Ada",
    actor_last_name: "Owner",
    actor_email: "owner@example.com",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getCurrentMembership).mockReset();
  vi.mocked(requirePermission).mockReset();
});

describe("listAuditEvents", () => {
  it("resolves the actor's display name from the joined profile", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      { match: (t) => t.includes("from audit_events e"), respond: () => [auditEventRow()] },
    ]);

    const { events, hasMore } = await listAuditEvents();

    expect(events).toHaveLength(1);
    expect(events[0].actorName).toBe("Ada Owner (owner@example.com)");
    expect(hasMore).toBe(false);
  });

  it("falls back to null actorName for system-sourced events with no actor", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("from audit_events e"),
        respond: () => [
          auditEventRow({
            actor_profile_id: null,
            actor_first_name: null,
            actor_last_name: null,
            actor_email: null,
            source: "system",
          }),
        ],
      },
    ]);

    const { events } = await listAuditEvents();

    expect(events[0].actorName).toBeNull();
  });

  it("reports hasMore when a page-plus-one row comes back", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("from audit_events e"),
        respond: () => [auditEventRow({ id: "event-1" }), auditEventRow({ id: "event-2" })],
      },
    ]);

    const { events, hasMore } = await listAuditEvents({}, { limit: 1 });

    expect(events).toHaveLength(1);
    expect(hasMore).toBe(true);
  });
});

describe("exportAuditEvents", () => {
  it("requires audit.export", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new AppError("forbidden", "Missing permission: audit.export"),
    );

    await expect(exportAuditEvents()).rejects.toThrow(AppError);
  });

  it("produces a CSV and records its own export audit event", async () => {
    const membership = makeMembership({ permissions: ["audit.export"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("from audit_events e"), respond: () => [auditEventRow()] },
      {
        match: (t) => t.includes("insert into audit_events"),
        respond: () => [{ id: "audit-export-event" }],
      },
    ]);

    const csv = await exportAuditEvents();

    expect(csv).toContain("exception.closed");
    expect(csv).toContain("Ada Owner (owner@example.com)");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });

  it("refuses to export past the row cap", async () => {
    const membership = makeMembership({ permissions: ["audit.export"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const manyRows = Array.from({ length: 5000 }, (_, i) => auditEventRow({ id: `event-${i}` }));
    wireTenantContext([
      { match: (t) => t.includes("from audit_events e"), respond: () => manyRows },
    ]);

    await expect(exportAuditEvents()).rejects.toThrow(AppError);
  });
});
