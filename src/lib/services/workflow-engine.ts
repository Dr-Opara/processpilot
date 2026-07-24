import "server-only";
import type postgres from "postgres";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { evaluateCondition, type WorkflowInstanceContext } from "@/lib/services/workflow-condition";
import type {
  ProcessEdge,
  ProcessGraphDefinition,
  ProcessNode,
  TaskRow,
  WorkflowRow,
} from "@/lib/db/database.types";

/**
 * Token-based (Petri-net-style) execution over a process_version's
 * validated DAG (process-graph-validation.ts guarantees a single start,
 * no cycles, and every node reachable). Each `tasks` row is one token
 * visit to one node — see the migration's header comment. Every
 * function here takes a plain `postgres.Sql | postgres.TransactionSql`
 * rather than assuming a tenant-scoped transaction, so the same engine
 * code runs identically from workflows.ts (inside withTenantContext(),
 * for user-initiated actions) and from src/lib/jobs/workflow-handlers.ts
 * (via the admin client, for the cron-triggered timer/deadline jobs —
 * see ADR-0010's security note on handlers running outside a user
 * session).
 *
 * Node-type scope decisions (see docs/project/phase-tracker.md — Forms
 * and evidence is Phase 9, Approvals and escalations is Phase 10,
 * Exception management is Phase 11; none of those are built yet):
 * - `form`/`evidence` execute exactly like `human_task` this phase — a
 *   generic completion with a free-form `output` blob. Structured,
 *   validated form-field capture and evidence file upload are Phase 9's
 *   job, layered on top of this same `tasks.output` column later.
 * - `approval` is a single assignee decision (approve/reject), not the
 *   configurable multi-step approval chain Phase 10 adds. A rejected
 *   *required* approval fails the whole workflow rather than routing
 *   down an unspecified rejection branch — workflow-engine.md says an
 *   approval-gated task "blocks workflow advancement the same way an
 *   incomplete required task does."
 * - `notification` only marks the graph position reached and logs the
 *   message to task_history — actual delivery is Phase 16.
 * - `subprocess` instantiates a real child workflow and blocks the
 *   parent task until it completes.
 * - `system_action` has no handler yet; startWorkflow() rejects
 *   instantiating a version that contains one, rather than stranding a
 *   token mid-execution.
 */

type Sql = postgres.Sql | postgres.TransactionSql;

export interface GraphIndex {
  nodeById: Map<string, ProcessNode>;
  outgoing: Map<string, ProcessEdge[]>;
  incoming: Map<string, ProcessEdge[]>;
}

export function buildGraphIndex(definition: ProcessGraphDefinition): GraphIndex {
  const nodeById = new Map(definition.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, ProcessEdge[]>();
  const incoming = new Map<string, ProcessEdge[]>();
  for (const edge of definition.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge]);
  }
  return { nodeById, outgoing, incoming };
}

/** True if `definition` contains a node type Phase 8 has no execution handler for yet. */
export function hasUnsupportedNodeType(definition: ProcessGraphDefinition): boolean {
  return definition.nodes.some((node) => node.type === "system_action");
}

async function buildInstanceContext(
  sql: Sql,
  workflowId: string,
): Promise<WorkflowInstanceContext> {
  const rows = await sql<Pick<TaskRow, "node_id" | "output">[]>`
    select node_id, output from tasks where workflow_id = ${workflowId} and status = 'completed'
  `;
  const context: WorkflowInstanceContext = {};
  for (const row of rows) {
    context[row.node_id] = row.output as Record<string, unknown>;
  }
  return context;
}

async function recordWorkflowHistory(
  sql: Sql,
  workflowId: string,
  organizationId: string,
  eventType: string,
  actorMemberId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await sql`
    insert into workflow_history (organization_id, workflow_id, event_type, actor_member_id, metadata)
    values (${organizationId}, ${workflowId}, ${eventType}, ${actorMemberId}, ${sql.json(metadata as unknown as postgres.JSONValue)})
  `;
}

