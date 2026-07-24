import "server-only";
import { z } from "zod";
import { getCurrentMembership, requirePermission, type CurrentMembership } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import {
  advanceFrom,
  buildGraphIndex,
  failWorkflow,
  hasUnsupportedNodeType,
  instantiateWorkflow,
} from "@/lib/services/workflow-engine";
import type {
  ProcessGraphDefinition,
  ProcessRow,
  TaskHistoryRow,
  TaskRow,
  WorkflowHistoryRow,
  WorkflowRow,
} from "@/lib/db/database.types";

export function toTenantContext(membership: {
  organization: { id: string };
  member: { id: string };
  profile: { clerk_user_id: string };
}) {
  return {
    organizationId: membership.organization.id,
    memberId: membership.member.id,
    clerkUserId: membership.profile.clerk_user_id,
  };
}

export async function getOwnWorkflow(
  membership: CurrentMembership,
  workflowId: string,
): Promise<WorkflowRow> {
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [workflow] = await tx<WorkflowRow[]>`
      select * from workflows where id = ${workflowId} and organization_id = ${membership.organization.id}
    `;
    if (!workflow) throw new AppError("not_found", "Workflow not found.");
    return workflow;
  });
}

export async function getOwnTask(membership: CurrentMembership, taskId: string): Promise<TaskRow> {
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [task] = await tx<TaskRow[]>`
      select * from tasks where id = ${taskId} and organization_id = ${membership.organization.id}
    `;
    if (!task) throw new AppError("not_found", "Task not found.");
    return task;
  });
}

/** True for the specific assignee, or for a member eligible to claim/act on a not-yet-claimed pooled (team/role) task. */
export async function isEligibleForTask(
  membership: CurrentMembership,
  task: TaskRow,
): Promise<boolean> {
  if (task.assignee_member_id) return task.assignee_member_id === membership.member.id;
  if (!task.assignee_team_id && !task.assignee_role_id) return false;

  return withTenantContext(toTenantContext(membership), async (tx) => {
    if (task.assignee_team_id) {
      const [row] = await tx<{ id: string }[]>`
        select id from team_members where team_id = ${task.assignee_team_id} and organization_member_id = ${membership.member.id}
      `;
      if (row) return true;
    }
    if (task.assignee_role_id) {
      const [row] = await tx<{ id: string }[]>`
        select id from member_role_assignments
        where role_id = ${task.assignee_role_id} and organization_member_id = ${membership.member.id}
      `;
      if (row) return true;
    }
    return false;
  });
}

export interface ListWorkflowsFilters {
  status?: WorkflowRow["status"] | "all";
  processId?: string;
}

/** Read access is RLS-narrowed (assignee, starter, or workflow.manage/assign holder) — see the migration's workflows_select policy. */
export async function listWorkflows(filters: ListWorkflowsFilters = {}): Promise<WorkflowRow[]> {
  const membership = await getCurrentMembership();
  const status = filters.status ?? "all";
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<WorkflowRow[]>`
      select * from workflows
      where organization_id = ${membership.organization.id}
        and (${status === "all"} or status = ${status})
        and (${filters.processId ?? null} is null or process_id = ${filters.processId ?? null})
      order by started_at desc
    `,
  );
}

export interface WorkflowDetail {
  workflow: WorkflowRow;
  tasks: TaskRow[];
  history: WorkflowHistoryRow[];
}

export async function getWorkflowDetail(workflowId: string): Promise<WorkflowDetail> {
  const membership = await getCurrentMembership();
  const workflow = await getOwnWorkflow(membership, workflowId);
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const tasks = await tx<TaskRow[]>`
      select * from tasks where workflow_id = ${workflowId} order by created_at asc
    `;
    const history = await tx<WorkflowHistoryRow[]>`
      select * from workflow_history where workflow_id = ${workflowId} order by created_at asc
    `;
    return { workflow, tasks, history };
  });
}

export interface TaskDetail {
  task: TaskRow;
  workflow: WorkflowRow;
  history: TaskHistoryRow[];
}

