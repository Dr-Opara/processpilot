import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { ProcessRow, ProcessVersionRow } from "@/lib/db/database.types";

const formFieldSchema = z.object({
  label: z.string().trim().min(1, "Field label is required").max(100),
  type: z.enum(["text", "number", "checkbox"]),
});

export const processStepSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1, "Step name is required").max(200),
    sequencing: z.enum(["linear", "parallel", "conditional"]),
    parallelGroup: z.string().trim().max(100).optional().nullable(),
    branchOnStepId: z.string().trim().optional().nullable(),
    branchCondition: z.string().trim().max(200).optional().nullable(),
    assigneeType: z.enum(["role", "team"]),
    assigneeRoleId: z.string().uuid().optional().nullable(),
    assigneeTeamId: z.string().uuid().optional().nullable(),
    required: z.boolean(),
    requiresForm: z.boolean(),
    formFields: z.array(formFieldSchema).max(20),
    requiresApproval: z.boolean(),
    approverRoleId: z.string().uuid().optional().nullable(),
    requiresEvidence: z.boolean(),
    evidenceDescription: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine((step, ctx) => {
    if (step.assigneeType === "role" && !step.assigneeRoleId) {
      ctx.addIssue({
        code: "custom",
        message: `Step "${step.name}" needs an assigned role.`,
        path: ["assigneeRoleId"],
      });
    }
    if (step.assigneeType === "team" && !step.assigneeTeamId) {
      ctx.addIssue({
        code: "custom",
        message: `Step "${step.name}" needs an assigned team.`,
        path: ["assigneeTeamId"],
      });
    }
    if (step.sequencing === "conditional" && !step.branchOnStepId) {
      ctx.addIssue({
        code: "custom",
        message: `Step "${step.name}" is conditional but has no branch-on step.`,
        path: ["branchOnStepId"],
      });
    }
    if (step.requiresApproval && !step.approverRoleId) {
      ctx.addIssue({
        code: "custom",
        message: `Step "${step.name}" requires approval but has no approver role.`,
        path: ["approverRoleId"],
      });
    }
  });

export const processDefinitionSchema = z
  .array(processStepSchema)
  .min(1, "At least one step is required.")
  .superRefine((steps, ctx) => {
    const seenIds = new Set<string>();
    steps.forEach((step, index) => {
      if (seenIds.has(step.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate step id "${step.id}".`,
          path: [index, "id"],
        });
      }
      seenIds.add(step.id);

      if (
        step.sequencing === "conditional" &&
        step.branchOnStepId &&
        !steps.some(
          (candidate, candidateIndex) =>
            candidate.id === step.branchOnStepId && candidateIndex < index,
        )
      ) {
        ctx.addIssue({
          code: "custom",
          message: `Step "${step.name}" branches on an unknown or later step.`,
          path: [index, "branchOnStepId"],
        });
      }
    });
  });

export type ProcessDefinitionInput = z.infer<typeof processDefinitionSchema>;

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

async function getOwnProcess(
  tx: postgres.TransactionSql,
  organizationId: string,
  processId: string,
): Promise<ProcessRow> {
  const [process] = await tx<ProcessRow[]>`
    select * from processes where id = ${processId} and organization_id = ${organizationId}
  `;
  if (!process) throw new AppError("not_found", "Process not found.");
  return process;
}

async function getOwnVersion(
  tx: postgres.TransactionSql,
  organizationId: string,
  versionId: string,
): Promise<ProcessVersionRow> {
  const [version] = await tx<ProcessVersionRow[]>`
    select * from process_versions where id = ${versionId} and organization_id = ${organizationId}
  `;
  if (!version) throw new AppError("not_found", "Process version not found.");
  return version;
}

async function assertNoVersionInProgress(
  tx: postgres.TransactionSql,
  processId: string,
): Promise<void> {
  const [inProgress] = await tx<{ id: string }[]>`
    select id from process_versions
    where process_id = ${processId} and status in ('draft', 'in_review')
  `;
  if (inProgress) {
    throw new AppError("conflict", "A draft or in-review version already exists for this process.");
  }
}

/** Creates a new draft version — a process's first version comes from createProcess() + this; every later revision (after publish or rejection) goes through this same path. */
export async function createVersion(
  processId: string,
  title: string,
  steps: ProcessDefinitionInput,
): Promise<ProcessVersionRow> {
  const definition = processDefinitionSchema.parse(steps);
  const trimmedTitle = title.trim();
  if (!trimmedTitle) throw new AppError("conflict", "Title is required.");

  const preCheck = await requirePermission("process.view");
  const process = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnProcess(tx, preCheck.organization.id, processId),
  );
  const membership = await requirePermission("process.edit", {
    scope: { departmentId: process.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    await assertNoVersionInProgress(tx, processId);

    const [{ max_version }] = await tx<{ max_version: number }[]>`
      select coalesce(max(version_number), 0) as max_version from process_versions where process_id = ${processId}
    `;

    const [version] = await tx<ProcessVersionRow[]>`
      insert into process_versions (organization_id, process_id, version_number, title, definition, created_by)
      values (
        ${membership.organization.id}, ${processId}, ${max_version + 1}, ${trimmedTitle},
        ${tx.json(definition)}, ${membership.profile.id}
      )
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ProcessVersionCreated,
      resourceType: AuditResourceType.ProcessVersion,
      resourceId: version.id,
      source: "app",
    });

    return version;
  });
}

export async function updateDraftVersion(
  versionId: string,
  input: { title: string; steps: ProcessDefinitionInput },
): Promise<ProcessVersionRow> {
  const definition = processDefinitionSchema.parse(input.steps);
  const title = input.title.trim();
  if (!title) throw new AppError("conflict", "Title is required.");

  const preCheck = await requirePermission("process.view");
  const version = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnVersion(tx, preCheck.organization.id, versionId),
  );
  if (version.status !== "draft") {
    throw new AppError("conflict", "Only a draft version can be edited.");
  }

  const membership = await requirePermission("process.edit", {
    scope: { departmentId: version.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<ProcessVersionRow[]>`
      update process_versions set title = ${title}, definition = ${tx.json(definition)}
      where id = ${versionId}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ProcessVersionUpdated,
      resourceType: AuditResourceType.ProcessVersion,
      resourceId: versionId,
      source: "app",
    });

    return updated;
  });
}

export async function submitForReview(versionId: string): Promise<ProcessVersionRow> {
  const preCheck = await requirePermission("process.view");
  const version = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnVersion(tx, preCheck.organization.id, versionId),
  );
  if (version.status !== "draft") {
    throw new AppError("conflict", "Only a draft version can be submitted for review.");
  }
  const membership = await requirePermission("process.edit", {
    scope: { departmentId: version.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<ProcessVersionRow[]>`
      update process_versions set
        status = 'in_review', submitted_by = ${membership.member.id}, submitted_at = now()
      where id = ${versionId}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ProcessVersionSubmittedForReview,
      resourceType: AuditResourceType.ProcessVersion,
      resourceId: versionId,
      source: "app",
    });

    return updated;
  });
}

