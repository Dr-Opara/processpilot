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
import { delegateAdministrator } from "./delegated-admins";

const MEMBER_2 = "22222222-2222-4222-8222-222222222222";
const ROLE_1 = "33333333-3333-4333-8333-333333333333";
const DEPT_1 = "44444444-4444-4444-8444-444444444444";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

describe("delegated-admins service", () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  it("rejects delegating administration to yourself", async () => {
    const membership = makeMembership({
      permissions: ["role.manage"],
      member: { id: MEMBER_2 },
    });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext();

    await expect(
      delegateAdministrator({ memberId: MEMBER_2, roleId: ROLE_1, departmentId: DEPT_1 }),
    ).rejects.toThrow(/cannot delegate administration to yourself/i);
  });

  it("requires at least one of department/location/team", async () => {
    const membership = makeMembership({ permissions: ["role.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext();

    await expect(delegateAdministrator({ memberId: MEMBER_2, roleId: ROLE_1 })).rejects.toThrow();
  });

  it("delegates department ownership and assigns the role in one transaction", async () => {
    const membership = makeMembership({ permissions: ["role.manage", "member.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from organization_members"),
        respond: () => [{ id: MEMBER_2, status: "active" }],
      },
      {
        match: (t) => t.includes("select * from roles"),
        respond: () => [{ id: ROLE_1, key: "manager" }],
      },
      {
        match: (t) => t.includes("update departments set owner_member_id"),
        respond: () => [{ id: DEPT_1 }],
      },
      { match: (t) => t.includes("insert into member_role_assignments"), respond: () => [] },
    ]);

    await delegateAdministrator({ memberId: MEMBER_2, roleId: ROLE_1, departmentId: DEPT_1 });

    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });

  it("surfaces the RLS self-escalation rejection as a forbidden error", async () => {
    const membership = makeMembership({ permissions: ["role.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from organization_members"),
        respond: () => [{ id: MEMBER_2, status: "active" }],
      },
      {
        match: (t) => t.includes("select * from roles"),
        respond: () => [{ id: ROLE_1, key: "manager" }],
      },
      {
        match: (t) => t.includes("update departments set owner_member_id"),
        respond: () => [{ id: DEPT_1 }],
      },
      {
        match: (t) => t.includes("insert into member_role_assignments"),
        respond: () => {
          throw new Error("new row violates row-level security policy");
        },
      },
    ]);

    await expect(
      delegateAdministrator({ memberId: MEMBER_2, roleId: ROLE_1, departmentId: DEPT_1 }),
    ).rejects.toThrow(AppError);
  });
});
