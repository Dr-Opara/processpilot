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
}));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { advanceFrom } from "@/lib/services/workflow-engine";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { amendForm, saveFormDraft, submitForm } from "./form-submissions";

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

const task = {
  id: "task-1",
  organization_id: "org-1",
  department_id: null,
  workflow_id: "wf-1",
  node_id: "form-node-1",
  status: "assigned",
  assignee_member_id: "member-1",
  assignee_team_id: null,
  assignee_role_id: null,
  form_version_id: "fv-1",
};

const workflow = {
  id: "wf-1",
  organization_id: "org-1",
  status: "running",
  process_version_id: "pv-1",
};

const formVersion = {
  id: "fv-1",
  organization_id: "org-1",
  definition: {
    fields: [
      { key: "notes", label: "Notes", type: "text", required: true, maxLength: 500 },
      { key: "amount", label: "Amount", type: "number", required: true, min: 0 },
    ],
  },
};

const taskAndWorkflowHandlers: FakeQueryHandler[] = [
  { match: (t) => t.includes("select * from tasks where id"), respond: () => [task] },
  { match: (t) => t.includes("select * from workflows where id"), respond: () => [workflow] },
];

describe("form-submissions service", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
    vi.mocked(advanceFrom).mockClear();
  });

  describe("saveFormDraft", () => {
    it("rejects saving a draft for a workflow that isn't running", async () => {
      const membership = makeMembership({ member: { id: "member-1" } });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      wireTenantContext([
        { match: (t) => t.includes("select * from tasks where id"), respond: () => [task] },
        {
          match: (t) => t.includes("select * from workflows where id"),
          respond: () => [{ ...workflow, status: "suspended" }],
        },
      ]);

      await expect(saveFormDraft("task-1", { notes: "wip" })).rejects.toThrow("not running");
    });

    it("rejects a member who is not eligible for this task", async () => {
      const membership = makeMembership({ member: { id: "someone-else" } });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      wireTenantContext(taskAndWorkflowHandlers);

      await expect(saveFormDraft("task-1", { notes: "wip" })).rejects.toThrow("not eligible");
    });

    it("creates a new draft row with type-checked (but not required-field-checked) answers", async () => {
      const membership = makeMembership({
        member: { id: "member-1" },
        permissions: ["form.submit"],
      });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      const fakeSql = wireTenantContext([
        ...taskAndWorkflowHandlers,
        {
          match: (t) => t.includes("select * from form_versions where id"),
          respond: () => [formVersion],
        },
        {
          match: (t) =>
            t.includes("select * from form_submissions where task_id") && t.includes("draft"),
          respond: () => [],
        },
        {
          match: (t) => t.includes("insert into form_submissions"),
          respond: () => [{ id: "sub-1", status: "draft" }],
        },
        catchAllAudit,
      ]);

      const draft = await saveFormDraft("task-1", { notes: "wip" });

      expect(draft.status).toBe("draft");
      expect(fakeSql.calls.some((c) => c.text.includes("insert into form_submissions"))).toBe(true);
    });

    it("rejects a draft with a type-invalid answer even though required fields aren't enforced yet", async () => {
      const membership = makeMembership({
        member: { id: "member-1" },
        permissions: ["form.submit"],
      });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        ...taskAndWorkflowHandlers,
        {
          match: (t) => t.includes("select * from form_versions where id"),
          respond: () => [formVersion],
        },
      ]);

      await expect(saveFormDraft("task-1", { amount: "not a number" })).rejects.toThrow(
        "invalid values",
      );
    });
  });

  describe("submitForm", () => {
    it("rejects submission with missing required fields", async () => {
      const membership = makeMembership({
        member: { id: "member-1" },
        permissions: ["form.submit"],
      });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        ...taskAndWorkflowHandlers,
        {
          match: (t) => t.includes("select * from form_versions where id"),
          respond: () => [formVersion],
        },
      ]);

      await expect(submitForm("task-1", { notes: "only notes" })).rejects.toThrow(
        "missing or invalid",
      );
      expect(advanceFrom).not.toHaveBeenCalled();
    });

    it("rejects submitting a task that is not open", async () => {
      const membership = makeMembership({ member: { id: "member-1" } });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from tasks where id"),
          respond: () => [{ ...task, status: "completed" }],
        },
        { match: (t) => t.includes("select * from workflows where id"), respond: () => [workflow] },
      ]);

      await expect(submitForm("task-1", { notes: "x", amount: 1 })).rejects.toThrow("not open");
    });

    it("submits valid answers, completes the task, and advances the workflow", async () => {
      const membership = makeMembership({
        member: { id: "member-1" },
        permissions: ["form.submit"],
      });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      const fakeSql = wireTenantContext([
        ...taskAndWorkflowHandlers,
        {
          match: (t) => t.includes("select * from form_versions where id"),
          respond: () => [formVersion],
        },
        {
          match: (t) =>
            t.includes("select * from form_submissions where task_id") && t.includes("draft"),
          respond: () => [],
        },
        {
          match: (t) => t.includes("insert into form_submissions"),
          respond: () => [{ id: "sub-1", status: "submitted" }],
        },
        {
          match: (t) => t.includes("update tasks set"),
          respond: () => [{ ...task, status: "completed" }],
        },
        { match: (t) => t.includes("insert into task_history"), respond: () => [] },
        {
          match: (t) => t.includes("select definition from process_versions where id"),
          respond: () => [{ definition: { nodes: [], edges: [] } }],
        },
        catchAllAudit,
      ]);

      const submission = await submitForm("task-1", { notes: "All good", amount: 42 });

      expect(submission.status).toBe("submitted");
      expect(advanceFrom).toHaveBeenCalledTimes(1);
      expect(fakeSql.calls.some((c) => c.text.includes("update tasks set"))).toBe(true);
    });

    it("finalizes an existing draft in place rather than creating a second row", async () => {
      const membership = makeMembership({
        member: { id: "member-1" },
        permissions: ["form.submit"],
      });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      const fakeSql = wireTenantContext([
        ...taskAndWorkflowHandlers,
        {
          match: (t) => t.includes("select * from form_versions where id"),
          respond: () => [formVersion],
        },
        {
          match: (t) =>
            t.includes("select * from form_submissions where task_id") && t.includes("draft"),
          respond: () => [{ id: "sub-1", status: "draft" }],
        },
        {
          match: (t) => t.includes("update form_submissions set"),
          respond: () => [{ id: "sub-1", status: "submitted" }],
        },
        {
          match: (t) => t.includes("update tasks set"),
          respond: () => [{ ...task, status: "completed" }],
        },
        { match: (t) => t.includes("insert into task_history"), respond: () => [] },
        {
          match: (t) => t.includes("select definition from process_versions where id"),
          respond: () => [{ definition: { nodes: [], edges: [] } }],
        },
        catchAllAudit,
      ]);

      await submitForm("task-1", { notes: "All good", amount: 42 });

      expect(fakeSql.calls.some((c) => c.text.includes("insert into form_submissions"))).toBe(
        false,
      );
      expect(fakeSql.calls.some((c) => c.text.includes("update form_submissions set"))).toBe(true);
    });
  });

  describe("amendForm", () => {
    const submitted = {
      id: "sub-1",
      organization_id: "org-1",
      department_id: null,
      workflow_id: "wf-1",
      task_id: "task-1",
      process_version_id: "pv-1",
      form_version_id: "fv-1",
      member_id: "member-1",
      status: "submitted",
      superseded_by_submission_id: null,
    };

    it("requires a non-empty reason", async () => {
      await expect(amendForm("sub-1", { answers: {}, reason: "  " })).rejects.toThrow(
        "reason is required",
      );
    });

    it("rejects amending a submission that isn't in the submitted state", async () => {
      const membership = makeMembership({ member: { id: "member-1" } });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from form_submissions where id"),
          respond: () => [{ ...submitted, status: "draft" }],
        },
      ]);

      await expect(
        amendForm("sub-1", { answers: { notes: "x", amount: 1 }, reason: "Correction" }),
      ).rejects.toThrow("Only a submitted form");
    });

    it("rejects amending a submission that has already been amended", async () => {
      const membership = makeMembership({ member: { id: "member-1" } });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from form_submissions where id"),
          respond: () => [{ ...submitted, superseded_by_submission_id: "sub-2" }],
        },
      ]);

      await expect(
        amendForm("sub-1", { answers: { notes: "x", amount: 1 }, reason: "Correction" }),
      ).rejects.toThrow("already been amended");
    });

    it("rejects a member who is neither the original submitter nor a workflow manager", async () => {
      const membership = makeMembership({ member: { id: "someone-else" } });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from form_submissions where id"),
          respond: () => [submitted],
        },
      ]);

      await expect(
        amendForm("sub-1", { answers: { notes: "x", amount: 1 }, reason: "Correction" }),
      ).rejects.toThrow("not authorized");
    });

    it("creates a new immutable amendment row and points the original at it", async () => {
      const preCheckMembership = makeMembership({ member: { id: "member-1" } });
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheckMembership);
      const membership = makeMembership({
        member: { id: "member-1" },
        permissions: ["form.submit"],
      });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      const fakeSql = wireTenantContext([
        {
          match: (t) => t.includes("select * from form_submissions where id"),
          respond: () => [submitted],
        },
        {
          match: (t) => t.includes("select * from form_versions where id"),
          respond: () => [formVersion],
        },
        {
          match: (t) => t.includes("insert into form_submissions"),
          respond: () => [{ id: "sub-2", amends_submission_id: "sub-1" }],
        },
        {
          match: (t) => t.includes("update form_submissions set superseded_by_submission_id"),
          respond: () => [],
        },
        catchAllAudit,
      ]);

      const amendment = await amendForm("sub-1", {
        answers: { notes: "Corrected", amount: 99 },
        reason: "Typo fix",
      });

      expect(amendment.amends_submission_id).toBe("sub-1");
      expect(
        fakeSql.calls.some((c) =>
          c.text.includes("update form_submissions set superseded_by_submission_id"),
        ),
      ).toBe(true);
    });
  });
});
