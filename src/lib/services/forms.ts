import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { formDefinitionSchema, type FormDefinitionInput } from "@/lib/services/form-schema";
import type { FormRow, FormVersionRow } from "@/lib/db/database.types";

/**
 * Forms follow the same mutable-shell/immutable-version split ADR-0011
 * established for Process (processes.ts/process-versions.ts) and
 * Document (knowledge-documents.ts/document-versions.ts), simplified by
 * dropping the separate review stage those two have — form.edit and
 * form.publish are still distinct permissions, so authoring and
 * publishing stay separable duties even without a review step.
 */
export const formInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  ownerMemberId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
});

export type FormInput = z.infer<typeof formInputSchema>;

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

export interface ListFormsFilters {
  search?: string;
  status?: "draft" | "published" | "archived" | "all";
  departmentId?: string;
}

export interface FormSummary extends FormRow {
  current_version_status: FormVersionRow["status"] | null;
  current_version_number: number | null;
}

/** Read access matches processes.ts's pattern — RLS narrows the rows a scoped role can see via form.view; write actions below each require the specific form.* permission, scoped to the form's department. */
export async function listForms(filters: ListFormsFilters = {}): Promise<FormSummary[]> {
  const membership = await getCurrentMembership();
  const status = filters.status ?? "published";
  const search = filters.search?.trim() ? `%${filters.search.trim()}%` : null;

  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<FormSummary[]>`
      select
        f.*, fv.status as current_version_status, fv.version_number as current_version_number
      from forms f
      left join form_versions fv on fv.id = f.current_version_id
      where f.organization_id = ${membership.organization.id}
        and (${status === "all"} or f.status = ${status})
        and (${filters.departmentId ?? null} is null or f.department_id = ${filters.departmentId ?? null})
        and (${search === null} or f.title ilike ${search} or f.category ilike ${search})
      order by f.title asc
    `,
  );
}

export interface FormDetail {
  form: FormRow;
  currentVersion: FormVersionRow | null;
  versions: FormVersionRow[];
}

export async function getForm(formId: string): Promise<FormDetail> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [form] = await tx<FormRow[]>`
      select * from forms where id = ${formId} and organization_id = ${membership.organization.id}
    `;
    if (!form) throw new AppError("not_found", "Form not found.");

    const versions = await tx<FormVersionRow[]>`
      select * from form_versions where form_id = ${formId} order by version_number desc
    `;
    const currentVersion = versions.find((v) => v.id === form.current_version_id) ?? null;

    return { form, currentVersion, versions };
  });
}

/** Fetches the organization's current published version of a form by id — the snapshot point workflow-engine.ts reads when a 'form' node's ProcessNodeData.formId resolves at task-creation time. */
export async function getPublishedFormVersion(
  tx: postgres.Sql | postgres.TransactionSql,
  organizationId: string,
  formId: string,
): Promise<FormVersionRow | null> {
  const [form] = await tx<Pick<FormRow, "current_version_id">[]>`
    select current_version_id from forms where id = ${formId} and organization_id = ${organizationId} and status = 'published'
  `;
  if (!form?.current_version_id) return null;
  const [version] = await tx<FormVersionRow[]>`
    select * from form_versions where id = ${form.current_version_id}
  `;
  return version ?? null;
}

/** Creates only the form shell (no version yet) — the caller immediately follows this with createDraftVersion() to create version 1. */
export async function createForm(input: FormInput): Promise<FormRow> {
  const data = formInputSchema.parse(input);
  const membership = await requirePermission("form.create", {
    scope: { departmentId: data.departmentId ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [form] = await tx<FormRow[]>`
      insert into forms (
        organization_id, title, description, category, owner_member_id, department_id, created_by
      ) values (
        ${membership.organization.id}, ${data.title}, ${data.description ?? null}, ${data.category ?? null},
        ${data.ownerMemberId ?? null}, ${data.departmentId ?? null}, ${membership.profile.id}
      )
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.FormCreated,
      resourceType: AuditResourceType.Form,
      resourceId: form.id,
      source: "app",
    });

    return form;
  });
}

async function getOwnForm(
  tx: postgres.TransactionSql,
  organizationId: string,
  formId: string,
): Promise<FormRow> {
  const [form] = await tx<FormRow[]>`
    select * from forms where id = ${formId} and organization_id = ${organizationId}
  `;
  if (!form) throw new AppError("not_found", "Form not found.");
  return form;
}

async function assertNoDraftInProgress(tx: postgres.TransactionSql, formId: string): Promise<void> {
  const [existing] = await tx<{ id: string }[]>`
    select id from form_versions where form_id = ${formId} and status = 'draft'
  `;
  if (existing) throw new AppError("conflict", "A draft version already exists for this form.");
}

export interface CreateDraftVersionInput {
  title: string;
  definition: FormDefinitionInput;
}

export async function createDraftVersion(
  formId: string,
  input: CreateDraftVersionInput,
): Promise<FormVersionRow> {
  const title = input.title.trim();
  if (!title) throw new AppError("conflict", "Title is required.");
  const definition = formDefinitionSchema.parse(input.definition);

  const preCheck = await requirePermission("form.view");
  const form = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnForm(tx, preCheck.organization.id, formId),
  );
  const membership = await requirePermission("form.edit", {
    scope: { departmentId: form.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    await assertNoDraftInProgress(tx, formId);

    const [{ max_version }] = await tx<{ max_version: number }[]>`
      select coalesce(max(version_number), 0) as max_version from form_versions where form_id = ${formId}
    `;

    const [version] = await tx<FormVersionRow[]>`
      insert into form_versions (
        organization_id, form_id, version_number, title, definition, created_by
      ) values (
        ${membership.organization.id}, ${formId}, ${max_version + 1}, ${title},
        ${tx.json(definition as unknown as Parameters<typeof tx.json>[0])}, ${membership.profile.id}
      )
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.FormVersionCreated,
      resourceType: AuditResourceType.FormVersion,
      resourceId: version.id,
      source: "app",
    });

    return version;
  });
}

