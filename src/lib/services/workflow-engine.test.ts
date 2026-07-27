import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/jobs/enqueue", () => ({
  enqueueJob: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/services/exceptions", () => ({
  createSystemException: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/services/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue({}),
}));

import { enqueueJob } from "@/lib/jobs/enqueue";
import { createSystemException } from "@/lib/services/exceptions";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import type {
  ProcessEdge,
  ProcessGraphDefinition,
  ProcessNode,
  ProcessNodeData,
  ProcessNodeType,
  WorkflowRow,
} from "@/lib/db/database.types";
import {
  activateNode,
  advanceFrom,
  buildGraphIndex,
  failWorkflow,
  hasUnsupportedNodeType,
  instantiateWorkflow,
} from "./workflow-engine";

beforeEach(() => {
  vi.mocked(enqueueJob).mockClear();
  vi.mocked(createSystemException).mockClear();
});

function node(id: string, type: ProcessNodeType, data: Partial<ProcessNodeData> = {}): ProcessNode {
  return { id, type, position: { x: 0, y: 0 }, data: { label: data.label ?? id, ...data } };
}

function edge(
  id: string,
  source: string,
  target: string,
  condition: string | null = null,
): ProcessEdge {
  return { id, source, target, condition };
}

const workflow: Pick<
  WorkflowRow,
  "id" | "organization_id" | "process_version_id" | "process_id" | "department_id" | "started_by"
> = {
  id: "wf-1",
  organization_id: "org-1",
  process_version_id: "pv-1",
  process_id: "process-1",
  department_id: null,
  started_by: "member-1",
};

/** A generic handler that turns any `insert into tasks (...)` call into a plausible TaskRow built from its own bound values, since every activateNode() call inserts a task with the same column order. */
const taskInsertHandler: FakeQueryHandler = {
  match: (t) => t.includes("insert into tasks ("),
  respond: (values) => [
    {
      id: `task-${values[2]}`,
      organization_id: values[0],
      workflow_id: values[1],
      node_id: values[2],
      node_type: values[3],
      label: values[4],
      required: values[5],
      status: values[6],
      assignee_member_id: values[7],
      assignee_team_id: values[8],
      assignee_role_id: values[9],
      output: {},
      started_at: new Date().toISOString(),
      due_at: null,
      completed_at: values[10],
      completed_by: null,
      created_at: new Date().toISOString(),
    },
  ],
};

