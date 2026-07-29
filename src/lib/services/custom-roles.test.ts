import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
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
import { AppError } from "@/lib/errors";
import { archiveCustomRole, createCustomRole, updateCustomRole } from "./custom-roles";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

describe("custom-roles service", () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  it("rejects creating a role that grants a permission the caller doesn't hold (rule 5)", async () => {
    const membership = makeMembership({ permissions: ["role.manage", "member.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext();

    await expect(
      createCustomRole({ name: "Billing peeker", permissionKeys: ["billing.manage"] }),
    ).rejects.toThrow(/cannot grant permissions you don't currently hold/i);
  });

  it("creates a role when every requested permission is already held by the caller", async () => {
    const membership = makeMembership({ permissions: ["role.manage", "member.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select id, key from permissions"),
        respond: () => [{ id: "perm-1", key: "member.manage" }],
      },
      {
        match: (t) => t.includes("insert into roles"),
        respond: () => [
          { id: "role-1", name: "Roster editor", is_system: false, archived_at: null },
        ],
      },
    ]);

    const role = await createCustomRole({
      name: "Roster editor",
      permissionKeys: ["member.manage"],
    });

    expect(role.id).toBe("role-1");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into role_permissions"))).toBe(true);
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });

  it("rejects updating a system role", async () => {
    const membership = makeMembership({ permissions: ["role.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from roles where id"),
        respond: () => [{ id: "role-1", is_system: true, archived_at: null }],
      },
    ]);

    await expect(updateCustomRole("role-1", { name: "Renamed" })).rejects.toThrow(
      /system roles cannot be edited/i,
    );
  });

  it("rejects updating permissions beyond the caller's own held set", async () => {
    const membership = makeMembership({ permissions: ["role.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext();

    await expect(
      updateCustomRole("role-1", { permissionKeys: ["organization.manage"] }),
    ).rejects.toThrow(/cannot grant permissions you don't currently hold/i);
  });

  it("rejects archiving a role that is currently assigned to members", async () => {
    const membership = makeMembership({ permissions: ["role.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from roles where id"),
        respond: () => [{ id: "role-1", is_system: false, archived_at: null }],
      },
      {
        match: (t) => t.includes("select count(*) as count from member_role_assignments"),
        respond: () => [{ count: "2" }],
      },
    ]);

    await expect(archiveCustomRole("role-1")).rejects.toThrow(/currently assigned/i);
  });

  it("propagates a forbidden error when the caller lacks role.manage entirely", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new AppError("forbidden", "Missing permission: role.manage"),
    );
    wireTenantContext();

    await expect(
      createCustomRole({ name: "X", permissionKeys: ["member.manage"] }),
    ).rejects.toThrow("Missing permission");
  });
});
