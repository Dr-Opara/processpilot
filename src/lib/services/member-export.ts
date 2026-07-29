import "server-only";
import { getCurrentMembership } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { writeCsv, sanitizeCsvCell } from "@/lib/services/csv";
import type { DirectoryMember } from "@/lib/services/members";

const EXPORT_HEADERS = [
  "First name",
  "Last name",
  "Work email",
  "Job title",
  "Status",
  "Location",
  "Department",
  "Roles",
] as const;

/**
 * Bulk export — the read-side complement to member-import.ts. Queries
 * the full roster directly rather than reusing listMembers(), whose
 * pageSize is capped at 100 for the paginated directory view; an export
 * has no such cap. Any active member can read the roster
 * (organization_members_select has no permission gate), matching
 * listMembers()'s own posture.
 */
export async function exportMembers(): Promise<string> {
  const membership = await getCurrentMembership();

  const members = await withTenantContext(
    {
      organizationId: membership.organization.id,
      memberId: membership.member.id,
      clerkUserId: membership.profile.clerk_user_id,
    },
    async (tx) => {
      const rows = await tx<DirectoryMember[]>`
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
        where om.organization_id = ${membership.organization.id}
          and not exists (
            select 1 from member_role_assignments mra2
            join roles r2 on r2.id = mra2.role_id
            where mra2.organization_member_id = om.id and r2.key = 'external_user'
          )
        group by om.id, p.email, p.first_name, p.last_name, om.job_title, om.status, l.name, d.name
        order by p.last_name asc nulls last, p.first_name asc nulls last
      `;

      await recordAuditEvent(tx, {
        organizationId: membership.organization.id,
        actorProfileId: membership.profile.id,
        action: AuditAction.MembersExported,
        resourceType: AuditResourceType.Member,
        resourceId: null,
        source: "app",
        metadata: { count: rows.length },
      });

      return rows;
    },
  );

  const csvRows = members.map((member) => [
    sanitizeCsvCell(member.first_name ?? ""),
    sanitizeCsvCell(member.last_name ?? ""),
    sanitizeCsvCell(member.email),
    sanitizeCsvCell(member.job_title ?? ""),
    sanitizeCsvCell(member.status),
    sanitizeCsvCell(member.location_name ?? ""),
    sanitizeCsvCell(member.department_name ?? ""),
    sanitizeCsvCell(member.role_names.join("; ")),
  ]);

  return writeCsv([...EXPORT_HEADERS], csvRows);
}
