import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));

const createOrganizationInvitation = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({
    organizations: { createOrganizationInvitation, revokeOrganizationInvitation: vi.fn() },
  })),
}));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { createFakeSql, asTransactionSql, type FakeQueryHandler } from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { assertRoleAssignable, createInvitation } from "./invitations";
import type { RoleRow } from "@/lib/db/database.types";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) => fn(asTransactionSql(fakeSql)));
  return fakeSql;
}

const employeeRole: RoleRow = {
  id: "role-employee",
  organization_id: null,
  key: "employee",
  name: "Employee",
  description: null,
  is_system: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  created_by: null,
  archived_at: null,
};

const ownerRole: RoleRow = { ...employeeRole, id: "role-owner", key: "organization_owner", name: "Owner" };

const ROLE_ID = "22222222-2222-2222-2222-222222222222";
const DEPARTMENT_ID = "33333333-3333-3333-3333-333333333333";

describe("invitations service", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
    createOrganizationInvitation.mockReset();
  });

  it("creates an invitation, scoped to the target department, when the caller holds member.invite", async () => {
    const membership = makeMembership({ permissions: ["member.invite", "role.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    createOrganizationInvitation.mockResolvedValue({ id: "clerk-inv-1" });
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("select * from roles"), respond: () => [employeeRole] },
      { match: (t) => t.includes("select om.id from organization_members"), respond: () => [] },
      { match: (t) => t.includes("select id from organization_invitations"), respond: () => [] },
      {
        match: (t) => t.includes("insert into organization_invitations"),
        respond: () => [{ id: "inv-1", email: "new.hire@example.com" }],
      },
    ]);

    const invitation = await createInvitation({
      email: "new.hire@example.com",
      roleId: ROLE_ID,
      departmentId: DEPARTMENT_ID,
    });

    expect(invitation).toEqual({ id: "inv-1", email: "new.hire@example.com" });
    expect(requirePermission).toHaveBeenCalledWith("member.invite", { scope: { departmentId: DEPARTMENT_ID } });
    expect(createOrganizationInvitation).toHaveBeenCalled();
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });

  it("rejects inviting oneself", async () => {
    const membership = makeMembership({ permissions: ["member.invite"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext();

    await expect(
      createInvitation({ email: membership.profile.email, roleId: ROLE_ID }),
    ).rejects.toThrow("cannot invite yourself");
  });

  it("rejects inviting someone who is already an active member", async () => {
    const membership = makeMembership({ permissions: ["member.invite"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      { match: (t) => t.includes("select * from roles"), respond: () => [employeeRole] },
      { match: (t) => t.includes("select om.id from organization_members"), respond: () => [{ id: "existing-member" }] },
    ]);

    await expect(
      createInvitation({ email: "already.here@example.com", roleId: ROLE_ID }),
    ).rejects.toThrow("already a member");
  });

  it("blocks a caller without role.manage from assigning anything above the baseline employee role", async () => {
    const membership = makeMembership({ permissions: ["member.invite"] });
    await expect(assertRoleAssignable(membership, { ...employeeRole, key: "manager" })).rejects.toThrow(
      "You do not have permission to assign this role",
    );
  });

  it("blocks assigning organization_owner without organization.manage, even for a role.manage holder", async () => {
    const membership = makeMembership({ permissions: ["member.invite", "role.manage"] });
    await expect(assertRoleAssignable(membership, ownerRole)).rejects.toThrow(
      "Only an organization owner can invite a new owner",
    );
  });

  it("allows a role.manage holder to assign any non-owner role", async () => {
    const membership = makeMembership({ permissions: ["member.invite", "role.manage"] });
    await expect(assertRoleAssignable(membership, { ...employeeRole, key: "manager" })).resolves.toBeUndefined();
  });
});
