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
import type { ProcessStep } from "@/lib/db/database.types";
import {
  approveAndPublish,
  createVersion,
  processDefinitionSchema,
  rejectReview,
  submitForReview,
} from "./process-versions";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

const PROCESS_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";
const ROLE_ID = "44444444-4444-4444-8444-444444444444";

function makeStep(overrides: Partial<ProcessStep> = {}): ProcessStep {
  return {
    id: "step-1",
    name: "Step 1",
    sequencing: "linear",
    parallelGroup: null,
    branchOnStepId: null,
    branchCondition: null,
    assigneeType: "role",
    assigneeRoleId: ROLE_ID,
    assigneeTeamId: null,
    required: true,
    requiresForm: false,
    formFields: [],
    requiresApproval: false,
    approverRoleId: null,
    requiresEvidence: false,
    evidenceDescription: null,
    ...overrides,
  };
}

describe("processDefinitionSchema", () => {
  it("rejects an empty step array", () => {
    expect(processDefinitionSchema.safeParse([]).success).toBe(false);
  });

  it("rejects a role-assigned step with no role selected", () => {
    const result = processDefinitionSchema.safeParse([makeStep({ assigneeRoleId: null })]);
    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues[0].message).toContain(
      "needs an assigned role",
    );
  });

  it("rejects a team-assigned step with no team selected", () => {
    const result = processDefinitionSchema.safeParse([
      makeStep({ assigneeType: "team", assigneeRoleId: null, assigneeTeamId: null }),
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects a conditional step with no branch-on step", () => {
    const result = processDefinitionSchema.safeParse([makeStep({ sequencing: "conditional" })]);
    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues[0].message).toContain(
      "no branch-on step",
    );
  });

  it("rejects a conditional step branching on a step that doesn't exist earlier", () => {
    const result = processDefinitionSchema.safeParse([
      makeStep({ id: "step-1", sequencing: "conditional", branchOnStepId: "step-2" }),
      makeStep({ id: "step-2" }),
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects an approval-required step with no approver role", () => {
    const result = processDefinitionSchema.safeParse([
      makeStep({ requiresApproval: true, approverRoleId: null }),
    ]);
    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues[0].message).toContain(
      "requires approval",
    );
  });

  it("accepts a valid linear step and a valid conditional step branching on a prior step", () => {
    const result = processDefinitionSchema.safeParse([
      makeStep({ id: "step-1" }),
      makeStep({
        id: "step-2",
        sequencing: "conditional",
        branchOnStepId: "step-1",
        branchCondition: "approved",
      }),
    ]);
    expect(result.success).toBe(true);
  });
});

describe("process-versions service", () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  describe("createVersion", () => {
    it("rejects when a draft or in-review version is already in progress", async () => {
      vi.mocked(requirePermission).mockResolvedValue(
        makeMembership({ permissions: ["process.edit"] }),
      );
      wireTenantContext([
        {
          match: (t) => t.includes("select * from processes where id"),
          respond: () => [{ id: PROCESS_ID, department_id: null }],
        },
        {
          match: (t) => t.includes("select id from process_versions"),
          respond: () => [{ id: "existing-draft" }],
        },
      ]);

      await expect(createVersion(PROCESS_ID, "Process v2", [makeStep()])).rejects.toThrow(
        "already exists for this process",
      );
    });

    it("creates the next version number with the given step definition", async () => {
      vi.mocked(requirePermission).mockResolvedValue(
        makeMembership({ permissions: ["process.edit"] }),
      );
      const fakeSql = wireTenantContext([
        {
          match: (t) => t.includes("select * from processes where id"),
          respond: () => [{ id: PROCESS_ID, department_id: null }],
        },
        { match: (t) => t.includes("select id from process_versions"), respond: () => [] },
        {
          match: (t) => t.includes("select coalesce(max(version_number)"),
          respond: () => [{ max_version: 1 }],
        },
        {
          match: (t) => t.includes("insert into process_versions"),
          respond: () => [{ id: VERSION_ID, version_number: 2 }],
        },
      ]);

      const version = await createVersion(PROCESS_ID, "Process v2", [makeStep()]);

      expect(version.version_number).toBe(2);
      expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
    });
  });

  describe("submitForReview", () => {
    it("rejects submitting a version that isn't a draft", async () => {
      vi.mocked(requirePermission).mockResolvedValue(makeMembership());
      wireTenantContext([
        {
          match: (t) => t.includes("select * from process_versions where id"),
          respond: () => [{ id: VERSION_ID, status: "published", department_id: null }],
        },
      ]);

      await expect(submitForReview(VERSION_ID)).rejects.toThrow("Only a draft version");
    });
  });

  describe("rejectReview", () => {
    it("requires process.review and returns the version to draft with notes", async () => {
      vi.mocked(requirePermission)
        .mockResolvedValueOnce(makeMembership())
        .mockResolvedValueOnce(makeMembership({ permissions: ["process.review"] }));
      const fakeSql = wireTenantContext([
        {
          match: (t) => t.includes("select * from process_versions where id"),
          respond: () => [{ id: VERSION_ID, status: "in_review", department_id: null }],
        },
        {
          match: (t) => t.includes("update process_versions set"),
          respond: () => [{ id: VERSION_ID, status: "draft", review_notes: "Missing an approver" }],
        },
      ]);

      const updated = await rejectReview(VERSION_ID, "Missing an approver");

      expect(updated.status).toBe("draft");
      expect(requirePermission).toHaveBeenCalledWith("process.review", {
        scope: { departmentId: undefined },
      });
      expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
    });
  });

  describe("approveAndPublish", () => {
    it("rejects publishing a version that isn't in review", async () => {
      vi.mocked(requirePermission).mockResolvedValue(makeMembership());
      wireTenantContext([
        {
          match: (t) => t.includes("select * from process_versions where id"),
          respond: () => [{ id: VERSION_ID, status: "draft", department_id: null }],
        },
      ]);

      await expect(approveAndPublish(VERSION_ID)).rejects.toThrow("Only an in-review version");
    });

    it("requires process.publish (the narrower, process_owner-only permission) and supersedes the prior published version", async () => {
      vi.mocked(requirePermission)
        .mockResolvedValueOnce(makeMembership())
        .mockResolvedValueOnce(makeMembership({ scopedPermissions: ["process.publish"] }));
      const fakeSql = wireTenantContext([
        {
          match: (t) => t.includes("select * from process_versions where id"),
          respond: () => [
            { id: VERSION_ID, status: "in_review", process_id: PROCESS_ID, department_id: null },
          ],
        },
        {
          match: (t) => t.includes("select * from processes where id"),
          respond: () => [{ id: PROCESS_ID, current_version_id: "old-version" }],
        },
        {
          match: (t) =>
            t.includes("update process_versions set") && t.includes("status = 'published'"),
          respond: () => [{ id: VERSION_ID, status: "published" }],
        },
        {
          match: (t) => t.includes("update process_versions set status = 'superseded'"),
          respond: () => [],
        },
        { match: (t) => t.includes("update processes set current_version_id"), respond: () => [] },
      ]);

      const published = await approveAndPublish(VERSION_ID);

      expect(published.status).toBe("published");
      expect(requirePermission).toHaveBeenCalledWith("process.publish", {
        scope: { departmentId: undefined },
      });
      const supersedeCall = fakeSql.calls.find((c) =>
        c.text.includes("update process_versions set status = 'superseded'"),
      );
      expect(supersedeCall?.values).toContain("old-version");
      const processUpdateCall = fakeSql.calls.find((c) =>
        c.text.includes("update processes set current_version_id"),
      );
      expect(processUpdateCall?.values).toContain(VERSION_ID);
    });
  });
});
