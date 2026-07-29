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
import { assignRoleToTeam } from "./team-role-assignments";

const TEAM_1 = "11111111-1111-4111-8111-111111111111";
const ROLE_1 = "33333333-3333-4333-8333-333333333333";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

describe("team-role-assignments service", () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  it("rejects attaching a role that grants a permission the caller doesn't hold", async () => {
    const membership = makeMembership({ permissions: ["role.manage", "member.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      { match: (t) => t.includes("select * from teams where id"), respond: () => [{ id: TEAM_1 }] },
      {
        match: (t) => t.includes("select * from roles"),
        respond: () => [{ id: ROLE_1, key: "organization_admin" }],
      },
      {
        match: (t) => t.includes("select p.key from role_permissions"),
        respond: () => [{ key: "billing.manage" }],
      },
    ]);

    await expect(assignRoleToTeam({ teamId: TEAM_1, roleId: ROLE_1 })).rejects.toThrow(
      /cannot attach a role that grants permissions you don't currently hold/i,
    );
  });

  it("fans a held role out to every current team member", async () => {
    const membership = makeMembership({ permissions: ["role.manage", "member.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("select * from teams where id"), respond: () => [{ id: TEAM_1 }] },
      {
        match: (t) => t.includes("select * from roles"),
        respond: () => [{ id: ROLE_1, key: "manager" }],
      },
      { match: (t) => t.includes("select p.key from role_permissions"), respond: () => [] },
      {
        match: (t) => t.includes("insert into team_role_assignments"),
        respond: () => [{ id: "assignment-1", team_id: TEAM_1, role_id: ROLE_1 }],
      },
      {
        match: (t) => t.includes("select * from team_members"),
        respond: () => [
          { organization_member_id: "member-a" },
          { organization_member_id: "member-b" },
        ],
      },
      { match: (t) => t.includes("insert into member_role_assignments"), respond: () => [] },
    ]);

    await assignRoleToTeam({ teamId: TEAM_1, roleId: ROLE_1 });

    const grantCalls = fakeSql.calls.filter((c) =>
      c.text.includes("insert into member_role_assignments"),
    );
    expect(grantCalls).toHaveLength(2);
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });

  it("propagates a forbidden error when the caller lacks role.manage", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new AppError("forbidden", "Missing permission: role.manage"),
    );
    wireTenantContext();

    await expect(assignRoleToTeam({ teamId: TEAM_1, roleId: ROLE_1 })).rejects.toThrow(
      "Missing permission",
    );
  });
});