export async function getTaskDetail(taskId: string): Promise<TaskDetail> {
  const membership = await getCurrentMembership();
  const task = await getOwnTask(membership, taskId);
  const workflow = await getOwnWorkflow(membership, task.workflow_id);
  const history = await withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<
        TaskHistoryRow[]
      >`select * from task_history where task_id = ${taskId} order by created_at asc`,
  );
  return { task, workflow, history };
}

export interface ListMyTasksFilters {
  status?: TaskRow["status"] | "open";
}

/** "My" inbox: tasks claimed by me, plus unclaimed pooled tasks I'm eligible for. `status: "open"` (the default) means assigned or in_progress. */
export async function listMyTasks(filters: ListMyTasksFilters = {}): Promise<TaskRow[]> {
  const membership = await getCurrentMembership();
  const status = filters.status ?? "open";

  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<TaskRow[]>`
      select t.* from tasks t
      where t.organization_id = ${membership.organization.id}
        and (
          t.assignee_member_id = ${membership.member.id}
          or (
            t.assignee_member_id is null
            and (
              (t.assignee_team_id is not null and exists (
                select 1 from team_members tm
                where tm.team_id = t.assignee_team_id and tm.organization_member_id = ${membership.member.id}
              ))
              or (t.assignee_role_id is not null and exists (
                select 1 from member_role_assignments mra
                where mra.role_id = t.assignee_role_id and mra.organization_member_id = ${membership.member.id}
              ))
            )
          )
        )
        and (${status === "open"} or t.status = ${status})
        and (${status !== "open"} or t.status in ('assigned', 'in_progress'))
      order by t.started_at asc
    `,
  );
}

/** Starts a new workflow from a process's current published version. */
export async function startWorkflow(processId: string): Promise<WorkflowRow> {
  const preCheck = await getCurrentMembership();
  const [process] = await withTenantContext(
    toTenantContext(preCheck),
    (tx) =>
      tx<
        ProcessRow[]
      >`select * from processes where id = ${processId} and organization_id = ${preCheck.organization.id}`,
  );
  if (!process) throw new AppError("not_found", "Process not found.");
  if (!process.current_version_id || process.status !== "published") {
    throw new AppError("conflict", "Only a published process can be started as a workflow.");
  }

  const membership = await requirePermission("workflow.start", {
    scope: { departmentId: process.department_id ?? undefined },
  });

  const [version] = await withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<{ definition: ProcessGraphDefinition }[]>`
      select definition from process_versions where id = ${process.current_version_id}
    `,
  );
  if (hasUnsupportedNodeType(version.definition)) {
    throw new AppError(
      "conflict",
      "This process uses a step type Phase 8 doesn't support executing yet (system action) — it can't be started as a workflow until the graph is revised.",
    );
  }

  return withTenantContext(toTenantContext(membership), (tx) =>
    instantiateWorkflow(tx, {
      organizationId: membership.organization.id,
      processId: process.id,
      processVersionId: process.current_version_id as string,
      slaHours: process.sla_hours,
      startedBy: membership.member.id,
      parentTaskId: null,
      restartedFromWorkflowId: null,
    }),
  );
}

const outputSchema = z.record(z.string(), z.unknown()).optional();

