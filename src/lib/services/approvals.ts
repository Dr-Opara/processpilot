import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { advanceFrom, buildGraphIndex, failWorkflow } from "@/lib/services/workflow-engine";
import { getOwnTask, getOwnWorkflow, toTenantContext } from "@/lib/services/workflows";
import type {
  ApprovalDecisionRow,
  ApprovalPolicyRow,
  ProcessGraphDefinition,
  TaskRow,
} from "@/lib/db/database.types";

/**
 * Configurable multi-approver chains layered on top of Phase 8's single-
 * assignee `approval` node, the same way form-submissions.ts layers
 * structured capture onto the generic `form` node. An 'approval' task
 * whose `approval_policy_id` is set (workflow-engine.ts snapshots the
 * policy at task-creation time) is decided through this module instead
 * of workflows.ts's decideApproval() — one `approval_decisions` row per
 * resolved approver, aggregated per the policy's `strategy`:
 *
 * - `sequential` — approvers act in `sequence_order`; only the earliest
 *   still-pending decision is actionable. All must approve.
 * - `parallel` — every approver may act at once. All must approve.
 * - `unanimous` — same aggregation as `parallel` (every named approver
 *   must approve); kept as a distinct strategy value for policy authors
 *   who want to say so explicitly.
 * - `majority` — resolves the moment a strict majority has approved, or
 *   the moment approval becomes mathematically impossible (too many
 *   rejections). Abstained decisions don't count toward the total.
 * - `first_response` / `any_one` — the first decision (by any named
 *   approver) resolves the whole step immediately; every other pending
 *   decision is left as-is (moot, since the task is already closed).
 */

const decisionSchema = z.enum(["approved", "rejected", "changes_requested"]);

export function toApprovalOutcome(
  policy: Pick<ApprovalPolicyRow, "strategy" | "allow_abstain">,
  decisions: ApprovalDecisionRow[],
): "pending" | "approved" | "rejected" {
  const relevant = policy.allow_abstain
    ? decisions.filter((d) => d.status !== "abstained")
    : decisions;
  const approved = relevant.filter((d) => d.status === "approved").length;
  const rejected = relevant.filter(
    (d) => d.status === "rejected" || d.status === "changes_requested",
  ).length;
  const total = relevant.length;

  switch (policy.strategy) {
    case "first_response":
    case "any_one": {
      const firstDecided = decisions.find(
        (d) =>
          d.status === "approved" || d.status === "rejected" || d.status === "changes_requested",
      );
      if (!firstDecided) return "pending";
      return firstDecided.status === "approved" ? "approved" : "rejected";
    }
    case "majority": {
      const needed = Math.floor(total / 2) + 1;
      if (approved >= needed) return "approved";
      if (rejected > total - needed) return "rejected";
      return "pending";
    }
    case "sequential":
    case "parallel":
    case "unanimous":
    default: {
      if (rejected > 0) return "rejected";
      if (total > 0 && approved === total) return "approved";
      return "pending";
    }
  }
}

/** True if `decision` may currently be acted on — every strategy but `sequential` allows any pending decision to be acted on at any time; `sequential` only allows the earliest still-pending one. */
export function isDecisionActionable(
  policy: Pick<ApprovalPolicyRow, "strategy">,
  decisions: ApprovalDecisionRow[],
  decision: ApprovalDecisionRow,
): boolean {
  if (decision.status !== "pending") return false;
  if (policy.strategy !== "sequential") return true;
  const pending = decisions
    .filter((d) => d.status === "pending")
    .sort((a, b) => a.sequence_order - b.sequence_order);
  return pending[0]?.id === decision.id;
}

async function getOwnPolicy(
  tx: postgres.TransactionSql,
  organizationId: string,
  policyId: string,
): Promise<ApprovalPolicyRow> {
  const [policy] = await tx<ApprovalPolicyRow[]>`
    select * from approval_policies where id = ${policyId} and organization_id = ${organizationId}
  `;
  if (!policy) throw new AppError("not_found", "Approval policy not found.");
  return policy;
}

