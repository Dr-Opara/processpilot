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
import {
  archiveApprovalPolicy,
  createApprovalPolicy,
  updateApprovalPolicy,
} from "./approval-policies";
import { AppError } from "@/lib/errors";

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

describe("createApprovalPolicy", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it("rejects a policy with zero approver rules", async () => {
    await expect(
      createApprovalPolicy({
        name: "Test",
        strategy: "unanimous",
        approverRules: [],
        allowDelegation: true,
        allowAbstain: false,
        preventSelfApproval: false,
      }),
    ).rejects.toThrow();
  });

  it("requires approval.manage and inserts the policy", async () => {
    const membership = makeMembership({ permissions: ["approval.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("insert into approval_policies"),
        respond: () => [{ id: "policy-1", name: "Test", strategy: "unanimous" }],
      },
      catchAllAudit,
    ]);

    const policy = await createApprovalPolicy({
      name: "Test",
      strategy: "unanimous",
      approverRules: [{ type: "user", value: "member-1" }],
      allowDelegation: true,
      allowAbstain: false,
      preventSelfApproval: false,
    });

    expect(policy.id).toBe("policy-1");
    expect(requirePermission).toHaveBeenCalledWith("approval.manage", expect.anything());
  });
});

describe("updateApprovalPolicy / archiveApprovalPolicy", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it("throws not_found when the policy doesn't exist in this organization", async () => {
    const preCheck = makeMembership();
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    wireTenantContext([
      { match: (t) => t.includes("select * from approval_policies"), respond: () => [] },
    ]);

    await expect(
      updateApprovalPolicy("missing-policy", {
        name: "X",
        strategy: "parallel",
        approverRules: [{ type: "user", value: "m1" }],
        allowDelegation: true,
        allowAbstain: false,
        preventSelfApproval: false,
      }),
    ).rejects.toThrow(AppError);
  });

  it("archives an existing policy", async () => {
    const preCheck = makeMembership();
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    const membership = makeMembership({ permissions: ["approval.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from approval_policies"),
        respond: () => [{ id: "policy-1", department_id: null }],
      },
      {
        match: (t) => t.includes("update approval_policies set status = 'archived'"),
        respond: () => [{ id: "policy-1", status: "archived" }],
      },
      catchAllAudit,
    ]);

    const result = await archiveApprovalPolicy("policy-1");
    expect(result.status).toBe("archived");
  });
});
