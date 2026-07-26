import "server-only";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { AiDraftRow, AiDraftType } from "@/lib/db/database.types";

/**
 * Shared persistence for every AI-generated draft/suggestion — see
 * docs/architecture/ai-architecture.md's governance boundary.
 * acceptAiDraft() records that a human chose to act on a draft; it
 * never performs the real mutation itself (no ai-*.ts module imports a
 * publish/approve/close/certify function) — the caller is expected to
 * have already taken that separate, explicit action via the relevant
 * existing service (processes.ts's publish, capa.ts's approvals,
 * exceptions.ts's closeException, ...) and pass the resulting record's
 * id here purely so the audit trail can trace "this published version
 * originated from this AI draft."
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

export interface CreateAiDraftInput {
  organizationId: string;
  departmentId?: string | null;
  draftType: AiDraftType;
  sourceType?: string | null;
  sourceId?: string | null;
  promptSummary: string;
  output: Record<string, unknown>;
  model: string;
  inputTokens: number;
  outputTokens: number;
  createdByMemberId: string;
}

/** Inserts the draft and its usage record together — called by each ai-*.ts feature service from within its own transaction after a successful adapter call. */
export async function createAiDraft(
  tx: postgres.TransactionSql,
  input: CreateAiDraftInput,
): Promise<AiDraftRow> {
  const [draft] = await tx<AiDraftRow[]>`
    insert into ai_drafts (
      organization_id, department_id, draft_type, source_type, source_id, prompt_summary,
      output, model, input_tokens, output_tokens, created_by
    ) values (
      ${input.organizationId}, ${input.departmentId ?? null}, ${input.draftType}, ${input.sourceType ?? null},
      ${input.sourceId ?? null}, ${input.promptSummary}, ${tx.json(input.output as unknown as Parameters<typeof tx.json>[0])},
      ${input.model}, ${input.inputTokens}, ${input.outputTokens}, ${input.createdByMemberId}
    )
    returning *
  `;
  await tx`
    insert into ai_usage_events (organization_id, feature, model, input_tokens, output_tokens, ai_draft_id, created_by)
    values (${input.organizationId}, ${input.draftType}, ${input.model}, ${input.inputTokens}, ${input.outputTokens}, ${draft.id}, ${input.createdByMemberId})
  `;
  await recordAuditEvent(tx, {
    organizationId: input.organizationId,
    action: AuditAction.AiDraftGenerated,
    resourceType: AuditResourceType.AiDraft,
    resourceId: draft.id,
    source: "app",
  });
  return draft;
}

/** Records adapter usage for a call that didn't produce a persisted draft (e.g. a read-only comparison the caller chose not to save) — still tracked for token/cost visibility. */
export async function recordAiUsage(
  tx: postgres.TransactionSql,
  input: {
    organizationId: string;
    feature: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    createdByMemberId: string;
  },
): Promise<void> {
  await tx`
    insert into ai_usage_events (organization_id, feature, model, input_tokens, output_tokens, created_by)
    values (${input.organizationId}, ${input.feature}, ${input.model}, ${input.inputTokens}, ${input.outputTokens}, ${input.createdByMemberId})
  `;
}

async function getOwnDraft(
  tx: postgres.TransactionSql,
  organizationId: string,
  draftId: string,
): Promise<AiDraftRow> {
  const [draft] = await tx<
    AiDraftRow[]
  >`select * from ai_drafts where id = ${draftId} and organization_id = ${organizationId}`;
  if (!draft) throw new AppError("not_found", "AI draft not found.");
  return draft;
}

export async function listAiDrafts(
  filters: { draftType?: AiDraftType; status?: AiDraftRow["status"] } = {},
): Promise<AiDraftRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<AiDraftRow[]>`
      select * from ai_drafts
      where organization_id = ${membership.organization.id}
        and (${filters.draftType ?? null}::text is null or draft_type = ${filters.draftType ?? null})
        and (${filters.status ?? null}::text is null or status = ${filters.status ?? null})
      order by created_at desc
    `,
  );
}

export async function getAiDraft(draftId: string): Promise<AiDraftRow> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), (tx) =>
    getOwnDraft(tx, membership.organization.id, draftId),
  );
}

export async function acceptAiDraft(
  draftId: string,
  acceptedResource?: { resourceType: string; resourceId: string },
): Promise<AiDraftRow> {
  const preCheck = await getCurrentMembership();
  const draft = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnDraft(tx, preCheck.organization.id, draftId),
  );
  if (draft.status !== "pending")
    throw new AppError("conflict", "This draft has already been decided.");
  const membership = await requirePermission("ai.use", {
    scope: { departmentId: draft.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<AiDraftRow[]>`
      update ai_drafts set
        status = 'accepted', decided_at = now(), decided_by = ${membership.member.id},
        accepted_resource_type = ${acceptedResource?.resourceType ?? null},
        accepted_resource_id = ${acceptedResource?.resourceId ?? null}
      where id = ${draftId}
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.AiDraftAccepted,
      resourceType: AuditResourceType.AiDraft,
      resourceId: draftId,
      source: "app",
    });
    return updated;
  });
}

export async function dismissAiDraft(draftId: string): Promise<AiDraftRow> {
  const preCheck = await getCurrentMembership();
  const draft = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnDraft(tx, preCheck.organization.id, draftId),
  );
  if (draft.status !== "pending")
    throw new AppError("conflict", "This draft has already been decided.");
  const membership = await requirePermission("ai.use", {
    scope: { departmentId: draft.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<AiDraftRow[]>`
      update ai_drafts set status = 'dismissed', decided_at = now(), decided_by = ${membership.member.id}
      where id = ${draftId}
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.AiDraftDismissed,
      resourceType: AuditResourceType.AiDraft,
      resourceId: draftId,
      source: "app",
    });
    return updated;
  });
}
