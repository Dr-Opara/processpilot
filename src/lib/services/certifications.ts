import "server-only";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { enqueueJob } from "@/lib/jobs/enqueue";
import type { CertificationRow } from "@/lib/db/database.types";

/**
 * Certification issuance, renewal, and revocation — a certification is
 * issued to a member from a passed training_assignment (see
 * training-assignments.ts's completeTrainingAssignment()), carries an
 * optional expiry, and is renewed (a new certification row, chained via
 * `renewed_from_certification_id`) rather than mutated in place, so the
 * full history of a member's credential stays traceable.
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

export interface IssueCertificationInput {
  organizationId: string;
  departmentId?: string | null;
  memberId: string;
  courseId: string;
  trainingAssignmentId: string;
  /** Nullable — a non-expiring certification is an explicit choice, not a default. */
  expiresAt: string | null;
  actorProfileId?: string;
}

/** Called from within an already-open transaction by training-assignments.ts's completeTrainingAssignment() on a pass — never opens its own withTenantContext(), same posture as exceptions.ts's createSystemException(). */
export async function issueCertification(
  tx: postgres.TransactionSql,
  input: IssueCertificationInput,
): Promise<CertificationRow> {
  const [certification] = await tx<CertificationRow[]>`
    insert into certifications (organization_id, department_id, member_id, course_id, training_assignment_id, expires_at, created_by)
    values (${input.organizationId}, ${input.departmentId ?? null}, ${input.memberId}, ${input.courseId}, ${input.trainingAssignmentId}, ${input.expiresAt}, ${input.actorProfileId ?? null})
    returning *
  `;
  await recordAuditEvent(tx, {
    organizationId: input.organizationId,
    actorProfileId: input.actorProfileId,
    action: AuditAction.CertificationIssued,
    resourceType: AuditResourceType.Certification,
    resourceId: certification.id,
    departmentId: certification.department_id,
    source: "app",
  });
  if (input.expiresAt) {
    await enqueueJob(tx, input.organizationId, {
      jobType: "certification-expiry-check",
      payload: { certificationId: certification.id },
      idempotencyKey: `certification-expiry-check:${certification.id}`,
      scheduledAt: new Date(input.expiresAt),
    });
  }
  return certification;
}

async function getOwnCertification(
  tx: postgres.TransactionSql,
  organizationId: string,
  certificationId: string,
): Promise<CertificationRow> {
  const [certification] = await tx<CertificationRow[]>`
    select * from certifications where id = ${certificationId} and organization_id = ${organizationId}
  `;
  if (!certification) throw new AppError("not_found", "Certification not found.");
  return certification;
}

export async function listMyCertifications(): Promise<CertificationRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<CertificationRow[]>`
      select * from certifications where organization_id = ${membership.organization.id} and member_id = ${membership.member.id}
      order by issued_at desc
    `,
  );
}

export async function listAllCertifications(): Promise<CertificationRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<
        CertificationRow[]
      >`select * from certifications where organization_id = ${membership.organization.id} order by issued_at desc`,
  );
}

export async function getCertification(certificationId: string): Promise<CertificationRow> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), (tx) =>
    getOwnCertification(tx, membership.organization.id, certificationId),
  );
}

/** Issues a new certification chained to the expiring one via renewed_from_certification_id — the prior certification's own row is left exactly as it was (its own expiry, its own history), never edited. */
export async function renewCertification(
  certificationId: string,
  newExpiresAt: string | null,
): Promise<CertificationRow> {
  const preCheck = await getCurrentMembership();
  const existing = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnCertification(tx, preCheck.organization.id, certificationId),
  );
  const membership = await requirePermission("training.manage", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [renewed] = await tx<CertificationRow[]>`
      insert into certifications (organization_id, department_id, member_id, course_id, expires_at, renewed_from_certification_id, created_by)
      values (${membership.organization.id}, ${existing.department_id}, ${existing.member_id}, ${existing.course_id}, ${newExpiresAt}, ${certificationId}, ${membership.profile.id})
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.CertificationRenewed,
      resourceType: AuditResourceType.Certification,
      resourceId: renewed.id,
      departmentId: renewed.department_id,
      source: "app",
    });
    if (newExpiresAt) {
      await enqueueJob(tx, membership.organization.id, {
        jobType: "certification-expiry-check",
        payload: { certificationId: renewed.id },
        idempotencyKey: `certification-expiry-check:${renewed.id}`,
        scheduledAt: new Date(newExpiresAt),
      });
    }
    return renewed;
  });
}

export async function revokeCertification(
  certificationId: string,
  reason: string,
): Promise<CertificationRow> {
  const trimmedReason = reason.trim();
  if (!trimmedReason)
    throw new AppError("conflict", "A reason is required to revoke a certification.");

  const preCheck = await getCurrentMembership();
  const existing = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnCertification(tx, preCheck.organization.id, certificationId),
  );
  if (existing.status !== "active")
    throw new AppError("conflict", "Only an active certification can be revoked.");
  const membership = await requirePermission("training.manage", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<CertificationRow[]>`
      update certifications set
        status = 'revoked', revoked_reason = ${trimmedReason}, revoked_by = ${membership.member.id}, revoked_at = now()
      where id = ${certificationId}
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.CertificationRevoked,
      resourceType: AuditResourceType.Certification,
      resourceId: certificationId,
      departmentId: existing.department_id,
      source: "app",
      reason: trimmedReason,
    });
    return updated;
  });
}

/** Marks a single certification 'expired' once past its expires_at — called by the certification-expiry-check background job, scheduled per-certification at issuance/renewal. Idempotent: a no-op if the certification was since renewed, revoked, or is no longer past its expiry. */
export async function expireCertification(
  tx: postgres.TransactionSql,
  certificationId: string,
  organizationId: string,
): Promise<void> {
  const [certification] = await tx<CertificationRow[]>`
    select * from certifications where id = ${certificationId} and organization_id = ${organizationId}
  `;
  if (!certification) return;
  if (certification.status !== "active") return;
  if (!certification.expires_at || new Date(certification.expires_at) > new Date()) return;

  await tx`update certifications set status = 'expired' where id = ${certificationId}`;
  await recordAuditEvent(tx, {
    organizationId,
    action: AuditAction.CertificationExpired,
    resourceType: AuditResourceType.Certification,
    resourceId: certificationId,
    departmentId: certification.department_id,
    source: "system",
  });
}