async function completeApprovalTask(
  tx: postgres.TransactionSql,
  task: TaskRow,
  workflow: Awaited<ReturnType<typeof getOwnWorkflow>>,
  outcome: "approved" | "rejected",
  decidedByMemberId: string,
): Promise<TaskRow> {
  const [updated] = await tx<TaskRow[]>`
    update tasks set
      status = ${outcome === "approved" ? "completed" : "rejected"},
      output = ${tx.json({ decision: outcome } as unknown as Parameters<typeof tx.json>[0])},
      completed_at = now(), completed_by = ${decidedByMemberId}
    where id = ${task.id}
    returning *
  `;
  await tx`
    insert into task_history (organization_id, workflow_id, task_id, event_type, actor_member_id, metadata)
    values (${task.organization_id}, ${workflow.id}, ${task.id}, 'task.approval_decided', ${decidedByMemberId}, ${tx.json({ outcome } as unknown as Parameters<typeof tx.json>[0])})
  `;
  await recordAuditEvent(tx, {
    organizationId: task.organization_id,
    action: AuditAction.TaskApprovalDecided,
    resourceType: AuditResourceType.Task,
    resourceId: task.id,
    source: "app",
  });

  if (outcome === "rejected" && updated.required) {
    await failWorkflow(
      tx,
      workflow.id,
      task.organization_id,
      `Required approval "${updated.label}" was rejected.`,
      { taskId: task.id, exceptionSource: "failed_approval", exceptionType: "process_deviation" },
    );
    return updated;
  }

  const [version] = await tx<{ definition: ProcessGraphDefinition }[]>`
    select definition from process_versions where id = ${workflow.process_version_id}
  `;
  const graph = buildGraphIndex(version.definition);
  await advanceFrom({ sql: tx, workflow, graph, task: updated });
  return updated;
}

export interface DecideApprovalChainInput {
  decision: "approved" | "rejected" | "changes_requested";
  comment?: string;
}

