import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { createSignedUrl, buildStoragePath, uploadFile } from "@/lib/services/storage";
import {
  extractTextFromUpload,
  mimeTypeForKind,
  validateUpload,
} from "@/lib/services/document-parsing";
import type { KnowledgeDocumentRow, DocumentVersionRow } from "@/lib/db/database.types";

export const authoredVersionInputSchema = z.object({
  documentId: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(300),
  content: z.string().trim().min(1, "Content is required").max(200_000),
});

export type AuthoredVersionInput = z.infer<typeof authoredVersionInputSchema>;

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

async function getOwnDocument(
  tx: postgres.TransactionSql,
  organizationId: string,
  documentId: string,
): Promise<KnowledgeDocumentRow> {
  const [document] = await tx<KnowledgeDocumentRow[]>`
    select * from knowledge_documents where id = ${documentId} and organization_id = ${organizationId}
  `;
  if (!document) throw new AppError("not_found", "Document not found.");
  return document;
}

async function assertNoVersionInProgress(
  tx: postgres.TransactionSql,
  documentId: string,
): Promise<void> {
  const [inProgress] = await tx<{ id: string }[]>`
    select id from document_versions
    where document_id = ${documentId} and status in ('draft', 'in_review')
  `;
  if (inProgress) {
    throw new AppError(
      "conflict",
      "A draft or in-review version already exists for this document.",
    );
  }
}

/** Creates a new authored draft version — a document's first version comes from createDocument(); this is for every version after (a re-edit of a published or rejected document). */
export async function createAuthoredVersion(
  input: AuthoredVersionInput,
): Promise<DocumentVersionRow> {
  const data = authoredVersionInputSchema.parse(input);
  const preCheck = await requirePermission("knowledge.view");
  const document = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnDocument(tx, preCheck.organization.id, data.documentId),
  );
  const membership = await requirePermission("knowledge.edit", {
    scope: { departmentId: document.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    await assertNoVersionInProgress(tx, data.documentId);

    const [{ max_version }] = await tx<{ max_version: number }[]>`
      select coalesce(max(version_number), 0) as max_version from document_versions where document_id = ${data.documentId}
    `;

    const [version] = await tx<DocumentVersionRow[]>`
      insert into document_versions (
        organization_id, document_id, version_number, title, source, content, extracted_text, created_by
      ) values (
        ${membership.organization.id}, ${data.documentId}, ${max_version + 1}, ${data.title},
        'authored', ${data.content}, ${data.content}, ${membership.profile.id}
      )
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.DocumentVersionCreated,
      resourceType: AuditResourceType.DocumentVersion,
      resourceId: version.id,
      source: "app",
    });

    return version;
  });
}

/** Creates a new draft version from an uploaded file — validates the file's actual bytes (never trusts the declared extension/mime type), extracts text for search, and stores the original in Supabase Storage. */
export async function createUploadedVersion(
  documentId: string,
  title: string,
  file: { buffer: Buffer; filename: string },
): Promise<DocumentVersionRow> {
  if (!title.trim()) throw new AppError("conflict", "Title is required.");
  const kind = validateUpload(file.buffer, file.filename);

  const preCheck = await requirePermission("knowledge.view");
  const document = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnDocument(tx, preCheck.organization.id, documentId),
  );
  const membership = await requirePermission("knowledge.edit", {
    scope: { departmentId: document.department_id ?? undefined },
  });

  const extractedText = await extractTextFromUpload(file.buffer, kind);

  return withTenantContext(toTenantContext(membership), async (tx) => {
    await assertNoVersionInProgress(tx, documentId);

    const [{ max_version }] = await tx<{ max_version: number }[]>`
      select coalesce(max(version_number), 0) as max_version from document_versions where document_id = ${documentId}
    `;
    const versionNumber = max_version + 1;

    const [version] = await tx<DocumentVersionRow[]>`
      insert into document_versions (
        organization_id, document_id, version_number, title, source, original_filename, mime_type,
        file_size_bytes, extracted_text, created_by
      ) values (
        ${membership.organization.id}, ${documentId}, ${versionNumber}, ${title}, 'uploaded',
        ${file.filename}, ${mimeTypeForKind(kind)}, ${file.buffer.byteLength}, ${extractedText},
        ${membership.profile.id}
      )
      returning *
    `;

    const storagePath = buildStoragePath(
      membership.organization.id,
      documentId,
      version.id,
      file.filename,
    );
    await uploadFile(storagePath, file.buffer, mimeTypeForKind(kind));

    const [updated] = await tx<DocumentVersionRow[]>`
      update document_versions set storage_path = ${storagePath} where id = ${version.id} returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.DocumentVersionCreated,
      resourceType: AuditResourceType.DocumentVersion,
      resourceId: version.id,
      source: "app",
    });

    return updated;
  });
}

async function getOwnVersion(
  tx: postgres.TransactionSql,
  organizationId: string,
  versionId: string,
): Promise<DocumentVersionRow> {
  const [version] = await tx<DocumentVersionRow[]>`
    select * from document_versions where id = ${versionId} and organization_id = ${organizationId}
  `;
  if (!version) throw new AppError("not_found", "Document version not found.");
  return version;
}

