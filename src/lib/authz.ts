import "server-only";
import type postgres from "postgres";
import { requireAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getAdminSql } from "@/lib/db/client-admin";
import type { OrganizationMemberRow, OrganizationRow, ProfileRow } from "@/lib/db/database.types";

/**
 * Server-side authorization services built on top of Phase 3's
 * requireAuth() (session verification only) and Phase 4's schema. These
 * resolve *who* the caller is in ProcessPilot's own terms and *what*
 * they're allowed to do — the permissions-matrix.md enforcement layer
 * that authentication-and-authorization.md described as "Phase 4+ work."
 *
 * getCurrentProfile/getCurrentMembership deliberately use the admin
 * (service-role) client, not withTenantContext() — resolving "who is
 * this caller" is the one lookup that necessarily happens *before* a
 * tenant context can be constructed at all (constructing it is what
 * these functions exist to do). Every filter below is scoped to the
 * caller's own verified Clerk identity (session.userId / session.orgId)
 * from requireAuth(), never a client-supplied value, per multi-tenancy.md
 * principle 3 and principle 5's "narrow, self-scoped" allowance for
 * admin-client use.
 */

export interface CurrentMembership {
  profile: ProfileRow;
  organization: OrganizationRow;
  member: OrganizationMemberRow;
  /** Unscoped ("✓") permissions only — see tenant-context.ts's TenantContext doc comment. */
  permissions: string[];
  /**
   * Permissions held only as a "Scoped" grant (product/permissions-matrix.md)
   * — e.g. a manager's department.manage. Membership in this list means
   * the caller *may* hold department/location/team-scoped access to
   * `permission`, not that they hold it for any specific resource; call
   * requirePermission(permission, { scope }) to check a specific resource.
   */
  scopedPermissions: string[];
  /** Keys of every role this member holds — nav/UI rendering only (e.g. detecting `external_user`); never authoritative for access control. */
  roleKeys: string[];
}

export async function getCurrentProfile(): Promise<ProfileRow> {
  const session = await requireAuth();
  const sql = getAdminSql();

  const [profile] = await sql<ProfileRow[]>`
    select * from profiles where clerk_user_id = ${session.userId} and deleted_at is null
  `;

  if (!profile) {
    throw new AppError("not_found", "No ProcessPilot profile exists for this account yet.");
  }

  return profile;
}

export async function getCurrentOrganization(): Promise<OrganizationRow> {
  const session = await requireAuth();
  if (!session.orgId) {
    throw new AppError("forbidden", "No active organization selected.");
  }

  const sql = getAdminSql();
  const [organization] = await sql<OrganizationRow[]>`
    select * from organizations where clerk_org_id = ${session.orgId} and archived_at is null
  `;

  if (!organization) {
    throw new AppError("not_found", "No ProcessPilot organization exists for this account yet.");
  }

  return organization;
}

export async function getCurrentMembership(): Promise<CurrentMembership> {
  const profile = await getCurrentProfile();
  const organization = await getCurrentOrganization();
  const sql = getAdminSql();

  const [member] = await sql<OrganizationMemberRow[]>`
    select * from organization_members
    where organization_id = ${organization.id}
      and profile_id = ${profile.id}
      and status = 'active'
  `;

  if (!member) {
    throw new AppError("forbidden", "Membership is not active in this organization.");
  }

  const [permissions, scopedPermissions, roleKeyRows] = await Promise.all([
    resolvePermissions(sql, member.id, "unscoped"),
    resolvePermissions(sql, member.id, "scoped"),
    sql<{ key: string }[]>`
      select distinct r.key
      from member_role_assignments mra
      join roles r on r.id = mra.role_id
      where mra.organization_member_id = ${member.id}
    `,
  ]);

  return {
    profile,
    organization,
    member,
    permissions,
    scopedPermissions,
    roleKeys: roleKeyRows.map((row) => row.key),
  };
}

async function resolvePermissions(
  sql: postgres.Sql,
  organizationMemberId: string,
  kind: "unscoped" | "scoped",
): Promise<string[]> {
  const rows =
    kind === "unscoped"
      ? await sql<{ key: string }[]>`
          select distinct p.key
          from member_role_assignments mra
          join role_permissions rp on rp.role_id = mra.role_id
          join permissions p on p.id = rp.permission_id
          where mra.organization_member_id = ${organizationMemberId}
            and rp.scope is null
        `
      : await sql<{ key: string }[]>`
          select distinct p.key
          from member_role_assignments mra
          join role_permissions rp on rp.role_id = mra.role_id
          join permissions p on p.id = rp.permission_id
          where mra.organization_member_id = ${organizationMemberId}
            and rp.scope is not null
        `;
  return rows.map((row) => row.key);
}

export interface PermissionScope {
  departmentId?: string;
  locationId?: string;
  teamId?: string;
}

export interface RequirePermissionOptions {
  /**
   * Department/location/team narrowing for a "Scoped" grant
   * (product/permissions-matrix.md) — e.g. a manager passes
   * `{ departmentId }` to prove they own the specific department a
   * member.manage/department.manage/team.manage action targets. Omit
   * entirely for organization-wide (unscoped-only) checks.
   */
  scope?: PermissionScope;
}

async function ownsScope(
  sql: postgres.Sql,
  organizationMemberId: string,
  scope: PermissionScope,
): Promise<boolean> {
  if (scope.departmentId) {
    const [row] = await sql<{ id: string }[]>`
      select id from departments where id = ${scope.departmentId} and owner_member_id = ${organizationMemberId}
    `;
    if (row) return true;
  }
  if (scope.locationId) {
    const [row] = await sql<{ id: string }[]>`
      select id from organization_locations where id = ${scope.locationId} and manager_member_id = ${organizationMemberId}
    `;
    if (row) return true;
  }
  if (scope.teamId) {
    const [row] = await sql<{ id: string }[]>`
      select id from teams where id = ${scope.teamId} and manager_member_id = ${organizationMemberId}
    `;
    if (row) return true;
  }
  return false;
}

/**
 * The one function every route/action/server component calls before
 * touching a protected resource, per
 * docs/architecture/authentication-and-authorization.md's non-negotiable
 * rule 1. Throws AppError("forbidden") if the caller's active
 * organization membership doesn't hold `permission` — either unscoped, or
 * scoped to the specific department/location/team passed via `scope`
 * (the caller must actually own/manage that resource, re-verified against
 * the database here, never trusted from the caller's own claim).
 */
export async function requirePermission(
  permission: string,
  options?: RequirePermissionOptions,
): Promise<CurrentMembership> {
  const membership = await getCurrentMembership();

  if (membership.permissions.includes(permission)) {
    return membership;
  }

  if (options?.scope && membership.scopedPermissions.includes(permission)) {
    const sql = getAdminSql();
    if (await ownsScope(sql, membership.member.id, options.scope)) {
      return membership;
    }
  }

  throw new AppError("forbidden", `Missing permission: ${permission}`);
}
