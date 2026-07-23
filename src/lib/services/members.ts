import "server-only";
import { z } from "zod";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { assertRoleAssignable } from "@/lib/services/invitations";
import type { AuditEventRow, OrganizationMemberRow, RoleRow } from "@/lib/db/database.types";

export interface ListMembersFilters {
  search?: string;
  roleKey?: string;
  status?: "active" | "suspended" | "removed" | "all";
  locationId?: string;
  departmentId?: string;
  teamId?: string;
  page?: number;
  pageSize?: number;
}

export interface DirectoryMember {
  id: string;
  profile_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  status: OrganizationMemberRow["status"];
  location_name: string | null;
  department_name: string | null;
  role_names: string[];
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

export async function listMembers(
  filters: ListMembersFilters = {},
): Promise<{ members: DirectoryMember[]; total: number }> {
  const membership = await getCurrentMembership();
  const status = filters.status ?? "active";
  const search = filters.search?.trim() ? `%${filters.search.trim()}%` : null;
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const members = await tx<DirectoryMember[]>`
      select
        om.id, om.profile_id, p.email, p.first_name, p.last_name, om.job_title, om.status,
        l.name as location_name, d.name as department_name,
        coalesce(array_agg(distinct r.name) filter (where r.name is not null), array[]::text[]) as role_names
      from organization_members om
      join profiles p on p.id = om.profile_id
      left join organization_locations l on l.id = om.location_id
      left join departments d on d.id = om.department_id
      left join member_role_assignments mra on mra.organization_member_id = om.id
      left join roles r on r.id = mra.role_id
      left join team_members tm on tm.organization_member_id = om.id
      where om.organization_id = ${membership.organization.id}
        and (${status === "all"} or om.status = ${status})
        and (${search === null} or p.email ilike ${search} or p.first_name ilike ${search} or p.last_name ilike ${search})
        and (${filters.locationId ?? null} is null or om.location_id = ${filters.locationId ?? null})
        and (${filters.departmentId ?? null} is null or om.department_id = ${filters.departmentId ?? null})
        and (${filters.teamId ?? null} is null or tm.team_id = ${filters.teamId ?? null})
        and (${filters.roleKey ?? null} is null or exists (
          select 1 from member_role_assignments mra2
          join roles r2 on r2.id = mra2.role_id
          where mra2.organization_member_id = om.id and r2.key = ${filters.roleKey ?? null}
        ))
      group by om.id, p.email, p.first_name, p.last_name, om.job_title, om.status, l.name, d.name
      order by p.last_name asc nulls last, p.first_name asc nulls last
      limit ${pageSize} offset ${offset}
    `;

    const [{ count }] = await tx<{ count: string }[]>`
      select count(distinct om.id) as count
      from organization_members om
      join profiles p on p.id = om.profile_id
      left join team_members tm on tm.organization_member_id = om.id
      where om.organization_id = ${membership.organization.id}
        and (${status === "all"} or om.status = ${status})
        and (${search === null} or p.email ilike ${search} or p.first_name ilike ${search} or p.last_name ilike ${search})
        and (${filters.locationId ?? null} is null or om.location_id = ${filters.locationId ?? null})
        and (${filters.departmentId ?? null} is null or om.department_id = ${filters.departmentId ?? null})
        and (${filters.teamId ?? null} is null or tm.team_id = ${filters.teamId ?? null})
    `;

    return { members, total: Number(count) };
  });
}

export interface MemberProfile {
  member: OrganizationMemberRow;
  email: string;
  firstName: string | null;
  lastName: string | null;
  locationName: string | null;
  departmentName: string | null;
  managerName: string | null;
  teams: { id: string; name: string }[];
  roles: RoleRow[];
  permissions: string[];
  recentActivity: AuditEventRow[];
}

