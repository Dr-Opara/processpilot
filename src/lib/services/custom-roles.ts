import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type postgres from "postgres";
import { requirePermission } from "@/lib/authz";
import type { CurrentMembership } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { PermissionRow, RoleRow, RoleTemplateRow } from "@/lib/db/database.types";

/**
 * Organization-scoped custom roles — product/permissions-matrix.md's
 * enforcement rule 5: "Custom roles can only grant permissions the
 * granting admin's own role already holds." Enforced here at the
 * application layer (clear error message, checked before any write) and
 * again, independently, by 20260806000001's role_permissions_insert RLS
 * policy — same defense-in-depth posture as every other permission
 * boundary in this codebase.
 */

function toTenantContext(membership: CurrentMembership) {
  return {
    organizationId: membership.organization.id,
    memberId: membership.member.id,
    clerkUserId: membership.profile.clerk_user_id,
  };
}

function assertPermissionsWithinGrantorBounds(
  membership: CurrentMembership,
  permissionKeys: string[],
): void {
  const notHeld = permissionKeys.filter((key) => !membership.permissions.includes(key));
  if (notHeld.length > 0) {
    throw new AppError(
      "forbidden",
      `You cannot grant permissions you don't currently hold: ${notHeld.join(", ")}.`,
    );
  }
}

function generateRoleKey(name: string): string {
  const slug =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "role";
  return `custom_${slug}_${randomBytes(3).toString("hex")}`;
}

export const customRoleInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional().nullable(),
  permissionKeys: z.array(z.string()).min(1, "Select at least one permission"),
});
export type CustomRoleInput = z.infer<typeof customRoleInputSchema>;

export const updateCustomRoleInputSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  permissionKeys: z.array(z.string()).min(1, "Select at least one permission").optional(),
});
export type UpdateCustomRoleInput = z.infer<typeof updateCustomRoleInputSchema>;

async function resolvePermissionIds(
  tx: postgres.TransactionSql,
  permissionKeys: string[],
): Promise<{ id: string; key: string }[]> {
  const rows = await tx<{ id: string; key: string }[]>`
    select id, key from permissions where key = any(${permissionKeys})
  `;
  if (rows.length !== new Set(permissionKeys).size) {
    throw new AppError("bad_request", "One or more permission keys are unknown.");
  }
  return rows;
}

/** The full permission catalog, for populating a create/edit role form's checkbox list. */
export async function listPermissions(): Promise<PermissionRow[]> {
  const membership = await requirePermission("role.manage");
  return withTenantContext(
    toTenantContext(membership),
    (tx) => tx<PermissionRow[]>`select * from permissions order by key asc`,
  );
}

export async function createCustomRole(input: CustomRoleInput): Promise<RoleRow> {
  const data = customRoleInputSchema.parse(input);
  const membership = await requirePermission("role.manage");
  assertPermissionsWithinGrantorBounds(membership, data.permissionKeys);

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const permissionRows = await resolvePermissionIds(tx, data.permissionKeys);

    let role: RoleRow;
    try {
      [role] = await tx<RoleRow[]>`
        insert into roles (organization_id, key, name, description, is_system, created_by)
        values (
          ${membership.organization.id}, ${generateRoleKey(data.name)}, ${data.name},
          ${data.description ?? null}, false, ${membership.profile.id}
        )
        returning *
      `;
    } catch {
      throw new AppError("conflict", "Could not create this role. Try again.");
    }

    for (const permission of permissionRows) {
      await tx`
        insert into role_permissions (role_id, permission_id) values (${role.id}, ${permission.id})
      `;
    }

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.CustomRoleCreated,
      resourceType: AuditResourceType.Role,
      resourceId: role.id,
      source: "app",
      metadata: { name: data.name, permissionKeys: data.permissionKeys },
    });

    return role;
  });
}

