import "server-only";
import { getCurrentMembership } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import type { PermissionRow, RoleRow } from "@/lib/db/database.types";

/**
 * Read-only: system roles are seeded, fixed reference data
 * (product/user-roles.md) — "do not allow destructive editing of system
 * roles." Custom, per-organization roles (roles.organization_id not
 * null) are schema-ready but out of scope for this phase per the task
 * brief ("prepare for custom roles later without exposing unfinished
 * controls") — there is deliberately no createRole/updateRole here yet.
 */

export interface RoleWithUsage {
  role: RoleRow;
  permissions: PermissionRow[];
  memberCount: number;
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

export async function listRoles(): Promise<RoleWithUsage[]> {
  const membership = await getCurrentMembership();

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const roles = await tx<RoleRow[]>`
      select * from roles
      where organization_id is null or organization_id = ${membership.organization.id}
      order by is_system desc, name asc
    `;

    const results: RoleWithUsage[] = [];
    for (const role of roles) {
      const permissions = await tx<PermissionRow[]>`
        select p.* from role_permissions rp
        join permissions p on p.id = rp.permission_id
        where rp.role_id = ${role.id}
        order by p.key asc
      `;
      const [{ count }] = await tx<{ count: string }[]>`
        select count(*) as count from member_role_assignments mra
        join organization_members om on om.id = mra.organization_member_id
        where mra.role_id = ${role.id} and om.organization_id = ${membership.organization.id} and om.status = 'active'
      `;
      results.push({ role, permissions, memberCount: Number(count) });
    }
    return results;
  });
}
