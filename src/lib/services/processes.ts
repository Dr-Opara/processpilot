import "server-only";
import { z } from "zod";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { ProcessRow, ProcessVersionRow } from "@/lib/db/database.types";

export const processInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  ownerMemberId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  slaHours: z.number().int().positive().max(100_000).optional().nullable(),
  effectiveFrom: z.string().date().optional().nullable(),
  effectiveUntil: z.string().date().optional().nullable(),
  sourceDocumentIds: z.array(z.string().uuid()).max(50).optional(),
});

export type ProcessInput = z.infer<typeof processInputSchema>;

export interface ListProcessesFilters {
  search?: string;
  status?: "draft" | "in_review" | "approved" | "published" | "archived" | "all";
  departmentId?: string;
  category?: string;
  tag?: string;
}

export interface ProcessSummary extends ProcessRow {
  current_version_status: ProcessVersionRow["status"] | null;
  current_version_number: number | null;
}

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

/**
 * Read access matches knowledge-documents.ts's pattern — any active
 * member can list/search within their view scope (RLS narrows the
 * rows a scoped process_owner/manager/employee/auditor can see via
 * process.view); write actions below each require the specific
 * process.* permission, scoped to the process's department.
 */
export async function listProcesses(filters: ListProcessesFilters = {}): Promise<ProcessSummary[]> {
  const membership = await getCurrentMembership();
  const status = filters.status ?? "published";
  const search = filters.search?.trim() ? `%${filters.search.trim()}%` : null;

  return withTenantContext(toTenantContext(membership), async (tx) => {
    return tx<ProcessSummary[]>`
      select
        p.*, pv.status as current_version_status, pv.version_number as current_version_number
      from processes p
      left join process_versions pv on pv.id = p.current_version_id
      where p.organization_id = ${membership.organization.id}
        and (${status === "all"} or p.status = ${status})
        and (${filters.departmentId ?? null} is null or p.department_id = ${filters.departmentId ?? null})
        and (${filters.category ?? null} is null or p.category = ${filters.category ?? null})
        and (${filters.tag ?? null} is null or ${filters.tag ?? null} = any(p.tags))
        and (${search === null} or p.title ilike ${search} or p.description ilike ${search})
      order by p.title asc
    `;
  });
}

export interface ProcessDetail {
  process: ProcessRow;
  currentVersion: ProcessVersionRow | null;
  versions: ProcessVersionRow[];
}

export async function getProcess(processId: string): Promise<ProcessDetail> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [process] = await tx<ProcessRow[]>`
      select * from processes where id = ${processId} and organization_id = ${membership.organization.id}
    `;
    if (!process) throw new AppError("not_found", "Process not found.");

    const versions = await tx<ProcessVersionRow[]>`
      select * from process_versions where process_id = ${processId} order by version_number desc
    `;
    const currentVersion = versions.find((v) => v.id === process.current_version_id) ?? null;

    return { process, currentVersion, versions };
  });
}

/**
 * Creates only the process shell (no version yet) — the caller
 * immediately follows this with createVersion() (process-versions.ts)
 * to create version 1, same "reuse the exact same version-creation
 * path every revision goes through" reasoning as
 * knowledge-documents.ts's createDocument().
 */
