import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { resolveMemberIdsForRule } from "@/lib/services/approval-resolution";
import { createSystemException } from "@/lib/services/exceptions";
import type { EscalationRuleRow, SlaDefinitionRow, TaskRow } from "@/lib/db/database.types";

function toTenantContext(membership: {
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

export const escalationRuleInputSchema = z.object({
  slaDefinitionId: z.string().uuid(),
  level: z.number().int().positive(),
  triggerAfterMinutesPastDue: z.number().int().nonnegative(),
  action: z.enum([
    "remind",
    "reassign",
    "escalate_manager",
    "escalate_process_owner",
    "escalate_admin",
  ]),
  reassignTarget: z
    .object({
      type: z.enum([
        "user",
        "role",
        "manager",
        "department_owner",
        "process_owner",
        "location_manager",
        "team_manager",
      ]),
      value: z.string().trim().min(1).nullable(),
    })
    .optional()
    .nullable(),
});

export type EscalationRuleInput = z.infer<typeof escalationRuleInputSchema>;

export async function listEscalationRules(slaDefinitionId: string): Promise<EscalationRuleRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<EscalationRuleRow[]>`
      select * from escalation_rules
      where sla_definition_id = ${slaDefinitionId} and organization_id = ${membership.organization.id}
      order by level asc
    `,
  );
}

