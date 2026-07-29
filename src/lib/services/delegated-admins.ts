import "server-only";
import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import type { CurrentMembership } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { OrganizationMemberRow, RoleRow } from "@/lib/db/database.types";

/**
 * A "delegated administrator" is a member granted a role scoped to one
 * department, location, or team, combined with being recorded as that
 * resource's owner/manager (departments.owner_member_id /
 * organization_locations.manager_member_id / teams.manager_member_id) —
 * the same scope source has_scoped_permission() already reads
 * (20260719140001). Delegation doesn't introduce a new grant mechanism;
 * it wraps the two existing ones (assign role + record ownership) behind
 * one action with one audit event, and — critically — relies on the
 * already-enforced member_role_assignments RLS self-escalation check
 * (the caller can only assign a role whose permissions they already
 * hold) rather than adding a parallel check here.
 */

function toTenantContext(membership: CurrentMembership) {
  return {
    organizationId: membership.organization.id,
    memberId: membership.member.id,
    clerkUserId: membership.profile.clerk_user_id,
  };
}

export const delegateAdministratorInputSchema = z
  .object({
    memberId: z.string().uuid(),
    roleId: z.string().uuid(),
    departmentId: z.string().uuid().optional().nullable(),
    locationId: z.string().uuid().optional().nullable(),
    teamId: z.string().uuid().optional().nullable(),
  })
  .refine((v) => Boolean(v.departmentId || v.locationId || v.teamId), {
    message: "Select a department, location, or team to delegate administration over.",
  });

export type DelegateAdministratorInput = z.infer<typeof delegateAdministratorInputSchema>;

export async function delegateAdministrator(input: DelegateAdministratorInput): Promise<void> {
  const data = delegateAdministratorInputSchema.parse(input);
  const membership = await requirePermission("role.manage");

  if (data.memberId === membership.member.id) {
    throw new AppError("forbidden", "You cannot delegate administration to yourself.");
  }

  await withTenantContext(toTenantContext(membership), async (tx) => {
    const [target] = await tx<OrganizationMemberRow[]>`
      select * from organization_members
      where id = ${data.memberId} and organization_id = ${membership.organization.id} and status = 'active'
    `;
    if (!target) throw new AppError("not_found", "Member not found or not active.");

    const [role] = await tx<RoleRow[]>`
      select * from roles
      where id = ${data.roleId} and (organization_id is null or organization_id = ${membership.organization.id})
    `;
    if (!role) throw new AppError("not_found", "Role not found.");

    if (data.departmentId) {
      const [department] = await tx<{ id: string }[]>`
        update departments set owner_member_id = ${data.memberId}
        where id = ${data.departmentId} and organization_id = ${membership.organization.id}
        returning id
      `;
      if (!department) throw new AppError("not_found", "Department not found.");
    }
    if (data.locationId) {
      const [location] = await tx<{ id: string }[]>`
        update organization_locations set manager_member_id = ${data.memberId}
        where id = ${data.locationId} and organization_id = ${membership.organization.id}
        returning id
      `;
      if (!location) throw new AppError("not_found", "Location not found.");
    }
    if (data.teamId) {
      const [team] = await tx<{ id: string }[]>`
        update teams set manager_member_id = ${data.memberId}
        where id = ${data.teamId} and organization_id = ${membership.organization.id}
        returning id
      `;
      if (!team) throw new AppError("not_found", "Team not found.");
    }

    try {
      await tx`
        insert into member_role_assignments (organization_id, organization_member_id, role_id, created_by)
        values (${membership.organization.id}, ${data.memberId}, ${data.roleId}, ${membership.profile.id})
        on conflict (organization_member_id, role_id) do nothing
      `;
    } catch {
      throw new AppError(
        "forbidden",
        "You cannot delegate a role that grants permissions you don't currently hold.",
      );
    }

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.DelegatedAdminAssigned,
      resourceType: AuditResourceType.Member,
      resourceId: data.memberId,
      source: "app",
      metadata: {
        roleKey: role.key,
        departmentId: data.departmentId ?? null,
        locationId: data.locationId ?? null,
        teamId: data.teamId ?? null,
      },
    });
  });
}