async function recordTaskHistory(
  sql: Sql,
  task: Pick<TaskRow, "id" | "workflow_id" | "organization_id">,
  eventType: string,
  actorMemberId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await sql`
    insert into task_history (organization_id, workflow_id, task_id, event_type, actor_member_id, metadata)
    values (
      ${task.organization_id}, ${task.workflow_id}, ${task.id}, ${eventType}, ${actorMemberId},
      ${sql.json(metadata as unknown as postgres.JSONValue)}
    )
  `;
}

/** Resolves a node's configured assignee into task columns — an unresolved pool (team or role) if no single member can be determined, per workflow-engine.md's "resolve ... into specific member assignments at instantiation or task-start time." A pool task is claimed later via claimTask(). */
function resolveAssignment(node: ProcessNode): {
  assigneeMemberId: null;
  assigneeTeamId: string | null;
  assigneeRoleId: string | null;
} {
  if (node.data.assigneeType === "team" && node.data.assigneeTeamId) {
    return {
      assigneeMemberId: null,
      assigneeTeamId: node.data.assigneeTeamId,
      assigneeRoleId: null,
    };
  }
  if (node.data.assigneeType === "role" && node.data.assigneeRoleId) {
    return {
      assigneeMemberId: null,
      assigneeTeamId: null,
      assigneeRoleId: node.data.assigneeRoleId,
    };
  }
  return { assigneeMemberId: null, assigneeTeamId: null, assigneeRoleId: null };
}

const HUMAN_NODE_TYPES = new Set(["human_task", "approval", "form", "evidence"]);

export interface ActivateNodeParams {
  sql: Sql;
  workflow: Pick<WorkflowRow, "id" | "organization_id" | "process_version_id">;
  graph: GraphIndex;
  nodeId: string;
}

/**
 * Creates the task row for `nodeId` ("a token arrives") and, for
 * system-executed node types, immediately runs their behavior and
 * recurses onward — so one activateNode() call for a start node can
 * synchronously walk an entire chain of system nodes down to the first
 * point that needs a human or a timer to elapse.
 *
 * parallel_join is the one node type that may be *invoked* once per
 * incoming branch without creating a row each time: it only actually
 * activates on the branch whose arrival completes the set. The unique
 * (workflow_id, node_id) constraint is the backstop against two
 * branches racing past that check concurrently (see the migration
 * comment) — a unique-violation here means another branch already
 * triggered the join, so it's swallowed as a no-op, not an error.
 */
