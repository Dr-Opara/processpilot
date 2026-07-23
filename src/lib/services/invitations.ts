import "server-only";
import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { CurrentMembership } from "@/lib/authz";
import type { OrganizationInvitationRow, RoleRow } from "@/lib/db/database.types";

/**
 * Invitation delivery rides on Clerk's own organization-invitation email
 * (already configured, already delivering real mail for this project) —
 * ProcessPilot doesn't have its own transactional-email provider wired up
 * yet (see docs/development/environment-variables.md's EMAIL_PROVIDER_API_KEY
 * row, still "future"), so this is the one invitation channel that
 * actually sends something today. Clerk's own org role
 * (admin/member — a coarse, cosmetic distinction Clerk needs for its own
 * UI) is NOT ProcessPilot's authorization model; the invited person's
 * real permissions come entirely from role_id/organization_invitations,
 * applied to member_role_assignments on acceptance (see the webhook
 * route). "resend" has no literal Clerk API — it revokes the existing
 * Clerk invitation (if still pending) and creates a fresh one.
 */
function clerkRoleFor(roleKey: string): string {
  return roleKey === "organization_owner" || roleKey === "organization_admin"
    ? "org:admin"
    : "org:member";
}

export const invitationInputSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  roleId: z.string().uuid(),
  locationId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  personalMessage: z.string().trim().max(1000).optional().nullable(),
});

export type InvitationInput = z.infer<typeof invitationInputSchema>;

export interface InvitationResult {
  email: string;
  status: "created" | "failed";
  error?: string;
  invitation?: OrganizationInvitationRow;
}

function toTenantContext(membership: CurrentMembership) {
  return {
    organizationId: membership.organization.id,
    memberId: membership.member.id,
    clerkUserId: membership.profile.clerk_user_id,
  };
}

/**
 * Enforces "prevent unauthorized role elevation" / "assigning
 * organization_owner without owner authority": a caller without
 * role.manage (e.g. a manager, who only ever holds member.invite scoped —
 * product/permissions-matrix.md never grants manager role.manage at all)
 * may only invite at the org's baseline 'employee' role. Even a
 * role.manage holder (organization_admin) cannot assign the
 * organization_owner role unless they hold organization.manage, which
 * only organization_owner itself grants.
 */
export async function assertRoleAssignable(
  membership: CurrentMembership,
  role: RoleRow,
): Promise<void> {
  if (
    role.key === "organization_owner" &&
    !membership.permissions.includes("organization.manage")
  ) {
    throw new AppError("forbidden", "Only an organization owner can invite a new owner.");
  }
  if (!membership.permissions.includes("role.manage") && role.key !== "employee") {
    throw new AppError("forbidden", "You do not have permission to assign this role.");
  }
}

