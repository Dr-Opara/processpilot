import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));
vi.mock("@/lib/jobs/enqueue", () => ({ enqueueJob: vi.fn().mockResolvedValue({}) }));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { enqueueJob } from "@/lib/jobs/enqueue";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { decideWaiver, expireWaiver, renewWaiver, requestWaiver, revokeWaiver } from "./waivers";
import { AppError } from "@/lib/errors";
import type { ExceptionRow, TemporaryWaiverRow } from "@/lib/db/database.types";

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

function exception(overrides: Partial<ExceptionRow> = {}): ExceptionRow {
  return {
    id: "exc-1",
    organization_id: "org-1",
    department_id: null,
    ...overrides,
  } as ExceptionRow;
}

function waiver(overrides: Partial<TemporaryWaiverRow> = {}): TemporaryWaiverRow {
  return {
    id: "waiver-1",
    organization_id: "org-1",
    department_id: null,
    exception_id: "exc-1",
    business_justification: "Vendor migration in progress",
    compensating_controls: null,
    risk_acceptance: null,
    requested_by_member_id: "member-1",
    approver_member_id: null,
    status: "requested",
    start_at: null,
    expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    created_at: new Date().toISOString(),
    decided_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getCurrentMembership).mockReset();
  vi.mocked(requirePermission).mockReset();
  vi.mocked(enqueueJob).mockClear();
});

describe("requestWaiver", () => {
  it("rejects an expiration date in the past", async () => {
    await expect(
      requestWaiver("exc-1", {
        businessJustification: "x",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    ).rejects.toThrow("must be in the future");
  });

  it("creates a waiver request", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["waivers.create"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from exceptions where id"),
        respond: () => [exception()],
      },
      { match: (t) => t.includes("insert into temporary_waivers"), respond: () => [waiver()] },
      catchAllAudit,
    ]);

    const created = await requestWaiver("exc-1", {
      businessJustification: "Vendor migration in progress",
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    });

    expect(created.status).toBe("requested");
  });
});

describe("decideWaiver", () => {
  it("rejects deciding an already-decided waiver", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("select * from temporary_waivers where id"),
        respond: () => [waiver({ status: "active" })],
      },
    ]);

    await expect(decideWaiver("waiver-1", "approved")).rejects.toThrow(AppError);
  });

  it("approving schedules the expiration-check job", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["waivers.approve"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from temporary_waivers where id"),
        respond: () => [waiver({ status: "requested" })],
      },
      { match: (t) => t.includes("insert into waiver_approvals"), respond: () => [] },
      {
        match: (t) => t.includes("update temporary_waivers set"),
        respond: () => [waiver({ status: "active" })],
      },
      catchAllAudit,
    ]);

    const updated = await decideWaiver("waiver-1", "approved");
    expect(updated.status).toBe("active");
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      expect.objectContaining({ jobType: "waiver-expiration-check" }),
    );
  });
});

describe("renewWaiver", () => {
  it("requires the new expiration to extend the current one", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const existing = waiver({ status: "active" });
    wireTenantContext([
      {
        match: (t) => t.includes("select * from temporary_waivers where id"),
        respond: () => [existing],
      },
    ]);

    await expect(
      renewWaiver("waiver-1", new Date(Date.now() - 1000).toISOString()),
    ).rejects.toThrow("must extend");
  });

  it("renews and re-schedules expiration", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["waivers.approve"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const newExpiry = new Date(Date.now() + 30 * 86_400_000).toISOString();
    wireTenantContext([
      {
        match: (t) => t.includes("select * from temporary_waivers where id"),
        respond: () => [waiver({ status: "active" })],
      },
      { match: (t) => t.includes("insert into waiver_renewals"), respond: () => [] },
      {
        match: (t) => t.includes("update temporary_waivers set status = 'renewed'"),
        respond: () => [waiver({ status: "renewed", expires_at: newExpiry })],
      },
      catchAllAudit,
    ]);

    const updated = await renewWaiver("waiver-1", newExpiry);
    expect(updated.status).toBe("renewed");
    expect(enqueueJob).toHaveBeenCalled();
  });
});

describe("revokeWaiver", () => {
  it("only revokes an active/renewed waiver", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("select * from temporary_waivers where id"),
        respond: () => [waiver({ status: "expired" })],
      },
    ]);

    await expect(revokeWaiver("waiver-1")).rejects.toThrow("Only an active waiver");
  });
});

describe("expireWaiver (background job)", () => {
  it("is idempotent — a no-op for a waiver that isn't active/renewed or isn't past due", async () => {
    const fakeSql = createFakeSql([
      {
        match: (t) => t.includes("select * from temporary_waivers"),
        respond: () => [waiver({ status: "requested" })],
      },
    ]);
    await expireWaiver(asTransactionSql(fakeSql), "waiver-1", "org-1");
    expect(
      fakeSql.calls.some((c) => c.text.includes("update temporary_waivers set status = 'expired'")),
    ).toBe(false);
  });

  it("expires an active waiver past its expiration", async () => {
    const fakeSql = createFakeSql([
      {
        match: (t) => t.includes("select * from temporary_waivers"),
        respond: () => [
          waiver({ status: "active", expires_at: new Date(Date.now() - 1000).toISOString() }),
        ],
      },
      {
        match: (t) => t.includes("update temporary_waivers set status = 'expired'"),
        respond: () => [],
      },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);
    await expireWaiver(asTransactionSql(fakeSql), "waiver-1", "org-1");
    expect(
      fakeSql.calls.some((c) => c.text.includes("update temporary_waivers set status = 'expired'")),
    ).toBe(true);
  });
});
