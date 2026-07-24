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
  hasUnsupportedNodeType: vi.fn().mockReturnValue(false),
  instantiateWorkflow: vi.fn(),
}));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import {
  advanceFrom,
  failWorkflow,
  hasUnsupportedNodeType,
  instantiateWorkflow,
} from "@/lib/services/workflow-engine";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import {
  claimTask,
  completeTask,
  decideApproval,
  cancelWorkflow,
  reassignTask,
  restartWorkflow,
  resumeWorkflow,
  skipTask,
  startWorkflow,
  suspendWorkflow,
} from "./workflows";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

const catchAllHistoryHandlers: FakeQueryHandler[] = [
  { match: (t) => t.includes("insert into task_history"), respond: () => [] },
  { match: (t) => t.includes("insert into workflow_history"), respond: () => [] },
  { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
];

const runningWorkflow = {
  id: "wf-1",
  organization_id: "org-1",
  department_id: null,
  process_id: "process-1",
  process_version_id: "pv-1",
  title: "Onboard vendor",
  status: "running",
  started_by: "member-1",
  due_at: null,
  failure_reason: null,
  parent_task_id: null,
};

function openTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    organization_id: "org-1",
    department_id: null,
    workflow_id: "wf-1",
    node_id: "task-1-node",
    node_type: "human_task",
    label: "Review request",
    required: true,
    status: "assigned",
    assignee_member_id: "member-1",
    assignee_team_id: null,
    assignee_role_id: null,
    output: {},
    ...overrides,
  };
}

