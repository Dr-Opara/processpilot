import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { validateEvidenceUpload } from "@/lib/services/evidence-upload-validation";
import {
  buildEvidenceStoragePath,
  createEvidenceSignedUrl,
  uploadEvidenceFile,
} from "@/lib/services/evidence-storage";
import type { EvidenceRow, FormSubmissionRow, TaskRow } from "@/lib/db/database.types";

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

async function recordEvidenceEvent(
  tx: postgres.TransactionSql,
  evidence: Pick<EvidenceRow, "id" | "organization_id">,
  eventType: "uploaded" | "downloaded" | "accepted" | "rejected" | "replaced" | "expired",
  actorMemberId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await tx`
    insert into evidence_events (organization_id, evidence_id, event_type, actor_member_id, metadata)
    values (${evidence.organization_id}, ${evidence.id}, ${eventType}, ${actorMemberId}, ${tx.json(metadata as unknown as Parameters<typeof tx.json>[0])})
  `;
}

const uploadEvidenceInputSchema = z
  .object({
    taskId: z.string().trim().min(1).optional(),
    formSubmissionId: z.string().trim().min(1).optional(),
    fieldKey: z.string().trim().min(1).max(100).optional(),
    expiresAt: z.string().datetime().optional().nullable(),
  })
  .refine((v) => Boolean(v.taskId || v.formSubmissionId), {
    message: "Evidence must be attached to a task or a form submission.",
  });

export type UploadEvidenceInput = z.infer<typeof uploadEvidenceInputSchema>;

/** Uploads a private evidence file, hashes it server-side for integrity, and opens its chain-of-custody log with the first 'uploaded' event. Attach either to a task directly (an 'evidence' node) or to a specific field of a form submission (a form's file-upload field). */
export async function uploadEvidence(
  input: UploadEvidenceInput,
  file: { buffer: Buffer; filename: string },
): Promise<EvidenceRow> {
  const data = uploadEvidenceInputSchema.parse(input);
  const { mimeType } = validateEvidenceUpload(file.buffer, file.filename);
  const sha256Hash = crypto.createHash("sha256").update(file.buffer).digest("hex");

  const preCheck = await getCurrentMembership();
  const { departmentId, workflowId } = await withTenantContext(
    toTenantContext(preCheck),
    async (tx) => {
      if (data.taskId) {
        const [task] = await tx<Pick<TaskRow, "department_id" | "workflow_id">[]>`
        select department_id, workflow_id from tasks where id = ${data.taskId} and organization_id = ${preCheck.organization.id}
      `;
        if (!task) throw new AppError("not_found", "Task not found.");
        return { departmentId: task.department_id, workflowId: task.workflow_id };
      }
      const [submission] = await tx<Pick<FormSubmissionRow, "department_id" | "workflow_id">[]>`
      select department_id, workflow_id from form_submissions where id = ${data.formSubmissionId ?? null} and organization_id = ${preCheck.organization.id}
    `;
      if (!submission) throw new AppError("not_found", "Form submission not found.");
      return { departmentId: submission.department_id, workflowId: submission.workflow_id };
    },
  );

  const membership = await requirePermission("evidence.upload", {
    scope: { departmentId: departmentId ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [evidence] = await tx<EvidenceRow[]>`
      insert into evidence (
        organization_id, workflow_id, task_id, form_submission_id, field_key, uploaded_by,
        original_filename, mime_type, file_size_bytes, storage_path, sha256_hash, expires_at
      ) values (
        ${membership.organization.id}, ${workflowId}, ${data.taskId ?? null}, ${data.formSubmissionId ?? null},
        ${data.fieldKey ?? null}, ${membership.member.id}, ${file.filename}, ${mimeType},
        ${file.buffer.byteLength}, '', ${sha256Hash}, ${data.expiresAt ?? null}
      )
      returning *
    `;

    const storagePath = buildEvidenceStoragePath(
      membership.organization.id,
      evidence.id,
      file.filename,
    );
    await uploadEvidenceFile(storagePath, file.buffer, mimeType);

    const [updated] = await tx<EvidenceRow[]>`
      update evidence set storage_path = ${storagePath} where id = ${evidence.id} returning *
    `;

    await recordEvidenceEvent(tx, updated, "uploaded", membership.member.id, {
      filename: file.filename,
      sizeBytes: file.buffer.byteLength,
    });
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.EvidenceUploaded,
      resourceType: AuditResourceType.Evidence,
      resourceId: updated.id,
      source: "app",
    });

    if (data.expiresAt) {
      await enqueueJob(tx, membership.organization.id, {
        jobType: "evidence-expiration-check",
        payload: { evidenceId: updated.id },
        idempotencyKey: `evidence-expiration-check:${updated.id}`,
        scheduledAt: new Date(data.expiresAt),
      });
    }

    return updated;
  });
}

async function getOwnEvidence(
  tx: postgres.TransactionSql,
  organizationId: string,
  evidenceId: string,
): Promise<EvidenceRow> {
  const [evidence] = await tx<EvidenceRow[]>`
    select * from evidence where id = ${evidenceId} and organization_id = ${organizationId}
  `;
  if (!evidence) throw new AppError("not_found", "Evidence not found.");
  return evidence;
}

export async function listEvidenceForTask(taskId: string): Promise<EvidenceRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<EvidenceRow[]>`
      select * from evidence where task_id = ${taskId} and organization_id = ${membership.organization.id}
      order by created_at desc
    `,
  );
}

export interface ReviewEvidenceInput {
  decision: "accepted" | "rejected";
  notes?: string;
}

const reviewDecisionSchema = z.enum(["accepted", "rejected"]);

