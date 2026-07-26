import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { ExceptionContainmentActionRow, ExceptionRow } from "@/lib/db/database.types";

/** Immediate containment actions against an exception — tracked independently of the exception's own status/root-cause/CAPA flow, per this phase's containment requirements. */

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

export const containmentActionInputSchema = z.object({
  action: z.string().trim().min(1).max(2000),
  ownerMemberId: z.string().uuid(),
  dueAt: z.string().datetime().optional().nullable(),
});

export type ContainmentActionInput = z.infer<typeof containmentActionInputSchema>;

export async function createContainmentAction(
  exceptionId: string,
  input: ContainmentActionInput,
): Promise<ExceptionContainmentActionRow> {
  const data = containmentActionInputSchema.parse(input);
  const preCheck = await getCurrentMembership();
  const exception = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnException(preCheck.organization.id, exceptionId, tx),
  );
  const membership = await requirePermission("exceptions.investigate", {
    scope: { departmentId: exception.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [containmentAction] = await tx<ExceptionContainmentActionRow[]>`
      insert into exception_containment_actions (organization_id, exception_id, action, owner_member_id, due_at, created_by_member_id)
      values (${membership.organization.id}, ${exceptionId}, ${data.action}, ${data.ownerMemberId}, ${data.dueAt ?? null}, ${membership.member.id})
      returning *
    `;
    await tx`update exceptions set status = 'containment_in_progress', updated_at = now() where id = ${exceptionId} and status in ('reported', 'triaged', 'under_investigation')`;
    await tx`
      insert into exception_history (organization_id, department_id, exception_id, event_type, actor_member_id, metadata)
      values (${membership.organization.id}, ${exception.department_id}, ${exceptionId}, 'exception.containment_action_created', ${membership.member.id}, ${tx.json({ containmentActionId: containmentAction.id } as unknown as Parameters<typeof tx.json>[0])})
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ExceptionContainmentActionCreated,
      resourceType: AuditResourceType.Exception,
      resourceId: exceptionId,
      source: "app",
    });
    return containmentAction;
  });
}

export async function completeContainmentAction(
  containmentActionId: string,
  verificationNotes?: string,
): Promise<ExceptionContainmentActionRow> {
  const preCheck = await getCurrentMembership();
  const existing = await withTenantContext(toTenantContext(preCheck), async (tx) => {
    const [row] = await tx<ExceptionContainmentActionRow[]>`
      select * from exception_containment_actions where id = ${containmentActionId} and organization_id = ${preCheck.organization.id}
    `;
    if (!row) throw new AppError("not_found", "Containment action not found.");
    return row;
  });
  const membership = await requirePermission("exceptions.investigate", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<ExceptionContainmentActionRow[]>`
      update exception_containment_actions set
        status = 'completed', completed_at = now(), completed_by_member_id = ${membership.member.id},
        verification_notes = ${verificationNotes?.trim() || null}
      where id = ${containmentActionId}
      returning *
    `;
    await tx`
      insert into exception_history (organization_id, department_id, exception_id, event_type, actor_member_id, metadata)
      values (${membership.organization.id}, ${existing.department_id}, ${existing.exception_id}, 'exception.containment_action_completed', ${membership.member.id}, ${tx.json({ containmentActionId } as unknown as Parameters<typeof tx.json>[0])})
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ExceptionContainmentActionCompleted,
      resourceType: AuditResourceType.Exception,
      resourceId: existing.exception_id,
      source: "app",
    });
    return updated;
  });
}

export async function listContainmentActions(
  exceptionId: string,
): Promise<ExceptionContainmentActionRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<ExceptionContainmentActionRow[]>`
      select * from exception_containment_actions where exception_id = ${exceptionId} and organization_id = ${membership.organization.id}
      order by created_at asc
    `,
  );
}