describe("workflows service", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
    vi.mocked(advanceFrom).mockClear();
    vi.mocked(failWorkflow).mockClear();
    vi.mocked(hasUnsupportedNodeType).mockReset().mockReturnValue(false);
    vi.mocked(instantiateWorkflow).mockReset();
  });

  describe("startWorkflow", () => {
    it("rejects starting a process that has never been published", async () => {
      const membership = makeMembership({ permissions: ["workflow.start"] });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from processes where id"),
          respond: () => [
            {
              id: "process-1",
              status: "draft",
              current_version_id: null,
              department_id: null,
              sla_hours: null,
            },
          ],
        },
      ]);

      await expect(startWorkflow("process-1")).rejects.toThrow("Only a published process");
    });

    it("rejects starting a workflow for a process not found in this organization (tenant isolation)", async () => {
      const membership = makeMembership({ permissions: ["workflow.start"] });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      wireTenantContext([
        { match: (t) => t.includes("select * from processes where id"), respond: () => [] },
      ]);

      await expect(startWorkflow("someone-elses-process")).rejects.toThrow("Process not found");
    });

    it("rejects a graph that uses a node type Phase 8 doesn't execute yet", async () => {
      const membership = makeMembership({ permissions: ["workflow.start"] });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      vi.mocked(hasUnsupportedNodeType).mockReturnValue(true);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from processes where id"),
          respond: () => [
            {
              id: "process-1",
              status: "published",
              current_version_id: "pv-1",
              department_id: null,
              sla_hours: null,
            },
          ],
        },
        {
          match: (t) => t.includes("select definition from process_versions where id"),
          respond: () => [{ definition: { nodes: [], edges: [] } }],
        },
      ]);

      await expect(startWorkflow("process-1")).rejects.toThrow("system action");
      expect(instantiateWorkflow).not.toHaveBeenCalled();
    });

    it("instantiates the workflow from the process's current published version on the happy path", async () => {
      const membership = makeMembership({ permissions: ["workflow.start"] });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      vi.mocked(instantiateWorkflow).mockResolvedValue(runningWorkflow as never);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from processes where id"),
          respond: () => [
            {
              id: "process-1",
              status: "published",
              current_version_id: "pv-1",
              department_id: null,
              sla_hours: 24,
            },
          ],
        },
        {
          match: (t) => t.includes("select definition from process_versions where id"),
          respond: () => [{ definition: { nodes: [], edges: [] } }],
        },
      ]);

      const result = await startWorkflow("process-1");

      expect(result).toEqual(runningWorkflow);
      expect(instantiateWorkflow).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          processId: "process-1",
          processVersionId: "pv-1",
          slaHours: 24,
          startedBy: membership.member.id,
        }),
      );
    });
  });

  describe("completeTask", () => {
    it("rejects completing an approval step through completeTask", async () => {
      const membership = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from tasks where id"),
          respond: () => [openTask({ node_type: "approval" })],
        },
        {
          match: (t) => t.includes("select * from workflows where id"),
          respond: () => [runningWorkflow],
        },
      ]);

      await expect(completeTask("task-1")).rejects.toThrow("decideApproval");
    });

    it("rejects completing a task that is not open", async () => {
      const membership = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from tasks where id"),
          respond: () => [openTask({ status: "completed" })],
        },
        {
          match: (t) => t.includes("select * from workflows where id"),
          respond: () => [runningWorkflow],
        },
      ]);

      await expect(completeTask("task-1")).rejects.toThrow("not open");
    });

    it("rejects completing a task on a workflow that is no longer running", async () => {
      const membership = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      wireTenantContext([
        { match: (t) => t.includes("select * from tasks where id"), respond: () => [openTask()] },
        {
          match: (t) => t.includes("select * from workflows where id"),
          respond: () => [{ ...runningWorkflow, status: "suspended" }],
        },
      ]);

      await expect(completeTask("task-1")).rejects.toThrow("not running");
    });

    it("rejects a member who is neither the assignee nor eligible for the pool", async () => {
      const membership = makeMembership({ member: { id: "someone-else" } });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from tasks where id"),
          respond: () => [openTask({ assignee_member_id: "member-1" })],
        },
        {
          match: (t) => t.includes("select * from workflows where id"),
          respond: () => [runningWorkflow],
        },
      ]);

      await expect(completeTask("task-1")).rejects.toThrow("not eligible");
    });

    it("completes the task, records history, and advances the graph on the happy path", async () => {
      const membership = makeMembership({
        member: { id: "member-1" },
        permissions: ["workflow.complete"],
      });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        { match: (t) => t.includes("select * from tasks where id"), respond: () => [openTask()] },
        {
          match: (t) => t.includes("select * from workflows where id"),
          respond: () => [runningWorkflow],
        },
        {
          match: (t) => t.includes("update tasks set"),
          respond: () => [openTask({ status: "completed" })],
        },
        {
          match: (t) => t.includes("select definition from process_versions where id"),
          respond: () => [{ definition: { nodes: [], edges: [] } }],
        },
        ...catchAllHistoryHandlers,
      ]);

      const updated = await completeTask("task-1", { notes: "done" });

      expect(updated.status).toBe("completed");
      expect(advanceFrom).toHaveBeenCalledTimes(1);
    });
  });

  describe("decideApproval", () => {
    it("rejects deciding a non-approval task", async () => {
      const membership = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from tasks where id"),
          respond: () => [openTask({ node_type: "human_task" })],
        },
        {
          match: (t) => t.includes("select * from workflows where id"),
          respond: () => [runningWorkflow],
        },
      ]);

      await expect(decideApproval("task-1", "approved")).rejects.toThrow("Only an approval step");
    });

    it("fails the whole workflow when a required approval is rejected, without advancing the graph", async () => {
      const membership = makeMembership({
        member: { id: "member-1" },
        permissions: ["approval.review"],
      });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from tasks where id"),
          respond: () => [openTask({ node_type: "approval", required: true })],
        },
        {
          match: (t) => t.includes("select * from workflows where id"),
          respond: () => [runningWorkflow],
        },
        {
          match: (t) => t.includes("update tasks set"),
          respond: () => [openTask({ node_type: "approval", status: "rejected", required: true })],
        },
        ...catchAllHistoryHandlers,
      ]);

      const updated = await decideApproval("task-1", "rejected", "Missing signature");

      expect(updated.status).toBe("rejected");
      expect(failWorkflow).toHaveBeenCalledWith(
        expect.anything(),
        "wf-1",
        "org-1",
        expect.stringContaining("rejected"),
      );
      expect(advanceFrom).not.toHaveBeenCalled();
    });

    it("advances the graph when the approval is approved", async () => {
      const membership = makeMembership({
        member: { id: "member-1" },
        permissions: ["approval.review"],
      });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from tasks where id"),
          respond: () => [openTask({ node_type: "approval" })],
        },
        {
          match: (t) => t.includes("select * from workflows where id"),
          respond: () => [runningWorkflow],
        },
        {
          match: (t) => t.includes("update tasks set"),
          respond: () => [openTask({ node_type: "approval", status: "completed" })],
        },
        {
          match: (t) => t.includes("select definition from process_versions where id"),
          respond: () => [{ definition: { nodes: [], edges: [] } }],
        },
        ...catchAllHistoryHandlers,
      ]);

      await decideApproval("task-1", "approved");

      expect(advanceFrom).toHaveBeenCalledTimes(1);
      expect(failWorkflow).not.toHaveBeenCalled();
    });
  });

  describe("claimTask", () => {
    it("rejects claiming a task that is already claimed", async () => {
      const membership = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from tasks where id"),
          respond: () => [openTask({ assignee_member_id: "member-1" })],
        },
      ]);

      await expect(claimTask("task-1")).rejects.toThrow("already claimed");
    });

    it("rejects a pool claim lost to a concurrent claimant (race safety)", async () => {
      const membership = makeMembership({
        member: { id: "member-2" },
        permissions: ["workflow.complete"],
      });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from tasks where id"),
          respond: () => [openTask({ assignee_member_id: null, assignee_team_id: "team-1" })],
        },
        {
          match: (t) => t.includes("select id from team_members"),
          respond: () => [{ id: "tm-1" }],
        },
        { match: (t) => t.includes("update tasks set assignee_member_id"), respond: () => [] }, // no row: someone else claimed it first
      ]);

      await expect(claimTask("task-1")).rejects.toThrow("already claimed by someone else");
    });

    it("claims an unclaimed pooled task for an eligible member", async () => {
      const membership = makeMembership({
        member: { id: "member-2" },
        permissions: ["workflow.complete"],
      });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from tasks where id"),
          respond: () => [openTask({ assignee_member_id: null, assignee_team_id: "team-1" })],
        },
        {
          match: (t) => t.includes("select id from team_members"),
          respond: () => [{ id: "tm-1" }],
        },
        {
          match: (t) => t.includes("update tasks set assignee_member_id"),
          respond: () => [openTask({ assignee_member_id: "member-2", status: "in_progress" })],
        },
        ...catchAllHistoryHandlers,
      ]);

      const updated = await claimTask("task-1");

      expect(updated.status).toBe("in_progress");
    });
  });

  describe("reassignTask", () => {
    it("rejects reassigning a task that is not open", async () => {
      const membership = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from tasks where id"),
          respond: () => [openTask({ status: "completed" })],
        },
      ]);

      await expect(reassignTask("task-1", "member-2")).rejects.toThrow("not open");
      expect(requirePermission).not.toHaveBeenCalled();
    });

    it("reassigns to a specific member when the caller holds workflow.assign", async () => {
      const membership = makeMembership({ permissions: ["workflow.assign"] });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        { match: (t) => t.includes("select * from tasks where id"), respond: () => [openTask()] },
        {
          match: (t) => t.includes("update tasks set assignee_member_id"),
          respond: () => [openTask({ assignee_member_id: "member-2" })],
        },
        ...catchAllHistoryHandlers,
      ]);

      const updated = await reassignTask("task-1", "member-2");

      expect(updated.assignee_member_id).toBe("member-2");
      expect(requirePermission).toHaveBeenCalledWith("workflow.assign", expect.anything());
    });
  });

  describe("skipTask", () => {
    it("refuses to skip a required task", async () => {
      const membership = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from tasks where id"),
          respond: () => [openTask({ required: true })],
        },
        {
          match: (t) => t.includes("select * from workflows where id"),
          respond: () => [runningWorkflow],
        },
      ]);

      await expect(skipTask("task-1")).rejects.toThrow("cannot be skipped");
    });

    it("skips a non-required task and advances the graph", async () => {
      const membership = makeMembership({ permissions: ["workflow.manage"] });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from tasks where id"),
          respond: () => [openTask({ required: false })],
        },
        {
          match: (t) => t.includes("select * from workflows where id"),
          respond: () => [runningWorkflow],
        },
        {
          match: (t) => t.includes("update tasks set status = 'skipped'"),
          respond: () => [openTask({ required: false, status: "skipped" })],
        },
        {
          match: (t) => t.includes("select definition from process_versions where id"),
          respond: () => [{ definition: { nodes: [], edges: [] } }],
        },
        ...catchAllHistoryHandlers,
      ]);

      const updated = await skipTask("task-1");

      expect(updated.status).toBe("skipped");
      expect(advanceFrom).toHaveBeenCalledTimes(1);
    });
  });

  describe("workflow lifecycle controls", () => {
    it("suspend rejects a workflow that is not running", async () => {
      const membership = makeMembership({ permissions: ["workflow.manage"] });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from workflows where id"),
          respond: () => [{ ...runningWorkflow, status: "completed" }],
        },
      ]);

      await expect(suspendWorkflow("wf-1")).rejects.toThrow("Only a running workflow");
    });

    it("resume rejects a workflow that is not suspended", async () => {
      const membership = makeMembership({ permissions: ["workflow.manage"] });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from workflows where id"),
          respond: () => [runningWorkflow],
        },
      ]);

      await expect(resumeWorkflow("wf-1")).rejects.toThrow("Only a suspended workflow");
    });

    it("cancel rejects a workflow that is already terminal", async () => {
      const membership = makeMembership({ permissions: ["workflow.manage"] });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from workflows where id"),
          respond: () => [{ ...runningWorkflow, status: "cancelled" }],
        },
      ]);

      await expect(cancelWorkflow("wf-1")).rejects.toThrow("Only a running or suspended workflow");
    });

    it("restart cancels a running instance and starts a fresh one from the same process_version", async () => {
      const membership = makeMembership({ permissions: ["workflow.manage"] });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      vi.mocked(instantiateWorkflow).mockResolvedValue({ ...runningWorkflow, id: "wf-2" } as never);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from workflows where id"),
          respond: () => [runningWorkflow],
        },
        {
          match: (t) => t.includes("update workflows set status = 'cancelled'"),
          respond: () => [{ ...runningWorkflow, status: "cancelled" }],
        },
        { match: (t) => t.includes("update tasks set status = 'cancelled'"), respond: () => [] },
        {
          match: (t) => t.includes("select * from processes where id"),
          respond: () => [{ id: "process-1", sla_hours: 24 }],
        },
        ...catchAllHistoryHandlers,
      ]);

      const restarted = await restartWorkflow("wf-1");

      expect(restarted.id).toBe("wf-2");
      expect(instantiateWorkflow).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ processVersionId: "pv-1", restartedFromWorkflowId: "wf-1" }),
      );
    });
  });
});