async function getOwnVersion(
  tx: postgres.TransactionSql,
  organizationId: string,
  versionId: string,
): Promise<FormVersionRow> {
  const [version] = await tx<FormVersionRow[]>`
    select * from form_versions where id = ${versionId} and organization_id = ${organizationId}
  `;
  if (!version) throw new AppError("not_found", "Form version not found.");
  return version;
}

export async function updateDraftVersion(
  versionId: string,
  input: CreateDraftVersionInput,
): Promise<FormVersionRow> {
  const title = input.title.trim();
  if (!title) throw new AppError("conflict", "Title is required.");
  const definition = formDefinitionSchema.parse(input.definition);

  const preCheck = await requirePermission("form.view");
  const version = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnVersion(tx, preCheck.organization.id, versionId),
  );
  if (version.status !== "draft") {
    throw new AppError("conflict", "Only a draft version can be edited.");
  }
  const membership = await requirePermission("form.edit", {
    scope: { departmentId: version.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<FormVersionRow[]>`
      update form_versions set title = ${title}, definition = ${tx.json(definition as unknown as Parameters<typeof tx.json>[0])}
      where id = ${versionId}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.FormVersionUpdated,
      resourceType: AuditResourceType.FormVersion,
      resourceId: versionId,
      source: "app",
    });

    return updated;
  });
}

/** Publishes a draft version: supersedes the form's previously-published version (if any) and points the form at this one — same "insert/activate the new before retiring the old" shape as document-versions.ts's approveAndPublish(). */
export async function publishFormVersion(versionId: string): Promise<FormVersionRow> {
  const preCheck = await requirePermission("form.view");
  const version = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnVersion(tx, preCheck.organization.id, versionId),
  );
  if (version.status !== "draft") {
    throw new AppError("conflict", "Only a draft version can be published.");
  }
  const membership = await requirePermission("form.publish", {
    scope: { departmentId: version.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const form = await getOwnForm(tx, membership.organization.id, version.form_id);

    const [published] = await tx<FormVersionRow[]>`
      update form_versions set status = 'published', published_by = ${membership.member.id}, published_at = now()
      where id = ${versionId}
      returning *
    `;

    if (form.current_version_id) {
      await tx`update form_versions set status = 'superseded' where id = ${form.current_version_id}`;
      await recordAuditEvent(tx, {
        organizationId: membership.organization.id,
        actorProfileId: membership.profile.id,
        action: AuditAction.FormVersionSuperseded,
        resourceType: AuditResourceType.FormVersion,
        resourceId: form.current_version_id,
        source: "app",
      });
    }

    await tx`update forms set current_version_id = ${versionId}, status = 'published' where id = ${version.form_id}`;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.FormVersionPublished,
      resourceType: AuditResourceType.FormVersion,
      resourceId: versionId,
      source: "app",
    });

    return published;
  });
}

export async function archiveForm(formId: string): Promise<FormRow> {
  const preCheck = await getCurrentMembership();
  const target = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnForm(tx, preCheck.organization.id, formId),
  );
  const membership = await requirePermission("form.edit", {
    scope: { departmentId: target.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [form] = await tx<FormRow[]>`
      update forms set archived_at = now(), status = 'archived' where id = ${formId} and archived_at is null returning *
    `;
    if (!form) throw new AppError("not_found", "Form not found or already archived.");

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.FormArchived,
      resourceType: AuditResourceType.Form,
      resourceId: form.id,
      source: "app",
    });

    return form;
  });
}

export async function restoreForm(formId: string): Promise<FormRow> {
  const preCheck = await getCurrentMembership();
  const target = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnForm(tx, preCheck.organization.id, formId),
  );
  if (!target.archived_at) throw new AppError("not_found", "Form not found or not archived.");

  const membership = await requirePermission("form.edit", {
    scope: { departmentId: target.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const restoredStatus = target.current_version_id ? "published" : "draft";
    const [form] = await tx<FormRow[]>`
      update forms set archived_at = null, status = ${restoredStatus} where id = ${formId} returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.FormRestored,
      resourceType: AuditResourceType.Form,
      resourceId: form.id,
      source: "app",
    });

    return form;
  });
}
