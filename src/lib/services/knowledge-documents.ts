import "server-only";
import { z } from "zod";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { DocumentVersionRow, KnowledgeDocumentRow } from "@/lib/db/database.types";

export const documentInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  category: z.string().trim().max(100).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  ownerMemberId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
});

export type DocumentInput = z.infer<typeof documentInputSchema>;

export interface ListDocumentsFilters {
  search?: string;
  category?: string;
  tag?: string;
  status?: "draft" | "in_review" | "published" | "archived" | "all";
  departmentId?: string;
}

export interface DocumentSummary extends KnowledgeDocumentRow {
  current_version_status: DocumentVersionRow["status"] | null;
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
 * Read access matches departments.ts's pattern — any active member can
 * list/search within their view scope (RLS itself narrows the rows a
 * scoped `process_owner`/manager/employee/auditor can see via
 * knowledge.view); write actions below each require the specific
 * knowledge.* permission, scoped to the document's department.
 */
export async function listDocuments(
  filters: ListDocumentsFilters = {},
): Promise<DocumentSummary[]> {
  const membership = await getCurrentMembership();
  const status = filters.status ?? "published";
  const search = filters.search?.trim() ? `%${filters.search.trim()}%` : null;

  return withTenantContext(toTenantContext(membership), async (tx) => {
    return tx<DocumentSummary[]>`
      select
        kd.*, dv.status as current_version_status, dv.version_number as current_version_number
      from knowledge_documents kd
      left join document_versions dv on dv.id = kd.current_version_id
      where kd.organization_id = ${membership.organization.id}
        and (${status === "all"} or kd.status = ${status})
        and (${filters.departmentId ?? null} is null or kd.department_id = ${filters.departmentId ?? null})
        and (${filters.category ?? null} is null or kd.category = ${filters.category ?? null})
        and (${filters.tag ?? null} is null or ${filters.tag ?? null} = any(kd.tags))
        and (
          ${search === null}
          or kd.title ilike ${search}
          or kd.category ilike ${search}
          or dv.extracted_text ilike ${search}
        )
      order by kd.title asc
    `;
  });
}

export interface DocumentDetail {
  document: KnowledgeDocumentRow;
  currentVersion: DocumentVersionRow | null;
  versions: DocumentVersionRow[];
}

export async function getDocument(documentId: string): Promise<DocumentDetail> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [document] = await tx<KnowledgeDocumentRow[]>`
      select * from knowledge_documents where id = ${documentId} and organization_id = ${membership.organization.id}
    `;
    if (!document) throw new AppError("not_found", "Document not found.");

    const versions = await tx<DocumentVersionRow[]>`
      select * from document_versions where document_id = ${documentId} order by version_number desc
    `;
    const currentVersion = versions.find((v) => v.id === document.current_version_id) ?? null;

    return { document, currentVersion, versions };
  });
}

/**
 * Creates only the document shell (no version yet) — the caller
 * immediately follows this with createAuthoredVersion() or
 * createUploadedVersion() (document-versions.ts) to create version 1,
 * reusing the exact same validation/storage/audit path every later
 * revision goes through rather than duplicating a separate "create v1"
 * code path here.
 */
export async function createDocument(input: DocumentInput): Promise<KnowledgeDocumentRow> {
  const data = documentInputSchema.parse(input);
  const membership = await requirePermission("knowledge.create", {
    scope: { departmentId: data.departmentId ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [document] = await tx<KnowledgeDocumentRow[]>`
      insert into knowledge_documents (
        organization_id, title, category, tags, owner_member_id, department_id, created_by
      ) values (
        ${membership.organization.id}, ${data.title}, ${data.category ?? null}, ${data.tags ?? []},
        ${data.ownerMemberId ?? null}, ${data.departmentId ?? null}, ${membership.profile.id}
      )
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.KnowledgeDocumentCreated,
      resourceType: AuditResourceType.KnowledgeDocument,
      resourceId: document.id,
      source: "app",
    });

    return document;
  });
}

export async function archiveDocument(documentId: string): Promise<KnowledgeDocumentRow> {
  const preCheck = await getCurrentMembership();
  const [target] = await withTenantContext(
    toTenantContext(preCheck),
    (tx) =>
      tx<
        KnowledgeDocumentRow[]
      >`select * from knowledge_documents where id = ${documentId} and organization_id = ${preCheck.organization.id}`,
  );
  if (!target) throw new AppError("not_found", "Document not found.");

  const membership = await requirePermission("knowledge.edit", {
    scope: { departmentId: target.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [document] = await tx<KnowledgeDocumentRow[]>`
      update knowledge_documents set archived_at = now(), status = 'archived'
      where id = ${documentId} and archived_at is null
      returning *
    `;
    if (!document) throw new AppError("not_found", "Document not found or already archived.");

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.KnowledgeDocumentArchived,
      resourceType: AuditResourceType.KnowledgeDocument,
      resourceId: document.id,
      source: "app",
    });

    return document;
  });
}

export async function restoreDocument(documentId: string): Promise<KnowledgeDocumentRow> {
  const preCheck = await getCurrentMembership();
  const [target] = await withTenantContext(
    toTenantContext(preCheck),
    (tx) =>
      tx<
        KnowledgeDocumentRow[]
      >`select * from knowledge_documents where id = ${documentId} and organization_id = ${preCheck.organization.id}`,
  );
  if (!target || !target.archived_at) {
    throw new AppError("not_found", "Document not found or not archived.");
  }

  const membership = await requirePermission("knowledge.edit", {
    scope: { departmentId: target.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [currentVersion] = target.current_version_id
      ? await tx<
          DocumentVersionRow[]
        >`select * from document_versions where id = ${target.current_version_id}`
      : [];
    const restoredStatus = currentVersion?.status === "published" ? "published" : "draft";

    const [document] = await tx<KnowledgeDocumentRow[]>`
      update knowledge_documents set archived_at = null, status = ${restoredStatus} where id = ${documentId} returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.KnowledgeDocumentRestored,
      resourceType: AuditResourceType.KnowledgeDocument,
      resourceId: document.id,
      source: "app",
    });

    return document;
  });
}