/** One approver's decision on a chained-approval task. Resolves and completes the task the moment the policy's strategy determines an outcome — see toApprovalOutcome(). */
export async function decideApprovalChain(
  taskId: string,
  input: DecideApprovalChainInput,
): Promise<ApprovalDecisionRow> {
  const parsedDecision = decisionSchema.parse(input.decision);
  const preCheck = await getCurrentMembership();
  const task = await getOwnTask(preCheck, taskId);
  const workflow = await getOwnWorkflow(preCheck, task.workflow_id);

  if (task.node_type !== "approval" || !task.approval_policy_id) {
    throw new AppError("conflict", "This task is not a chained-approval step.");
  }
  if (task.status !== "assigned" && task.status !== "in_progress") {
    throw new AppError("conflict", "This approval step is not open.");
  }
  if (workflow.status !== "running")
    throw new AppError("conflict", "This workflow is not running.");

  const membership = await requirePermission("approval.review", {
    scope: { departmentId: task.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const policy = await getOwnPolicy(
      tx,
      membership.organization.id,
      task.approval_policy_id as string,
    );
    const decisions = await tx<
      ApprovalDecisionRow[]
    >`select * from approval_decisions where task_id = ${taskId} order by sequence_order asc`;
    const own = decisions.find((d) => d.approver_member_id === membership.member.id);
    if (!own) throw new AppError("forbidden", "You are not a named approver on this step.");
    if (!isDecisionActionable(policy, decisions, own)) {
      throw new AppError(
        "conflict",
        "It is not yet your turn to decide, or you have already decided.",
      );
    }

    const comment = input.comment?.trim() || null;
    const [updatedDecision] = await tx<ApprovalDecisionRow[]>`
      update approval_decisions set status = ${parsedDecision}, comment = ${comment}, decided_at = now()
      where id = ${own.id}
      returning *
    `;

    // Immutable record of this individual approver's decision — inserted
    // unconditionally here (not only once the whole chain resolves via
    // completeApprovalTask's separate 'task.approval_decided' event
    // below), since a multi-approver chain's earlier decisions would
    // otherwise only ever exist as a mutable approval_decisions row.
    await tx`
      insert into task_history (organization_id, workflow_id, task_id, event_type, actor_member_id, metadata)
      values (
        ${task.organization_id}, ${workflow.id}, ${task.id}, 'task.approval_decision_recorded', ${membership.member.id},
        ${tx.json({ decisionId: updatedDecision.id, decision: parsedDecision, comment } as unknown as Parameters<typeof tx.json>[0])}
      )
    `;

    const refreshed = decisions.map((d) => (d.id === updatedDecision.id ? updatedDecision : d));
    const outcome = toApprovalOutcome(policy, refreshed);
    if (outcome !== "pending") {
      await completeApprovalTask(tx, task, workflow, outcome, membership.member.id);
    } else {
      await tx`update tasks set status = 'in_progress' where id = ${taskId} and status = 'assigned'`;
    }

    return updatedDecision;
  });
}

/** Reassigns the caller's own still-pending decision to another member — only when the policy allows it. Preserves history: the original row is marked 'delegated' (never edited into looking like it decided anything), and a new row is created for the delegate. */
export async function delegateApprovalDecision(
  taskId: string,
  toMemberId: string,
): Promise<ApprovalDecisionRow> {
  const preCheck = await getCurrentMembership();
  const task = await getOwnTask(preCheck, taskId);
  if (task.node_type !== "approval" || !task.approval_policy_id) {
    throw new AppError("conflict", "This task is not a chained-approval step.");
  }
  const membership = await requirePermission("approval.review", {
    scope: { departmentId: task.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const policy = await getOwnPolicy(
      tx,
      membership.organization.id,
      task.approval_policy_id as string,
    );
    if (!policy.allow_delegation)
      throw new AppError("conflict", "This approval policy does not allow delegation.");

    const [own] = await tx<ApprovalDecisionRow[]>`
      select * from approval_decisions where task_id = ${taskId} and approver_member_id = ${membership.member.id}
    `;
    if (!own) throw new AppError("forbidden", "You are not a named approver on this step.");
    if (own.status !== "pending")
      throw new AppError("conflict", "Only a pending decision can be delegated.");

    await tx`update approval_decisions set status = 'delegated', delegated_to_member_id = ${toMemberId} where id = ${own.id}`;

    const [delegated] = await tx<ApprovalDecisionRow[]>`
      insert into approval_decisions (
        organization_id, task_id, approval_policy_id, approver_member_id, sequence_order, delegated_from_member_id
      ) values (
        ${membership.organization.id}, ${taskId}, ${policy.id}, ${toMemberId}, ${own.sequence_order}, ${membership.member.id}
      )
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ApprovalDelegated,
      resourceType: AuditResourceType.Task,
      resourceId: taskId,
      source: "app",
    });

    return delegated;
  });
}

/** Administrative override — resolves the whole approval step immediately regardless of the chain's current state. Requires approval.manage or workflow.manage, never the approver's own approval.review grant. */
export async function overrideApprovalDecision(
  taskId: string,
  decision: "approved" | "rejected",
  reason: string,
): Promise<TaskRow> {
  const trimmedReason = reason.trim();
  if (!trimmedReason)
    throw new AppError("conflict", "A reason is required for an administrative override.");

  const preCheck = await getCurrentMembership();
  const task = await getOwnTask(preCheck, taskId);
  const workflow = await getOwnWorkflow(preCheck, task.workflow_id);
  if (task.node_type !== "approval")
    throw new AppError("conflict", "Only an approval step can be overridden.");
  if (task.status !== "assigned" && task.status !== "in_progress") {
    throw new AppError("conflict", "This approval step is not open.");
  }

  const membership = await requirePermission("approval.manage", {
    scope: { departmentId: task.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    if (task.approval_policy_id) {
      const overridden = await tx<ApprovalDecisionRow[]>`
        update approval_decisions set status = ${decision}, is_override = true,
          override_by_member_id = ${membership.member.id}, override_reason = ${trimmedReason}, decided_at = now()
        where task_id = ${taskId} and status = 'pending'
        returning *
      `;
      for (const decisionRow of overridden) {
        await tx`
          insert into task_history (organization_id, workflow_id, task_id, event_type, actor_member_id, metadata)
          values (
            ${task.organization_id}, ${workflow.id}, ${task.id}, 'task.approval_decision_recorded', ${membership.member.id},
            ${tx.json({ decisionId: decisionRow.id, decision, isOverride: true, overrideReason: trimmedReason } as unknown as Parameters<typeof tx.json>[0])}
          )
        `;
      }
    }
    const updated = await completeApprovalTask(tx, task, workflow, decision, membership.member.id);

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ApprovalOverridden,
      resourceType: AuditResourceType.Task,
      resourceId: taskId,
      source: "app",
      reason: trimmedReason,
    });

    return updated;
  });
}

export async function listApprovalDecisionsForTask(taskId: string): Promise<ApprovalDecisionRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<ApprovalDecisionRow[]>`
      select * from approval_decisions where task_id = ${taskId} and organization_id = ${membership.organization.id}
      order by sequence_order asc
    `,
  );
}
