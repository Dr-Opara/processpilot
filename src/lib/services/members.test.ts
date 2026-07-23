import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));

const assertRoleAssignable = vi.fn();
vi.mock("@/lib/services/invitations", () => ({
  assertRoleAssignable,
}));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { createFakeSql, asTransactionSql, type FakeQueryHandler } from "@/lib/db/test-helpers/fake-sql";
import { makeMembership, makeOrganizationMember } from "@/lib/db/test-helpers/service-fixtures";
import {
  changeMemberRole,
  removeMember,
  suspendMember,
  transferOwnership,
  updateMemberFields,
} from "./members";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) => fn(asTransactionSql(fakeSql)));
  return fakeSql;
}

const DEPARTMENT_ID = "11111111-1111-1111-1111-111111111111";
const ROLE_ID = "22222222-2222-2222-2222-222222222222";
const TARGET_MEMBER_ID = "33333333-3333-3333-3333-333333333333";

describe("members service", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
    assertRoleAssignable.mockReset().mockResolvedValue(undefined);
  });

  describe("updateMemberFields", () => {
    it("scopes the permission check to the target member's current department", async () => {
      const preCheck = makeMembership();
      const membership = makeMembership({ permissions: ["member.manage"] });
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from organization_members where id"),
          respond: () => [makeOrganizationMember({ id: TARGET_MEMBER_ID, department_id: DEPARTMENT_ID })],
        },
        {
          match: (t) => t.includes("update organization_members set job_title"),
          respond: () => [makeOrganizationMember({ id: TARGET_MEMBER_ID, department_id: DEPARTMENT_ID, job_title: "Lead" })],
        },
      ]);

      await updateMemberFields(TARGET_MEMBER_ID, { jobTitle: "Lead" });

      expect(requirePermission).toHaveBeenCalledWith("member.manage", { scope: { departmentId: DEPARTMENT_ID } });
    });

    it("rejects a member being set as their own manager", async () => {
      const preCheck = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from organization_members where id"),
          respond: () => [makeOrganizationMember({ id: TARGET_MEMBER_ID })],
        },
      ]);
      vi.mocked(requirePermission).mockResolvedValue(makeMembership({ permissions: ["member.manage"] }));

      await expect(
        updateMemberFields(TARGET_MEMBER_ID, { managerId: TARGET_MEMBER_ID }),
      ).rejects.toThrow("cannot be their own manager");
    });
  });

  describe("changeMemberRole", () => {
    it("rejects changing one's own role before checking role-assignability", async () => {
      const membership = makeMembership({ permissions: ["role.manage"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);

      await expect(changeMemberRole(membership.member.id, ROLE_ID)).rejects.toThrow(
        "cannot change your own role",
      );
      expect(assertRoleAssignable).not.toHaveBeenCalled();
    });

    it("propagates the role-assignability guard (no self- or caller-driven escalation)", async () => {
      const membership = makeMembership({ permissions: ["role.manage"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      assertRoleAssignable.mockRejectedValue(new Error("You do not have permission to assign this role."));
      wireTenantContext([
        {
          match: (t) => t.includes("select * from organization_members where id"),
          respond: () => [makeOrganizationMember({ id: TARGET_MEMBER_ID })],
        },
        { match: (t) => t.includes("select * from roles where id"), respond: () => [{ id: ROLE_ID, key: "manager" }] },
      ]);

      await expect(changeMemberRole(TARGET_MEMBER_ID, ROLE_ID)).rejects.toThrow(
        "You do not have permission to assign this role",
      );
    });

    it("turns a last-owner trigger failure into a friendly conflict instead of a raw DB error", async () => {
      const membership = makeMembership({ permissions: ["role.manage"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from organization_members where id"),
          respond: () => [makeOrganizationMember({ id: TARGET_MEMBER_ID })],
        },
        { match: (t) => t.includes("select * from roles where id"), respond: () => [{ id: ROLE_ID, key: "employee" }] },
        {
          match: (t) => t.includes("delete from member_role_assignments"),
          respond: () => {
            throw new Error("cannot remove the organization's last owner");
          },
        },
      ]);

      await expect(changeMemberRole(TARGET_MEMBER_ID, ROLE_ID)).rejects.toThrow("This role change is not allowed.");
    });
  });

  describe("suspendMember / removeMember", () => {
    it("rejects suspending or removing your own membership", async () => {
      const preCheck = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from organization_members where id"),
          respond: () => [makeOrganizationMember({ id: preCheck.member.id })],
        },
      ]);

      await expect(suspendMember(preCheck.member.id)).rejects.toThrow(
        "cannot suspend or remove your own membership",
      );
    });

    it("turns a last-owner trigger failure on removal into a friendly conflict", async () => {
      const preCheck = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
      vi.mocked(requirePermission).mockResolvedValue(makeMembership({ permissions: ["member.manage"] }));
      wireTenantContext([
        {
          match: (t) => t.includes("select * from organization_members where id"),
          respond: () => [makeOrganizationMember({ id: TARGET_MEMBER_ID })],
        },
        {
          match: (t) => t.includes("update organization_members set status"),
          respond: () => {
            throw new Error("cannot suspend or remove the organization's last owner");
          },
        },
      ]);

      await expect(removeMember(TARGET_MEMBER_ID)).rejects.toThrow(
        "Cannot suspend or remove the organization's last owner.",
      );
    });
  });

  describe("transferOwnership", () => {
    it("rejects a caller who does not currently hold the owner role", async () => {
      const membership = makeMembership({ permissions: ["organization.manage"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        { match: (t) => t.includes("select * from roles where key"), respond: () => [{ id: "role-owner" }] },
        { match: (t) => t.includes("select exists"), respond: () => [{ exists: false }] },
      ]);

      await expect(transferOwnership(TARGET_MEMBER_ID)).rejects.toThrow(
        "Only a current owner can transfer ownership",
      );
    });

    it("rejects transferring ownership to oneself", async () => {
      const membership = makeMembership({ permissions: ["organization.manage"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        { match: (t) => t.includes("select * from roles where key"), respond: () => [{ id: "role-owner" }] },
        { match: (t) => t.includes("select exists"), respond: () => [{ exists: true }] },
      ]);

      await expect(transferOwnership(membership.member.id)).rejects.toThrow("You already own this organization");
    });

    it("grants the new owner before revoking the current owner's role, in one transaction", async () => {
      const membership = makeMembership({ permissions: ["organization.manage"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      const fakeSql = wireTenantContext([
        { match: (t) => t.includes("select * from roles where key"), respond: () => [{ id: "role-owner" }] },
        { match: (t) => t.includes("select exists"), respond: () => [{ exists: true }] },
        {
          match: (t) => t.includes("select * from organization_members where id"),
          respond: () => [makeOrganizationMember({ id: TARGET_MEMBER_ID, status: "active" })],
        },
        { match: (t) => t.includes("insert into member_role_assignments"), respond: () => [] },
        { match: (t) => t.includes("delete from member_role_assignments"), respond: () => [] },
      ]);

      await transferOwnership(TARGET_MEMBER_ID);

      const insertIndex = fakeSql.calls.findIndex((c) => c.text.includes("insert into member_role_assignments"));
      const deleteIndex = fakeSql.calls.findIndex((c) => c.text.includes("delete from member_role_assignments"));
      expect(insertIndex).toBeGreaterThanOrEqual(0);
      expect(deleteIndex).toBeGreaterThan(insertIndex);
    });
  });
});