export async function getMemberProfile(memberId: string): Promise<MemberProfile> {
  const membership = await getCurrentMembership();

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [row] = await tx<
      {
        member: OrganizationMemberRow;
        email: string;
        first_name: string | null;
        last_name: string | null;
        location_name: string | null;
        department_name: string | null;
        manager_first_name: string | null;
        manager_last_name: string | null;
      }[]
    >`
      select
        to_jsonb(om.*) as member, p.email, p.first_name, p.last_name,
        l.name as location_name, d.name as department_name,
        mp.first_name as manager_first_name, mp.last_name as manager_last_name
      from organization_members om
      join profiles p on p.id = om.profile_id
      left join organization_locations l on l.id = om.location_id
      left join departments d on d.id = om.department_id
      left join organization_members mm on mm.id = om.manager_id
      left join profiles mp on mp.id = mm.profile_id
      where om.id = ${memberId} and om.organization_id = ${membership.organization.id}
    `;
    if (!row) throw new AppError("not_found", "Member not found.");

    const teams = await tx<{ id: string; name: string }[]>`
      select t.id, t.name from team_members tm join teams t on t.id = tm.team_id
      where tm.organization_member_id = ${memberId}
    `;

    const roles = await tx<RoleRow[]>`
      select r.* from member_role_assignments mra
      join roles r on r.id = mra.role_id
      where mra.organization_member_id = ${memberId}
      order by r.name asc
    `;

    const permissions = await tx<{ key: string }[]>`
      select distinct p.key from member_role_assignments mra
      join role_permissions rp on rp.role_id = mra.role_id
      join permissions p on p.id = rp.permission_id
      where mra.organization_member_id = ${memberId}
    `;

    const recentActivity = await tx<AuditEventRow[]>`
      select * from audit_events
      where organization_id = ${membership.organization.id}
        and resource_type = ${AuditResourceType.Member}
        and resource_id = ${memberId}
      order by created_at desc
      limit 25
    `;

    return {
      member: row.member,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      locationName: row.location_name,
      departmentName: row.department_name,
      managerName: row.manager_first_name
        ? `${row.manager_first_name} ${row.manager_last_name ?? ""}`.trim()
        : null,
      teams,
      roles,
      permissions: permissions.map((p) => p.key),
      recentActivity,
    };
  });
}

export const memberFieldsInputSchema = z.object({
  jobTitle: z.string().trim().max(200).optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  startDate: z.string().date().optional().nullable(),
});

export type MemberFieldsInput = z.infer<typeof memberFieldsInputSchema>;

