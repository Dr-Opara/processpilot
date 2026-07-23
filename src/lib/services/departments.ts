import "server-only";
import { z } from "zod";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { DepartmentRow } from "@/lib/db/database.types";

export const departmentInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  locationId: z.string().uuid().optional().nullable(),
  parentDepartmentId: z.string().uuid().optional().nullable(),
  ownerMemberId: z.string().uuid().optional().nullable(),
});

export type DepartmentInput = z.infer<typeof departmentInputSchema>;

export interface ListDepartmentsFilters {
  search?: string;
  status?: "active" | "archived" | "all";
  locationId?: string;
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
 * department.manage is "Scoped" for manager (product/permissions-matrix.md)
 * — bound to departments the caller already owns. Reads use the unscoped
 * check plus RLS's own row filtering (a manager sees only what RLS
 * returns); every write below re-checks scope against the *specific*
 * department id, since a manager who owns department A must not be able
 * to write department B by guessing its id.
 */

export async function listDepartments(
  filters: ListDepartmentsFilters = {},
): Promise<DepartmentRow[]> {
  // Listing (read) is allowed for any active member, not just holders of
  // department.manage — the directory/org-chart UI needs to resolve
  // department names regardless of who's viewing. See departments_select
  // (organization-wide read, no permission gate). Write actions below all
  // require department.manage, scoped to the specific department.
  const membership = await getCurrentMembership();
  const status = filters.status ?? "active";
  const search = filters.search?.trim() ? `%${filters.search.trim()}%` : null;

  return withTenantContext(toTenantContext(membership), async (tx) => {
    return tx<DepartmentRow[]>`
      select * from departments
      where organization_id = ${membership.organization.id}
        and (${status === "all"} or archived_at is ${status === "archived" ? tx`not null` : tx`null`})
        and (${filters.locationId ?? null} is null or location_id = ${filters.locationId ?? null})
        and (${search === null} or name ilike ${search})
      order by name asc
    `;
  });
}

export async function getDepartment(departmentId: string): Promise<DepartmentRow> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [department] = await tx<DepartmentRow[]>`
      select * from departments where id = ${departmentId} and organization_id = ${membership.organization.id}
    `;
    if (!department) throw new AppError("not_found", "Department not found.");
    return department;
  });
}

async function assertNoCycle(
  departmentId: string | null,
  parentDepartmentId: string | null | undefined,
): Promise<void> {
  if (!parentDepartmentId) return;
  if (departmentId && parentDepartmentId === departmentId) {
    throw new AppError("conflict", "A department cannot be its own parent.");
  }
  // The database trigger (prevent_department_cycle) is the authoritative
  // enforcement — this is a friendlier pre-check so the UI can show a
  // normal validation error instead of a raw constraint-violation message
  // bubbling up through toSafeErrorResponse() as a generic 500.
}

export async function createDepartment(input: DepartmentInput): Promise<DepartmentRow> {
  const data = departmentInputSchema.parse(input);
  await assertNoCycle(null, data.parentDepartmentId);
  const membership = await requirePermission("department.manage");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [existing] = await tx<{ id: string }[]>`
      select id from departments
      where organization_id = ${membership.organization.id}
        and lower(name) = lower(${data.name})
        and archived_at is null
    `;
    if (existing) throw new AppError("conflict", "A department with this name already exists.");

    let department: DepartmentRow;
    try {
      [department] = await tx<DepartmentRow[]>`
        insert into departments (
          organization_id, name, location_id, parent_department_id, owner_member_id, created_by
        ) values (
          ${membership.organization.id}, ${data.name}, ${data.locationId ?? null},
          ${data.parentDepartmentId ?? null}, ${data.ownerMemberId ?? null}, ${membership.profile.id}
        )
        returning *
      `;
    } catch {
      throw new AppError("conflict", "Invalid department hierarchy.");
    }

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.DepartmentCreated,
      resourceType: AuditResourceType.Department,
      resourceId: department.id,
      source: "app",
    });

    return department;
  });
}

export async function updateDepartment(
  departmentId: string,
  input: Partial<DepartmentInput>,
): Promise<DepartmentRow> {
  const data = departmentInputSchema.partial().parse(input);
  await assertNoCycle(departmentId, data.parentDepartmentId);
  const membership = await requirePermission("department.manage", {
    scope: { departmentId },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [existing] = await tx<DepartmentRow[]>`
      select * from departments where id = ${departmentId} and organization_id = ${membership.organization.id}
    `;
    if (!existing) throw new AppError("not_found", "Department not found.");

    let department: DepartmentRow;
    try {
      [department] = await tx<DepartmentRow[]>`
        update departments set
          name = ${data.name ?? existing.name},
          location_id = ${data.locationId === undefined ? existing.location_id : data.locationId},
          parent_department_id = ${
            data.parentDepartmentId === undefined
              ? existing.parent_department_id
              : data.parentDepartmentId
          },
          owner_member_id = ${
            data.ownerMemberId === undefined ? existing.owner_member_id : data.ownerMemberId
          }
        where id = ${departmentId}
        returning *
      `;
    } catch {
      throw new AppError("conflict", "Invalid department hierarchy.");
    }

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.DepartmentUpdated,
      resourceType: AuditResourceType.Department,
      resourceId: department.id,
      source: "app",
    });

    return department;
  });
}

export async function archiveDepartment(departmentId: string): Promise<DepartmentRow> {
  const membership = await requirePermission("department.manage", {
    scope: { departmentId },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [department] = await tx<DepartmentRow[]>`
      update departments set archived_at = now()
      where id = ${departmentId} and organization_id = ${membership.organization.id} and archived_at is null
      returning *
    `;
    if (!department) throw new AppError("not_found", "Department not found or already archived.");

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.DepartmentArchived,
      resourceType: AuditResourceType.Department,
      resourceId: department.id,
      source: "app",
    });

    return department;
  });
}

export async function restoreDepartment(departmentId: string): Promise<DepartmentRow> {
  const membership = await requirePermission("department.manage", {
    scope: { departmentId },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [target] = await tx<DepartmentRow[]>`
      select * from departments where id = ${departmentId} and organization_id = ${membership.organization.id}
    `;
    if (!target || !target.archived_at) {
      throw new AppError("not_found", "Department not found or not archived.");
    }

    const [conflict] = await tx<{ id: string }[]>`
      select id from departments
      where organization_id = ${membership.organization.id}
        and lower(name) = lower(${target.name})
        and archived_at is null
        and id <> ${departmentId}
    `;
    if (conflict)
      throw new AppError("conflict", "Another active department already uses this name.");

    const [department] = await tx<DepartmentRow[]>`
      update departments set archived_at = null where id = ${departmentId} returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.DepartmentRestored,
      resourceType: AuditResourceType.Department,
      resourceId: department.id,
      source: "app",
    });

    return department;
  });
}
