import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { enqueueJob } from "@/lib/jobs/enqueue";
import type { ExceptionRow, TemporaryWaiverRow } from "@/lib/db/database.types";

/**
 * Temporary waivers — a time-bound risk acceptance against an
 * exception. `expires_at` is required at creation (never optional) so a
 * waiver can never "silently become permanent," per this phase's
 * requirement; the waiver-expiration background job
 * (src/lib/jobs/waiver-expiration-handlers.ts) is what actually enforces
 * that by flipping status to 'expired' once the date passes without a
 * renewal.
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

async function getOwnException(
  organizationId: string,
  exceptionId: string,
  tx: postgres.TransactionSql,
) {
  const [exception] = await tx<
    ExceptionRow[]
  >`select * from exceptions where id = ${exceptionId} and organization_id = ${organizationId}`;
  if (!exception) throw new AppError("not_found", "Exception not found.");
  return exception;
}

async function getOwnWaiver(organizationId: string, waiverId: string, tx: postgres.TransactionSql) {
  const [waiver] = await tx<
    TemporaryWaiverRow[]
  >`select * from temporary_waivers where id = ${waiverId} and organization_id = ${organizationId}`;
  if (!waiver) throw new AppError("not_found", "Waiver not found.");
  return waiver;
}

export const waiverRequestInputSchema = z.object({
  businessJustification: z.string().trim().min(1).max(5000),
  compensatingControls: z.string().trim().max(5000).optional().nullable(),
  riskAcceptance: z.string().trim().max(2000).optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime(),
});

export type WaiverRequestInput = z.infer<typeof waiverRequestInputSchema>;

export async function requestWaiver(
  exceptionId: string,
  input: WaiverRequestInput,
): Promise<TemporaryWaiverRow> {
  const data = waiverRequestInputSchema.parse(input);
  if (new Date(data.expiresAt) <= new Date()) {
    throw new AppError("conflict", "A waiver's expiration date must be in the future.");
  }
  const preCheck = await getCurrentMembership();
  const exception = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnException(preCheck.organization.id, exceptionId, tx),
  );
  const membership = await requirePermission("waivers.create", {
    scope: { departmentId: exception.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [waiver] = await tx<TemporaryWaiverRow[]>`
      insert into temporary_waivers (
        organization_id, department_id, exception_id, business_justification, compensating_controls, risk_acceptance,
        requested_by_member_id, start_at, expires_at
      ) values (
        ${membership.organization.id}, ${exception.department_id}, ${exceptionId}, ${data.businessJustification}, ${data.compensatingControls ?? null},
        ${data.riskAcceptance ?? null}, ${membership.member.id}, ${data.startAt ?? null}, ${data.expiresAt}
      )
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.WaiverRequested,
      resourceType: AuditResourceType.TemporaryWaiver,
      resourceId: waiver.id,
      departmentId: waiver.department_id,
      source: "app",
    });
    return waiver;
  });
}

export async function decideWaiver(
  waiverId: string,
  decision: "approved" | "rejected",
  comment?: string,
): Promise<TemporaryWaiverRow> {
  const preCheck = await getCurrentMembership();
  const waiver = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnWaiver(preCheck.organization.id, waiverId, tx),
  );
  if (waiver.status !== "requested")
    throw new AppError("conflict", "This waiver has already been decided.");
  const membership = await requirePermission("waivers.approve", {
    scope: { departmentId: waiver.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    await tx`
      insert into waiver_approvals (organization_id, waiver_id, approver_member_id, decision, comment)
      values (${membership.organization.id}, ${waiverId}, ${membership.member.id}, ${decision}, ${comment?.trim() || null})
    `;
    const [updated] = await tx<TemporaryWaiverRow[]>`
      update temporary_waivers set
        status = ${decision === "approved" ? "active" : "rejected"}, approver_member_id = ${membership.member.id}, decided_at = now()
      where id = ${waiverId}
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: decision === "approved" ? AuditAction.WaiverApproved : AuditAction.WaiverRejected,
      resourceType: AuditResourceType.TemporaryWaiver,
      resourceId: waiverId,
      departmentId: waiver.department_id,
      source: "app",
    });
    if (decision === "approved") {
      await enqueueJob(tx, membership.organization.id, {
        jobType: "waiver-expiration-check",
        payload: { waiverId },
        idempotencyKey: `waiver-expiration-check:${waiverId}:${updated.expires_at}`,
        scheduledAt: new Date(updated.expires_at),
      });
    }
    return updated;
  });
}

export async function renewWaiver(
  waiverId: string,
  newExpiresAt: string,
): Promise<TemporaryWaiverRow> {
  const preCheck = await getCurrentMembership();
  const waiver = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnWaiver(preCheck.organization.id, waiverId, tx),
  );
  if (waiver.status !== "active" && waiver.status !== "renewed") {
    throw new AppError("conflict", "Only an active waiver can be renewed.");
  }
  if (new Date(newExpiresAt) <= new Date(waiver.expires_at)) {
    throw new AppError("conflict", "A renewal must extend the expiration date.");
  }
  const membership = await requirePermission("waivers.approve", {
    scope: { departmentId: waiver.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    await tx`
      insert into waiver_renewals (organization_id, waiver_id, previous_expires_at, new_expires_at, requested_by_member_id, approved_by_member_id)
      values (${membership.organization.id}, ${waiverId}, ${waiver.expires_at}, ${newExpiresAt}, ${membership.member.id}, ${membership.member.id})
    `;
    const [updated] = await tx<TemporaryWaiverRow[]>`
      update temporary_waivers set status = 'renewed', expires_at = ${newExpiresAt} where id = ${waiverId} returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.WaiverRenewed,
      resourceType: AuditResourceType.TemporaryWaiver,
      resourceId: waiverId,
      departmentId: waiver.department_id,
      source: "app",
    });
    await enqueueJob(tx, membership.organization.id, {
      jobType: "waiver-expiration-check",
      payload: { waiverId },
      idempotencyKey: `waiver-expiration-check:${waiverId}:${updated.expires_at}`,
      scheduledAt: new Date(updated.expires_at),
    });
    return updated;
  });
}

export async function revokeWaiver(waiverId: string): Promise<TemporaryWaiverRow> {
  const preCheck = await getCurrentMembership();
  const waiver = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnWaiver(preCheck.organization.id, waiverId, tx),
  );
  if (waiver.status !== "active" && waiver.status !== "renewed") {
    throw new AppError("conflict", "Only an active waiver can be revoked.");
  }
  const membership = await requirePermission("waivers.approve", {
    scope: { departmentId: waiver.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<
      TemporaryWaiverRow[]
    >`update temporary_waivers set status = 'revoked' where id = ${waiverId} returning *`;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.WaiverRevoked,
      resourceType: AuditResourceType.TemporaryWaiver,
      resourceId: waiverId,
      departmentId: waiver.department_id,
      source: "app",
    });
    return updated;
  });
}

export interface ListWaiversFilters {
  status?: TemporaryWaiverRow["status"];
  expiringOnly?: boolean;
}

/** Org-wide waiver queue/dashboard — /app/waivers's list page filters this by status/expiringOnly for "active"/"expiring soon" views. */
export async function listWaivers(filters: ListWaiversFilters = {}): Promise<TemporaryWaiverRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<TemporaryWaiverRow[]>`
      select * from temporary_waivers
      where organization_id = ${membership.organization.id}
        and (${filters.status ?? null}::text is null or status = ${filters.status ?? null})
        and (${filters.expiringOnly ?? false} = false or (status in ('active', 'renewed') and expires_at < now() + interval '14 days'))
      order by created_at desc
    `,
  );
}

