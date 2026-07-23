import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));

import { getCurrentMembership } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { createFakeSql, asTransactionSql, type FakeQueryHandler } from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { listRoles } from "./roles";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) => fn(asTransactionSql(fakeSql)));
  return fakeSql;
}

describe("roles service", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
  });

  it("lists roles with their permissions and active member counts, available to any active member (read-only)", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("select * from roles"),
        respond: () => [{ id: "role-1", key: "employee", name: "Employee", is_system: true }],
      },
      {
        match: (t) => t.includes("select p.* from role_permissions"),
        respond: () => [{ id: "perm-1", key: "member.invite" }],
      },
      { match: (t) => t.includes("select count(*) as count"), respond: () => [{ count: "3" }] },
    ]);

    const roles = await listRoles();

    expect(roles).toEqual([
      {
        role: { id: "role-1", key: "employee", name: "Employee", is_system: true },
        permissions: [{ id: "perm-1", key: "member.invite" }],
        memberCount: 3,
      },
    ]);
  });
});
