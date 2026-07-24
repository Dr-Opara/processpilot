import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { advanceFrom, buildGraphIndex } from "@/lib/services/workflow-engine";
import {
  getOwnTask,
  getOwnWorkflow,
  isEligibleForTask,
  toTenantContext,
} from "@/lib/services/workflows";
import { validateAnswers } from "@/lib/services/form-schema";
import type {
  EvidenceRow,
  FormSubmissionRow,
  FormVersionRow,
  ProcessGraphDefinition,
} from "@/lib/db/database.types";

/**
 * Structured, validated capture on top of Phase 8's completeTask() for
 * a task whose `form_version_id` is set (workflow-engine.ts snapshots
 * this at task-creation time). Draft saving and final submission both
 * write to `form_submissions`; a submitted row is immutable (enforced
 * by the migration's trigger) — amendForm() below is the only way to
 * change a submitted answer, and it does so by creating a new row
 * rather than editing history.
 */

const answersSchema = z.record(z.string(), z.unknown());

async function getFormVersionForTask(
  tx: postgres.TransactionSql,
  organizationId: string,
  taskId: string,
  formVersionId: string | null,
): Promise<FormVersionRow> {
  if (!formVersionId) {
    throw new AppError("conflict", "This task is not linked to a form.");
  }
  const [version] = await tx<FormVersionRow[]>`
    select * from form_versions where id = ${formVersionId} and organization_id = ${organizationId}
  `;
  if (!version) throw new AppError("not_found", "Form version not found.");
  return version;
}

/** Cross-checks every `file`-type answer's evidenceId against a real, organization-owned evidence row attached to this task — validateAnswers() only checks the answer's *shape*, not that the referenced file genuinely exists and belongs here. */
async function assertFileAnswersReferenceOwnedEvidence(
  tx: postgres.TransactionSql,
  organizationId: string,
  taskId: string,
  version: FormVersionRow,
  answers: Record<string, unknown>,
): Promise<void> {
  const fileFieldKeys = version.definition.fields
    .filter((f) => f.type === "file")
    .map((f) => f.key);
  const evidenceIds = fileFieldKeys
    .map((key) => (answers[key] as { evidenceId?: string } | undefined)?.evidenceId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (evidenceIds.length === 0) return;

  const rows = await tx<Pick<EvidenceRow, "id">[]>`
    select id from evidence where id = any(${evidenceIds}) and organization_id = ${organizationId} and task_id = ${taskId}
  `;
  if (rows.length !== new Set(evidenceIds).size) {
    throw new AppError("conflict", "One or more uploaded files could not be found for this task.");
  }
}

export async function getFormSubmissionForTask(taskId: string): Promise<{
  version: FormVersionRow;
  current: FormSubmissionRow | null;
  draft: FormSubmissionRow | null;
  history: FormSubmissionRow[];
}> {
  const membership = await getCurrentMembership();
  const task = await getOwnTask(membership, taskId);
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const version = await getFormVersionForTask(
      tx,
      membership.organization.id,
      taskId,
      task.form_version_id,
    );
    const submissions = await tx<FormSubmissionRow[]>`
      select * from form_submissions where task_id = ${taskId} order by created_at asc
    `;
    const draft = submissions.find((s) => s.status === "draft") ?? null;
    const current =
      submissions.find((s) => s.status === "submitted" && !s.superseded_by_submission_id) ?? null;
    return {
      version,
      current,
      draft,
      history: submissions.filter((s) => s.status === "submitted"),
    };
  });
}