export async function listWaiversForException(exceptionId: string): Promise<TemporaryWaiverRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<
        TemporaryWaiverRow[]
      >`select * from temporary_waivers where exception_id = ${exceptionId} and organization_id = ${membership.organization.id} order by created_at desc`,
  );
}

export async function getWaiver(waiverId: string): Promise<TemporaryWaiverRow> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), (tx) =>
    getOwnWaiver(membership.organization.id, waiverId, tx),
  );
}

/** Marks an active/renewed waiver 'expired' once past its expires_at — called by the waiver-expiration-check background job, same idempotent "check before acting" shape as evidence.ts's expireEvidence. A no-op if the waiver was renewed (new expiry, new scheduled job) or otherwise no longer expirable since this job was scheduled. */
export async function expireWaiver(
  tx: postgres.TransactionSql,
  waiverId: string,
  organizationId: string,
): Promise<void> {
  const [waiver] = await tx<
    TemporaryWaiverRow[]
  >`select * from temporary_waivers where id = ${waiverId} and organization_id = ${organizationId}`;
  if (!waiver) return;
  if (waiver.status !== "active" && waiver.status !== "renewed") return;
  if (new Date(waiver.expires_at) > new Date()) return;

  await tx`update temporary_waivers set status = 'expired' where id = ${waiverId}`;
  await recordAuditEvent(tx, {
    organizationId,
    action: AuditAction.WaiverExpired,
    resourceType: AuditResourceType.TemporaryWaiver,
    resourceId: waiverId,
    departmentId: waiver.department_id,
    source: "system",
  });
}
