import "server-only";
import { z } from "zod";
import { requirePermission, getCurrentMembership } from "@/lib/authz";
import type { CurrentMembership } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { enqueueJob } from "@/lib/jobs/enqueue";
import type { OrganizationDeletionRequestRow } from "@/lib/db/database.types";

/**
 * Tenant-safe organization deletion/offboarding: a cancellable,
 * 14-day-grace-period request, never an immediate delete. Requesting
 * requires typing the organization's exact name (elevated confirmation
 * for a destructive, ownership-affecting action, per the phase's
 * security requirements) and organization.manage (owner-only, same
 * bound as transferOwnership()). The actual deletion sweep
 * (organization-deletion-handlers.ts) is gated by
 * ORGANIZATION_DELETION_ENABLED, unset/false in every environment this
 * was built in — see isOrganizationDeletionEnabled() and
 * docs/architecture/organization-administration.md.
 */

function toTenantContext(membership: CurrentMembership) {
  return {
    organizationId: membership.organization.id,
    memberId: membership.member.id,
    clerkUserId: membership.profile.clerk_user_id,
  };
}

export function isOrganizationDeletionEnabled(): boolean {
  return process.env.ORGANIZATION_DELETION_ENABLED === "true";
}

const GRACE_PERIOD_DAYS = 14;

export const requestOrganizationDeletionInputSchema = z.object({
  confirmationOrgName: z.string().trim().min(1, "Type the organization name to confirm."),
  reason: z.string().trim().max(1000).optional().nullable(),
});
export type RequestOrganizationDeletionInput = z.infer<
  typeof requestOrganizationDeletionInputSchema
>;

export async function requestOrganizationDeletion(
  input: RequestOrganizationDeletionInput,
): Promise<OrganizationDeletionRequestRow> {
  const data = requestOrganizationDeletionInputSchema.parse(input);
  const membership = await requirePermission("organization.manage");

  if (data.confirmationOrgName !== membership.organization.name) {
    throw new AppError("bad_request", "Type the organization's exact name to confirm deletion.");
  }

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const scheduledDeleteAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    let request: OrganizationDeletionRequestRow;
    try {
      [request] = await tx<OrganizationDeletionRequestRow[]>`
        insert into organization_deletion_requests (
          organization_id, requested_by, reason, scheduled_delete_at
        ) values (
          ${membership.organization.id}, ${membership.profile.id}, ${data.reason ?? null}, ${scheduledDeleteAt}
        )
        returning *
      `;
    } catch {
      throw new AppError(
        "conflict",
        "A deletion request is already pending for this organization.",
      );
    }

    await enqueueJob(tx, membership.organization.id, {
      jobType: "organization-deletion-sweep",
      payload: { requestId: request.id },
      idempotencyKey: `organization-deletion-sweep:${request.id}`,
      scheduledAt: scheduledDeleteAt,
    });

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.OrganizationDeletionRequested,
      resourceType: AuditResourceType.OrganizationDeletionRequest,
      resourceId: request.id,
      source: "app",
      reason: data.reason ?? null,
      metadata: { scheduledDeleteAt: scheduledDeleteAt.toISOString() },
    });

    return request;
  });
}

export async function cancelOrganizationDeletion(
  requestId: string,
): Promise<OrganizationDeletionRequestRow> {
  const membership = await requirePermission("organization.manage");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [request] = await tx<OrganizationDeletionRequestRow[]>`
      update organization_deletion_requests set status = 'cancelled', cancelled_by = ${membership.profile.id}, cancelled_at = now()
      where id = ${requestId} and organization_id = ${membership.organization.id} and status = 'pending'
      returning *
    `;
    if (!request) throw new AppError("not_found", "No pending deletion request found.");

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.OrganizationDeletionCancelled,
      resourceType: AuditResourceType.OrganizationDeletionRequest,
      resourceId: request.id,
      source: "app",
    });

    return request;
  });
}

export async function getActiveOrganizationDeletionRequest(): Promise<OrganizationDeletionRequestRow | null> {
  const membership = await getCurrentMembership();
  const [request] = await withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<OrganizationDeletionRequestRow[]>`
      select * from organization_deletion_requests
      where organization_id = ${membership.organization.id} and status = 'pending'
      order by created_at desc
      limit 1
    `,
  );
  return request ?? null;
}