export async function activateNode(params: ActivateNodeParams): Promise<void> {
  const { sql, workflow, graph, nodeId } = params;
  const node = graph.nodeById.get(nodeId);
  if (!node) throw new Error(`Node "${nodeId}" does not exist in this workflow's process version.`);

  if (node.type === "parallel_join") {
    const incomingSources = (graph.incoming.get(nodeId) ?? []).map((edge) => edge.source);
    const completed = await sql<{ node_id: string }[]>`
      select node_id from tasks
      where workflow_id = ${workflow.id} and status = 'completed' and node_id = any(${incomingSources})
    `;
    if (completed.length < incomingSources.length) return; // still waiting on other branches
  }

  const assignment = HUMAN_NODE_TYPES.has(node.type) ? resolveAssignment(node) : null;
  const isSystemExecuted =
    !HUMAN_NODE_TYPES.has(node.type) && node.type !== "timer" && node.type !== "subprocess";

  let task: TaskRow;
  try {
    [task] = await sql<TaskRow[]>`
      insert into tasks (
        organization_id, workflow_id, node_id, node_type, label, required, status,
        assignee_member_id, assignee_team_id, assignee_role_id,
        completed_at, completed_by
      ) values (
        ${workflow.organization_id}, ${workflow.id}, ${node.id}, ${node.type}, ${node.data.label || node.id},
        ${node.data.required ?? true},
        ${isSystemExecuted ? "completed" : node.type === "timer" || node.type === "subprocess" ? "in_progress" : "assigned"},
        ${assignment?.assigneeMemberId ?? null}, ${assignment?.assigneeTeamId ?? null}, ${assignment?.assigneeRoleId ?? null},
        ${isSystemExecuted ? new Date() : null}, null
      )
      returning *
    `;
  } catch (error) {
    if (isUniqueViolation(error)) return; // parallel_join race, or a reconverging non-join node — see below
    throw error;
  }

  await recordTaskHistory(sql, task, "task.created", null, { nodeType: node.type });

  if (node.type === "start") {
    await recordTaskHistory(sql, task, "task.completed", null, {});
    await advanceFrom({ sql, workflow, graph, task });
    return;
  }

  if (node.type === "end") {
    await recordTaskHistory(sql, task, "task.completed", null, {});
    await maybeCompleteWorkflow(sql, workflow.id, workflow.organization_id);
    return;
  }

  if (node.type === "notification") {
    await recordTaskHistory(sql, task, "task.completed", null, {
      message: node.data.notificationMessage ?? null,
    });
    await advanceFrom({ sql, workflow, graph, task });
    return;
  }

  if (node.type === "parallel_split") {
    await recordTaskHistory(sql, task, "task.completed", null, {});
    await advanceFrom({ sql, workflow, graph, task });
    return;
  }

  if (node.type === "parallel_join") {
    await recordTaskHistory(sql, task, "task.completed", null, {});
    await advanceFrom({ sql, workflow, graph, task });
    return;
  }

  if (node.type === "decision") {
    const context = await buildInstanceContext(sql, workflow.id);
    const edges = graph.outgoing.get(node.id) ?? [];
    const matches = edges.filter((edge) => evaluateCondition(edge.condition as string, context));

    if (matches.length === 0) {
      await recordTaskHistory(sql, task, "task.failed", null, {
        reason: "no branch condition matched",
      });
      await failWorkflow(
        sql,
        workflow.id,
        workflow.organization_id,
        `Decision "${task.label}" had no matching branch.`,
      );
      return;
    }

    // First match wins when more than one condition is true — deterministic
    // (edge array order), documented here since the graph editor doesn't
    // enforce mutual exclusivity of sibling conditions.
    const chosen = matches[0];
    await sql`update tasks set output = ${sql.json({ matchedEdgeId: chosen.id } as unknown as postgres.JSONValue)} where id = ${task.id}`;
    await recordTaskHistory(sql, task, "task.completed", null, { matchedEdgeId: chosen.id });
    await activateNode({ sql, workflow, graph, nodeId: chosen.target });
    return;
  }

  if (node.type === "timer") {
    const minutes = node.data.timerDurationMinutes ?? 0;
    const dueAt = new Date(Date.now() + minutes * 60_000);
    await sql`update tasks set due_at = ${dueAt} where id = ${task.id}`;
    await enqueueJob(sql, workflow.organization_id, {
      jobType: "workflow-timer-advance",
      payload: { workflowId: workflow.id, taskId: task.id },
      idempotencyKey: `workflow-timer-advance:${task.id}`,
      scheduledAt: dueAt,
    });
    return;
  }

  if (node.type === "subprocess") {
    if (!node.data.subprocessId) {
      await failWorkflow(
        sql,
        workflow.id,
        workflow.organization_id,
        `Subprocess step "${task.label}" has no process configured.`,
      );
      return;
    }
    await startChildWorkflow(sql, workflow, task, node.data.subprocessId);
    return;
  }

  // human_task / approval / form / evidence: left 'assigned', waiting on
  // completeTask()/decideApproval() (workflows.ts).
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "23505",
  );
}

export interface AdvanceFromParams {
  sql: Sql;
  workflow: Pick<WorkflowRow, "id" | "organization_id" | "process_version_id">;
  graph: GraphIndex;
  task: Pick<TaskRow, "node_id">;
}

