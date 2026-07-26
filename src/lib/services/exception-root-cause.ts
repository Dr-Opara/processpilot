import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type {
  ExceptionRow,
  RootCauseAnalysisRow,
  RootCauseFactorRow,
} from "@/lib/db/database.types";

/**
 * Root-cause analysis (Five Whys / fishbone), one per exception —
 * closeException() (exceptions.ts) checks for a non-null
 * `primary_root_cause` here before allowing closure without an explicit
 * override, per this phase's "prevent closure without a documented root
 * cause unless an authorized exception is recorded" requirement.
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

export const rootCauseAnalysisInputSchema = z.object({
  method: z.enum(["five_whys", "fishbone", "other"]),
  fishboneCategory: z
    .enum(["people", "process", "equipment", "materials", "environment", "management"])
    .optional()
    .nullable(),
  primaryRootCause: z.string().trim().min(1).max(2000).optional().nullable(),
  investigatorNotes: z.string().trim().max(10_000).optional().nullable(),
});

export type RootCauseAnalysisInput = z.infer<typeof rootCauseAnalysisInputSchema>;

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

/** Creates or replaces the exception's single root-cause analysis record — investigation is iterative, so this is upsert-by-exception rather than append-only (root_cause_factors below is the append-only detail). */
export async function upsertRootCauseAnalysis(
  exceptionId: string,
  input: RootCauseAnalysisInput,
): Promise<RootCauseAnalysisRow> {
  const data = rootCauseAnalysisInputSchema.parse(input);
  const preCheck = await getCurrentMembership();
  const exception = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnException(preCheck.organization.id, exceptionId, tx),
  );
  const membership = await requirePermission("exceptions.investigate", {
    scope: { departmentId: exception.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [analysis] = await tx<RootCauseAnalysisRow[]>`
      insert into root_cause_analyses (
        organization_id, exception_id, method, fishbone_category, primary_root_cause, investigator_notes, investigator_member_id
      ) values (
        ${membership.organization.id}, ${exceptionId}, ${data.method}, ${data.fishboneCategory ?? null},
        ${data.primaryRootCause ?? null}, ${data.investigatorNotes ?? null}, ${membership.member.id}
      )
      on conflict (exception_id) do update set
        method = excluded.method,
        fishbone_category = excluded.fishbone_category,
        primary_root_cause = excluded.primary_root_cause,
        investigator_notes = excluded.investigator_notes,
        investigator_member_id = excluded.investigator_member_id,
        updated_at = now()
      returning *
    `;

    await tx`
      insert into exception_history (organization_id, department_id, exception_id, event_type, actor_member_id, metadata)
      values (${membership.organization.id}, ${exception.department_id}, ${exceptionId}, 'exception.root_cause_added', ${membership.member.id}, ${tx.json({ method: data.method } as unknown as Parameters<typeof tx.json>[0])})
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ExceptionRootCauseAdded,
      resourceType: AuditResourceType.Exception,
      resourceId: exceptionId,
      source: "app",
    });

    return analysis;
  });
}

export const rootCauseFactorInputSchema = z.object({
  factorType: z.enum(["five_why_step", "secondary_root_cause", "contributing_factor"]),
  sequenceOrder: z.number().int().nonnegative().default(0),
  description: z.string().trim().min(1).max(2000),
  evidenceReference: z.string().trim().max(300).optional().nullable(),
});

export type RootCauseFactorInput = z.infer<typeof rootCauseFactorInputSchema>;

export async function addRootCauseFactor(
  rootCauseAnalysisId: string,
  input: RootCauseFactorInput,
): Promise<RootCauseFactorRow> {
  const data = rootCauseFactorInputSchema.parse(input);
  const preCheck = await getCurrentMembership();
  const analysis = await withTenantContext(toTenantContext(preCheck), async (tx) => {
    const [row] = await tx<RootCauseAnalysisRow[]>`
      select * from root_cause_analyses where id = ${rootCauseAnalysisId} and organization_id = ${preCheck.organization.id}
    `;
    if (!row) throw new AppError("not_found", "Root-cause analysis not found.");
    return row;
  });
  const membership = await requirePermission("exceptions.investigate", {
    scope: { departmentId: analysis.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [factor] = await tx<RootCauseFactorRow[]>`
      insert into root_cause_factors (organization_id, root_cause_analysis_id, factor_type, sequence_order, description, evidence_reference)
      values (${membership.organization.id}, ${rootCauseAnalysisId}, ${data.factorType}, ${data.sequenceOrder}, ${data.description}, ${data.evidenceReference ?? null})
      returning *
    `;
    return factor;
  });
}

export async function getRootCauseAnalysis(
  exceptionId: string,
): Promise<{ analysis: RootCauseAnalysisRow; factors: RootCauseFactorRow[] } | null> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [analysis] = await tx<RootCauseAnalysisRow[]>`
      select * from root_cause_analyses where exception_id = ${exceptionId} and organization_id = ${membership.organization.id}
    `;
    if (!analysis) return null;
    const factors = await tx<RootCauseFactorRow[]>`
      select * from root_cause_factors where root_cause_analysis_id = ${analysis.id} order by sequence_order asc
    `;
    return { analysis, factors };
  });
}
