import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { validateProcessGraph } from "@/lib/services/process-graph-validation";
import type {
  ProcessGraphDefinition,
  ProcessRow,
  ProcessVersionRow,
} from "@/lib/db/database.types";

const formFieldSchema = z.object({
  label: z.string().trim().min(1, "Field label is required").max(100),
  type: z.enum(["text", "number", "checkbox"]),
});

export const processNodeSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum([
    "start",
    "end",
    "human_task",
    "approval",
    "decision",
    "parallel_split",
    "parallel_join",
    "timer",
    "notification",
    "subprocess",
    "form",
    "evidence",
    "system_action",
  ]),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    label: z.string().trim().max(200),
    assigneeType: z.enum(["role", "team"]).optional().nullable(),
    assigneeRoleId: z.string().uuid().optional().nullable(),
    assigneeTeamId: z.string().uuid().optional().nullable(),
    required: z.boolean().optional(),
    formFields: z.array(formFieldSchema).max(30).optional(),
    evidenceDescription: z.string().trim().max(500).optional().nullable(),
    timerDurationMinutes: z.number().int().positive().optional().nullable(),
    notificationMessage: z.string().trim().max(500).optional().nullable(),
    subprocessId: z.string().uuid().optional().nullable(),
    systemActionType: z.string().trim().max(100).optional().nullable(),
  }),
});

export const processEdgeSchema = z.object({
  id: z.string().trim().min(1),
  source: z.string().trim().min(1),
  target: z.string().trim().min(1),
  label: z.string().trim().max(200).optional().nullable(),
  condition: z.string().trim().max(200).optional().nullable(),
});

export const processGraphSchema = z.object({
  nodes: z.array(processNodeSchema).min(1, "At least one node is required."),
  edges: z.array(processEdgeSchema),
});

export type ProcessGraphInput = z.infer<typeof processGraphSchema>;

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
    where process_id = ${processId} and status in ('draft', 'in_review', 'approved')
  `;
  if (inProgress) {
    throw new AppError(
      "conflict",
      "A draft, in-review, or approved version already exists for this process.",
    );
  }
}

/** Creates a new draft version — a process's first version comes from createProcess() + this; every later revision (after publish or rejection) goes through this same path. Saving a draft never requires the graph to be valid yet (see getGraphValidationErrors) — only submitting it for review does. */
export async function createVersion(
  processId: string,
  title: string,
  graph: ProcessGraphInput,
): Promise<ProcessVersionRow> {
  const definition = processGraphSchema.parse(graph);
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
        ${tx.json(definition as unknown as postgres.JSONValue)}, ${membership.profile.id}
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
  input: { title: string; graph: ProcessGraphInput },
): Promise<ProcessVersionRow> {
  const definition = processGraphSchema.parse(input.graph);
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
      update process_versions set title = ${title}, definition = ${tx.json(definition as unknown as postgres.JSONValue)}
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

/** Returns validation errors for a version's current graph without changing anything — used by the editor's validation panel and to block submitForReview. */
export async function getGraphValidationErrors(versionId: string) {
  const membership = await requirePermission("process.view");
  const version = await withTenantContext(toTenantContext(membership), (tx) =>
    getOwnVersion(tx, membership.organization.id, versionId),
  );
  return validateProcessGraph(version.definition as ProcessGraphDefinition);
}

export async function submitForReview(versionId: string): Promise<ProcessVersionRow> {
  const preCheck = await requirePermission("process.view");
  const version = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnVersion(tx, preCheck.organization.id, versionId),
  );
  if (version.status !== "draft") {
    throw new AppError("conflict", "Only a draft version can be submitted for review.");
  }
  const errors = validateProcessGraph(version.definition as ProcessGraphDefinition);
  if (errors.length > 0) {
    throw new AppError("conflict", `The process graph has validation errors: ${errors[0].message}`);
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

/** in_review -> approved. A distinct step from publishing (process.review, not process.publish) — an approved version can wait (e.g. for its effective date) before someone with process.publish actually publishes it. */
export async function approveVersion(versionId: string): Promise<ProcessVersionRow> {
  const preCheck = await requirePermission("process.view");
  const version = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnVersion(tx, preCheck.organization.id, versionId),
  );
  if (version.status !== "in_review") {
    throw new AppError("conflict", "Only an in-review version can be approved.");
  }
  const membership = await requirePermission("process.review", {
    scope: { departmentId: version.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<ProcessVersionRow[]>`
      update process_versions set
        status = 'approved', reviewed_by = ${membership.member.id}, reviewed_at = now()
      where id = ${versionId}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ProcessVersionApproved,
      resourceType: AuditResourceType.ProcessVersion,
      resourceId: versionId,
      source: "app",
    });

    return updated;
  });
}

/** Publishes an approved version: supersedes the process's previously-published version (if any) and points the process at this one — same "insert/activate new before retiring old" transaction shape as members.ts's transferOwnership. Requires process.publish, which — unlike knowledge.publish — has no unscoped grantee at all (only process_owner, scoped) per product/permissions-matrix.md. */
export async function publishVersion(versionId: string): Promise<ProcessVersionRow> {
  const preCheck = await requirePermission("process.view");
  const version = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnVersion(tx, preCheck.organization.id, versionId),
  );
  if (version.status !== "approved") {
    throw new AppError("conflict", "Only an approved version can be published.");
  }
  const membership = await requirePermission("process.publish", {
    scope: { departmentId: version.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const process = await getOwnProcess(tx, membership.organization.id, version.process_id);

    const [published] = await tx<ProcessVersionRow[]>`
      update process_versions set
        status = 'published', published_by = ${membership.member.id}, published_at = now()
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
