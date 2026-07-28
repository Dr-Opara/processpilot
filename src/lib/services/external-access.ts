import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import type postgres from "postgres";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { getAdminSql } from "@/lib/db/client-admin";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { ExternalAccessGrantRow, TaskRow } from "@/lib/db/database.types";

/**
 * Resource-scoped access for the `external_user` role
 * (product/user-roles.md) — see
 * docs/architecture/external-portal.md. An invite ties exactly one
 * Clerk-based `organization_invitations` row to exactly one task via
 * `external_access_grants`; on acceptance,
 * src/lib/db/identity-sync.ts's `applyPendingInvitation()` already
 * assigns the `external_user` role (an ordinary invitation-role
 * assignment, nothing new), and this module's
 * `activateExternalAccessGrant()` (called right after it) additionally
 * makes the new member that task's assignee — the one extra step this
 * role needs beyond a normal invitation.
 *
 * Deliberately bypasses invitations.ts's createInvitation()/
 * assertRoleAssignable() (which requires role.manage to assign any
 * non-employee role): the caller here needs only workflow.assign — the
 * permission whose own seeded description is literally "assign a
 * workflow or its tasks to... external users" — and the assigned role
 * is always hardcoded to `external_user`, never caller-chosen, so
 * assertRoleAssignable's general role-selection guard doesn't apply.
 *
 * Not seat-gated: product/pricing-hypotheses.md's own open questions
 * explicitly flag "does external_user access consume a seat" as
 * unresolved — requireSeatAvailable() is deliberately not called here
 * until that's decided, rather than guessing.
 */

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

export const inviteExternalUserInputSchema = z.object({
  taskId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});
export type InviteExternalUserInput = z.infer<typeof inviteExternalUserInputSchema>;

