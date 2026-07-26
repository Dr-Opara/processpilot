import "server-only";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { addBusinessMinutes, loadCalendarConfig } from "@/lib/services/business-calendar";
import { getOwnTask, toTenantContext } from "@/lib/services/workflows";
import type { SlaDefinitionRow, TaskRow } from "@/lib/db/database.types";

/** Runtime due-date resolution — reads an SlaDefinition (and its BusinessCalendar, if any) and computes a concrete due_at from `from`. Returns null when `slaDefinitionId` doesn't resolve to an active definition, so callers can fall back to whatever they'd otherwise do (e.g. a process's plain sla_hours, per Phase 8). */
export async function resolveDueAt(
  sql: postgres.Sql | postgres.TransactionSql,
  organizationId: string,
  slaDefinitionId: string,
  from: Date = new Date(),
): Promise<{ dueAt: Date; definition: SlaDefinitionRow } | null> {
  const [definition] = await sql<SlaDefinitionRow[]>`
    select * from sla_definitions where id = ${slaDefinitionId} and organization_id = ${organizationId} and status = 'active'
  `;
  if (!definition) return null;

  const config = definition.business_calendar_id
    ? await loadCalendarConfig(sql, definition.business_calendar_id)
    : null;
  const dueAt = addBusinessMinutes(config, from, definition.target_minutes);
  return { dueAt, definition };
}

/**
 * Pauses a task's SLA clock — records the pause instant only; the actual
 * `due_at` shift happens on resumeTaskSla (a task may sit paused
 * indefinitely, so there's nothing to compute yet). While paused, the
 * escalation background job (escalation-handlers.ts) skips this task
 * entirely — see checkTaskEscalations in escalation.ts.
 */
export async function pauseTaskSla(taskId: string): Promise<TaskRow> {
  const preCheck = await getCurrentMembership();
  const task = await getOwnTask(preCheck, taskId);
  if (!task.sla_definition_id || !task.due_at) {
    throw new AppError("conflict", "This task has no SLA to pause.");
  }
  if (task.sla_paused_at) throw new AppError("conflict", "This task's SLA is already paused.");
  const membership = await requirePermission("sla.manage", {
    scope: { departmentId: task.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<TaskRow[]>`
      update tasks set sla_paused_at = now() where id = ${taskId} returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TaskSlaPaused,
      resourceType: AuditResourceType.Task,
      resourceId: taskId,
      source: "app",
    });
    return updated;
  });
}

/**
 * Resumes a paused task's SLA clock — shifts `due_at` forward by the
 * wall-clock duration spent paused (a straight shift, not a re-run of
 * business-calendar math, since the elapsed pause itself isn't business
 * time to skip — it's time the clock was deliberately stopped).
 */
export async function resumeTaskSla(taskId: string): Promise<TaskRow> {
  const preCheck = await getCurrentMembership();
  const task = await getOwnTask(preCheck, taskId);
  if (!task.sla_paused_at || !task.due_at)
    throw new AppError("conflict", "This task's SLA is not paused.");
  const membership = await requirePermission("sla.manage", {
    scope: { departmentId: task.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const pausedMinutes = Math.round(
      (Date.now() - new Date(task.sla_paused_at as string).getTime()) / 60_000,
    );
    const newDueAt = new Date(new Date(task.due_at as string).getTime() + pausedMinutes * 60_000);
    const [updated] = await tx<TaskRow[]>`
      update tasks set
        sla_paused_at = null,
        due_at = ${newDueAt},
        sla_paused_minutes_total = sla_paused_minutes_total + ${pausedMinutes}
      where id = ${taskId}
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TaskSlaResumed,
      resourceType: AuditResourceType.Task,
      resourceId: taskId,
      source: "app",
    });
    return updated;
  });
}

/**
 * Re-resolves `due_at` from the task's already-snapshotted SLA
 * definition, computed fresh from now — for when the definition or its
 * business calendar has been edited after the task started, or a
 * reassignment should reset the clock. Deliberately a separate, explicit
 * action rather than an automatic side effect of every edit/reassignment:
 * `due_at` is otherwise a snapshot taken once at task-creation time (the
 * same pattern the migration's header comment documents for
 * approval_policy_id/form_version_id), so silently recomputing it on
 * unrelated events would be surprising.
 */
export async function recalculateTaskDueAt(taskId: string): Promise<TaskRow> {
  const preCheck = await getCurrentMembership();
  const task = await getOwnTask(preCheck, taskId);
  if (!task.sla_definition_id)
    throw new AppError("conflict", "This task has no SLA definition to recalculate against.");
  const membership = await requirePermission("sla.manage", {
    scope: { departmentId: task.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const resolved = await resolveDueAt(
      tx,
      membership.organization.id,
      task.sla_definition_id as string,
    );
    if (!resolved)
      throw new AppError("conflict", "This task's SLA definition is no longer active.");
    const [updated] = await tx<TaskRow[]>`
      update tasks set due_at = ${resolved.dueAt}, sla_paused_at = null where id = ${taskId} returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TaskDueAtRecalculated,
      resourceType: AuditResourceType.Task,
      resourceId: taskId,
      source: "app",
    });
    return updated;
  });
}