/** Completes a human_task/form/evidence task — not `approval`, which goes through decideApproval() instead since it needs a different permission and records a decision, not just an output blob. */
export async function completeTask(
  taskId: string,
  output?: Record<string, unknown>,
): Promise<TaskRow> {
  const parsedOutput = outputSchema.parse(output) ?? {};
  const membership = await getCurrentMembership();
  const task = await getOwnTask(membership, taskId);
  const workflow = await getOwnWorkflow(membership, task.workflow_id);

  if (task.node_type === "approval") {
    throw new AppError(
      "conflict",
      "An approval step must be decided via decideApproval, not completeTask.",
    );
  }
  if (task.status !== "assigned" && task.status !== "in_progress") {
    throw new AppError("conflict", "This task is not open.");
  }
  if (workflow.status !== "running") {
    throw new AppError("conflict", "This workflow is not running.");
  }
  if (!(await isEligibleForTask(membership, task))) {
    throw new AppError("forbidden", "You are not eligible to complete this task.");
  }
  await requirePermission("workflow.complete", {
    scope: { departmentId: task.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<TaskRow[]>`
      update tasks set
        status = 'completed', output = ${tx.json(parsedOutput as unknown as Parameters<typeof tx.json>[0])},
        completed_at = now(), completed_by = ${membership.member.id},
        assignee_member_id = coalesce(assignee_member_id, ${membership.member.id})
      where id = ${taskId}
      returning *
    `;

    await tx`
      insert into task_history (organization_id, workflow_id, task_id, event_type, actor_member_id, metadata)
      values (${membership.organization.id}, ${workflow.id}, ${taskId}, 'task.completed', ${membership.member.id}, ${tx.json(parsedOutput as unknown as Parameters<typeof tx.json>[0])})
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TaskCompleted,
      resourceType: AuditResourceType.Task,
      resourceId: taskId,
      source: "app",
    });

    const [version] = await tx<{ definition: ProcessGraphDefinition }[]>`
      select definition from process_versions where id = ${workflow.process_version_id}
    `;
    const graph = buildGraphIndex(version.definition);
    await advanceFrom({ sql: tx, workflow, graph, task: updated });

    return updated;
  });
}

const decisionSchema = z.enum(["approved", "rejected"]);

/** Decides an `approval` node. A rejected *required* approval fails the whole workflow — see workflow-engine.ts's header comment. */
export async function decideApproval(
  taskId: string,
  decision: "approved" | "rejected",
  comment?: string,
): Promise<TaskRow> {
  const parsedDecision = decisionSchema.parse(decision);
  const membership = await getCurrentMembership();
  const task = await getOwnTask(membership, taskId);
  const workflow = await getOwnWorkflow(membership, task.workflow_id);

  if (task.node_type !== "approval") {
    throw new AppError("conflict", "Only an approval step can be decided.");
  }
  if (task.status !== "assigned" && task.status !== "in_progress") {
    throw new AppError("conflict", "This approval step is not open.");
  }
  if (workflow.status !== "running") {
    throw new AppError("conflict", "This workflow is not running.");
  }
  if (!(await isEligibleForTask(membership, task))) {
    throw new AppError("forbidden", "You are not eligible to decide this approval.");
  }
  await requirePermission("approval.review", {
    scope: { departmentId: task.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const output = { decision: parsedDecision, comment: comment?.trim() || null };
    const [updated] = await tx<TaskRow[]>`
      update tasks set
        status = ${parsedDecision === "approved" ? "completed" : "rejected"},
        output = ${tx.json(output as unknown as Parameters<typeof tx.json>[0])},
        completed_at = now(), completed_by = ${membership.member.id},
        assignee_member_id = coalesce(assignee_member_id, ${membership.member.id})
      where id = ${taskId}
      returning *
    `;

    await tx`
      insert into task_history (organization_id, workflow_id, task_id, event_type, actor_member_id, metadata)
      values (${membership.organization.id}, ${workflow.id}, ${taskId}, 'task.approval_decided', ${membership.member.id}, ${tx.json(output as unknown as Parameters<typeof tx.json>[0])})
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TaskApprovalDecided,
      resourceType: AuditResourceType.Task,
      resourceId: taskId,
      source: "app",
      reason: output.comment,
    });

    if (parsedDecision === "rejected" && updated.required) {
      await failWorkflow(
        tx,
        workflow.id,
        membership.organization.id,
        `Required approval "${updated.label}" was rejected.`,
      );
      return updated;
    }

    const [version] = await tx<{ definition: ProcessGraphDefinition }[]>`
      select definition from process_versions where id = ${workflow.process_version_id}
    `;
    const graph = buildGraphIndex(version.definition);
    await advanceFrom({ sql: tx, workflow, graph, task: updated });

    return updated;
  });
}

