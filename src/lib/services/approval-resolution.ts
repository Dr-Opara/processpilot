import "server-only";
import type postgres from "postgres";
import { AppError } from "@/lib/errors";
import type { WorkflowInstanceContext } from "@/lib/services/workflow-condition";
import type {
  ApprovalDecisionRow,
  ApprovalPolicyRow,
  ApproverRule,
  TaskRow,
} from "@/lib/db/database.types";

/** `<nodeId>.<key>` — a bare field reference into WorkflowInstanceContext, e.g. `intake-1.requested_by_member_id`. Deliberately narrower than workflow-condition.ts's parseCondition (no operator/literal): a 'runtime_expression' approver rule resolves to a member id, not a boolean. */
const FIELD_REFERENCE_PATTERN = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_]+)$/;

/**
 * Pure approver-resolution logic shared by workflow-engine.ts
 * (task-creation-time fan-out) and approvals.ts/escalation.ts (deciding
 * and reassigning). Deliberately its own module, not part of either of
 * those: workflow-engine.ts needs createApprovalDecisions() at
 * activation time, while approvals.ts needs advanceFrom()/failWorkflow()
 * from workflow-engine.ts to *complete* a task once a chain resolves —
 * putting both directions in the same two files would be a circular
 * import.
 */

export async function getActiveApprovalPolicy(
  sql: postgres.Sql | postgres.TransactionSql,
  organizationId: string,
  policyId: string,
): Promise<ApprovalPolicyRow | null> {
  const [policy] = await sql<ApprovalPolicyRow[]>`
    select * from approval_policies where id = ${policyId} and organization_id = ${organizationId} and status = 'active'
  `;
  return policy ?? null;
}

export async function resolveMemberIdsForRule(
  tx: postgres.Sql | postgres.TransactionSql,
  organizationId: string,
  rule: ApproverRule,
  context: {
    departmentId: string | null;
    startedByMemberId: string | null;
    instanceContext?: WorkflowInstanceContext;
  },
): Promise<string[]> {
  switch (rule.type) {
    case "runtime_expression": {
      if (!rule.value) return [];
      const match = FIELD_REFERENCE_PATTERN.exec(rule.value.trim());
      if (!match) return [];
      const [, nodeId, key] = match;
      const value = context.instanceContext?.[nodeId]?.[key];
      return typeof value === "string" && value ? [value] : [];
    }
    case "user":
      return rule.value ? [rule.value] : [];
    case "role": {
      if (!rule.value) return [];
      const rows = await tx<{ organization_member_id: string }[]>`
        select mra.organization_member_id from member_role_assignments mra
        join organization_members om on om.id = mra.organization_member_id
        where mra.role_id = ${rule.value} and mra.organization_id = ${organizationId} and om.status = 'active'
      `;
      return rows.map((r) => r.organization_member_id);
    }
    case "manager": {
      if (!context.startedByMemberId) return [];
      const [starter] = await tx<{ manager_id: string | null }[]>`
        select manager_id from organization_members where id = ${context.startedByMemberId}
      `;
      return starter?.manager_id ? [starter.manager_id] : [];
    }
    case "department_owner": {
      if (!context.departmentId) return [];
      const [department] = await tx<{ owner_member_id: string | null }[]>`
        select owner_member_id from departments where id = ${context.departmentId}
      `;
      return department?.owner_member_id ? [department.owner_member_id] : [];
    }
    case "process_owner": {
      // rule.value carries the process id explicitly — a workflow
      // instance's own process_id, resolved by the caller.
      if (!rule.value) return [];
      const [process] = await tx<{ owner_member_id: string | null }[]>`
        select owner_member_id from processes where id = ${rule.value}
      `;
      return process?.owner_member_id ? [process.owner_member_id] : [];
    }
    case "location_manager": {
      if (!rule.value) return [];
      const [location] = await tx<{ manager_member_id: string | null }[]>`
        select manager_member_id from organization_locations where id = ${rule.value}
      `;
      return location?.manager_member_id ? [location.manager_member_id] : [];
    }
    case "team_manager": {
      if (!rule.value) return [];
      const [team] = await tx<{ manager_member_id: string | null }[]>`
        select manager_member_id from teams where id = ${rule.value}
      `;
      return team?.manager_member_id ? [team.manager_member_id] : [];
    }
  }
}

/** Fans an 'approval' task out into one approval_decisions row per resolved approver — called by workflow-engine.ts's activateNode() when the node's snapshotted policy resolves to at least one approver. Throws if it resolves to none, since an approval step nobody can act on would strand the workflow. */
export async function createApprovalDecisions(
  sql: postgres.Sql | postgres.TransactionSql,
  task: Pick<TaskRow, "id" | "organization_id">,
  policy: ApprovalPolicyRow,
  context: {
    departmentId: string | null;
    startedByMemberId: string | null;
    processId: string;
    instanceContext?: WorkflowInstanceContext;
  },
): Promise<ApprovalDecisionRow[]> {
  const memberIdSets = await Promise.all(
    policy.approver_rules.map((rule) =>
      resolveMemberIdsForRule(
        sql,
        task.organization_id,
        rule.type === "process_owner" && !rule.value ? { ...rule, value: context.processId } : rule,
        context,
      ),
    ),
  );
  let orderedUniqueMemberIds = [...new Set(memberIdSets.flat())];
  if (policy.prevent_self_approval && context.startedByMemberId) {
    orderedUniqueMemberIds = orderedUniqueMemberIds.filter(
      (id) => id !== context.startedByMemberId,
    );
  }
  if (orderedUniqueMemberIds.length === 0) {
    throw new AppError(
      "conflict",
      `Approval policy "${policy.name}" resolved to no eligible approvers.`,
    );
  }

  const decisions: ApprovalDecisionRow[] = [];
  for (const [index, memberId] of orderedUniqueMemberIds.entries()) {
    const [decision] = await sql<ApprovalDecisionRow[]>`
      insert into approval_decisions (organization_id, task_id, approval_policy_id, approver_member_id, sequence_order)
      values (${task.organization_id}, ${task.id}, ${policy.id}, ${memberId}, ${index})
      returning *
    `;
    decisions.push(decision);
  }
  return decisions;
}
