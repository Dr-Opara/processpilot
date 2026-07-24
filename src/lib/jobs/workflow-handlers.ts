import "server-only";
import { getAdminSql } from "@/lib/db/client-admin";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { registerJobHandler } from "@/lib/jobs/registry";
import { advanceFrom, buildGraphIndex } from "@/lib/services/workflow-engine";
import type { ProcessGraphDefinition, TaskRow, WorkflowRow } from "@/lib/db/database.types";

/**
 * The two Phase 8 background jobs, registered at module load per
 * README.md — import this module (for its side effect) from
 * src/app/api/jobs/process/route.ts. Both run through the admin client
 * rather than withTenantContext(): a cron tick has no Clerk user
 * session to build tenant claims from (ADR-0010's security note), so
 * each handler independently re-checks organization_id on every query
 * instead of relying on RLS as its only backstop — same posture
 * worker.ts's own claim/complete/fail functions already take.
 */

registerJobHandler("workflow-timer-advance", async ({ job }) => {
  const sql = getAdminSql();
  const { workflowId, taskId } = job.payload as { workflowId: string; taskId: string };

  await sql.begin(async (tx) => {
    const [task] = await tx<TaskRow[]>`
      select * from tasks where id = ${taskId} and workflow_id = ${workflowId} and organization_id = ${job.organization_id}
    `;
    if (!task || task.status !== "in_progress" || task.node_type !== "timer") return; // already advanced, cancelled, or stale retry

    const [workflow] = await tx<WorkflowRow[]>`
      select * from workflows where id = ${workflowId} and organization_id = ${job.organization_id}
    `;
    if (!workflow || workflow.status !== "running") return; // suspended/cancelled/failed since the timer was scheduled

    const [updated] = await tx<TaskRow[]>`
      update tasks set status = 'completed', completed_at = now() where id = ${taskId} returning *
    `;
    await tx`
      insert into task_history (organization_id, workflow_id, task_id, event_type)
      values (${job.organization_id}, ${workflowId}, ${taskId}, 'task.completed')
    `;

    const [version] = await tx<{ definition: ProcessGraphDefinition }[]>`
      select definition from process_versions where id = ${workflow.process_version_id}
    `;
    const graph = buildGraphIndex(version.definition);
    await advanceFrom({ sql: tx, workflow, graph, task: updated });
  });
});

registerJobHandler("workflow-deadline-check", async ({ job }) => {
  const sql = getAdminSql();
  const { workflowId } = job.payload as { workflowId: string };

  await sql.begin(async (tx) => {
    const [workflow] = await tx<WorkflowRow[]>`
      select * from workflows where id = ${workflowId} and organization_id = ${job.organization_id}
    `;
    // Not running (completed/cancelled/failed/suspended) — the deadline
    // no longer applies. Escalating a *suspended* workflow's breach
    // would be noise: whoever suspended it already knows it's paused.
    if (!workflow || workflow.status !== "running") return;
    if (!workflow.due_at || new Date(workflow.due_at) > new Date()) return;

    await tx`
      insert into workflow_history (organization_id, workflow_id, event_type, metadata)
      values (${job.organization_id}, ${workflowId}, 'workflow.deadline_breached', ${tx.json({ dueAt: workflow.due_at })})
    `;
    await recordAuditEvent(tx, {
      organizationId: job.organization_id,
      action: AuditAction.WorkflowDeadlineBreached,
      resourceType: AuditResourceType.Workflow,
      resourceId: workflowId,
      source: "system",
    });
  });
});
