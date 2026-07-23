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
import { AppError } from "@/lib/errors";
import {
  archiveDepartment,
  createDepartment,
  restoreDepartment,
  updateDepartment,
} from "./departments";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

describe("departments service", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it("creates a department when the caller holds department.manage", async () => {
    const membership = makeMembership({ permissions: ["department.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("select id from departments"), respond: () => [] },
      {
        match: (t) => t.includes("insert into departments"),
        respond: () => [{ id: "dept-1", name: "Kitchen", archived_at: null }],
      },
    ]);

    const department = await createDepartment({ name: "Kitchen" });

    expect(department).toEqual({ id: "dept-1", name: "Kitchen", archived_at: null });
    expect(requirePermission).toHaveBeenCalledWith("department.manage");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });

  it("rejects creation when the caller lacks department.manage", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new AppError("forbidden", "Missing permission: department.manage"),
    );
    wireTenantContext();

    await expect(createDepartment({ name: "Kitchen" })).rejects.toThrow("Missing permission");
  });

  it("rejects a department being set as its own parent before any permission check", async () => {
    const deptId = "11111111-1111-1111-1111-111111111111";
    await expect(updateDepartment(deptId, { parentDepartmentId: deptId })).rejects.toThrow(
      "cannot be its own parent",
    );
    expect(requirePermission).not.toHaveBeenCalled();
  });

  it("scopes update/archive/restore to the specific department id — a manager owning department A cannot silently act on department B", async () => {
    const membership = makeMembership({ scopedPermissions: ["department.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from departments where id"),
        respond: () => [
          { id: "dept-b", name: "Front Desk", archived_at: null, parent_department_id: null },
        ],
      },
      {
        match: (t) => t.includes("update departments set"),
        respond: () => [{ id: "dept-b", name: "Front Desk", archived_at: null }],
      },
    ]);

    await updateDepartment("dept-b", { name: "Front Desk" });

    expect(requirePermission).toHaveBeenCalledWith("department.manage", {
      scope: { departmentId: "dept-b" },
    });
  });

  it("propagates a forbidden error when the caller does not own the target department's scope", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new AppError("forbidden", "Missing permission: department.manage"),
    );
    wireTenantContext();

    await expect(archiveDepartment("dept-not-owned")).rejects.toThrow("Missing permission");
    expect(requirePermission).toHaveBeenCalledWith("department.manage", {
      scope: { departmentId: "dept-not-owned" },
    });
  });

  it("rejects restoring a department whose name collides with an active department", async () => {
    const membership = makeMembership({ permissions: ["department.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from departments where id"),
        respond: () => [{ id: "dept-1", name: "Kitchen", archived_at: "2026-01-01T00:00:00.000Z" }],
      },
      {
        match: (t) =>
          t.includes("select id from departments") && t.includes("archived_at is null and id"),
        respond: () => [{ id: "dept-2" }],
      },
    ]);

    await expect(restoreDepartment("dept-1")).rejects.toThrow("already uses this name");
  });
});