const historyHandlers: FakeQueryHandler[] = [
  { match: (t) => t.includes("insert into task_history"), respond: () => [] },
  { match: (t) => t.includes("insert into workflow_history"), respond: () => [] },
  { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
];

function fakeSql(handlers: FakeQueryHandler[]) {
  const fake = createFakeSql(handlers);
  return { sql: asTransactionSql(fake), fake };
}

describe("buildGraphIndex", () => {
  it("indexes nodes by id and edges by source/target", () => {
    const definition: ProcessGraphDefinition = {
      nodes: [node("a", "start"), node("b", "human_task")],
      edges: [edge("e1", "a", "b")],
    };

    const index = buildGraphIndex(definition);

    expect(index.nodeById.get("a")?.type).toBe("start");
    expect(index.outgoing.get("a")).toEqual([edge("e1", "a", "b")]);
    expect(index.incoming.get("b")).toEqual([edge("e1", "a", "b")]);
    expect(index.outgoing.get("b")).toBeUndefined();
  });
});

describe("hasUnsupportedNodeType", () => {
  it("is true when the graph contains a system_action node", () => {
    const definition: ProcessGraphDefinition = {
      nodes: [node("a", "start"), node("b", "system_action")],
      edges: [],
    };
    expect(hasUnsupportedNodeType(definition)).toBe(true);
  });

  it("is false for a graph built only from Phase 8 supported node types", () => {
    const definition: ProcessGraphDefinition = {
      nodes: [node("a", "start"), node("b", "human_task"), node("c", "end")],
      edges: [],
    };
    expect(hasUnsupportedNodeType(definition)).toBe(false);
  });
});

describe("activateNode — form node (Phase 9 linkage)", () => {
  it("snapshots the form's current published version onto the task when ProcessNodeData.formId is configured", async () => {
    const graph = buildGraphIndex({
      nodes: [node("form-1", "form", { formId: "form-abc" })],
      edges: [],
    });
    const { sql, fake } = fakeSql([
      {
        match: (t) => t.includes("select current_version_id from forms"),
        respond: () => [{ current_version_id: "fv-1" }],
      },
      {
        match: (t) => t.includes("select * from form_versions where id"),
        respond: () => [{ id: "fv-1", status: "published" }],
      },
      taskInsertHandler,
      ...historyHandlers,
    ]);

    await activateNode({ sql, workflow, graph, nodeId: "form-1" });

    const insertedTask = fake.calls.find((c) => c.text.includes("insert into tasks ("));
    expect(insertedTask?.values[11]).toBe("fv-1");
  });

  it("leaves form_version_id null when the node has no formId configured (Phase 8's generic behavior)", async () => {
    const graph = buildGraphIndex({ nodes: [node("form-1", "form")], edges: [] });
    const { sql, fake } = fakeSql([taskInsertHandler, ...historyHandlers]);

    await activateNode({ sql, workflow, graph, nodeId: "form-1" });

    const insertedTask = fake.calls.find((c) => c.text.includes("insert into tasks ("));
    expect(insertedTask?.values[11]).toBeNull();
  });
});

describe("activateNode — approval node (Phase 10 linkage)", () => {
  const approvalPolicy = {
    id: "policy-1",
    strategy: "parallel",
    approver_rules: [{ type: "user", value: "member-1" }],
    allow_delegation: true,
    allow_abstain: false,
    status: "active",
    name: "Test policy",
  };

  it("snapshots the policy and fans out one approval_decisions row per resolved approver", async () => {
    const graph = buildGraphIndex({
      nodes: [node("approval-1", "approval", { approvalPolicyId: "policy-1" })],
      edges: [],
    });
    const { sql, fake } = fakeSql([
      {
        match: (t) => t.includes("select * from approval_policies where id"),
        respond: () => [approvalPolicy],
      },
      {
        match: (t) => t.includes("insert into approval_decisions"),
        respond: () => [{ id: "dec-1", approver_member_id: "member-1" }],
      },
      taskInsertHandler,
      ...historyHandlers,
    ]);

    await activateNode({ sql, workflow, graph, nodeId: "approval-1" });

    const insertedTask = fake.calls.find((c) => c.text.includes("insert into tasks ("));
    expect(insertedTask?.values[12]).toBe("policy-1");
    expect(fake.calls.some((c) => c.text.includes("insert into approval_decisions"))).toBe(true);
  });

  it("resolves a 'runtime_expression' approver rule against the workflow instance's accumulated task outputs", async () => {
    const graph = buildGraphIndex({
      nodes: [node("approval-1", "approval", { approvalPolicyId: "policy-2" })],
      edges: [],
    });
    const { sql, fake } = fakeSql([
      {
        match: (t) => t.includes("select * from approval_policies where id"),
        respond: () => [
          {
            ...approvalPolicy,
            id: "policy-2",
            approver_rules: [
              { type: "runtime_expression", value: "intake-1.requested_by_member_id" },
            ],
          },
        ],
      },
      {
        match: (t) => t.includes("select node_id, output from tasks where workflow_id"),
        respond: () => [{ node_id: "intake-1", output: { requested_by_member_id: "member-9" } }],
      },
      {
        match: (t) => t.includes("insert into approval_decisions"),
        respond: (values) => [{ id: "dec-9", approver_member_id: values[3] }],
      },
      taskInsertHandler,
      ...historyHandlers,
    ]);

    await activateNode({ sql, workflow, graph, nodeId: "approval-1" });

    const insertedDecision = fake.calls.find((c) =>
      c.text.includes("insert into approval_decisions"),
    );
    expect(insertedDecision?.values[3]).toBe("member-9");
  });

  it("leaves approval_policy_id null when the node has no approvalPolicyId configured (Phase 8's generic single-assignee behavior)", async () => {
    const graph = buildGraphIndex({ nodes: [node("approval-1", "approval")], edges: [] });
    const { sql, fake } = fakeSql([taskInsertHandler, ...historyHandlers]);

    await activateNode({ sql, workflow, graph, nodeId: "approval-1" });

    const insertedTask = fake.calls.find((c) => c.text.includes("insert into tasks ("));
    expect(insertedTask?.values[12]).toBeNull();
    expect(fake.calls.some((c) => c.text.includes("insert into approval_decisions"))).toBe(false);
  });
});

describe("activateNode — SLA linkage (Phase 10)", () => {
  it("resolves a business-calendar-aware due_at and schedules a task-escalation-check job when the node has a slaDefinitionId", async () => {
    const graph = buildGraphIndex({
      nodes: [node("task-1", "human_task", { slaDefinitionId: "sla-1" })],
      edges: [],
    });
    const { sql, fake } = fakeSql([
      {
        match: (t) => t.includes("from sla_definitions"),
        respond: () => [
          {
            id: "sla-1",
            organization_id: "org-1",
            target_minutes: 60,
            business_calendar_id: null,
            status: "active",
          },
        ],
      },
      { match: (t) => t.includes("update tasks set due_at"), respond: () => [] },
      taskInsertHandler,
      ...historyHandlers,
    ]);

    await activateNode({ sql, workflow, graph, nodeId: "task-1" });

    expect(fake.calls.some((c) => c.text.includes("update tasks set due_at"))).toBe(true);
    expect(enqueueJob).toHaveBeenCalledWith(
      sql,
      workflow.organization_id,
      expect.objectContaining({ jobType: "task-escalation-check" }),
    );
  });

  it("does nothing when the node has no slaDefinitionId", async () => {
    const graph = buildGraphIndex({ nodes: [node("task-1", "human_task")], edges: [] });
    const { sql, fake } = fakeSql([taskInsertHandler, ...historyHandlers]);

    await activateNode({ sql, workflow, graph, nodeId: "task-1" });

    expect(fake.calls.some((c) => c.text.includes("update tasks set due_at"))).toBe(false);
  });
});

describe("instantiateWorkflow — happy path", () => {
  it("creates the workflow, activates the start node, and leaves the workflow running with an open human task", async () => {
    const definition: ProcessGraphDefinition = {
      nodes: [node("start-1", "start"), node("task-1", "human_task"), node("end-1", "end")],
      edges: [edge("e1", "start-1", "task-1"), edge("e2", "task-1", "end-1")],
    };

    const { sql } = fakeSql([
      {
        match: (t) => t.includes("select title, definition from process_versions where id"),
        respond: () => [{ title: "Onboard vendor", definition }],
      },
      {
        match: (t) => t.includes("insert into workflows ("),
        respond: () => [{ id: "wf-1", organization_id: "org-1", process_version_id: "pv-1" }],
      },
      {
        match: (t) => t.includes("select * from workflows where id"),
        respond: () => [
          { id: "wf-1", organization_id: "org-1", status: "running", parent_task_id: null },
        ],
      },
      // start node's own task is a system-executed no-op; only the human task stays open.
      {
        match: (t) => t.includes("select count(*)::int as open_count from tasks"),
        respond: () => [{ open_count: 1 }],
      },
      taskInsertHandler,
      ...historyHandlers,
    ]);

    const result = await instantiateWorkflow(sql, {
      organizationId: "org-1",
      processId: "process-1",
      processVersionId: "pv-1",
      slaHours: null,
      startedBy: "member-1",
      parentTaskId: null,
      restartedFromWorkflowId: null,
    });

    expect(result.status).toBe("running");
    expect(enqueueJob).not.toHaveBeenCalled(); // no slaHours -> no deadline-check job
  });

  it("schedules a deadline-check job when the process has an SLA", async () => {
    const definition: ProcessGraphDefinition = {
      nodes: [node("start-1", "start"), node("task-1", "human_task")],
      edges: [edge("e1", "start-1", "task-1")],
    };
    const { sql } = fakeSql([
      {
        match: (t) => t.includes("select title, definition from process_versions where id"),
        respond: () => [{ title: "Onboard vendor", definition }],
      },
      {
        match: (t) => t.includes("insert into workflows ("),
        respond: () => [{ id: "wf-1", organization_id: "org-1" }],
      },
      {
        match: (t) => t.includes("select * from workflows where id"),
        respond: () => [
          { id: "wf-1", organization_id: "org-1", status: "running", parent_task_id: null },
        ],
      },
      {
        match: (t) => t.includes("select count(*)::int as open_count from tasks"),
        respond: () => [{ open_count: 1 }],
      },
      taskInsertHandler,
      ...historyHandlers,
    ]);

    await instantiateWorkflow(sql, {
      organizationId: "org-1",
      processId: "process-1",
      processVersionId: "pv-1",
      slaHours: 24,
      startedBy: "member-1",
      parentTaskId: null,
      restartedFromWorkflowId: null,
    });

    expect(enqueueJob).toHaveBeenCalledWith(
      sql,
      "org-1",
      expect.objectContaining({ jobType: "workflow-deadline-check" }),
    );
  });

  it("throws when the process version has no start node", async () => {
    const definition: ProcessGraphDefinition = { nodes: [node("task-1", "human_task")], edges: [] };
    const { sql } = fakeSql([
      {
        match: (t) => t.includes("select title, definition from process_versions where id"),
        respond: () => [{ title: "Broken", definition }],
      },
      {
        match: (t) => t.includes("insert into workflows ("),
        respond: () => [{ id: "wf-1", organization_id: "org-1" }],
      },
      ...historyHandlers,
    ]);

    await expect(
      instantiateWorkflow(sql, {
        organizationId: "org-1",
        processId: "process-1",
        processVersionId: "pv-1",
        slaHours: null,
        startedBy: "member-1",
        parentTaskId: null,
        restartedFromWorkflowId: null,
      }),
    ).rejects.toThrow("no start node");
  });
});

describe("activateNode — decision routing", () => {
  it("advances down the first matching branch and records the matched edge on the decision task", async () => {
    const definition: ProcessGraphDefinition = {
      nodes: [
        node("decision-1", "decision"),
        node("approved-path", "human_task"),
        node("rejected-path", "human_task"),
      ],
      edges: [
        edge("e-approved", "decision-1", "approved-path", 'approval-1.decision == "approved"'),
        edge("e-rejected", "decision-1", "rejected-path", 'approval-1.decision == "rejected"'),
      ],
    };
    const graph = buildGraphIndex(definition);

    const { sql, fake } = fakeSql([
      {
        match: (t) => t.includes("select node_id, output from tasks"),
        respond: () => [{ node_id: "approval-1", output: { decision: "approved" } }],
      },
      { match: (t) => t.includes("update tasks set output"), respond: () => [] },
      taskInsertHandler,
      ...historyHandlers,
    ]);

    await activateNode({ sql, workflow, graph, nodeId: "decision-1" });

    const insertCalls = fake.calls.filter((c) => c.text.includes("insert into tasks ("));
    // decision-1's own task, plus the chosen branch's human task — not the unmatched branch.
    expect(insertCalls.map((c) => c.values[2])).toEqual(["decision-1", "approved-path"]);
  });

  it("fails the workflow when no outgoing branch condition matches", async () => {
    const definition: ProcessGraphDefinition = {
      nodes: [node("decision-1", "decision"), node("only-path", "human_task")],
      edges: [edge("e1", "decision-1", "only-path", 'approval-1.decision == "approved"')],
    };
    const graph = buildGraphIndex(definition);

    const { sql, fake } = fakeSql([
      {
        match: (t) => t.includes("select node_id, output from tasks"),
        respond: () => [{ node_id: "approval-1", output: { decision: "rejected" } }],
      },
      {
        match: (t) => t.includes("update workflows set status = 'failed'"),
        respond: () => [
          { id: "wf-1", organization_id: "org-1", status: "failed", parent_task_id: null },
        ],
      },
      { match: (t) => t.includes("update tasks set status = 'cancelled'"), respond: () => [] },
      taskInsertHandler,
      ...historyHandlers,
    ]);

    await activateNode({ sql, workflow, graph, nodeId: "decision-1" });

    expect(fake.calls.some((c) => c.text.includes("update workflows set status = 'failed'"))).toBe(
      true,
    );
  });
});

describe("activateNode — parallel_join", () => {
  const definition: ProcessGraphDefinition = {
    nodes: [
      node("branch-a", "human_task"),
      node("branch-b", "human_task"),
      node("join-1", "parallel_join"),
    ],
    edges: [edge("e1", "branch-a", "join-1"), edge("e2", "branch-b", "join-1")],
  };
  const graph = buildGraphIndex(definition);

  it("does not create a join task until every incoming branch has completed", async () => {
    const { sql, fake } = fakeSql([
      {
        match: (t) => t.includes("select node_id from tasks"),
        respond: () => [{ node_id: "branch-a" }], // only one of two branches done
      },
      taskInsertHandler,
      ...historyHandlers,
    ]);

    await activateNode({ sql, workflow, graph, nodeId: "join-1" });

    expect(fake.calls.some((c) => c.text.includes("insert into tasks ("))).toBe(false);
  });

  it("activates the join once every incoming branch has completed", async () => {
    const { sql, fake } = fakeSql([
      {
        match: (t) => t.includes("select node_id from tasks"),
        respond: () => [{ node_id: "branch-a" }, { node_id: "branch-b" }],
      },
      {
        match: (t) => t.includes("select count(*)::int as open_count from tasks"),
        respond: () => [{ open_count: 0 }],
      },
      {
        match: (t) => t.includes("select * from workflows where id"),
        respond: () => [{ id: "wf-1", status: "running", parent_task_id: null }],
      },
      { match: (t) => t.includes("update workflows set status = 'completed'"), respond: () => [] },
      taskInsertHandler,
      ...historyHandlers,
    ]);

    await activateNode({ sql, workflow, graph, nodeId: "join-1" });

    expect(fake.calls.some((c) => c.text.includes("insert into tasks ("))).toBe(true);
  });

  it("swallows a unique-violation on the join insert as a harmless race between two branches (crash-recovery / retry safety)", async () => {
    const { sql } = fakeSql([
      {
        match: (t) => t.includes("select node_id from tasks"),
        respond: () => [{ node_id: "branch-a" }, { node_id: "branch-b" }],
      },
      {
        match: (t) => t.includes("insert into tasks ("),
        respond: () => {
          throw { code: "23505" };
        },
      },
      ...historyHandlers,
    ]);

    await expect(activateNode({ sql, workflow, graph, nodeId: "join-1" })).resolves.toBeUndefined();
  });

  it("re-throws a non-unique-violation error from the task insert", async () => {
    const { sql } = fakeSql([
      {
        match: (t) => t.includes("select node_id from tasks"),
        respond: () => [{ node_id: "branch-a" }, { node_id: "branch-b" }],
      },
      {
        match: (t) => t.includes("insert into tasks ("),
        respond: () => {
          throw new Error("connection reset");
        },
      },
      ...historyHandlers,
    ]);

    await expect(activateNode({ sql, workflow, graph, nodeId: "join-1" })).rejects.toThrow(
      "connection reset",
    );
  });
});

describe("activateNode — timer", () => {
  beforeEach(() => vi.mocked(enqueueJob).mockClear());

  it("schedules a workflow-timer-advance job and leaves the task in_progress rather than completing it inline", async () => {
    const definition: ProcessGraphDefinition = {
      nodes: [node("timer-1", "timer", { timerDurationMinutes: 60 })],
      edges: [],
    };
    const graph = buildGraphIndex(definition);
    const { sql, fake } = fakeSql([
      { match: (t) => t.includes("update tasks set due_at"), respond: () => [] },
      taskInsertHandler,
      ...historyHandlers,
    ]);

    await activateNode({ sql, workflow, graph, nodeId: "timer-1" });

    const insertedTask = fake.calls.find((c) => c.text.includes("insert into tasks ("));
    expect(insertedTask?.values[6]).toBe("in_progress");
    expect(enqueueJob).toHaveBeenCalledWith(
      sql,
      workflow.organization_id,
      expect.objectContaining({
        jobType: "workflow-timer-advance",
        idempotencyKey: expect.stringContaining("task-timer-1"),
      }),
    );
  });
});

describe("advanceFrom", () => {
  it("resolves a dead-end (no outgoing edges) by checking whether the workflow can complete rather than throwing", async () => {
    const graph = buildGraphIndex({ nodes: [node("dead-end", "human_task")], edges: [] });
    const { sql, fake } = fakeSql([
      {
        match: (t) => t.includes("select count(*)::int as open_count from tasks"),
        respond: () => [{ open_count: 0 }],
      },
      {
        match: (t) => t.includes("select * from workflows where id"),
        respond: () => [{ id: "wf-1", status: "running", parent_task_id: null }],
      },
      { match: (t) => t.includes("update workflows set status = 'completed'"), respond: () => [] },
      ...historyHandlers,
    ]);

    await advanceFrom({ sql, workflow, graph, task: { node_id: "dead-end" } });

    expect(
      fake.calls.some((c) => c.text.includes("update workflows set status = 'completed'")),
    ).toBe(true);
  });

  it("does not mark the workflow completed while any task is still assigned or in_progress", async () => {
    const graph = buildGraphIndex({ nodes: [node("dead-end", "human_task")], edges: [] });
    const { sql, fake } = fakeSql([
      {
        match: (t) => t.includes("select count(*)::int as open_count from tasks"),
        respond: () => [{ open_count: 1 }],
      },
    ]);

    await advanceFrom({ sql, workflow, graph, task: { node_id: "dead-end" } });

    expect(fake.calls.some((c) => c.text.includes("update workflows set status"))).toBe(false);
  });
});

describe("failWorkflow", () => {
  it("cancels every open task, records history/audit events, and is a no-op if the workflow is already terminal", async () => {
    const { sql, fake } = fakeSql([
      {
        match: (t) => t.includes("update workflows set status = 'failed'"),
        respond: () => [
          { id: "wf-1", organization_id: "org-1", status: "failed", parent_task_id: null },
        ],
      },
      { match: (t) => t.includes("update tasks set status = 'cancelled'"), respond: () => [] },
      ...historyHandlers,
    ]);

    await failWorkflow(sql, "wf-1", "org-1", "Required approval was rejected.");

    expect(fake.calls.some((c) => c.text.includes("update tasks set status = 'cancelled'"))).toBe(
      true,
    );
    expect(fake.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });

  it("does nothing when the workflow is already terminal (idempotent retry)", async () => {
    const { sql, fake } = fakeSql([
      { match: (t) => t.includes("update workflows set status = 'failed'"), respond: () => [] }, // no row matched status='running'
    ]);

    await failWorkflow(sql, "wf-1", "org-1", "Retry after crash");

    expect(fake.calls.some((c) => c.text.includes("update tasks set status = 'cancelled'"))).toBe(
      false,
    );
    expect(fake.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(false);
  });
});
