import "server-only";
import { z } from "zod";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { TeamRow } from "@/lib/db/database.types";

export const teamInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  departmentId: z.string().uuid().optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
  managerMemberId: z.string().uuid().optional().nullable(),
});

export type TeamInput = z.infer<typeof teamInputSchema>;

export interface ListTeamsFilters {
  search?: string;
  status?: "active" | "archived" | "all";
  departmentId?: string;
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

export async function listTeams(filters: ListTeamsFilters = {}): Promise<TeamRow[]> {
  const membership = await getCurrentMembership();
  const status = filters.status ?? "active";
  const search = filters.search?.trim() ? `%${filters.search.trim()}%` : null;

  return withTenantContext(toTenantContext(membership), async (tx) => {
    return tx<TeamRow[]>`
      select * from teams
      where organization_id = ${membership.organization.id}
        and (${status === "all"} or archived_at is ${status === "archived" ? tx`not null` : tx`null`})
        and (${filters.departmentId ?? null} is null or department_id = ${filters.departmentId ?? null})
        and (${filters.locationId ?? null} is null or location_id = ${filters.locationId ?? null})
        and (${search === null} or name ilike ${search})
      order by name asc
    `;
  });
}

export async function getTeam(teamId: string): Promise<TeamRow> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [team] = await tx<TeamRow[]>`
      select * from teams where id = ${teamId} and organization_id = ${membership.organization.id}
    `;
    if (!team) throw new AppError("not_found", "Team not found.");
    return team;
  });
}

export async function createTeam(input: TeamInput): Promise<TeamRow> {
  const data = teamInputSchema.parse(input);
  const membership = await requirePermission("team.manage");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [existing] = await tx<{ id: string }[]>`
      select id from teams
      where organization_id = ${membership.organization.id}
        and lower(name) = lower(${data.name})
        and archived_at is null
    `;
    if (existing) throw new AppError("conflict", "A team with this name already exists.");

    const [team] = await tx<TeamRow[]>`
      insert into teams (organization_id, name, department_id, location_id, manager_member_id, created_by)
      values (
        ${membership.organization.id}, ${data.name}, ${data.departmentId ?? null},
        ${data.locationId ?? null}, ${data.managerMemberId ?? null}, ${membership.profile.id}
      )
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TeamCreated,
      resourceType: AuditResourceType.Team,
      resourceId: team.id,
      source: "app",
    });

    return team;
  });
}

export async function updateTeam(teamId: string, input: Partial<TeamInput>): Promise<TeamRow> {
  const data = teamInputSchema.partial().parse(input);
  const membership = await requirePermission("team.manage", { scope: { teamId } });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [existing] = await tx<TeamRow[]>`
      select * from teams where id = ${teamId} and organization_id = ${membership.organization.id}
    `;
    if (!existing) throw new AppError("not_found", "Team not found.");

    const [team] = await tx<TeamRow[]>`
      update teams set
        name = ${data.name ?? existing.name},
        department_id = ${data.departmentId === undefined ? existing.department_id : data.departmentId},
        location_id = ${data.locationId === undefined ? existing.location_id : data.locationId},
        manager_member_id = ${
          data.managerMemberId === undefined ? existing.manager_member_id : data.managerMemberId
        }
      where id = ${teamId}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TeamUpdated,
      resourceType: AuditResourceType.Team,
      resourceId: team.id,
      source: "app",
    });

    return team;
  });
}

export async function archiveTeam(teamId: string): Promise<TeamRow> {
  const membership = await requirePermission("team.manage", { scope: { teamId } });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [team] = await tx<TeamRow[]>`
      update teams set archived_at = now()
      where id = ${teamId} and organization_id = ${membership.organization.id} and archived_at is null
      returning *
    `;
    if (!team) throw new AppError("not_found", "Team not found or already archived.");

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TeamArchived,
      resourceType: AuditResourceType.Team,
      resourceId: team.id,
      source: "app",
    });

    return team;
  });
}

export async function restoreTeam(teamId: string): Promise<TeamRow> {
  const membership = await requirePermission("team.manage", { scope: { teamId } });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [target] = await tx<TeamRow[]>`
      select * from teams where id = ${teamId} and organization_id = ${membership.organization.id}
    `;
    if (!target || !target.archived_at)
      throw new AppError("not_found", "Team not found or not archived.");

    const [conflict] = await tx<{ id: string }[]>`
      select id from teams
      where organization_id = ${membership.organization.id}
        and lower(name) = lower(${target.name})
        and archived_at is null
        and id <> ${teamId}
    `;
    if (conflict) throw new AppError("conflict", "Another active team already uses this name.");

    const [team] = await tx<TeamRow[]>`
      update teams set archived_at = null where id = ${teamId} returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TeamRestored,
      resourceType: AuditResourceType.Team,
      resourceId: team.id,
      source: "app",
    });

    return team;
  });
}

export async function setTeamMembers(teamId: string, memberIds: string[]): Promise<void> {
  const membership = await requirePermission("team.manage", { scope: { teamId } });

  await withTenantContext(toTenantContext(membership), async (tx) => {
    const [team] = await tx<TeamRow[]>`
      select * from teams where id = ${teamId} and organization_id = ${membership.organization.id}
    `;
    if (!team) throw new AppError("not_found", "Team not found.");

    await tx`delete from team_members where team_id = ${teamId}`;
    for (const memberId of memberIds) {
      await tx`
        insert into team_members (organization_id, team_id, organization_member_id, created_by)
        values (${membership.organization.id}, ${teamId}, ${memberId}, ${membership.profile.id})
      `;
    }

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TeamUpdated,
      resourceType: AuditResourceType.Team,
      resourceId: teamId,
      source: "app",
      metadata: { memberCount: memberIds.length },
    });
  });
}
