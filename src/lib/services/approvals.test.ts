import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));
vi.mock("@/lib/services/workflow-engine", () => ({
  advanceFrom: vi.fn().mockResolvedValue(undefined),
  buildGraphIndex: vi
    .fn()
    .mockReturnValue({ nodeById: new Map(), outgoing: new Map(), incoming: new Map() }),
  failWorkflow: vi.fn().mockResolvedValue(undefined),
}));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { advanceFrom, failWorkflow } from "@/lib/services/workflow-engine";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import {
  decideApprovalChain,
  delegateApprovalDecision,
  isDecisionActionable,
  overrideApprovalDecision,
  toApprovalOutcome,
} from "./approvals";
import type { ApprovalDecisionRow, ApprovalPolicyRow } from "@/lib/db/database.types";

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

function policy(overrides: Partial<ApprovalPolicyRow> = {}): ApprovalPolicyRow {
  return {
    id: "policy-1",
    organization_id: "org-1",
    department_id: null,
    name: "Test policy",
    strategy: "unanimous",
    approver_rules: [],
    allow_delegation: true,
    allow_abstain: false,
    prevent_self_approval: false,
    status: "active",
    created_at: new Date().toISOString(),
    created_by: null,
    archived_at: null,
    ...overrides,
  };
}

function decision(overrides: Partial<ApprovalDecisionRow> = {}): ApprovalDecisionRow {
  return {
    id: "dec-1",
    organization_id: "org-1",
    department_id: null,
    task_id: "task-1",
    approval_policy_id: "policy-1",
    approver_member_id: "member-1",
    sequence_order: 0,
    status: "pending",
    comment: null,
    decided_at: null,
    delegated_to_member_id: null,
    delegated_from_member_id: null,
    is_override: false,
    override_by_member_id: null,
    override_reason: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("toApprovalOutcome", () => {
  it("unanimous: pending until every decision is approved", () => {
    const decisions = [
      decision({ id: "d1", status: "approved" }),
      decision({ id: "d2", status: "pending" }),
    ];
    expect(toApprovalOutcome(policy({ strategy: "unanimous" }), decisions)).toBe("pending");
  });

  it("unanimous: approved once every decision has approved", () => {
    const decisions = [
      decision({ id: "d1", status: "approved" }),
      decision({ id: "d2", status: "approved" }),
    ];
    expect(toApprovalOutcome(policy({ strategy: "unanimous" }), decisions)).toBe("approved");
  });

  it("unanimous/parallel/sequential: a single rejection rejects the whole step", () => {
    const decisions = [
      decision({ id: "d1", status: "approved" }),
      decision({ id: "d2", status: "rejected" }),
    ];
    for (const strategy of ["unanimous", "parallel", "sequential"] as const) {
      expect(toApprovalOutcome(policy({ strategy }), decisions)).toBe("rejected");
    }
  });

  it("majority: resolves once a strict majority approves", () => {
    const decisions = [
      decision({ id: "d1", status: "approved" }),
      decision({ id: "d2", status: "approved" }),
      decision({ id: "d3", status: "pending" }),
    ];
    expect(toApprovalOutcome(policy({ strategy: "majority" }), decisions)).toBe("approved");
  });

  it("majority: resolves to rejected once approval becomes mathematically impossible", () => {
    const decisions = [
      decision({ id: "d1", status: "rejected" }),
      decision({ id: "d2", status: "rejected" }),
      decision({ id: "d3", status: "pending" }),
    ];
    expect(toApprovalOutcome(policy({ strategy: "majority" }), decisions)).toBe("rejected");
  });

  it("majority: still pending while the outcome could go either way", () => {
    const decisions = [
      decision({ id: "d1", status: "approved" }),
      decision({ id: "d2", status: "rejected" }),
      decision({ id: "d3", status: "pending" }),
    ];
    expect(toApprovalOutcome(policy({ strategy: "majority" }), decisions)).toBe("pending");
  });

  it("majority: excludes abstained decisions from the denominator when allow_abstain is set", () => {
    const decisions = [
      decision({ id: "d1", status: "approved" }),
      decision({ id: "d2", status: "abstained" }),
      decision({ id: "d3", status: "pending" }),
    ];
    // With d2 excluded, total=2 (d1,d3), needed=2; d1 alone isn't enough yet.
    expect(
      toApprovalOutcome(policy({ strategy: "majority", allow_abstain: true }), decisions),
    ).toBe("pending");
  });

  it("first_response/any_one: the first decision resolves the whole step", () => {
    const decisions = [
      decision({ id: "d1", status: "approved" }),
      decision({ id: "d2", status: "pending" }),
      decision({ id: "d3", status: "pending" }),
    ];
    for (const strategy of ["first_response", "any_one"] as const) {
      expect(toApprovalOutcome(policy({ strategy }), decisions)).toBe("approved");
    }
  });
});

describe("isDecisionActionable", () => {
  it("sequential: only the earliest pending decision is actionable", () => {
    const decisions = [
      decision({ id: "d1", sequence_order: 0, status: "approved" }),
      decision({ id: "d2", sequence_order: 1, status: "pending" }),
      decision({ id: "d3", sequence_order: 2, status: "pending" }),
    ];
    expect(isDecisionActionable(policy({ strategy: "sequential" }), decisions, decisions[1])).toBe(
      true,
    );
    expect(isDecisionActionable(policy({ strategy: "sequential" }), decisions, decisions[2])).toBe(
      false,
    );
  });

  it("parallel: every pending decision is actionable regardless of order", () => {
    const decisions = [
      decision({ id: "d1", sequence_order: 0, status: "pending" }),
      decision({ id: "d2", sequence_order: 1, status: "pending" }),
    ];
    expect(isDecisionActionable(policy({ strategy: "parallel" }), decisions, decisions[1])).toBe(
      true,
    );
  });

  it("a decision that already decided is never actionable again", () => {
    const decisions = [decision({ id: "d1", status: "approved" })];
    expect(isDecisionActionable(policy({ strategy: "parallel" }), decisions, decisions[0])).toBe(
      false,
    );
  });
});

const task = {
  id: "task-1",
  organization_id: "org-1",
  department_id: null,
  workflow_id: "wf-1",
  node_type: "approval",
  approval_policy_id: "policy-1",
  status: "assigned",
  label: "Approve request",
  required: true,
};

const workflow = {
  id: "wf-1",
  organization_id: "org-1",
  status: "running",
  process_version_id: "pv-1",
};

describe("decideApprovalChain", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
    vi.mocked(advanceFrom).mockClear();
    vi.mocked(failWorkflow).mockClear();
  });

  it("rejects a caller who is not a named approver on the step", async () => {
    const preCheck = makeMembership({ member: { id: "someone-else" } });
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    const membership = makeMembership({
      member: { id: "someone-else" },
      permissions: ["approval.review"],
    });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      { match: (t) => t.includes("select * from tasks where id"), respond: () => [task] },
      { match: (t) => t.includes("select * from workflows where id"), respond: () => [workflow] },
      {
        match: (t) => t.includes("select * from approval_policies where id"),
        respond: () => [policy({ strategy: "parallel" })],
      },
      {
        match: (t) => t.includes("select * from approval_decisions where task_id"),
        respond: () => [decision({ approver_member_id: "member-1" })],
      },
    ]);

    await expect(decideApprovalChain("task-1", { decision: "approved" })).rejects.toThrow(
      "not a named approver",
    );
  });

  it("rejects a sequential approver acting out of turn", async () => {
    const preCheck = makeMembership({ member: { id: "member-2" } });
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    const membership = makeMembership({
      member: { id: "member-2" },
      permissions: ["approval.review"],
    });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      { match: (t) => t.includes("select * from tasks where id"), respond: () => [task] },
      { match: (t) => t.includes("select * from workflows where id"), respond: () => [workflow] },
      {
        match: (t) => t.includes("select * from approval_policies where id"),
        respond: () => [policy({ strategy: "sequential" })],
      },
      {
        match: (t) => t.includes("select * from approval_decisions where task_id"),
        respond: () => [
          decision({
            id: "d1",
            sequence_order: 0,
            approver_member_id: "member-1",
            status: "pending",
          }),
          decision({
            id: "d2",
            sequence_order: 1,
            approver_member_id: "member-2",
            status: "pending",
          }),
        ],
      },
    ]);

    await expect(decideApprovalChain("task-1", { decision: "approved" })).rejects.toThrow(
      "not yet your turn",
    );
  });

  it("completes the task and advances the workflow once the strategy resolves to approved", async () => {
    const preCheck = makeMembership({ member: { id: "member-1" } });
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    const membership = makeMembership({
      member: { id: "member-1" },
      permissions: ["approval.review"],
    });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("select * from tasks where id"), respond: () => [task] },
      { match: (t) => t.includes("select * from workflows where id"), respond: () => [workflow] },
      {
        match: (t) => t.includes("select * from approval_policies where id"),
        respond: () => [policy({ strategy: "any_one" })],
      },
      {
        match: (t) => t.includes("select * from approval_decisions where task_id"),
        respond: () => [decision({ approver_member_id: "member-1", status: "pending" })],
      },
      {
        match: (t) => t.includes("update approval_decisions set status"),
        respond: () => [decision({ approver_member_id: "member-1", status: "approved" })],
      },
      {
        match: (t) => t.includes("update tasks set"),
        respond: () => [{ ...task, status: "completed" }],
      },
      {
        match: (t) => t.includes("select definition from process_versions where id"),
        respond: () => [{ definition: { nodes: [], edges: [] } }],
      },
      catchAllAudit,
    ]);

    await decideApprovalChain("task-1", { decision: "approved" });

    expect(advanceFrom).toHaveBeenCalledTimes(1);
    expect(fakeSql.calls.some((c) => c.text.includes("insert into task_history"))).toBe(true);
  });

  it("fails a required workflow when the resolved outcome is rejected", async () => {
    const preCheck = makeMembership({ member: { id: "member-1" } });
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    const membership = makeMembership({
      member: { id: "member-1" },
      permissions: ["approval.review"],
    });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      { match: (t) => t.includes("select * from tasks where id"), respond: () => [task] },
      { match: (t) => t.includes("select * from workflows where id"), respond: () => [workflow] },
      {
        match: (t) => t.includes("select * from approval_policies where id"),
        respond: () => [policy({ strategy: "any_one" })],
      },
      {
        match: (t) => t.includes("select * from approval_decisions where task_id"),
        respond: () => [decision({ approver_member_id: "member-1", status: "pending" })],
      },
      {
        match: (t) => t.includes("update approval_decisions set status"),
        respond: () => [decision({ approver_member_id: "member-1", status: "rejected" })],
      },
      {
        match: (t) => t.includes("update tasks set"),
        respond: () => [{ ...task, status: "rejected", required: true }],
      },
      catchAllAudit,
    ]);

    await decideApprovalChain("task-1", { decision: "rejected" });

    expect(failWorkflow).toHaveBeenCalledWith(
      expect.anything(),
      "wf-1",
      "org-1",
      expect.stringContaining("rejected"),
      expect.objectContaining({ exceptionSource: "failed_approval" }),
    );
    expect(advanceFrom).not.toHaveBeenCalled();
  });

  it("leaves the outcome pending (and the task in_progress) when the strategy isn't resolved yet", async () => {
    const preCheck = makeMembership({ member: { id: "member-1" } });
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    const membership = makeMembership({
      member: { id: "member-1" },
      permissions: ["approval.review"],
    });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("select * from tasks where id"), respond: () => [task] },
      { match: (t) => t.includes("select * from workflows where id"), respond: () => [workflow] },
      {
        match: (t) => t.includes("select * from approval_policies where id"),
        respond: () => [policy({ strategy: "unanimous" })],
      },
      {
        match: (t) => t.includes("select * from approval_decisions where task_id"),
        respond: () => [
          decision({ id: "d1", approver_member_id: "member-1", status: "pending" }),
          decision({ id: "d2", approver_member_id: "member-2", status: "pending" }),
        ],
      },
      {
        match: (t) => t.includes("update approval_decisions set status"),
        respond: () => [decision({ id: "d1", approver_member_id: "member-1", status: "approved" })],
      },
      { match: (t) => t.includes("update tasks set status = 'in_progress'"), respond: () => [] },
    ]);

    await decideApprovalChain("task-1", { decision: "approved" });

    expect(advanceFrom).not.toHaveBeenCalled();
    expect(
      fakeSql.calls.some((c) => c.text.includes("update tasks set status = 'in_progress'")),
    ).toBe(true);
    // Even though the chain hasn't resolved yet, this individual approver's
    // decision is already an immutable task_history entry — see approvals.ts's
    // header comment on why the decision row alone (mutable, updated in
    // place) isn't a sufficient audit trail on its own.
    expect(
      fakeSql.calls.some(
        (c) =>
          c.text.includes("insert into task_history") &&
          c.text.includes("task.approval_decision_recorded"),
      ),
    ).toBe(true);
  });
});

