import "server-only";
import { getAdminSql } from "@/lib/db/client-admin";
import { registerJobHandler } from "@/lib/jobs/registry";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { checkTaskEscalations } from "@/lib/services/escalation";
import type { EscalationRuleRow, TaskRow } from "@/lib/db/database.types";

/**
 * The one Phase 10 background job, registered at module load per
 * workflow-handlers.ts's established pattern — import this module (for
 * its side effect) from src/app/api/jobs/process/route.ts. Runs through
 * the admin client rather than withTenantContext(), same reasoning as
 * every other Phase 8/9 job handler.
 *
 * Self-rescheduling rather than one job per escalation level: escalation
 * rules can be added/edited after a task is already running, so a fixed
 * set of jobs computed at task-creation time could never see a rule
 * added later. Each run checks every currently-configured rule/reminder
 * threshold, then re-enqueues itself for the next one that hasn't fired
 * yet (or stops once every level has fired). Idempotent either way:
 * checkTaskEscalations() only ever fires a given level once.
 */
registerJobHandler("task-escalation-check", async ({ job }) => {
  const sql = getAdminSql();
  const { taskId } = job.payload as { taskId: string };

  await sql.begin(async (tx) => {
    const [task] = await tx<TaskRow[]>`
      select * from tasks where id = ${taskId} and organization_id = ${job.organization_id}
    `;
    if (!task || (task.status !== "assigned" && task.status !== "in_progress")) return; // already resolved
    if (!task.sla_definition_id || !task.due_at) return;

    if (task.sla_paused_at) {
      // Clock stopped (sla.ts's pauseTaskSla) — nothing to fire. Check
      // back periodically rather than exiting for good, since resuming
      // doesn't re-enqueue this job on its own.
      await enqueueJob(tx, job.organization_id, {
        jobType: "task-escalation-check",
        payload: { taskId },
        idempotencyKey: `task-escalation-check:${taskId}:paused:${Date.now()}`,
        scheduledAt: new Date(Date.now() + 60 * 60_000),
      });
      return;
    }

    await checkTaskEscalations(tx, task, job.organization_id);

    const rules = await tx<EscalationRuleRow[]>`
      select * from escalation_rules where sla_definition_id = ${task.sla_definition_id} order by level asc
    `;
    if (rules.length === 0) return;

    const fired = await tx<{ escalation_rule_id: string }[]>`
      select escalation_rule_id from escalation_events where task_id = ${taskId} and escalation_rule_id is not null
    `;
    const firedRuleIds = new Set(fired.map((f) => f.escalation_rule_id));
    const unfired = rules.filter((r) => !firedRuleIds.has(r.id));
    if (unfired.length === 0) return; // every configured level has fired

    const nextThresholdMinutes = Math.min(...unfired.map((r) => r.trigger_after_minutes_past_due));
    const candidateAt = new Date(new Date(task.due_at).getTime() + nextThresholdMinutes * 60_000);
    const scheduledAt = candidateAt > new Date() ? candidateAt : new Date(Date.now() + 60_000);

    await enqueueJob(tx, job.organization_id, {
      jobType: "task-escalation-check",
      payload: { taskId },
      idempotencyKey: `task-escalation-check:${taskId}:${nextThresholdMinutes}`,
      scheduledAt,
    });
  });
});