export async function createProcess(input: ProcessInput): Promise<ProcessRow> {
  const data = processInputSchema.parse(input);
  const membership = await requirePermission("process.create", {
    scope: { departmentId: data.departmentId ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [process] = await tx<ProcessRow[]>`
      insert into processes (
        organization_id, title, description, category, tags, owner_member_id, department_id,
        location_id, team_id, sla_hours, effective_from, effective_until, source_document_ids, created_by
      ) values (
        ${membership.organization.id}, ${data.title}, ${data.description ?? null}, ${data.category ?? null},
        ${data.tags ?? []}, ${data.ownerMemberId ?? null}, ${data.departmentId ?? null},
        ${data.locationId ?? null}, ${data.teamId ?? null}, ${data.slaHours ?? null},
        ${data.effectiveFrom ?? null}, ${data.effectiveUntil ?? null}, ${data.sourceDocumentIds ?? []},
        ${membership.profile.id}
      )
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ProcessCreated,
      resourceType: AuditResourceType.Process,
      resourceId: process.id,
      source: "app",
    });

    return process;
  });
}

/** Edits process-level metadata (not the version's graph content, which goes through process-versions.ts) — requires process.manage, distinct from process.edit. */
export async function updateProcessMetadata(
  processId: string,
  input: ProcessInput,
): Promise<ProcessRow> {
  const data = processInputSchema.parse(input);
  const preCheck = await getCurrentMembership();
  const [target] = await withTenantContext(
    toTenantContext(preCheck),
    (tx) =>
      tx<
        ProcessRow[]
      >`select * from processes where id = ${processId} and organization_id = ${preCheck.organization.id}`,
  );
  if (!target) throw new AppError("not_found", "Process not found.");

  const membership = await requirePermission("process.manage", {
    scope: { departmentId: target.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [process] = await tx<ProcessRow[]>`
      update processes set
        title = ${data.title}, description = ${data.description ?? null}, category = ${data.category ?? null},
        tags = ${data.tags ?? []}, owner_member_id = ${data.ownerMemberId ?? null},
        department_id = ${data.departmentId ?? null}, location_id = ${data.locationId ?? null},
        team_id = ${data.teamId ?? null}, sla_hours = ${data.slaHours ?? null},
        effective_from = ${data.effectiveFrom ?? null}, effective_until = ${data.effectiveUntil ?? null},
        source_document_ids = ${data.sourceDocumentIds ?? []}
      where id = ${processId}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ProcessUpdated,
      resourceType: AuditResourceType.Process,
      resourceId: process.id,
      source: "app",
    });

    return process;
  });
}

export async function archiveProcess(processId: string): Promise<ProcessRow> {
  const preCheck = await getCurrentMembership();
  const [target] = await withTenantContext(
    toTenantContext(preCheck),
    (tx) =>
      tx<
        ProcessRow[]
      >`select * from processes where id = ${processId} and organization_id = ${preCheck.organization.id}`,
  );
  if (!target) throw new AppError("not_found", "Process not found.");

  const membership = await requirePermission("process.manage", {
    scope: { departmentId: target.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [process] = await tx<ProcessRow[]>`
      update processes set archived_at = now(), status = 'archived'
      where id = ${processId} and archived_at is null
      returning *
    `;
    if (!process) throw new AppError("not_found", "Process not found or already archived.");

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ProcessArchived,
      resourceType: AuditResourceType.Process,
      resourceId: process.id,
      source: "app",
    });

    return process;
  });
}

export async function restoreProcess(processId: string): Promise<ProcessRow> {
  const preCheck = await getCurrentMembership();
  const [target] = await withTenantContext(
    toTenantContext(preCheck),
    (tx) =>
      tx<
        ProcessRow[]
      >`select * from processes where id = ${processId} and organization_id = ${preCheck.organization.id}`,
  );
  if (!target || !target.archived_at) {
    throw new AppError("not_found", "Process not found or not archived.");
  }

  const membership = await requirePermission("process.manage", {
    scope: { departmentId: target.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [currentVersion] = target.current_version_id
      ? await tx<
          ProcessVersionRow[]
        >`select * from process_versions where id = ${target.current_version_id}`
      : [];
    const restoredStatus = currentVersion?.status === "published" ? "published" : "draft";

    const [process] = await tx<ProcessRow[]>`
      update processes set archived_at = null, status = ${restoredStatus} where id = ${processId} returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ProcessRestored,
      resourceType: AuditResourceType.Process,
      resourceId: process.id,
      source: "app",
    });

    return process;
  });
}