export async function updateCustomRole(
  roleId: string,
  input: UpdateCustomRoleInput,
): Promise<RoleRow> {
  const data = updateCustomRoleInputSchema.parse(input);
  const membership = await requirePermission("role.manage");
  if (data.permissionKeys) {
    assertPermissionsWithinGrantorBounds(membership, data.permissionKeys);
  }

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [existing] = await tx<RoleRow[]>`
      select * from roles where id = ${roleId} and organization_id = ${membership.organization.id}
    `;
    if (!existing) throw new AppError("not_found", "Role not found.");
    if (existing.is_system) throw new AppError("forbidden", "System roles cannot be edited.");
    if (existing.archived_at) throw new AppError("conflict", "This role is archived.");

    if (data.permissionKeys) {
      const permissionRows = await resolvePermissionIds(tx, data.permissionKeys);
      await tx`delete from role_permissions where role_id = ${roleId}`;
      for (const permission of permissionRows) {
        await tx`
          insert into role_permissions (role_id, permission_id) values (${roleId}, ${permission.id})
        `;
      }
    }

    const [role] = await tx<RoleRow[]>`
      update roles set
        name = ${data.name ?? existing.name},
        description = ${data.description === undefined ? existing.description : data.description}
      where id = ${roleId}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.CustomRoleUpdated,
      resourceType: AuditResourceType.Role,
      resourceId: roleId,
      source: "app",
      metadata: data.permissionKeys ? { permissionKeys: data.permissionKeys } : undefined,
    });

    return role;
  });
}

export async function archiveCustomRole(roleId: string): Promise<RoleRow> {
  const membership = await requirePermission("role.manage");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [existing] = await tx<RoleRow[]>`
      select * from roles where id = ${roleId} and organization_id = ${membership.organization.id}
    `;
    if (!existing) throw new AppError("not_found", "Role not found.");
    if (existing.is_system) throw new AppError("forbidden", "System roles cannot be archived.");

    const [inUse] = await tx<{ count: string }[]>`
      select count(*) as count from member_role_assignments where role_id = ${roleId}
    `;
    if (Number(inUse.count) > 0) {
      throw new AppError(
        "conflict",
        "This role is currently assigned to one or more members — remove those assignments first.",
      );
    }

    const [role] = await tx<RoleRow[]>`
      update roles set archived_at = now() where id = ${roleId} returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.CustomRoleArchived,
      resourceType: AuditResourceType.Role,
      resourceId: roleId,
      source: "app",
    });

    return role;
  });
}

export interface RoleTemplateWithPermissions {
  template: RoleTemplateRow;
  permissions: PermissionRow[];
}

export async function listRoleTemplates(): Promise<RoleTemplateWithPermissions[]> {
  const membership = await requirePermission("role.manage");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const templates = await tx<RoleTemplateRow[]>`select * from role_templates order by name asc`;
    const results: RoleTemplateWithPermissions[] = [];
    for (const template of templates) {
      const permissions = await tx<PermissionRow[]>`
        select p.* from role_template_permissions rtp
        join permissions p on p.id = rtp.permission_id
        where rtp.role_template_id = ${template.id}
        order by p.key asc
      `;
      results.push({ template, permissions });
    }
    return results;
  });
}

export async function createCustomRoleFromTemplate(
  templateId: string,
  name: string,
): Promise<RoleRow> {
  const membership = await requirePermission("role.manage");

  const permissionKeys = await withTenantContext(toTenantContext(membership), async (tx) => {
    const [template] = await tx<RoleTemplateRow[]>`
      select * from role_templates where id = ${templateId}
    `;
    if (!template) throw new AppError("not_found", "Role template not found.");

    const permissions = await tx<{ key: string }[]>`
      select p.key from role_template_permissions rtp
      join permissions p on p.id = rtp.permission_id
      where rtp.role_template_id = ${templateId}
    `;
    return permissions.map((row) => row.key);
  });

  return createCustomRole({ name, permissionKeys });
}