export async function createInvitation(input: InvitationInput): Promise<OrganizationInvitationRow> {
  const data = invitationInputSchema.parse(input);
  const membership = await requirePermission("member.invite", {
    scope: { departmentId: data.departmentId ?? undefined },
  });

  if (data.email === membership.profile.email.toLowerCase()) {
    throw new AppError("conflict", "You cannot invite yourself.");
  }

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [role] = await tx<RoleRow[]>`
      select * from roles
      where id = ${data.roleId} and (organization_id is null or organization_id = ${membership.organization.id})
    `;
    if (!role) throw new AppError("not_found", "Role not found.");
    await assertRoleAssignable(membership, role);

    const [existingMember] = await tx<{ id: string }[]>`
      select om.id from organization_members om
      join profiles p on p.id = om.profile_id
      where om.organization_id = ${membership.organization.id}
        and lower(p.email) = ${data.email}
        and om.status <> 'removed'
    `;
    if (existingMember) throw new AppError("conflict", "This person is already a member.");

    const [existingInvitation] = await tx<{ id: string }[]>`
      select id from organization_invitations
      where organization_id = ${membership.organization.id}
        and lower(email) = ${data.email}
        and status = 'pending'
    `;
    if (existingInvitation)
      throw new AppError("conflict", "An active invitation already exists for this email.");

    let clerkInvitationId: string | null = null;
    try {
      const client = await clerkClient();
      const clerkInvitation = await client.organizations.createOrganizationInvitation({
        organizationId: membership.organization.clerk_org_id,
        emailAddress: data.email,
        role: clerkRoleFor(role.key),
        inviterUserId: membership.profile.clerk_user_id,
      });
      clerkInvitationId = clerkInvitation.id;
    } catch (error) {
      console.error("Failed to create Clerk organization invitation", error);
      throw new AppError("conflict", "Could not send the invitation email. Please try again.");
    }

    const [invitation] = await tx<OrganizationInvitationRow[]>`
      insert into organization_invitations (
        organization_id, clerk_invitation_id, email, role_id, location_id, department_id, team_id,
        personal_message, invited_by, expires_at
      ) values (
        ${membership.organization.id}, ${clerkInvitationId}, ${data.email}, ${role.id},
        ${data.locationId ?? null}, ${data.departmentId ?? null}, ${data.teamId ?? null},
        ${data.personalMessage ?? null}, ${membership.profile.id}, now() + interval '30 days'
      )
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.InvitationCreated,
      resourceType: AuditResourceType.Invitation,
      resourceId: invitation.id,
      source: "app",
      metadata: { roleKey: role.key },
    });

    return invitation;
  });
}

/** Invites multiple employees in one call, reporting per-row success/failure so a bad row never blocks the good ones — the same behavior the CSV import flow needs. */
export async function createInvitations(inputs: InvitationInput[]): Promise<InvitationResult[]> {
  const results: InvitationResult[] = [];
  for (const input of inputs) {
    try {
      const invitation = await createInvitation(input);
      results.push({ email: input.email, status: "created", invitation });
    } catch (error) {
      results.push({
        email: input.email,
        status: "failed",
        error: error instanceof AppError ? error.message : "Could not create this invitation.",
      });
    }
  }
  return results;
}

export interface ListInvitationsFilters {
  status?: "pending" | "accepted" | "revoked" | "expired" | "all";
}

export async function listInvitations(
  filters: ListInvitationsFilters = {},
): Promise<OrganizationInvitationRow[]> {
  const membership = await getCurrentMembership();
  if (
    !membership.permissions.includes("member.invite") &&
    !membership.scopedPermissions.includes("member.invite")
  ) {
    throw new AppError("forbidden", "Missing permission: member.invite");
  }
  const status = filters.status ?? "pending";

  return withTenantContext(toTenantContext(membership), async (tx) => {
    return tx<OrganizationInvitationRow[]>`
      select * from organization_invitations
      where organization_id = ${membership.organization.id}
        and (${status === "all"} or status = ${status})
      order by created_at desc
    `;
  });
}

async function getOwnInvitation(
  membership: CurrentMembership,
  invitationId: string,
): Promise<OrganizationInvitationRow> {
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [invitation] = await tx<OrganizationInvitationRow[]>`
      select * from organization_invitations where id = ${invitationId} and organization_id = ${membership.organization.id}
    `;
    if (!invitation) throw new AppError("not_found", "Invitation not found.");
    return invitation;
  });
}

export async function resendInvitation(invitationId: string): Promise<OrganizationInvitationRow> {
  const preCheck = await getCurrentMembership();
  const existing = await getOwnInvitation(preCheck, invitationId);
  const membership = await requirePermission("member.invite", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  if (existing.status !== "pending") {
    throw new AppError("conflict", "Only a pending invitation can be resent.");
  }

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [role] = await tx<RoleRow[]>`select * from roles where id = ${existing.role_id}`;

    const client = await clerkClient();
    if (existing.clerk_invitation_id) {
      try {
        await client.organizations.revokeOrganizationInvitation({
          organizationId: membership.organization.clerk_org_id,
          invitationId: existing.clerk_invitation_id,
          requestingUserId: membership.profile.clerk_user_id,
        });
      } catch (error) {
        console.error("Failed to revoke prior Clerk invitation before resend", error);
      }
    }

    let clerkInvitationId: string | null = null;
    try {
      const clerkInvitation = await client.organizations.createOrganizationInvitation({
        organizationId: membership.organization.clerk_org_id,
        emailAddress: existing.email,
        role: clerkRoleFor(role?.key ?? "employee"),
        inviterUserId: membership.profile.clerk_user_id,
      });
      clerkInvitationId = clerkInvitation.id;
    } catch (error) {
      console.error("Failed to create Clerk organization invitation on resend", error);
      throw new AppError("conflict", "Could not resend the invitation email. Please try again.");
    }

    const [invitation] = await tx<OrganizationInvitationRow[]>`
      update organization_invitations set
        clerk_invitation_id = ${clerkInvitationId},
        expires_at = now() + interval '30 days'
      where id = ${invitationId}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.InvitationResent,
      resourceType: AuditResourceType.Invitation,
      resourceId: invitation.id,
      source: "app",
    });

    return invitation;
  });
}

export async function revokeInvitation(invitationId: string): Promise<OrganizationInvitationRow> {
  const preCheck = await getCurrentMembership();
  const existing = await getOwnInvitation(preCheck, invitationId);
  const membership = await requirePermission("member.invite", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  if (existing.status !== "pending") {
    throw new AppError("conflict", "Only a pending invitation can be revoked.");
  }

  return withTenantContext(toTenantContext(membership), async (tx) => {
    if (existing.clerk_invitation_id) {
      try {
        const client = await clerkClient();
        await client.organizations.revokeOrganizationInvitation({
          organizationId: membership.organization.clerk_org_id,
          invitationId: existing.clerk_invitation_id,
          requestingUserId: membership.profile.clerk_user_id,
        });
      } catch (error) {
        console.error("Failed to revoke Clerk invitation", error);
      }
    }

    const [invitation] = await tx<OrganizationInvitationRow[]>`
      update organization_invitations set status = 'revoked' where id = ${invitationId} returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.InvitationRevoked,
      resourceType: AuditResourceType.Invitation,
      resourceId: invitation.id,
      source: "app",
    });

    return invitation;
  });
}