/** Accepts or rejects an evidence file — evidence.review, distinct from the evidence.upload the uploader itself needed, keeping review a separate duty. */
export async function reviewEvidence(
  evidenceId: string,
  input: ReviewEvidenceInput,
): Promise<EvidenceRow> {
  const decision = reviewDecisionSchema.parse(input.decision);
  const preCheck = await getCurrentMembership();
  const evidence = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnEvidence(tx, preCheck.organization.id, evidenceId),
  );
  if (evidence.status !== "pending_review") {
    throw new AppError("conflict", "Only evidence pending review can be accepted or rejected.");
  }
  const membership = await requirePermission("evidence.review", {
    scope: { departmentId: evidence.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const notes = input.notes?.trim() || null;
    const [updated] = await tx<EvidenceRow[]>`
      update evidence set
        status = ${decision}, reviewed_by = ${membership.member.id}, reviewed_at = now(), review_notes = ${notes}
      where id = ${evidenceId}
      returning *
    `;

    await recordEvidenceEvent(
      tx,
      updated,
      decision === "accepted" ? "accepted" : "rejected",
      membership.member.id,
      {
        notes,
      },
    );
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: decision === "accepted" ? AuditAction.EvidenceAccepted : AuditAction.EvidenceRejected,
      resourceType: AuditResourceType.Evidence,
      resourceId: evidenceId,
      source: "app",
      reason: notes,
    });

    return updated;
  });
}

/** Uploads a new file to replace a rejected or expired evidence record — the old row is marked 'replaced' (its file stays exactly as it was, immutable) rather than ever being overwritten, per file-storage.md principle 3. */
export async function replaceEvidence(
  oldEvidenceId: string,
  file: { buffer: Buffer; filename: string },
): Promise<EvidenceRow> {
  const preCheck = await getCurrentMembership();
  const old = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnEvidence(tx, preCheck.organization.id, oldEvidenceId),
  );
  if (old.status !== "rejected" && old.status !== "expired") {
    throw new AppError("conflict", "Only rejected or expired evidence can be replaced.");
  }

  const created = await uploadEvidence(
    {
      taskId: old.task_id ?? undefined,
      formSubmissionId: old.form_submission_id ?? undefined,
      fieldKey: old.field_key ?? undefined,
      expiresAt: old.expires_at ?? undefined,
    },
    file,
  );

  const membership = await requirePermission("evidence.upload", {
    scope: { departmentId: old.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [linked] = await tx<EvidenceRow[]>`
      update evidence set replaces_evidence_id = ${old.id} where id = ${created.id} returning *
    `;
    const [supersededOld] = await tx<EvidenceRow[]>`
      update evidence set status = 'replaced' where id = ${old.id} returning *
    `;

    await recordEvidenceEvent(tx, supersededOld, "replaced", membership.member.id, {
      newEvidenceId: created.id,
    });
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.EvidenceReplaced,
      resourceType: AuditResourceType.Evidence,
      resourceId: old.id,
      source: "app",
    });

    return linked;
  });
}

/** Marks accepted/pending evidence 'expired' once past its expires_at — called by the evidence-expiration-check background job, or manually by a reviewer. */
export async function expireEvidence(
  sql: postgres.Sql | postgres.TransactionSql,
  evidenceId: string,
  organizationId: string,
): Promise<void> {
  const [evidence] = await sql<EvidenceRow[]>`
    select * from evidence where id = ${evidenceId} and organization_id = ${organizationId}
  `;
  if (!evidence || (evidence.status !== "accepted" && evidence.status !== "pending_review")) return; // already terminal or gone

  const [updated] = await sql<
    EvidenceRow[]
  >`update evidence set status = 'expired' where id = ${evidenceId} returning *`;
  await sql`
    insert into evidence_events (organization_id, evidence_id, event_type, metadata)
    values (${organizationId}, ${evidenceId}, 'expired', ${sql.json({} as unknown as postgres.JSONValue)})
  `;
  await recordAuditEvent(sql, {
    organizationId,
    action: AuditAction.EvidenceExpired,
    resourceType: AuditResourceType.Evidence,
    resourceId: updated.id,
    source: "system",
  });
}

/** Requires evidence.review, the uploader's own upload, or workflow.manage; blocks download if the file was flagged. Every issued signed URL is logged as a 'downloaded' chain-of-custody event. */
export async function getEvidenceDownloadUrl(evidenceId: string): Promise<string> {
  const preCheck = await getCurrentMembership();
  const evidence = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnEvidence(tx, preCheck.organization.id, evidenceId),
  );
  const canReview = Boolean(
    preCheck.permissions.includes("evidence.review") ||
    preCheck.scopedPermissions.includes("evidence.review"),
  );
  const canManage = Boolean(
    preCheck.permissions.includes("workflow.manage") ||
    preCheck.scopedPermissions.includes("workflow.manage"),
  );
  if (!canReview && !canManage && evidence.uploaded_by !== preCheck.member.id) {
    throw new AppError("forbidden", "You are not authorized to download this file.");
  }
  if (evidence.scan_status === "flagged") {
    throw new AppError("forbidden", "This file was flagged and cannot be downloaded.");
  }

  const url = await createEvidenceSignedUrl(evidence.storage_path);

  await withTenantContext(toTenantContext(preCheck), async (tx) => {
    await recordEvidenceEvent(tx, evidence, "downloaded", preCheck.member.id);
    await recordAuditEvent(tx, {
      organizationId: preCheck.organization.id,
      actorProfileId: preCheck.profile.id,
      action: AuditAction.EvidenceDownloaded,
      resourceType: AuditResourceType.Evidence,
      resourceId: evidenceId,
      source: "app",
    });
  });

  return url;
}