export async function createEscalationRule(input: EscalationRuleInput): Promise<EscalationRuleRow> {
  const data = escalationRuleInputSchema.parse(input);
  if (data.action === "reassign" && !data.reassignTarget) {
    throw new AppError("conflict", "A reassign target is required for the 'reassign' action.");
  }

  const preCheck = await getCurrentMembership();
  const definition = await withTenantContext(toTenantContext(preCheck), async (tx) => {
    const [row] = await tx<SlaDefinitionRow[]>`
      select * from sla_definitions where id = ${data.slaDefinitionId} and organization_id = ${preCheck.organization.id}
    `;
    if (!row) throw new AppError("not_found", "SLA definition not found.");
    return row;
  });
  const membership = await requirePermission("sla.manage", {
    scope: { departmentId: definition.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [rule] = await tx<EscalationRuleRow[]>`
      insert into escalation_rules (
        organization_id, sla_definition_id, level, trigger_after_minutes_past_due, action, reassign_target
      ) values (
        ${membership.organization.id}, ${data.slaDefinitionId}, ${data.level}, ${data.triggerAfterMinutesPastDue},
        ${data.action}, ${data.reassignTarget ? tx.json(data.reassignTarget as unknown as Parameters<typeof tx.json>[0]) : null}
      )
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.EscalationRuleCreated,
      resourceType: AuditResourceType.EscalationRule,
      resourceId: rule.id,
      source: "app",
    });
    return rule;
  });
}

export async function deleteEscalationRule(ruleId: string): Promise<void> {
  const preCheck = await getCurrentMembership();
  const rule = await withTenantContext(toTenantContext(preCheck), async (tx) => {
    const [row] = await tx<EscalationRuleRow[]>`
      select * from escalation_rules where id = ${ruleId} and organization_id = ${preCheck.organization.id}
    `;
    if (!row) throw new AppError("not_found", "Escalation rule not found.");
    return row;
  });
  const membership = await requirePermission("sla.manage", {
    scope: { departmentId: rule.department_id ?? undefined },
  });

  await withTenantContext(toTenantContext(membership), async (tx) => {
    await tx`delete from escalation_rules where id = ${ruleId}`;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.EscalationRuleDeleted,
      resourceType: AuditResourceType.EscalationRule,
      resourceId: ruleId,
      source: "app",
    });
  });
}

/** Fires (once each) any of the SLA definition's reminder_minutes_before_due thresholds that have now been crossed — logged as a level-0 'remind' escalation_events row, same idempotent "check before acting" shape as checkTaskEscalations. */
async function checkTaskReminders(
  tx: postgres.TransactionSql,
  task: TaskRow,
  organizationId: string,
): Promise<void> {
  const [definition] = await tx<Pick<SlaDefinitionRow, "reminder_minutes_before_due">[]>`
    select reminder_minutes_before_due from sla_definitions where id = ${task.sla_definition_id}
  `;
  if (!definition || definition.reminder_minutes_before_due.length === 0) return;

  const minutesUntilDue = (new Date(task.due_at as string).getTime() - Date.now()) / 60_000;
  const fired = await tx<{ metadata: Record<string, unknown> }[]>`
    select metadata from escalation_events where task_id = ${task.id} and level = 0 and action = 'remind'
  `;
  const firedThresholds = new Set(fired.map((f) => f.metadata.reminderMinutesBeforeDue));

  for (const threshold of definition.reminder_minutes_before_due) {
    if (firedThresholds.has(threshold)) continue;
    if (minutesUntilDue > threshold) continue;

    await tx`
      insert into escalation_events (organization_id, task_id, workflow_id, level, action, metadata)
      values (${organizationId}, ${task.id}, ${task.workflow_id}, 0, 'remind', ${tx.json({ reminderMinutesBeforeDue: threshold } as unknown as Parameters<typeof tx.json>[0])})
    `;
  }
}

async function resolveEscalationTarget(
  tx: postgres.TransactionSql,
  organizationId: string,
  task: TaskRow,
  rule: EscalationRuleRow,
): Promise<string | null> {
  if (rule.action === "reassign" && rule.reassign_target) {
    const ids = await resolveMemberIdsForRule(tx, organizationId, rule.reassign_target, {
      departmentId: task.department_id,
      startedByMemberId: task.assignee_member_id,
    });
    return ids[0] ?? null;
  }
  if (rule.action === "escalate_manager") {
    if (!task.assignee_member_id) return null;
    const [assignee] = await tx<{ manager_id: string | null }[]>`
      select manager_id from organization_members where id = ${task.assignee_member_id}
    `;
    return assignee?.manager_id ?? null;
  }
  if (rule.action === "escalate_process_owner") {
    const [workflow] = await tx<
      { process_id: string }[]
    >`select process_id from workflows where id = ${task.workflow_id}`;
    if (!workflow) return null;
    const [process] = await tx<{ owner_member_id: string | null }[]>`
      select owner_member_id from processes where id = ${workflow.process_id}
    `;
    return process?.owner_member_id ?? null;
  }
  if (rule.action === "escalate_admin") {
    const [admin] = await tx<{ organization_member_id: string }[]>`
      select mra.organization_member_id from member_role_assignments mra
      join roles r on r.id = mra.role_id
      join organization_members om on om.id = mra.organization_member_id
      where r.key = 'organization_admin' and r.organization_id is null
        and mra.organization_id = ${organizationId} and om.status = 'active'
      order by mra.organization_id
      limit 1
    `;
    return admin?.organization_member_id ?? null;
  }
  return null; // 'remind' has no reassignment target — see the header comment on checkTaskEscalations.
}

/**
 * Evaluates every escalation_rules level for a single overdue task,
 * firing (inserting an escalation_events row, and for reassignment
 * actions, actually reassigning the task) each level whose threshold
 * has passed and hasn't already fired. Idempotent: re-running after a
 * level already fired for this task is a no-op for that level, the
 * same "check before acting" pattern workflow-handlers.ts's jobs use.
 *
 * 'remind' only logs the event — same as Phase 8's `notification` node
 * and Phase 9's deferred evidence scanning, actual delivery is Phase
 * 16's job. Reassignment escalation actions only apply to task-level
 * SLAs (a workflow has no single assignee to reassign); a workflow-
 * level SLA breach only ever logs the escalation_event.
 */
export async function checkTaskEscalations(
  tx: postgres.TransactionSql,
  task: TaskRow,
  organizationId: string,
): Promise<void> {
  if (!task.sla_definition_id || !task.due_at) return;
  if (task.sla_paused_at) return; // clock stopped — see sla.ts's pauseTaskSla.

  if (new Date(task.due_at) > new Date()) {
    await checkTaskReminders(tx, task, organizationId);
    return;
  }

  const rules = await tx<EscalationRuleRow[]>`
    select * from escalation_rules where sla_definition_id = ${task.sla_definition_id} order by level asc
  `;
  const fired = await tx<{ escalation_rule_id: string }[]>`
    select escalation_rule_id from escalation_events where task_id = ${task.id} and escalation_rule_id is not null
  `;
  const firedRuleIds = new Set(fired.map((f) => f.escalation_rule_id));

  const minutesPastDue = (Date.now() - new Date(task.due_at).getTime()) / 60_000;

  for (const rule of rules) {
    if (firedRuleIds.has(rule.id)) continue;
    if (minutesPastDue < rule.trigger_after_minutes_past_due) continue;

    const target = await resolveEscalationTarget(tx, organizationId, task, rule);
    if (rule.action === "reassign" && target) {
      await tx`update tasks set assignee_member_id = ${target}, status = 'assigned' where id = ${task.id}`;
      await tx`
        insert into task_history (organization_id, workflow_id, task_id, event_type, metadata)
        values (${organizationId}, ${task.workflow_id}, ${task.id}, 'task.reassigned', ${tx.json({ escalationRuleId: rule.id, reassignedTo: target } as unknown as Parameters<typeof tx.json>[0])})
      `;
    } else if (rule.action.startsWith("escalate_") && target) {
      await tx`update tasks set assignee_member_id = ${target}, status = 'assigned' where id = ${task.id}`;
    }

    await tx`
      insert into escalation_events (organization_id, task_id, workflow_id, escalation_rule_id, level, action, metadata)
      values (${organizationId}, ${task.id}, ${task.workflow_id}, ${rule.id}, ${rule.level}, ${rule.action}, ${tx.json({ target } as unknown as Parameters<typeof tx.json>[0])})
    `;
    await recordAuditEvent(tx, {
      organizationId,
      action: AuditAction.EscalationFired,
      resourceType: AuditResourceType.Task,
      resourceId: task.id,
      source: "system",
    });

    // Phase 11: reaching the top escalation level (admin escalation)
    // means every lower-level attempt to resolve the breach on its own
    // has already failed — that's a recorded exception, not just an
    // escalation_events row, so it enters triage rather than staying
    // implicit in the escalation log.
    if (rule.action === "escalate_admin") {
      await createSystemException(tx, {
        organizationId,
        departmentId: task.department_id,
        title: `Missed SLA: "${task.label}" escalated to an administrator.`,
        exceptionType: "missed_sla",
        source: "missed_sla",
        severity: "high",
        workflowId: task.workflow_id,
        taskId: task.id,
        idempotencyMatch: { taskId: task.id },
      });
    }
  }
}
