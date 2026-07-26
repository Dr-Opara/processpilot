import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type {
  CapaActionRow,
  CapaApprovalRow,
  CapaEffectivenessCheckRow,
  CapaPlanRow,
  ExceptionRow,
} from "@/lib/db/database.types";

/**
 * Corrective and preventive action (CAPA) plans against an exception —
 * a plan (capa_plans) has one or more individual action items
 * (capa_actions, each `corrective` or `preventive`), goes through an
 * approval gate (capa_approvals) before work starts, and is verified by
 * an effectiveness check (capa_effectiveness_checks) before it can be
 * marked `effective`/`closed` rather than `ineffective`.
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

async function getOwnCapaPlan(
  organizationId: string,
  capaPlanId: string,
  tx: postgres.TransactionSql,
) {
  const [plan] = await tx<
    CapaPlanRow[]
  >`select * from capa_plans where id = ${capaPlanId} and organization_id = ${organizationId}`;
  if (!plan) throw new AppError("not_found", "CAPA plan not found.");
  return plan;
}

export const capaPlanInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(10_000).optional().nullable(),
  ownerMemberId: z.string().uuid(),
  sponsorMemberId: z.string().uuid().optional().nullable(),
  completionCriteria: z.string().trim().max(2000).optional().nullable(),
  effectivenessCheckMethod: z.string().trim().max(500).optional().nullable(),
  effectivenessCheckDate: z.string().date().optional().nullable(),
  verificationOwnerMemberId: z.string().uuid().optional().nullable(),
});

export type CapaPlanInput = z.infer<typeof capaPlanInputSchema>;

export async function createCapaPlan(
  exceptionId: string,
  input: CapaPlanInput,
): Promise<CapaPlanRow> {
  const data = capaPlanInputSchema.parse(input);
  const preCheck = await getCurrentMembership();
  const exception = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnException(preCheck.organization.id, exceptionId, tx),
  );
  const membership = await requirePermission("capa.create", {
    scope: { departmentId: exception.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [plan] = await tx<CapaPlanRow[]>`
      insert into capa_plans (
        organization_id, exception_id, title, description, owner_member_id, sponsor_member_id,
        completion_criteria, effectiveness_check_method, effectiveness_check_date, verification_owner_member_id,
        created_by_member_id
      ) values (
        ${membership.organization.id}, ${exceptionId}, ${data.title}, ${data.description ?? null}, ${data.ownerMemberId},
        ${data.sponsorMemberId ?? null}, ${data.completionCriteria ?? null}, ${data.effectivenessCheckMethod ?? null},
        ${data.effectivenessCheckDate ?? null}, ${data.verificationOwnerMemberId ?? null}, ${membership.member.id}
      )
      returning *
    `;
    await tx`update exceptions set status = 'action_plan_required', updated_at = now() where id = ${exceptionId} and status not in ('closed', 'rejected')`;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.CapaPlanCreated,
      resourceType: AuditResourceType.CapaPlan,
      resourceId: plan.id,
      source: "app",
    });
    return plan;
  });
}

export const capaActionInputSchema = z.object({
  actionType: z.enum(["corrective", "preventive"]),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(10_000).optional().nullable(),
  ownerMemberId: z.string().uuid(),
  dueAt: z.string().datetime().optional().nullable(),
  dependsOnActionId: z.string().uuid().optional().nullable(),
  requiresEvidence: z.boolean().default(false),
});

export type CapaActionInput = z.infer<typeof capaActionInputSchema>;

export async function addCapaAction(
  capaPlanId: string,
  input: CapaActionInput,
): Promise<CapaActionRow> {
  const data = capaActionInputSchema.parse(input);
  const preCheck = await getCurrentMembership();
  const plan = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnCapaPlan(preCheck.organization.id, capaPlanId, tx),
  );
  const membership = await requirePermission("capa.edit", {
    scope: { departmentId: plan.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [action] = await tx<CapaActionRow[]>`
      insert into capa_actions (
        organization_id, capa_plan_id, action_type, title, description, owner_member_id, due_at,
        depends_on_action_id, requires_evidence, created_by_member_id
      ) values (
        ${membership.organization.id}, ${capaPlanId}, ${data.actionType}, ${data.title}, ${data.description ?? null},
        ${data.ownerMemberId}, ${data.dueAt ?? null}, ${data.dependsOnActionId ?? null}, ${data.requiresEvidence},
        ${membership.member.id}
      )
      returning *
    `;
    return action;
  });
}

export async function completeCapaAction(
  capaActionId: string,
  evidenceId?: string,
): Promise<CapaActionRow> {
  const preCheck = await getCurrentMembership();
  const existing = await withTenantContext(toTenantContext(preCheck), async (tx) => {
    const [row] = await tx<
      CapaActionRow[]
    >`select * from capa_actions where id = ${capaActionId} and organization_id = ${preCheck.organization.id}`;
    if (!row) throw new AppError("not_found", "CAPA action not found.");
    return row;
  });
  if (existing.requires_evidence && !existing.evidence_id && !evidenceId) {
    throw new AppError("conflict", "This action requires evidence before it can be completed.");
  }
  const membership = await requirePermission("capa.edit", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<CapaActionRow[]>`
      update capa_actions set
        status = 'completed', completed_at = now(), completed_by_member_id = ${membership.member.id},
        evidence_id = ${evidenceId ?? existing.evidence_id}
      where id = ${capaActionId}
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.CapaActionCompleted,
      resourceType: AuditResourceType.CapaPlan,
      resourceId: existing.capa_plan_id,
      source: "app",
    });
    return updated;
  });
}

/** Moves the plan from draft to pending_approval — capa.edit, distinct from the capa.approve decision itself. */
export async function submitCapaPlanForApproval(capaPlanId: string): Promise<CapaPlanRow> {
  const preCheck = await getCurrentMembership();
  const plan = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnCapaPlan(preCheck.organization.id, capaPlanId, tx),
  );
  if (plan.status !== "draft")
    throw new AppError("conflict", "Only a draft CAPA plan can be submitted for approval.");
  const membership = await requirePermission("capa.edit", {
    scope: { departmentId: plan.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<
      CapaPlanRow[]
    >`update capa_plans set status = 'pending_approval' where id = ${capaPlanId} returning *`;
    return updated;
  });
}

