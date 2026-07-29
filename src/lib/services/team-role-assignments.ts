import "server-only";
import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import type { CurrentMembership } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type {
  RoleRow,
  TeamMemberRow,
  TeamRoleAssignmentRow,
  TeamRow,
} from "@/lib/db/database.types";

/**
 * Group-based access management, using the existing Team as the
 * "group" (product/terminology.md — a distinct "Group" concept would
 * duplicate Team, which already models a shared-purpose membership
 * unit). Attaching a role to a team fans that role out to every member
 * currently on the team, in one transaction.
 *
 * Known gap: this fan-out runs at assignment time only, not on every
 * later team_members change — a member added to the team afterward does
 * not automatically pick up the team's roles until an admin re-runs
 * syncTeamRoleAssignments(). See docs/architecture/organization-administration.md.
 */

function toTenantContext(membership: CurrentMembership) {
  return {
    organizationId: membership.organization.id,
    memberId: membership.member.id,
    clerkUserId: membership.profile.clerk_user_id,
  };
}

export const assignTeamRoleInputSchema = z.object({
  teamId: z.string().uuid(),
  roleId: z.string().uuid(),
});
export type AssignTeamRoleInput = z.infer<typeof assignTeamRoleInputSchema>;

export interface TeamRoleAssignmentWithRole {
  assignment: TeamRoleAssignmentRow;
  role: RoleRow;
}

export async function listTeamRoleAssignments(
  teamId: string,
): Promise<TeamRoleAssignmentWithRole[]> {
  const membership = await requirePermission("role.manage");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const rows = await tx<(TeamRoleAssignmentRow & { role: RoleRow })[]>`
      select tra.*, to_jsonb(r.*) as role
      from team_role_assignments tra
      join roles r on r.id = tra.role_id
      where tra.organization_id = ${membership.organization.id} and tra.team_id = ${teamId}
      order by r.name asc
    `;
    return rows.map(({ role, ...assignment }) => ({ assignment, role }));
  });
}

/** Attaches `roleId` to `teamId` and grants it to every current team member. */
export async function assignRoleToTeam(input: AssignTeamRoleInput): Promise<TeamRoleAssignmentRow> {
  const data = assignTeamRoleInputSchema.parse(input);
  const membership = await requirePermission("role.manage");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [team] = await tx<TeamRow[]>`
      select * from teams where id = ${data.teamId} and organization_id = ${membership.organization.id}
    `;
    if (!team) throw new AppError("not_found", "Team not found.");

    const [role] = await tx<RoleRow[]>`
      select * from roles
      where id = ${data.roleId} and (organization_id is null or organization_id = ${membership.organization.id})
    `;
    if (!role) throw new AppError("not_found", "Role not found.");

    // Same self-escalation bound as member_role_assignments/role_permissions:
    // the caller can only attach a role that grants permissions they already
    // hold. The insert below would be rejected by RLS anyway (defense in
    // depth); this check exists to fail with a clear message before that.
    const [heldMismatch] = await tx<{ key: string }[]>`
      select p.key from role_permissions rp
      join permissions p on p.id = rp.permission_id
      where rp.role_id = ${data.roleId} and not (p.key = any(${membership.permissions}))
      limit 1
    `;
    if (heldMismatch) {
      throw new AppError(
        "forbidden",
        "You cannot attach a role that grants permissions you don't currently hold.",
      );
    }

    let assignment: TeamRoleAssignmentRow;
    try {
      [assignment] = await tx<TeamRoleAssignmentRow[]>`
        insert into team_role_assignments (organization_id, team_id, role_id, created_by)
        values (${membership.organization.id}, ${data.teamId}, ${data.roleId}, ${membership.profile.id})
        returning *
      `;
    } catch {
      throw new AppError("conflict", "This role is already attached to this team.");
    }

    const teamMembers = await tx<TeamMemberRow[]>`
      select * from team_members where team_id = ${data.teamId}
    `;
    for (const teamMember of teamMembers) {
      await tx`
        insert into member_role_assignments (organization_id, organization_member_id, role_id, created_by)
        values (
          ${membership.organization.id}, ${teamMember.organization_member_id}, ${data.roleId},
          ${membership.profile.id}
        )
        on conflict (organization_member_id, role_id) do nothing
      `;
    }

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TeamRoleAssigned,
      resourceType: AuditResourceType.TeamRoleAssignment,
      resourceId: assignment.id,
      source: "app",
      metadata: { teamId: data.teamId, roleId: data.roleId, memberCount: teamMembers.length },
    });

    return assignment;
  });
}

/**
 * Re-applies a team's currently-attached roles to every current member —
 * closes the "member added after the initial assignment" gap on demand.
 */
export async function syncTeamRoleAssignments(teamId: string): Promise<{ granted: number }> {
  const membership = await requirePermission("role.manage");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [team] = await tx<TeamRow[]>`
      select * from teams where id = ${teamId} and organization_id = ${membership.organization.id}
    `;
    if (!team) throw new AppError("not_found", "Team not found.");

    const roleIds = await tx<{ role_id: string }[]>`
      select role_id from team_role_assignments
      where organization_id = ${membership.organization.id} and team_id = ${teamId}
    `;
    const teamMembers = await tx<TeamMemberRow[]>`
      select * from team_members where team_id = ${teamId}
    `;

    let granted = 0;
    for (const { role_id: roleId } of roleIds) {
      for (const teamMember of teamMembers) {
        const [inserted] = await tx<{ id: string }[]>`
          insert into member_role_assignments (organization_id, organization_member_id, role_id, created_by)
          values (
            ${membership.organization.id}, ${teamMember.organization_member_id}, ${roleId},
            ${membership.profile.id}
          )
          on conflict (organization_member_id, role_id) do nothing
          returning id
        `;
        if (inserted) granted += 1;
      }
    }

    return { granted };
  });
}

export async function unassignRoleFromTeam(teamId: string, roleId: string): Promise<void> {
  const membership = await requirePermission("role.manage");

  await withTenantContext(toTenantContext(membership), async (tx) => {
    const [deleted] = await tx<{ id: string }[]>`
      delete from team_role_assignments
      where organization_id = ${membership.organization.id} and team_id = ${teamId} and role_id = ${roleId}
      returning id
    `;
    if (!deleted) throw new AppError("not_found", "Team role assignment not found.");

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TeamRoleUnassigned,
      resourceType: AuditResourceType.TeamRoleAssignment,
      resourceId: deleted.id,
      source: "app",
      metadata: { teamId, roleId },
    });
  });
}