export async function rejectReview(
  versionId: string,
  reviewNotes: string,
): Promise<ProcessVersionRow> {
  const preCheck = await requirePermission("process.view");
  const version = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnVersion(tx, preCheck.organization.id, versionId),
  );
  if (version.status !== "in_review") {
    throw new AppError("conflict", "Only an in-review version can be rejected.");
  }
  const membership = await requirePermission("process.review", {
    scope: { departmentId: version.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<ProcessVersionRow[]>`
      update process_versions set
        status = 'draft', reviewed_by = ${membership.member.id}, reviewed_at = now(),
        review_notes = ${reviewNotes || null}
      where id = ${versionId}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ProcessVersionRejected,
      resourceType: AuditResourceType.ProcessVersion,
      resourceId: versionId,
      source: "app",
      reason: reviewNotes || null,
    });

    return updated;
  });
}

/** Publishes an in-review version: supersedes the process's previously-published version (if any) and points the process at this one — matches document-versions.ts's approveAndPublish transaction shape exactly. Requires process.publish, which — unlike knowledge.publish — has no unscoped grantee at all (only process_owner, scoped) per product/permissions-matrix.md. */
export async function approveAndPublish(versionId: string): Promise<ProcessVersionRow> {
  const preCheck = await requirePermission("process.view");
  const version = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnVersion(tx, preCheck.organization.id, versionId),
  );
  if (version.status !== "in_review") {
    throw new AppError("conflict", "Only an in-review version can be published.");
  }
  const membership = await requirePermission("process.publish", {
    scope: { departmentId: version.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const process = await getOwnProcess(tx, membership.organization.id, version.process_id);

    const [published] = await tx<ProcessVersionRow[]>`
      update process_versions set
        status = 'published', reviewed_by = ${membership.member.id}, reviewed_at = now(),
        published_by = ${membership.member.id}, published_at = now()
      where id = ${versionId}
      returning *
    `;

    if (process.current_version_id) {
      await tx`
        update process_versions set status = 'superseded' where id = ${process.current_version_id}
      `;
      await recordAuditEvent(tx, {
        organizationId: membership.organization.id,
        actorProfileId: membership.profile.id,
        action: AuditAction.ProcessVersionSuperseded,
        resourceType: AuditResourceType.ProcessVersion,
        resourceId: process.current_version_id,
        source: "app",
      });
    }

    await tx`
      update processes set current_version_id = ${versionId}, status = 'published'
      where id = ${version.process_id}
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ProcessVersionPublished,
      resourceType: AuditResourceType.ProcessVersion,
      resourceId: versionId,
      source: "app",
    });

    return published;
  });
}