/** Saves (creating or overwriting) the caller's own in-progress draft — never validated for completeness, only type-checked for whatever's present. */
export async function saveFormDraft(
  taskId: string,
  answers: Record<string, unknown>,
): Promise<FormSubmissionRow> {
  const parsedAnswers = answersSchema.parse(answers);
  const preCheck = await getCurrentMembership();
  const task = await getOwnTask(preCheck, taskId);
  const workflow = await getOwnWorkflow(preCheck, task.workflow_id);
  if (workflow.status !== "running")
    throw new AppError("conflict", "This workflow is not running.");
  if (!(await isEligibleForTask(preCheck, task))) {
    throw new AppError("forbidden", "You are not eligible to fill out this form.");
  }
  const membership = await requirePermission("form.submit", {
    scope: { departmentId: task.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const version = await getFormVersionForTask(
      tx,
      membership.organization.id,
      taskId,
      task.form_version_id,
    );
    const errors = validateAnswers(version.definition.fields, parsedAnswers, false);
    if (Object.keys(errors).length > 0) {
      throw new AppError("conflict", "This draft contains invalid values.");
    }

    const [existing] = await tx<FormSubmissionRow[]>`
      select * from form_submissions where task_id = ${taskId} and status = 'draft'
    `;

    const [saved] = existing
      ? await tx<FormSubmissionRow[]>`
          update form_submissions set answers = ${tx.json(parsedAnswers as unknown as Parameters<typeof tx.json>[0])}
          where id = ${existing.id}
          returning *
        `
      : await tx<FormSubmissionRow[]>`
          insert into form_submissions (
            organization_id, workflow_id, task_id, process_version_id, form_version_id, member_id, status, answers
          ) values (
            ${membership.organization.id}, ${workflow.id}, ${taskId}, ${workflow.process_version_id}, ${version.id},
            ${membership.member.id}, 'draft', ${tx.json(parsedAnswers as unknown as Parameters<typeof tx.json>[0])}
          )
          returning *
        `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.FormSubmissionSaved,
      resourceType: AuditResourceType.FormSubmission,
      resourceId: saved.id,
      source: "app",
    });

    return saved;
  });
}