/** Edits an authored draft's title/content before it's submitted for review. Uploaded-file versions are replaced by creating a new version instead (re-uploading a file mid-draft isn't supported this phase). */
export async function updateDraftVersion(
  versionId: string,
  input: { title: string; content: string },
): Promise<DocumentVersionRow> {
  const preCheck = await requirePermission("knowledge.view");
  const version = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnVersion(tx, preCheck.organization.id, versionId),
  );
  if (version.status !== "draft") {
    throw new AppError("conflict", "Only a draft version can be edited.");
  }
  if (version.source !== "authored") {
    throw new AppError(
      "conflict",
      "An uploaded file's version can't be edited in place — create a new version instead.",
    );
  }
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) throw new AppError("conflict", "Title is required.");
  if (!content) throw new AppError("conflict", "Content is required.");

  const membership = await requirePermission("knowledge.edit", {
    scope: { departmentId: version.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<DocumentVersionRow[]>`
      update document_versions set title = ${title}, content = ${content}, extracted_text = ${content}
      where id = ${versionId}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.DocumentVersionUpdated,
      resourceType: AuditResourceType.DocumentVersion,
      resourceId: versionId,
      source: "app",
    });

    return updated;
  });
}

export async function submitForReview(versionId: string): Promise<DocumentVersionRow> {
  const preCheck = await requirePermission("knowledge.view");
  const version = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnVersion(tx, preCheck.organization.id, versionId),
  );
  if (version.status !== "draft") {
    throw new AppError("conflict", "Only a draft version can be submitted for review.");
  }
  const membership = await requirePermission("knowledge.edit", {
    scope: { departmentId: version.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<DocumentVersionRow[]>`
      update document_versions set
        status = 'in_review', submitted_by = ${membership.member.id}, submitted_at = now()
      where id = ${versionId}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.DocumentVersionSubmittedForReview,
      resourceType: AuditResourceType.DocumentVersion,
      resourceId: versionId,
      source: "app",
    });

    return updated;
  });
}

export async function rejectReview(
  versionId: string,
  reviewNotes: string,
): Promise<DocumentVersionRow> {
  const preCheck = await requirePermission("knowledge.view");
  const version = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnVersion(tx, preCheck.organization.id, versionId),
  );
  if (version.status !== "in_review") {
    throw new AppError("conflict", "Only an in-review version can be rejected.");
  }
  const membership = await requirePermission("knowledge.review", {
    scope: { departmentId: version.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<DocumentVersionRow[]>`
      update document_versions set
        status = 'draft', reviewed_by = ${membership.member.id}, reviewed_at = now(),
        review_notes = ${reviewNotes || null}
      where id = ${versionId}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.DocumentVersionRejected,
      resourceType: AuditResourceType.DocumentVersion,
      resourceId: versionId,
      source: "app",
      reason: reviewNotes || null,
    });

    return updated;
  });
}

/** Publishes an in-review version: supersedes the document's previously-published version (if any) and points the document at this one — all in one transaction, same "insert/activate the new before retiring the old" shape as members.ts's transferOwnership. */
export async function approveAndPublish(versionId: string): Promise<DocumentVersionRow> {
  const preCheck = await requirePermission("knowledge.view");
  const version = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnVersion(tx, preCheck.organization.id, versionId),
  );
  if (version.status !== "in_review") {
    throw new AppError("conflict", "Only an in-review version can be published.");
  }
  const membership = await requirePermission("knowledge.publish", {
    scope: { departmentId: version.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const document = await getOwnDocument(tx, membership.organization.id, version.document_id);

    const [published] = await tx<DocumentVersionRow[]>`
      update document_versions set
        status = 'published', reviewed_by = ${membership.member.id}, reviewed_at = now(),
        published_by = ${membership.member.id}, published_at = now()
      where id = ${versionId}
      returning *
    `;

    if (document.current_version_id) {
      await tx`
        update document_versions set status = 'superseded' where id = ${document.current_version_id}
      `;
      await recordAuditEvent(tx, {
        organizationId: membership.organization.id,
        actorProfileId: membership.profile.id,
        action: AuditAction.DocumentVersionSuperseded,
        resourceType: AuditResourceType.DocumentVersion,
        resourceId: document.current_version_id,
        source: "app",
      });
    }

    await tx`
      update knowledge_documents set current_version_id = ${versionId}, status = 'published'
      where id = ${version.document_id}
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.DocumentVersionPublished,
      resourceType: AuditResourceType.DocumentVersion,
      resourceId: versionId,
      source: "app",
    });

    return published;
  });
}

/** Requires knowledge.view; blocks a download if the file was flagged. No real scanner exists yet (see the 20260719150001 migration's scan_status column) — every upload sits at 'pending_scan' until a future phase wires one in; this gate exists now so that later addition needs no schema change. */
export async function getDownloadUrl(versionId: string): Promise<string> {
  const preCheck = await requirePermission("knowledge.view");
  const version = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnVersion(tx, preCheck.organization.id, versionId),
  );
  await requirePermission("knowledge.view", {
    scope: { departmentId: version.department_id ?? undefined },
  });

  if (!version.storage_path) {
    throw new AppError("conflict", "This version has no uploaded file to download.");
  }
  if (version.scan_status === "flagged") {
    throw new AppError("forbidden", "This file was flagged and cannot be downloaded.");
  }

  return createSignedUrl(version.storage_path);
}