/** Routes to every outgoing edge's target from a just-completed node — the general rule for every node type except `decision`, which picks a single branch inside activateNode() instead. */
export async function advanceFrom(params: AdvanceFromParams): Promise<void> {
  const { sql, workflow, graph, task } = params;
  const edges = graph.outgoing.get(task.node_id) ?? [];

  if (edges.length === 0) {
    // A dead end that isn't type 'end' — a graph-authoring gap the
    // validator doesn't catch (it only guarantees *some* end is
    // reachable, not that every path reaches one). This token simply
    // stops; maybeCompleteWorkflow() below still resolves the workflow
    // once no open tokens remain on any branch.
    await maybeCompleteWorkflow(sql, workflow.id, workflow.organization_id);
    return;
  }

  for (const edge of edges) {
    await activateNode({ sql, workflow, graph, nodeId: edge.target });
  }
  await maybeCompleteWorkflow(sql, workflow.id, workflow.organization_id);
}

async function maybeCompleteWorkflow(
  sql: Sql,
  workflowId: string,
  organizationId: string,
): Promise<void> {
  const [{ open_count }] = await sql<{ open_count: number }[]>`
    select count(*)::int as open_count from tasks
    where workflow_id = ${workflowId} and status in ('assigned', 'in_progress')
  `;
  if (open_count > 0) return;

  const [workflow] = await sql<WorkflowRow[]>`select * from workflows where id = ${workflowId}`;
  if (!workflow || workflow.status !== "running") return;

  await sql`update workflows set status = 'completed', completed_at = now() where id = ${workflowId}`;
  await recordWorkflowHistory(sql, workflowId, organizationId, "workflow.completed", null);
  await recordAuditEvent(sql, {
    organizationId,
    action: AuditAction.WorkflowCompleted,
    resourceType: AuditResourceType.Workflow,
    resourceId: workflowId,
    source: "app",
  });

  if (workflow.parent_task_id) {
    await onChildWorkflowCompleted(sql, workflow);
  }
}

export async function failWorkflow(
  sql: Sql,
  workflowId: string,
  organizationId: string,
  reason: string,
): Promise<void> {
  const [workflow] = await sql<WorkflowRow[]>`
    update workflows set status = 'failed', failure_reason = ${reason}
    where id = ${workflowId} and status = 'running'
    returning *
  `;
  if (!workflow) return; // already terminal — nothing to do

  await sql`
    update tasks set status = 'cancelled'
    where workflow_id = ${workflowId} and status in ('assigned', 'in_progress')
  `;
  await recordWorkflowHistory(sql, workflowId, organizationId, "workflow.failed", null, { reason });
  await recordAuditEvent(sql, {
    organizationId,
    action: AuditAction.WorkflowFailed,
    resourceType: AuditResourceType.Workflow,
    resourceId: workflowId,
    source: "app",
    reason,
  });

  if (workflow.parent_task_id) {
    await failWorkflow(
      sql,
      (
        await sql<
          { workflow_id: string }[]
        >`select workflow_id from tasks where id = ${workflow.parent_task_id}`
      )[0].workflow_id,
      organizationId,
      `Subprocess "${workflow.title}" failed: ${reason}`,
    );
  }
}

async function startChildWorkflow(
  sql: Sql,
  parentWorkflow: Pick<WorkflowRow, "id" | "organization_id">,
  parentTask: Pick<TaskRow, "id">,
  subprocessId: string,
): Promise<void> {
  const [process] = await sql<
    { id: string; current_version_id: string | null; sla_hours: number | null }[]
  >`
    select id, current_version_id, sla_hours from processes
    where id = ${subprocessId} and organization_id = ${parentWorkflow.organization_id}
  `;
  if (!process?.current_version_id) {
    await failWorkflow(
      sql,
      parentWorkflow.id,
      parentWorkflow.organization_id,
      `Subprocess references an unpublished or missing process.`,
    );
    return;
  }

  await instantiateWorkflow(sql, {
    organizationId: parentWorkflow.organization_id,
    processId: process.id,
    processVersionId: process.current_version_id,
    slaHours: process.sla_hours,
    startedBy: null,
    parentTaskId: parentTask.id,
    restartedFromWorkflowId: null,
  });
}

