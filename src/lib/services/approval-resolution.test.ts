import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createFakeSql, asSql } from "@/lib/db/test-helpers/fake-sql";
import { AppError } from "@/lib/errors";
import {
  createApprovalDecisions,
  getActiveApprovalPolicy,
  resolveMemberIdsForRule,
} from "./approval-resolution";
import type { ApprovalPolicyRow } from "@/lib/db/database.types";

function policy(overrides: Partial<ApprovalPolicyRow> = {}): ApprovalPolicyRow {
  return {
    id: "policy-1",
    organization_id: "org-1",
    department_id: null,
    name: "Test policy",
    strategy: "parallel",
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

describe("resolveMemberIdsForRule", () => {
  it("resolves a 'user' rule to its literal value", async () => {
    const sql = asSql(createFakeSql([]));
    expect(
      await resolveMemberIdsForRule(
        sql,
        "org-1",
        { type: "user", value: "member-1" },
        { departmentId: null, startedByMemberId: null },
      ),
    ).toEqual(["member-1"]);
  });

  it("resolves a 'role' rule to every active member holding that role", async () => {
    const sql = asSql(
      createFakeSql([
        {
          match: (t) => t.includes("from member_role_assignments"),
          respond: () => [{ organization_member_id: "m1" }, { organization_member_id: "m2" }],
        },
      ]),
    );
    const ids = await resolveMemberIdsForRule(
      sql,
      "org-1",
      { type: "role", value: "role-1" },
      { departmentId: null, startedByMemberId: null },
    );
    expect(ids).toEqual(["m1", "m2"]);
  });

  it("resolves a 'manager' rule to the workflow starter's manager", async () => {
    const sql = asSql(
      createFakeSql([
        {
          match: (t) => t.includes("from organization_members where id"),
          respond: () => [{ manager_id: "manager-1" }],
        },
      ]),
    );
    const ids = await resolveMemberIdsForRule(
      sql,
      "org-1",
      { type: "manager", value: null },
      { departmentId: null, startedByMemberId: "starter-1" },
    );
    expect(ids).toEqual(["manager-1"]);
  });

  it("resolves a 'manager' rule to nothing when the starter has no manager", async () => {
    const sql = asSql(
      createFakeSql([
        {
          match: (t) => t.includes("from organization_members where id"),
          respond: () => [{ manager_id: null }],
        },
      ]),
    );
    const ids = await resolveMemberIdsForRule(
      sql,
      "org-1",
      { type: "manager", value: null },
      { departmentId: null, startedByMemberId: "starter-1" },
    );
    expect(ids).toEqual([]);
  });

  it("resolves a 'department_owner' rule using the workflow's department", async () => {
    const sql = asSql(
      createFakeSql([
        {
          match: (t) => t.includes("from departments where id"),
          respond: () => [{ owner_member_id: "owner-1" }],
        },
      ]),
    );
    const ids = await resolveMemberIdsForRule(
      sql,
      "org-1",
      { type: "department_owner", value: null },
      { departmentId: "dept-1", startedByMemberId: null },
    );
    expect(ids).toEqual(["owner-1"]);
  });

  it("resolves a 'process_owner' rule from the given process id", async () => {
    const sql = asSql(
      createFakeSql([
        {
          match: (t) => t.includes("from processes where id"),
          respond: () => [{ owner_member_id: "owner-2" }],
        },
      ]),
    );
    const ids = await resolveMemberIdsForRule(
      sql,
      "org-1",
      { type: "process_owner", value: "process-1" },
      { departmentId: null, startedByMemberId: null },
    );
    expect(ids).toEqual(["owner-2"]);
  });

  it("resolves 'location_manager'/'team_manager' rules from their explicit ids", async () => {
    const locationSql = asSql(
      createFakeSql([
        {
          match: (t) => t.includes("from organization_locations"),
          respond: () => [{ manager_member_id: "lm-1" }],
        },
      ]),
    );
    expect(
      await resolveMemberIdsForRule(
        locationSql,
        "org-1",
        { type: "location_manager", value: "loc-1" },
        { departmentId: null, startedByMemberId: null },
      ),
    ).toEqual(["lm-1"]);

    const teamSql = asSql(
      createFakeSql([
        {
          match: (t) => t.includes("from teams where id"),
          respond: () => [{ manager_member_id: "tm-1" }],
        },
      ]),
    );
    expect(
      await resolveMemberIdsForRule(
        teamSql,
        "org-1",
        { type: "team_manager", value: "team-1" },
        { departmentId: null, startedByMemberId: null },
      ),
    ).toEqual(["tm-1"]);
  });

  it("resolves a 'runtime_expression' rule to a member id read from a prior task's output", async () => {
    const sql = asSql(createFakeSql([]));
    const ids = await resolveMemberIdsForRule(
      sql,
      "org-1",
      { type: "runtime_expression", value: "intake-1.requested_by_member_id" },
      {
        departmentId: null,
        startedByMemberId: null,
        instanceContext: { "intake-1": { requested_by_member_id: "m-9" } },
      },
    );
    expect(ids).toEqual(["m-9"]);
  });

  it("resolves a 'runtime_expression' rule to nothing when the referenced field is missing or not a string", async () => {
    const sql = asSql(createFakeSql([]));
    expect(
      await resolveMemberIdsForRule(
        sql,
        "org-1",
        { type: "runtime_expression", value: "intake-1.requested_by_member_id" },
        { departmentId: null, startedByMemberId: null, instanceContext: {} },
      ),
    ).toEqual([]);
    expect(
      await resolveMemberIdsForRule(
        sql,
        "org-1",
        { type: "runtime_expression", value: "not-a-reference" },
        { departmentId: null, startedByMemberId: null },
      ),
    ).toEqual([]);
  });
});

describe("createApprovalDecisions", () => {
  it("creates one decision per unique resolved approver, deduplicated across rules", async () => {
    const fakeSql = createFakeSql([
      {
        match: (t) => t.includes("from member_role_assignments"),
        respond: () => [{ organization_member_id: "m1" }, { organization_member_id: "m2" }],
      },
      {
        match: (t) => t.includes("insert into approval_decisions"),
        respond: (values) => [
          { id: `dec-${values[3]}`, approver_member_id: values[3], sequence_order: values[4] },
        ],
      },
    ]);
    const sql = asSql(fakeSql);
    const p = policy({
      approver_rules: [
        { type: "user", value: "m1" },
        { type: "role", value: "role-1" },
      ],
    });

    const decisions = await createApprovalDecisions(
      sql,
      { id: "task-1", organization_id: "org-1" },
      p,
      {
        departmentId: null,
        startedByMemberId: null,
        processId: "process-1",
      },
    );

    expect(decisions.map((d) => d.approver_member_id)).toEqual(["m1", "m2"]); // m1 deduplicated across both rules
  });

  it("throws when the policy resolves to zero eligible approvers", async () => {
    const sql = asSql(createFakeSql([]));
    const p = policy({ approver_rules: [{ type: "user", value: null }] });

    await expect(
      createApprovalDecisions(sql, { id: "task-1", organization_id: "org-1" }, p, {
        departmentId: null,
        startedByMemberId: null,
        processId: "process-1",
      }),
    ).rejects.toThrow(AppError);
  });

  it("excludes the workflow starter when prevent_self_approval is set", async () => {
    const fakeSql = createFakeSql([
      {
        match: (t) => t.includes("insert into approval_decisions"),
        respond: (values) => [
          { id: `dec-${values[3]}`, approver_member_id: values[3], sequence_order: values[4] },
        ],
      },
    ]);
    const sql = asSql(fakeSql);
    const p = policy({
      prevent_self_approval: true,
      approver_rules: [
        { type: "user", value: "m1" },
        { type: "user", value: "m2" },
      ],
    });

    const decisions = await createApprovalDecisions(
      sql,
      { id: "task-1", organization_id: "org-1" },
      p,
      {
        departmentId: null,
        startedByMemberId: "m1",
        processId: "process-1",
      },
    );

    expect(decisions.map((d) => d.approver_member_id)).toEqual(["m2"]);
  });

  it("throws when prevent_self_approval excludes every resolved approver", async () => {
    const sql = asSql(createFakeSql([]));
    const p = policy({
      prevent_self_approval: true,
      approver_rules: [{ type: "user", value: "m1" }],
    });

    await expect(
      createApprovalDecisions(sql, { id: "task-1", organization_id: "org-1" }, p, {
        departmentId: null,
        startedByMemberId: "m1",
        processId: "process-1",
      }),
    ).rejects.toThrow(AppError);
  });
});

describe("getActiveApprovalPolicy", () => {
  it("returns null when no active policy matches", async () => {
    const sql = asSql(
      createFakeSql([{ match: (t) => t.includes("from approval_policies"), respond: () => [] }]),
    );
    expect(await getActiveApprovalPolicy(sql, "org-1", "policy-1")).toBeNull();
  });

  it("returns the policy row when found", async () => {
    const sql = asSql(
      createFakeSql([
        { match: (t) => t.includes("from approval_policies"), respond: () => [policy()] },
      ]),
    );
    const result = await getActiveApprovalPolicy(sql, "org-1", "policy-1");
    expect(result?.id).toBe("policy-1");
  });
});