export async function updateMemberFields(
  memberId: string,
  input: MemberFieldsInput,
): Promise<OrganizationMemberRow> {
  const data = memberFieldsInputSchema.parse(input);

  // Scope check is bound to the member's *current* department — a manager
  // can only edit members already in a department they own.
  const preCheck = await getCurrentMembership();
  const [target] = await withTenantContext(
    toTenantContext(preCheck),
    (tx) =>
      tx<
        OrganizationMemberRow[]
      >`select * from organization_members where id = ${memberId} and organization_id = ${preCheck.organization.id}`,
  );
  if (!target) throw new AppError("not_found", "Member not found.");

  const membership = await requirePermission("member.manage", {
    scope: { departmentId: target.department_id ?? undefined },
  });

  if (data.managerId === memberId) {
    throw new AppError("conflict", "A member cannot be their own manager.");
  }

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<OrganizationMemberRow[]>`
      update organization_members set
        job_title = ${data.jobTitle === undefined ? target.job_title : data.jobTitle},
        location_id = ${data.locationId === undefined ? target.location_id : data.locationId},
        department_id = ${data.departmentId === undefined ? target.department_id : data.departmentId},
        manager_id = ${data.managerId === undefined ? target.manager_id : data.managerId},
        start_date = ${data.startDate === undefined ? target.start_date : data.startDate}
      where id = ${memberId}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.MemberUpdated,
      resourceType: AuditResourceType.Member,
      resourceId: memberId,
      source: "app",
    });

    return updated;
  });
}

export async function changeMemberRole(memberId: string, roleId: string): Promise<void> {
  const membership = await requirePermission("role.manage");

  if (memberId === membership.member.id) {
    throw new AppError("forbidden", "You cannot change your own role.");
  }

  await withTenantContext(toTenantContext(membership), async (tx) => {
    const [target] = await tx<OrganizationMemberRow[]>`
      select * from organization_members where id = ${memberId} and organization_id = ${membership.organization.id}
    `;
    if (!target) throw new AppError("not_found", "Member not found.");

    const [role] = await tx<RoleRow[]>`
      select * from roles
      where id = ${roleId} and (organization_id is null or organization_id = ${membership.organization.id})
    `;
    if (!role) throw new AppError("not_found", "Role not found.");

    // Same rule invitations.ts enforces for a new invite: only an
    // organization.manage holder may grant organization_owner, and a
    // caller without role.manage may never grant anything above the
    // baseline 'employee' role — no self- or caller-driven escalation.
    await assertRoleAssignable(membership, role);

    // Replaces the member's full role set with the single selected role —
    // "change allowed role" is a one-role-at-a-time admin action. Two
    // independent DB-level guards can reject this delete+insert: the
    // last-owner trigger (removing the org's final organization_owner)
    // and the insert's own WITH CHECK (granting a role whose permissions
    // the caller doesn't hold) — both caught here and rethrown as a
    // friendly conflict rather than a raw Postgres error.
    try {
      await tx`delete from member_role_assignments where organization_member_id = ${memberId}`;
      await tx`
        insert into member_role_assignments (organization_id, organization_member_id, role_id, created_by)
        values (${membership.organization.id}, ${memberId}, ${roleId}, ${membership.profile.id})
      `;
    } catch {
      throw new AppError("conflict", "This role change is not allowed.");
    }

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.MemberRoleChanged,
      resourceType: AuditResourceType.Member,
      resourceId: memberId,
      source: "app",
      metadata: { roleKey: role.key },
    });
  });
}

async function setMemberStatus(
  memberId: string,
  newStatus: "active" | "suspended" | "removed",
  action: string,
  reason?: string,
): Promise<OrganizationMemberRow> {
  const preCheck = await getCurrentMembership();
  const [target] = await withTenantContext(
    toTenantContext(preCheck),
    (tx) =>
      tx<
        OrganizationMemberRow[]
      >`select * from organization_members where id = ${memberId} and organization_id = ${preCheck.organization.id}`,
  );
  if (!target) throw new AppError("not_found", "Member not found.");

  if (memberId === preCheck.member.id && newStatus !== "active") {
    throw new AppError("forbidden", "You cannot suspend or remove your own membership.");
  }

  const membership = await requirePermission("member.manage", {
    scope: { departmentId: target.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    let updated: OrganizationMemberRow;
    try {
      [updated] = await tx<OrganizationMemberRow[]>`
        update organization_members set status = ${newStatus}
        where id = ${memberId}
        returning *
      `;
    } catch {
      throw new AppError("conflict", "Cannot suspend or remove the organization's last owner.");
    }

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action,
      resourceType: AuditResourceType.Member,
      resourceId: memberId,
      source: "app",
      reason: reason ?? null,
    });

    return updated;
  });
}

export function suspendMember(memberId: string, reason?: string) {
  return setMemberStatus(memberId, "suspended", AuditAction.MemberSuspended, reason);
}

export function restoreMember(memberId: string, reason?: string) {
  return setMemberStatus(memberId, "active", AuditAction.MemberRestored, reason);
}

export function removeMember(memberId: string, reason?: string) {
  return setMemberStatus(memberId, "removed", AuditAction.MemberRemoved, reason);
}

/**
 * Assigns organization_owner to `newOwnerMemberId` *before* removing it
 * from the current owner, in the same transaction — the last-owner
 * database trigger sees the new owner already in place by the time the
 * old owner's assignment is deleted, so a legitimate transfer always
 * succeeds while an attempt to drop to zero owners never can.
 */
export async function transferOwnership(newOwnerMemberId: string): Promise<void> {
  const membership = await requirePermission("organization.manage");

  const isCurrentlyOwner = await withTenantContext(toTenantContext(membership), async (tx) => {
    const [ownerRole] = await tx<RoleRow[]>`
      select * from roles where key = 'organization_owner' and organization_id is null
    `;
    if (!ownerRole) throw new AppError("not_found", "Owner role not configured.");

    const [callerIsOwner] = await tx<{ exists: boolean }[]>`
      select exists (
        select 1 from member_role_assignments
        where organization_member_id = ${membership.member.id} and role_id = ${ownerRole.id}
      ) as exists
    `;
    return { ownerRole, callerIsOwner: callerIsOwner.exists };
  });

  if (!isCurrentlyOwner.callerIsOwner) {
    throw new AppError("forbidden", "Only a current owner can transfer ownership.");
  }
  if (newOwnerMemberId === membership.member.id) {
    throw new AppError("conflict", "You already own this organization.");
  }

  await withTenantContext(toTenantContext(membership), async (tx) => {
    const [newOwner] = await tx<OrganizationMemberRow[]>`
      select * from organization_members
      where id = ${newOwnerMemberId} and organization_id = ${membership.organization.id} and status = 'active'
    `;
    if (!newOwner) throw new AppError("not_found", "Target member not found or not active.");

    const ownerRoleId = isCurrentlyOwner.ownerRole.id;

    await tx`
      insert into member_role_assignments (organization_id, organization_member_id, role_id, created_by)
      values (${membership.organization.id}, ${newOwnerMemberId}, ${ownerRoleId}, ${membership.profile.id})
      on conflict (organization_member_id, role_id) do nothing
    `;
    await tx`
      delete from member_role_assignments
      where organization_member_id = ${membership.member.id} and role_id = ${ownerRoleId}
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.OwnershipTransferred,
      resourceType: AuditResourceType.Organization,
      resourceId: membership.organization.id,
      source: "app",
      metadata: { newOwnerMemberId },
    });
  });
}