describe("delegateApprovalDecision", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it("rejects delegation when the policy disallows it", async () => {
    const preCheck = makeMembership({ member: { id: "member-1" } });
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    const membership = makeMembership({
      member: { id: "member-1" },
      permissions: ["approval.review"],
    });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      { match: (t) => t.includes("select * from tasks where id"), respond: () => [task] },
      {
        match: (t) => t.includes("select * from approval_policies where id"),
        respond: () => [policy({ allow_delegation: false })],
      },
    ]);

    await expect(delegateApprovalDecision("task-1", "member-2")).rejects.toThrow(
      "does not allow delegation",
    );
  });

  it("marks the original decision delegated and creates a new row for the delegate", async () => {
    const preCheck = makeMembership({ member: { id: "member-1" } });
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    const membership = makeMembership({
      member: { id: "member-1" },
      permissions: ["approval.review"],
    });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("select * from tasks where id"), respond: () => [task] },
      {
        match: (t) => t.includes("select * from approval_policies where id"),
        respond: () => [policy({ allow_delegation: true })],
      },
      {
        match: (t) =>
          t.includes("select * from approval_decisions where task_id") &&
          t.includes("approver_member_id"),
        respond: () => [decision({ approver_member_id: "member-1", status: "pending" })],
      },
      {
        match: (t) => t.includes("update approval_decisions set status = 'delegated'"),
        respond: () => [],
      },
      {
        match: (t) => t.includes("insert into approval_decisions"),
        respond: () => [
          decision({
            id: "dec-2",
            approver_member_id: "member-2",
            delegated_from_member_id: "member-1",
          }),
        ],
      },
      catchAllAudit,
    ]);

    const delegated = await delegateApprovalDecision("task-1", "member-2");

    expect(delegated.delegated_from_member_id).toBe("member-1");
    expect(
      fakeSql.calls.some((c) =>
        c.text.includes("update approval_decisions set status = 'delegated'"),
      ),
    ).toBe(true);
  });
});