/** Final submission: validates every visible required field, completes the task (same advanceFrom() call completeTask() makes), and turns the draft (if any) into an immutable submitted record. */
export async function submitForm(
  taskId: string,
  answers: Record<string, unknown>,
): Promise<FormSubmissionRow> {
  const parsedAnswers = answersSchema.parse(answers);
  const preCheck = await getCurrentMembership();
  const task = await getOwnTask(preCheck, taskId);
  const workflow = await getOwnWorkflow(preCheck, task.workflow_id);
  if (task.status !== "assigned" && task.status !== "in_progress") {
    throw new AppError("conflict", "This task is not open.");
  }
  if (workflow.status !== "running")
    throw new AppError("conflict", "This workflow is not running.");
  if (!(await isEligibleForTask(preCheck, task))) {
    throw new AppError("forbidden", "You are not eligible to submit this form.");
  }
  const membership = await requirePermission("form.submit", {
    scope: { departmentId: task.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const version = await getFormVersionForTask(
      tx,
      membership.organization.id,
      taskId,
      task.form_version_id,
    );
    const errors = validateAnswers(version.definition.fields, parsedAnswers, true);
    if (Object.keys(errors).length > 0) {
      throw new AppError("conflict", "This form has missing or invalid required fields.");
    }
    await assertFileAnswersReferenceOwnedEvidence(
      tx,
      membership.organization.id,
      taskId,
      version,
      parsedAnswers,
    );

    const [existingDraft] = await tx<FormSubmissionRow[]>`
      select * from form_submissions where task_id = ${taskId} and status = 'draft'
    `;

    const [submission] = existingDraft
      ? await tx<FormSubmissionRow[]>`
          update form_submissions set
            status = 'submitted', answers = ${tx.json(parsedAnswers as unknown as Parameters<typeof tx.json>[0])},
            submitted_at = now()
          where id = ${existingDraft.id}
          returning *
        `
      : await tx<FormSubmissionRow[]>`
          insert into form_submissions (
            organization_id, workflow_id, task_id, process_version_id, form_version_id, member_id, status,
            answers, submitted_at
          ) values (
            ${membership.organization.id}, ${workflow.id}, ${taskId}, ${workflow.process_version_id}, ${version.id},
            ${membership.member.id}, 'submitted', ${tx.json(parsedAnswers as unknown as Parameters<typeof tx.json>[0])}, now()
          )
          returning *
        `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.FormSubmissionSubmitted,
      resourceType: AuditResourceType.FormSubmission,
      resourceId: submission.id,
      source: "app",
    });

    const [updatedTask] = await tx<Parameters<typeof advanceFrom>[0]["task"][]>`
      update tasks set
        status = 'completed', output = ${tx.json(parsedAnswers as unknown as Parameters<typeof tx.json>[0])},
        completed_at = now(), completed_by = ${membership.member.id},
        assignee_member_id = coalesce(assignee_member_id, ${membership.member.id})
      where id = ${taskId}
      returning *
    `;
    await tx`
      insert into task_history (organization_id, workflow_id, task_id, event_type, actor_member_id, metadata)
      values (${membership.organization.id}, ${workflow.id}, ${taskId}, 'task.completed', ${membership.member.id}, ${tx.json({ formSubmissionId: submission.id } as unknown as Parameters<typeof tx.json>[0])})
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TaskCompleted,
      resourceType: AuditResourceType.Task,
      resourceId: taskId,
      source: "app",
    });

    const [processVersion] = await tx<{ definition: ProcessGraphDefinition }[]>`
      select definition from process_versions where id = ${workflow.process_version_id}
    `;
    const graph = buildGraphIndex(processVersion.definition);
    await advanceFrom({ sql: tx, workflow, graph, task: updatedTask });

    return submission;
  });
}

const amendFormSchema = z.object({
  answers: answersSchema,
  reason: z.string().trim().min(1, "A reason is required for an amendment.").max(2000),
});

/** Creates a new, immutable submission that amends a previously-submitted one — the original row is never edited (only its superseded_by_submission_id pointer is set once), preserving the full history for audit. Does not reopen or re-advance the task; the workflow has already moved on. */
export async function amendForm(
  originalSubmissionId: string,
  input: { answers: Record<string, unknown>; reason: string },
): Promise<FormSubmissionRow> {
  const data = amendFormSchema.parse(input);
  const preCheck = await getCurrentMembership();

  const original = await withTenantContext(toTenantContext(preCheck), async (tx) => {
    const [row] = await tx<FormSubmissionRow[]>`
      select * from form_submissions where id = ${originalSubmissionId} and organization_id = ${preCheck.organization.id}
    `;
    if (!row) throw new AppError("not_found", "Form submission not found.");
    return row;
  });
  if (original.status !== "submitted") {
    throw new AppError("conflict", "Only a submitted form can be amended.");
  }
  if (original.superseded_by_submission_id) {
    throw new AppError(
      "conflict",
      "This submission has already been amended — amend the latest version instead.",
    );
  }

  const canManage =
    preCheck.permissions.includes("workflow.manage") ||
    preCheck.scopedPermissions.includes("workflow.manage");
  if (original.member_id !== preCheck.member.id && !canManage) {
    throw new AppError("forbidden", "You are not authorized to amend this submission.");
  }
  const membership = await requirePermission("form.submit", {
    scope: { departmentId: original.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const version = await getFormVersionForTask(
      tx,
      membership.organization.id,
      original.task_id,
      original.form_version_id,
    );
    const errors = validateAnswers(version.definition.fields, data.answers, true);
    if (Object.keys(errors).length > 0) {
      throw new AppError("conflict", "This amendment has missing or invalid required fields.");
    }

    const [amendment] = await tx<FormSubmissionRow[]>`
      insert into form_submissions (
        organization_id, workflow_id, task_id, process_version_id, form_version_id, member_id, status,
        answers, amendment_reason, amends_submission_id, submitted_at
      ) values (
        ${membership.organization.id}, ${original.workflow_id}, ${original.task_id}, ${original.process_version_id},
        ${original.form_version_id}, ${membership.member.id}, 'submitted',
        ${tx.json(data.answers as unknown as Parameters<typeof tx.json>[0])}, ${data.reason}, ${original.id}, now()
      )
      returning *
    `;

    await tx`update form_submissions set superseded_by_submission_id = ${amendment.id} where id = ${original.id}`;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.FormSubmissionAmended,
      resourceType: AuditResourceType.FormSubmission,
      resourceId: amendment.id,
      source: "app",
      reason: data.reason,
    });

    return amendment;
  });
}