/** Self-assigns an unclaimed pooled (team/role) task — narrows who it's for without changing its status; completeTask()/decideApproval() also implicitly claim on completion if called directly by an eligible pool member. */
export async function claimTask(taskId: string): Promise<TaskRow> {
  const membership = await getCurrentMembership();
  const task = await getOwnTask(membership, taskId);
  if (task.assignee_member_id) throw new AppError("conflict", "This task is already claimed.");
  if (task.status !== "assigned") throw new AppError("conflict", "This task is not open.");
  if (!(await isEligibleForTask(membership, task))) {
    throw new AppError("forbidden", "You are not eligible to claim this task.");
  }
  await requirePermission(task.node_type === "approval" ? "approval.review" : "workflow.complete", {
    scope: { departmentId: task.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<TaskRow[]>`
      update tasks set assignee_member_id = ${membership.member.id}, status = 'in_progress'
      where id = ${taskId} and assignee_member_id is null
      returning *
    `;
    if (!updated) throw new AppError("conflict", "This task was already claimed by someone else.");

    await tx`
      insert into task_history (organization_id, workflow_id, task_id, event_type, actor_member_id)
      values (${membership.organization.id}, ${task.workflow_id}, ${taskId}, 'task.assigned', ${membership.member.id})
    `;
    return updated;
  });
}

/** Manager/admin reassignment to a specific member — distinct from claimTask's self-service pool claim. */
export async function reassignTask(taskId: string, newAssigneeMemberId: string): Promise<TaskRow> {
  const preCheck = await getCurrentMembership();
  const task = await getOwnTask(preCheck, taskId);
  if (task.status !== "assigned" && task.status !== "in_progress") {
    throw new AppError("conflict", "This task is not open.");
  }
  const membership = await requirePermission("workflow.assign", {
    scope: { departmentId: task.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<TaskRow[]>`
      update tasks set assignee_member_id = ${newAssigneeMemberId}, assignee_team_id = null, assignee_role_id = null
      where id = ${taskId}
      returning *
    `;
    await tx`
      insert into task_history (organization_id, workflow_id, task_id, event_type, actor_member_id, metadata)
      values (
        ${membership.organization.id}, ${task.workflow_id}, ${taskId}, 'task.reassigned', ${membership.member.id},
        ${tx.json({ newAssigneeMemberId } as unknown as Parameters<typeof tx.json>[0])}
      )
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TaskReassigned,
      resourceType: AuditResourceType.Task,
      resourceId: taskId,
      source: "app",
    });
    return updated;
  });
}

/** Administratively skips a non-required task that's stuck (e.g. its assignee left) — required tasks can't be skipped this way; use cancelWorkflow or reassignTask instead. */
export async function skipTask(taskId: string): Promise<TaskRow> {
  const preCheck = await getCurrentMembership();
  const task = await getOwnTask(preCheck, taskId);
  const workflow = await getOwnWorkflow(preCheck, task.workflow_id);
  if (task.required)
    throw new AppError("conflict", "A required task cannot be skipped — reassign it instead.");
  if (task.status !== "assigned" && task.status !== "in_progress") {
    throw new AppError("conflict", "This task is not open.");
  }
  const membership = await requirePermission("workflow.manage", {
    scope: { departmentId: task.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<TaskRow[]>`
      update tasks set status = 'skipped', completed_at = now(), completed_by = ${membership.member.id}
      where id = ${taskId}
      returning *
    `;
    await tx`
      insert into task_history (organization_id, workflow_id, task_id, event_type, actor_member_id)
      values (${membership.organization.id}, ${workflow.id}, ${taskId}, 'task.skipped', ${membership.member.id})
    `;

    const [version] = await tx<{ definition: ProcessGraphDefinition }[]>`
      select definition from process_versions where id = ${workflow.process_version_id}
    `;
    const graph = buildGraphIndex(version.definition);
    await advanceFrom({ sql: tx, workflow, graph, task: updated });

    return updated;
  });
}

async function requireManageableWorkflow(workflowId: string): Promise<{
  membership: CurrentMembership;
  workflow: WorkflowRow;
}> {
  const preCheck = await getCurrentMembership();
  const workflow = await getOwnWorkflow(preCheck, workflowId);
  const membership = await requirePermission("workflow.manage", {
    scope: { departmentId: workflow.department_id ?? undefined },
  });
  return { membership, workflow };
}

export async function suspendWorkflow(workflowId: string): Promise<WorkflowRow> {
  const { membership, workflow } = await requireManageableWorkflow(workflowId);
  if (workflow.status !== "running")
    throw new AppError("conflict", "Only a running workflow can be suspended.");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<WorkflowRow[]>`
      update workflows set status = 'suspended', suspended_at = now(), suspended_by = ${membership.member.id}
      where id = ${workflowId}
      returning *
    `;
    await tx`
      insert into workflow_history (organization_id, workflow_id, event_type, actor_member_id)
      values (${membership.organization.id}, ${workflowId}, 'workflow.suspended', ${membership.member.id})
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.WorkflowSuspended,
      resourceType: AuditResourceType.Workflow,
      resourceId: workflowId,
      source: "app",
    });
    return updated;
  });
}