async function onChildWorkflowCompleted(sql: Sql, childWorkflow: WorkflowRow): Promise<void> {
  if (!childWorkflow.parent_task_id) return;
  const [parentTask] = await sql<
    TaskRow[]
  >`select * from tasks where id = ${childWorkflow.parent_task_id}`;
  if (!parentTask) return;

  await sql`update tasks set status = 'completed', completed_at = now() where id = ${parentTask.id}`;
  await recordTaskHistory(sql, parentTask, "task.completed", null, {
    childWorkflowId: childWorkflow.id,
  });

  const [parentWorkflow] = await sql<
    WorkflowRow[]
  >`select * from workflows where id = ${parentTask.workflow_id}`;
  if (!parentWorkflow || parentWorkflow.status !== "running") return; // cancelled/suspended/failed while the child ran
  const [version] = await sql<{ definition: ProcessGraphDefinition }[]>`
    select definition from process_versions where id = ${parentWorkflow.process_version_id}
  `;
  const graph = buildGraphIndex(version.definition);
  await advanceFrom({ sql, workflow: parentWorkflow, graph, task: parentTask });
}

export interface InstantiateWorkflowInput {
  organizationId: string;
  processId: string;
  processVersionId: string;
  slaHours: number | null;
  startedBy: string | null;
  parentTaskId: string | null;
  restartedFromWorkflowId: string | null;
}

/** Creates the `workflows` row and activates the graph's start node — the one entry point both startWorkflow() (workflows.ts) and startChildWorkflow()/restartWorkflow() go through. */
export async function instantiateWorkflow(
  sql: Sql,
  input: InstantiateWorkflowInput,
): Promise<WorkflowRow> {
  const [version] = await sql<{ title: string; definition: ProcessGraphDefinition }[]>`
    select title, definition from process_versions where id = ${input.processVersionId}
  `;
  if (!version) throw new Error("Process version not found.");

  const dueAt = input.slaHours ? new Date(Date.now() + input.slaHours * 3_600_000) : null;

  const [workflow] = await sql<WorkflowRow[]>`
    insert into workflows (
      organization_id, process_id, process_version_id, title, started_by, due_at,
      parent_task_id, restarted_from_workflow_id
    ) values (
      ${input.organizationId}, ${input.processId}, ${input.processVersionId}, ${version.title},
      ${input.startedBy}, ${dueAt}, ${input.parentTaskId}, ${input.restartedFromWorkflowId}
    )
    returning *
  `;

  await recordWorkflowHistory(
    sql,
    workflow.id,
    input.organizationId,
    "workflow.started",
    input.startedBy,
  );
  await recordAuditEvent(sql, {
    organizationId: input.organizationId,
    actorProfileId: null,
    action: AuditAction.WorkflowStarted,
    resourceType: AuditResourceType.Workflow,
    resourceId: workflow.id,
    source: input.startedBy ? "app" : "system",
  });

  if (dueAt) {
    await enqueueJob(sql, input.organizationId, {
      jobType: "workflow-deadline-check",
      payload: { workflowId: workflow.id },
      idempotencyKey: `workflow-deadline-check:${workflow.id}`,
      scheduledAt: dueAt,
    });
  }

  const graph = buildGraphIndex(version.definition);
  const startNode = version.definition.nodes.find((node) => node.type === "start");
  if (!startNode) throw new Error("Process version has no start node."); // unreachable: validated before publish

  await activateNode({ sql, workflow, graph, nodeId: startNode.id });

  const [refreshed] = await sql<WorkflowRow[]>`select * from workflows where id = ${workflow.id}`;
  return refreshed;
}