export async function inviteExternalUser(
  input: InviteExternalUserInput,
): Promise<ExternalAccessGrantRow> {
  const data = inviteExternalUserInputSchema.parse(input);
  const preCheck = await requirePermission("workflow.assign");
  const [task] = await withTenantContext(
    toTenantContext(preCheck),
    (tx) =>
      tx<
        TaskRow[]
      >`select * from tasks where id = ${data.taskId} and organization_id = ${preCheck.organization.id}`,
  );
  if (!task) throw new AppError("not_found", "Task not found.");
  if (task.status !== "assigned" && task.status !== "in_progress") {
    throw new AppError(
      "conflict",
      "Only an open (assigned/in-progress) task can be given to an external collaborator.",
    );
  }

  const membership = await requirePermission("workflow.assign", {
    scope: { departmentId: task.department_id ?? undefined },
  });

  const [existingLiveGrant] = await withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<{ id: string }[]>`
      select id from external_access_grants where task_id = ${data.taskId} and status in ('pending', 'active')
    `,
  );
  if (existingLiveGrant) {
    throw new AppError(
      "conflict",
      "This task already has a pending or active external-access grant.",
    );
  }

  const adminSql = getAdminSql();
  const [role] = await adminSql<{ id: string }[]>`
    select id from roles where key = 'external_user' and organization_id is null
  `;
  if (!role) throw new AppError("unavailable", "The external_user system role is not seeded.");

  const expiresAt = new Date(Date.now() + data.expiresInDays * 24 * 60 * 60_000);

  let clerkInvitationId: string | null = null;
  try {
    const client = await clerkClient();
    const clerkInvitation = await client.organizations.createOrganizationInvitation({
      organizationId: membership.organization.clerk_org_id,
      emailAddress: data.email,
      role: "org:member",
      inviterUserId: membership.profile.clerk_user_id,
    });
    clerkInvitationId = clerkInvitation.id;
  } catch (error) {
    console.error("Failed to create Clerk organization invitation for external user", error);
    throw new AppError("conflict", "Could not send the invitation email. Please try again.");
  }

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [invitation] = await tx<{ id: string }[]>`
      insert into organization_invitations (
        organization_id, clerk_invitation_id, email, role_id, department_id, invited_by, expires_at
      ) values (
        ${membership.organization.id}, ${clerkInvitationId}, ${data.email}, ${role.id},
        ${task.department_id}, ${membership.profile.id}, ${expiresAt}
      )
      returning id
    `;

    const [grant] = await tx<ExternalAccessGrantRow[]>`
      insert into external_access_grants (organization_id, department_id, invitation_id, task_id, expires_at)
      values (${membership.organization.id}, ${task.department_id}, ${invitation.id}, ${data.taskId}, ${expiresAt})
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ExternalAccessGranted,
      resourceType: AuditResourceType.ExternalAccessGrant,
      resourceId: grant.id,
      source: "app",
      metadata: { taskId: data.taskId, expiresAt: expiresAt.toISOString() },
    });

    return grant;
  });
}

/**
 * Called from src/lib/db/identity-sync.ts's syncMembershipUpserted(),
 * right after applyPendingInvitation() assigns the external_user role
 * — makes the newly-accepted member that grant's task's assignee, the
 * one step a normal invitation acceptance doesn't already do. A no-op
 * if there's no pending grant for this invitation (the ordinary case
 * for every other role).
 */
export async function activateExternalAccessGrant(
  sql: postgres.Sql | postgres.TransactionSql,
  organizationId: string,
  invitationId: string,
  memberId: string,
  correlationId: string,
): Promise<void> {
  const [grant] = await sql<ExternalAccessGrantRow[]>`
    update external_access_grants set
      member_id = ${memberId}, status = 'active', accepted_at = now()
    where invitation_id = ${invitationId} and status = 'pending'
    returning *
  `;
  if (!grant) return;

  await sql`
    update tasks set assignee_member_id = ${memberId}
    where id = ${grant.task_id} and status in ('assigned', 'in_progress')
  `;

  await enqueueJob(sql, organizationId, {
    jobType: "external-access-expiration-check",
    payload: { grantId: grant.id },
    idempotencyKey: `external-access-expiration-check:${grant.id}`,
    scheduledAt: new Date(grant.expires_at),
  });

  await recordAuditEvent(sql, {
    organizationId,
    action: AuditAction.ExternalAccessActivated,
    resourceType: AuditResourceType.ExternalAccessGrant,
    resourceId: grant.id,
    correlationId,
    source: "webhook",
    metadata: { taskId: grant.task_id, memberId },
  });
}

export async function listExternalAccessGrants(taskId?: string): Promise<ExternalAccessGrantRow[]> {
  const membership = await requirePermission("workflow.assign");
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<ExternalAccessGrantRow[]>`
      select * from external_access_grants
      where organization_id = ${membership.organization.id}
        and (${taskId ?? null}::uuid is null or task_id = ${taskId ?? null})
      order by created_at desc
    `,
  );
}

export async function revokeExternalAccessGrant(grantId: string): Promise<void> {
  const membership = await requirePermission("workflow.assign");
  await withTenantContext(toTenantContext(membership), async (tx) => {
    const [grant] = await tx<ExternalAccessGrantRow[]>`
      update external_access_grants set status = 'revoked', revoked_at = now()
      where id = ${grantId} and organization_id = ${membership.organization.id}
        and status in ('pending', 'active')
      returning *
    `;
    if (!grant) throw new AppError("not_found", "No live external-access grant with that id.");

    if (grant.member_id) {
      await tx`update organization_members set status = 'suspended' where id = ${grant.member_id}`;
    }

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ExternalAccessRevoked,
      resourceType: AuditResourceType.ExternalAccessGrant,
      resourceId: grantId,
      source: "app",
    });
  });
}

/** Called only by the background job (external-access-handlers.ts) — expires a still-live grant past its expires_at and suspends the member, same "system-triggered write, no permission gate" posture as every other expiration job in this codebase. */
export async function expireExternalAccessGrant(
  sql: postgres.Sql | postgres.TransactionSql,
  grantId: string,
  organizationId: string,
): Promise<void> {
  const [grant] = await sql<ExternalAccessGrantRow[]>`
    select * from external_access_grants where id = ${grantId} and organization_id = ${organizationId}
  `;
  if (!grant) return;
  if (grant.status !== "pending" && grant.status !== "active") return;
  if (new Date(grant.expires_at) > new Date()) return;

  await sql`update external_access_grants set status = 'expired' where id = ${grantId}`;
  if (grant.member_id) {
    await sql`update organization_members set status = 'suspended' where id = ${grant.member_id}`;
  }

  await recordAuditEvent(sql, {
    organizationId,
    action: AuditAction.ExternalAccessExpired,
    resourceType: AuditResourceType.ExternalAccessGrant,
    resourceId: grantId,
    source: "system",
  });
}