describe("overrideApprovalDecision", () => {
  it("requires a non-empty reason", async () => {
    await expect(overrideApprovalDecision("task-1", "approved", "  ")).rejects.toThrow(
      "reason is required",
    );
  });

  it("resolves the task immediately with is_override set, bypassing the chain's current state", async () => {
    const preCheck = makeMembership({ member: { id: "admin-1" } });
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    const membership = makeMembership({
      member: { id: "admin-1" },
      permissions: ["approval.manage"],
    });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("select * from tasks where id"), respond: () => [task] },
      { match: (t) => t.includes("select * from workflows where id"), respond: () => [workflow] },
      {
        match: (t) => t.includes("update approval_decisions set status"),
        respond: () => [
          decision({ approver_member_id: "member-1", status: "approved", is_override: true }),
        ],
      },
      {
        match: (t) => t.includes("update tasks set"),
        respond: () => [{ ...task, status: "completed" }],
      },
      {
        match: (t) => t.includes("select definition from process_versions where id"),
        respond: () => [{ definition: { nodes: [], edges: [] } }],
      },
      catchAllAudit,
    ]);

    const updated = await overrideApprovalDecision("task-1", "approved", "Executive exception");

    expect(updated.status).toBe("completed");
    expect(fakeSql.calls.some((c) => c.text.includes("is_override = true"))).toBe(true);
    // Each overridden decision gets its own immutable task_history entry,
    // not just the bulk mutable approval_decisions update.
    expect(
      fakeSql.calls.some(
        (c) =>
          c.text.includes("insert into task_history") &&
          c.text.includes("task.approval_decision_recorded"),
      ),
    ).toBe(true);
  });
});