export async function decideCapaPlanApproval(
  capaPlanId: string,
  decision: "approved" | "rejected",
  comment?: string,
): Promise<CapaPlanRow> {
  const preCheck = await getCurrentMembership();
  const plan = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnCapaPlan(preCheck.organization.id, capaPlanId, tx),
  );
  if (plan.status !== "pending_approval")
    throw new AppError("conflict", "This CAPA plan is not pending approval.");
  const membership = await requirePermission("capa.approve", {
    scope: { departmentId: plan.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    await tx<CapaApprovalRow[]>`
      insert into capa_approvals (organization_id, capa_plan_id, approver_member_id, decision, comment)
      values (${membership.organization.id}, ${capaPlanId}, ${membership.member.id}, ${decision}, ${comment?.trim() || null})
    `;
    const [updated] = await tx<CapaPlanRow[]>`
      update capa_plans set status = ${decision === "approved" ? "approved" : "draft"} where id = ${capaPlanId} returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: decision === "approved" ? AuditAction.CapaPlanApproved : AuditAction.CapaPlanRejected,
      resourceType: AuditResourceType.CapaPlan,
      resourceId: capaPlanId,
      source: "app",
    });
    return updated;
  });
}

export async function recordCapaEffectivenessCheck(
  capaPlanId: string,
  outcome: "effective" | "ineffective",
  notes?: string,
): Promise<CapaEffectivenessCheckRow> {
  const preCheck = await getCurrentMembership();
  const plan = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnCapaPlan(preCheck.organization.id, capaPlanId, tx),
  );
  const membership = await requirePermission("capa.verify", {
    scope: { departmentId: plan.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [check] = await tx<CapaEffectivenessCheckRow[]>`
      insert into capa_effectiveness_checks (organization_id, capa_plan_id, outcome, notes, verifier_member_id)
      values (${membership.organization.id}, ${capaPlanId}, ${outcome}, ${notes?.trim() || null}, ${membership.member.id})
      returning *
    `;
    await tx`update capa_plans set status = ${outcome} where id = ${capaPlanId}`;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action:
        outcome === "effective"
          ? AuditAction.CapaEffectivenessCheckCompleted
          : AuditAction.CapaPlanMarkedIneffective,
      resourceType: AuditResourceType.CapaPlan,
      resourceId: capaPlanId,
      source: "app",
    });
    return check;
  });
}

export async function closeCapaPlan(capaPlanId: string): Promise<CapaPlanRow> {
  const preCheck = await getCurrentMembership();
  const plan = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnCapaPlan(preCheck.organization.id, capaPlanId, tx),
  );
  if (plan.status !== "effective") {
    throw new AppError("conflict", "Only a CAPA plan verified 'effective' can be closed.");
  }
  const membership = await requirePermission("capa.close", {
    scope: { departmentId: plan.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<CapaPlanRow[]>`
      update capa_plans set status = 'closed', closed_at = now(), closed_by_member_id = ${membership.member.id}
      where id = ${capaPlanId}
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.CapaPlanClosed,
      resourceType: AuditResourceType.CapaPlan,
      resourceId: capaPlanId,
      source: "app",
    });
    return updated;
  });
}

export interface ListCapaPlansFilters {
  status?: CapaPlanRow["status"];
}

/** Org-wide CAPA queue/dashboard — src/app/app/(protected)/capa's list page filters this by status for "open"/"overdue"/"ineffective" views rather than needing separate dashboard queries. */
export async function listCapaPlans(filters: ListCapaPlansFilters = {}): Promise<CapaPlanRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<
        CapaPlanRow[]
      >`select * from capa_plans where organization_id = ${membership.organization.id} and (${filters.status ?? null}::text is null or status = ${filters.status ?? null}) order by created_at desc`,
  );
}

export async function listCapaPlansForException(exceptionId: string): Promise<CapaPlanRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<
        CapaPlanRow[]
      >`select * from capa_plans where exception_id = ${exceptionId} and organization_id = ${membership.organization.id} order by created_at desc`,
  );
}

export async function listCapaActions(capaPlanId: string): Promise<CapaActionRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<
        CapaActionRow[]
      >`select * from capa_actions where capa_plan_id = ${capaPlanId} and organization_id = ${membership.organization.id} order by created_at asc`,
  );
}

export async function getCapaPlan(capaPlanId: string): Promise<CapaPlanRow> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), (tx) =>
    getOwnCapaPlan(membership.organization.id, capaPlanId, tx),
  );
}