export async function resumeWorkflow(workflowId: string): Promise<WorkflowRow> {
  const { membership, workflow } = await requireManageableWorkflow(workflowId);
  if (workflow.status !== "suspended")
    throw new AppError("conflict", "Only a suspended workflow can be resumed.");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<WorkflowRow[]>`
      update workflows set status = 'running', suspended_at = null, suspended_by = null
      where id = ${workflowId}
      returning *
    `;
    await tx`
      insert into workflow_history (organization_id, workflow_id, event_type, actor_member_id)
      values (${membership.organization.id}, ${workflowId}, 'workflow.resumed', ${membership.member.id})
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.WorkflowResumed,
      resourceType: AuditResourceType.Workflow,
      resourceId: workflowId,
      source: "app",
    });
    return updated;
  });
}

export async function cancelWorkflow(workflowId: string, reason?: string): Promise<WorkflowRow> {
  const { membership, workflow } = await requireManageableWorkflow(workflowId);
  if (workflow.status !== "running" && workflow.status !== "suspended") {
    throw new AppError("conflict", "Only a running or suspended workflow can be cancelled.");
  }

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<WorkflowRow[]>`
      update workflows set status = 'cancelled', cancelled_at = now(), cancelled_by = ${membership.member.id}
      where id = ${workflowId}
      returning *
    `;
    await tx`
      update tasks set status = 'cancelled' where workflow_id = ${workflowId} and status in ('assigned', 'in_progress')
    `;
    await tx`
      insert into workflow_history (organization_id, workflow_id, event_type, actor_member_id, metadata)
      values (${membership.organization.id}, ${workflowId}, 'workflow.cancelled', ${membership.member.id}, ${tx.json({ reason: reason?.trim() || null } as unknown as Parameters<typeof tx.json>[0])})
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.WorkflowCancelled,
      resourceType: AuditResourceType.Workflow,
      resourceId: workflowId,
      source: "app",
      reason: reason?.trim() || null,
    });
    return updated;
  });
}

/** Cancels this instance (if not already terminal) and starts a fresh one from the *same* process_version — never rewinds an existing instance in place, which would mutate history ADR-0011 guarantees is immutable. */
export async function restartWorkflow(workflowId: string): Promise<WorkflowRow> {
  const preCheck = await getCurrentMembership();
  const workflow = await getOwnWorkflow(preCheck, workflowId);
  const membership = await requirePermission("workflow.manage", {
    scope: { departmentId: workflow.department_id ?? undefined },
  });

  if (workflow.status === "running" || workflow.status === "suspended") {
    await cancelWorkflow(workflowId, "Restarted");
  }

  const [process] = await withTenantContext(
    toTenantContext(membership),
    (tx) => tx<ProcessRow[]>`select * from processes where id = ${workflow.process_id}`,
  );

  return withTenantContext(toTenantContext(membership), (tx) =>
    instantiateWorkflow(tx, {
      organizationId: membership.organization.id,
      processId: workflow.process_id,
      processVersionId: workflow.process_version_id,
      slaHours: process?.sla_hours ?? null,
      startedBy: membership.member.id,
      parentTaskId: null,
      restartedFromWorkflowId: workflowId,
    }),
  );
}
