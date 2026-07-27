import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { findRecurrenceMatches } from "@/lib/services/exception-recurrence";
import type {
  ExceptionCommentRow,
  ExceptionHistoryRow,
  ExceptionLikelihoodImpact,
  ExceptionLinkedType,
  ExceptionRow,
  ExceptionSeverity,
  ExceptionSource,
  ExceptionStatus,
  ExceptionType,
} from "@/lib/db/database.types";

/**
 * Exception management (Phase 11) — the queue, triage, investigation,
 * and closure lifecycle for a recorded deviation
 * (product/terminology.md's `Exception`). Automatic creation from other
 * subsystems (workflow failure, missed SLA, rejected approval, evidence
 * rejection, ...) goes through createSystemException(), called from
 * within an already-open transaction by workflow-engine.ts/escalation.ts/
 * evidence.ts rather than opening its own — see that function's own
 * comment on why, and on the idempotency guard that makes a retried
 * caller a no-op instead of a duplicate.
 *
 * Root-cause analysis, containment actions, CAPA plans, and temporary
 * waivers each have their own file (exception-root-cause.ts,
 * exception-containment.ts, capa.ts, waivers.ts) — this file owns only
 * the exception record itself: its lifecycle status, severity/priority,
 * ownership, comments, and links to other records.
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

const EXCEPTION_TYPES = [
  "process_deviation",
  "policy_exception",
  "control_failure",
  "missed_sla",
  "evidence_deficiency",
  "task_failure",
  "security_issue",
  "training_deficiency",
  "vendor_issue",
  "data_quality_issue",
  "other",
] as const;

const MANUAL_SOURCES = [
  "employee_submission",
  "manager_submission",
  "administrative_entry",
] as const;

const LIKELIHOOD_IMPACT = ["low", "moderate", "high"] as const;
const SEVERITY = ["low", "moderate", "high", "critical"] as const;

export const createExceptionInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().trim().max(10_000).optional().nullable(),
  exceptionType: z.enum(EXCEPTION_TYPES),
  source: z.enum(MANUAL_SOURCES).default("employee_submission"),
  severity: z.enum(SEVERITY).default("moderate"),
  likelihood: z.enum(LIKELIHOOD_IMPACT).optional().nullable(),
  impact: z.enum(LIKELIHOOD_IMPACT).optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  ownerMemberId: z.string().uuid().optional().nullable(),
  processId: z.string().uuid().optional().nullable(),
  workflowId: z.string().uuid().optional().nullable(),
  taskId: z.string().uuid().optional().nullable(),
  documentId: z.string().uuid().optional().nullable(),
  evidenceId: z.string().uuid().optional().nullable(),
  controlReference: z.string().trim().max(300).optional().nullable(),
  occurredAt: z.string().datetime().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  // Business-impact inputs to calculatePriority(); not persisted as
  // their own columns (only the resulting `priority` is), since they're
  // just calculation inputs, not attributes of the exception itself.
  regulatoryImpact: z.boolean().default(false),
  recurrence: z.boolean().default(false),
  slaBreach: z.boolean().default(false),
  customerImpact: z.boolean().default(false),
});

export type CreateExceptionInput = z.infer<typeof createExceptionInputSchema>;

const PRIORITY_ORDER: ExceptionSeverity[] = ["low", "moderate", "high", "critical"];

/**
 * A deliberately simple, documented scoring function — not a
 * proprietary risk model. Severity is the starting point (an exception
 * always starts at its own severity's priority level); each aggravating
 * risk input (high likelihood, high impact, regulatory impact,
 * recurrence, an SLA breach, customer impact) counts as one "boost,"
 * and every two boosts pushes priority up one level, capped at
 * `critical`. A caller who disagrees can always override via the
 * `priorityOverride` param on createException()/triageException(),
 * which is exactly what "allow authorized manual override with
 * required reason" calls for.
 */
export function calculatePriority(input: {
  severity: ExceptionSeverity;
  likelihood?: ExceptionLikelihoodImpact | null;
  impact?: ExceptionLikelihoodImpact | null;
  regulatoryImpact?: boolean;
  recurrence?: boolean;
  slaBreach?: boolean;
  customerImpact?: boolean;
}): ExceptionSeverity {
  let boosts = 0;
  if (input.likelihood === "high") boosts += 1;
  if (input.impact === "high") boosts += 1;
  if (input.regulatoryImpact) boosts += 1;
  if (input.recurrence) boosts += 1;
  if (input.slaBreach) boosts += 1;
  if (input.customerImpact) boosts += 1;

  const baseIndex = PRIORITY_ORDER.indexOf(input.severity);
  const boostedIndex = Math.min(baseIndex + Math.floor(boosts / 2), PRIORITY_ORDER.length - 1);
  return PRIORITY_ORDER[boostedIndex];
}

async function recordHistory(
  tx: postgres.Sql | postgres.TransactionSql,
  exception: Pick<ExceptionRow, "id" | "organization_id" | "department_id">,
  eventType: string,
  actorMemberId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await tx`
    insert into exception_history (organization_id, department_id, exception_id, event_type, actor_member_id, metadata)
    values (${exception.organization_id}, ${exception.department_id}, ${exception.id}, ${eventType}, ${actorMemberId}, ${tx.json(metadata as unknown as Parameters<typeof tx.json>[0])})
  `;
}

export async function createException(input: CreateExceptionInput): Promise<ExceptionRow> {
  const data = createExceptionInputSchema.parse(input);
  const membership = await requirePermission("exceptions.create", {
    scope: { departmentId: data.departmentId ?? undefined },
  });

  const priority = calculatePriority(data);

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [exception] = await tx<ExceptionRow[]>`
      insert into exceptions (
        organization_id, department_id, location_id, team_id, title, description, exception_type, source,
        severity, likelihood, impact, priority, status, reporter_member_id, owner_member_id, process_id,
        workflow_id, task_id, document_id, evidence_id, control_reference, occurred_at, due_at, tags,
        created_by_member_id
      ) values (
        ${membership.organization.id}, ${data.departmentId ?? null}, ${data.locationId ?? null}, ${data.teamId ?? null},
        ${data.title}, ${data.description ?? null}, ${data.exceptionType}, ${data.source},
        ${data.severity}, ${data.likelihood ?? null}, ${data.impact ?? null}, ${priority}, 'reported',
        ${membership.member.id}, ${data.ownerMemberId ?? null}, ${data.processId ?? null},
        ${data.workflowId ?? null}, ${data.taskId ?? null}, ${data.documentId ?? null}, ${data.evidenceId ?? null},
        ${data.controlReference ?? null}, ${data.occurredAt ?? null}, ${data.dueAt ?? null}, ${data.tags},
        ${membership.member.id}
      )
      returning *
    `;

    await recordHistory(tx, exception, "exception.created", membership.member.id, {
      source: data.source,
    });
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ExceptionCreated,
      resourceType: AuditResourceType.Exception,
      resourceId: exception.id,
      departmentId: exception.department_id,
      source: "app",
    });

    await findRecurrenceMatches(tx, exception);

    return exception;
  });
}

export interface SystemExceptionInput {
  organizationId: string;
  departmentId?: string | null;
  title: string;
  description?: string | null;
  exceptionType: ExceptionType;
  source: ExceptionSource;
  severity?: ExceptionSeverity;
  workflowId?: string | null;
  taskId?: string | null;
  processId?: string | null;
  evidenceId?: string | null;
  approvalDecisionId?: string | null;
  formSubmissionId?: string | null;
  /** De-duplication key: skip creating a new exception if an open one already exists matching this. Required — every system-creation call site has a natural one (the failing task/workflow/evidence id plus source). */
  idempotencyMatch: {
    taskId?: string | null;
    workflowId?: string | null;
    evidenceId?: string | null;
  };
}

/**
 * Automatic exception creation from another subsystem (workflow
 * failure, missed SLA, rejected approval, evidence rejection, ...) —
 * called from within an already-open transaction (workflow-engine.ts's
 * failWorkflow(), escalation.ts's admin-escalation firing, evidence.ts's
 * reviewEvidence() rejection path), never opening its own
 * withTenantContext(). No permission check: the caller is always
 * trusted engine/job code that has already established its own
 * authorization for the action that triggered this (e.g. the workflow
 * engine's own transaction, or the escalation job's admin client) —
 * same reasoning as escalation_events_insert's RLS policy.
 *
 * Idempotent: if an exception with the same source/target combination
 * is already open, this is a no-op that returns the existing row rather
 * than creating a duplicate — a background job or an event handler
 * retried after a crash must not fan out into multiple exceptions for
 * the same underlying failure.
 */
export async function createSystemException(
  tx: postgres.Sql | postgres.TransactionSql,
  input: SystemExceptionInput,
): Promise<ExceptionRow> {
  const existing = await tx<ExceptionRow[]>`
    select * from exceptions
    where organization_id = ${input.organizationId}
      and source = ${input.source}
      and status not in ('closed', 'rejected')
      and (
        (${input.idempotencyMatch.taskId ?? null}::uuid is not null and task_id = ${input.idempotencyMatch.taskId ?? null})
        or (${input.idempotencyMatch.workflowId ?? null}::uuid is not null and task_id is null and workflow_id = ${input.idempotencyMatch.workflowId ?? null})
        or (${input.idempotencyMatch.evidenceId ?? null}::uuid is not null and evidence_id = ${input.idempotencyMatch.evidenceId ?? null})
      )
  `;
  if (existing.length > 0) return existing[0];

  const priority = calculatePriority({
    severity: input.severity ?? "moderate",
    slaBreach: input.source === "missed_sla",
  });

  const [exception] = await tx<ExceptionRow[]>`
    insert into exceptions (
      organization_id, department_id, title, description, exception_type, source, severity, priority, status,
      process_id, workflow_id, task_id, evidence_id, approval_decision_id, form_submission_id
    ) values (
      ${input.organizationId}, ${input.departmentId ?? null}, ${input.title}, ${input.description ?? null},
      ${input.exceptionType}, ${input.source}, ${input.severity ?? "moderate"}, ${priority}, 'reported',
      ${input.processId ?? null}, ${input.workflowId ?? null}, ${input.taskId ?? null}, ${input.evidenceId ?? null},
      ${input.approvalDecisionId ?? null}, ${input.formSubmissionId ?? null}
    )
    returning *
  `;

  await recordHistory(tx, exception, "exception.created", null, { source: input.source });
  await recordAuditEvent(tx, {
    organizationId: input.organizationId,
    action: AuditAction.ExceptionCreated,
    resourceType: AuditResourceType.Exception,
    resourceId: exception.id,
    departmentId: exception.department_id,
    source: "system",
  });
  await findRecurrenceMatches(tx, exception);

  return exception;
}

export interface ListExceptionsFilters {
  status?: ExceptionStatus;
  severity?: ExceptionSeverity;
  exceptionType?: ExceptionType;
  ownerMemberId?: string;
  overdueOnly?: boolean;
}

export async function listExceptions(filters: ListExceptionsFilters = {}): Promise<ExceptionRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<ExceptionRow[]>`
      select * from exceptions
      where organization_id = ${membership.organization.id}
        and (${filters.status ?? null}::text is null or status = ${filters.status ?? null})
        and (${filters.severity ?? null}::text is null or severity = ${filters.severity ?? null})
        and (${filters.exceptionType ?? null}::text is null or exception_type = ${filters.exceptionType ?? null})
        and (${filters.ownerMemberId ?? null}::uuid is null or owner_member_id = ${filters.ownerMemberId ?? null})
        and (${filters.overdueOnly ?? false} = false or (due_at is not null and due_at < now() and status not in ('closed', 'rejected')))
      order by created_at desc
    `,
  );
}

async function getOwnException(
  tx: postgres.TransactionSql,
  organizationId: string,
  exceptionId: string,
): Promise<ExceptionRow> {
  const [exception] = await tx<ExceptionRow[]>`
    select * from exceptions where id = ${exceptionId} and organization_id = ${organizationId}
  `;
  if (!exception) throw new AppError("not_found", "Exception not found.");
  return exception;
}

export async function getException(exceptionId: string): Promise<ExceptionRow> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), (tx) =>
    getOwnException(tx, membership.organization.id, exceptionId),
  );
}

export const triageExceptionInputSchema = z.object({
  severity: z.enum(SEVERITY).optional(),
  likelihood: z.enum(LIKELIHOOD_IMPACT).optional().nullable(),
  impact: z.enum(LIKELIHOOD_IMPACT).optional().nullable(),
  ownerMemberId: z.string().uuid().optional().nullable(),
  investigatorMemberId: z.string().uuid().optional().nullable(),
  priorityOverride: z.enum(SEVERITY).optional(),
  priorityOverrideReason: z.string().trim().max(2000).optional(),
});

export type TriageExceptionInput = z.infer<typeof triageExceptionInputSchema>;

/** Sets severity/likelihood/impact/owner/investigator and recalculates priority — or applies a manual override, which requires a reason (this phase's "allow authorized manual override with required reason" requirement). */
export async function triageException(
  exceptionId: string,
  input: TriageExceptionInput,
): Promise<ExceptionRow> {
  const data = triageExceptionInputSchema.parse(input);
  if (data.priorityOverride && !data.priorityOverrideReason?.trim()) {
    throw new AppError("conflict", "A reason is required to override the calculated priority.");
  }

  const preCheck = await getCurrentMembership();
  const existing = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnException(tx, preCheck.organization.id, exceptionId),
  );
  const membership = await requirePermission("exceptions.triage", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const severity = data.severity ?? existing.severity;
    const likelihood = data.likelihood !== undefined ? data.likelihood : existing.likelihood;
    const impact = data.impact !== undefined ? data.impact : existing.impact;
    const priority = data.priorityOverride ?? calculatePriority({ severity, likelihood, impact });

    const [updated] = await tx<ExceptionRow[]>`
      update exceptions set
        severity = ${severity}, likelihood = ${likelihood}, impact = ${impact},
        priority = ${priority}, priority_overridden = ${Boolean(data.priorityOverride)},
        priority_override_reason = ${data.priorityOverride ? (data.priorityOverrideReason ?? null) : null},
        owner_member_id = ${data.ownerMemberId !== undefined ? data.ownerMemberId : existing.owner_member_id},
        investigator_member_id = ${data.investigatorMemberId !== undefined ? data.investigatorMemberId : existing.investigator_member_id},
        status = ${existing.status === "reported" ? "triaged" : existing.status},
        updated_at = now()
      where id = ${exceptionId}
      returning *
    `;

    await recordHistory(tx, updated, "exception.triaged", membership.member.id, {
      severity,
      priority,
      priorityOverridden: Boolean(data.priorityOverride),
    });
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ExceptionTriaged,
      resourceType: AuditResourceType.Exception,
      resourceId: exceptionId,
      departmentId: existing.department_id,
      source: "app",
    });

    return updated;
  });
}

export async function startInvestigation(exceptionId: string): Promise<ExceptionRow> {
  const preCheck = await getCurrentMembership();
  const existing = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnException(tx, preCheck.organization.id, exceptionId),
  );
  const membership = await requirePermission("exceptions.investigate", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<ExceptionRow[]>`
      update exceptions set status = 'under_investigation', updated_at = now() where id = ${exceptionId} returning *
    `;
    await recordHistory(tx, updated, "exception.investigation_started", membership.member.id);
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ExceptionInvestigationStarted,
      resourceType: AuditResourceType.Exception,
      resourceId: exceptionId,
      departmentId: existing.department_id,
      source: "app",
    });
    return updated;
  });
}

export async function setExceptionStatus(
  exceptionId: string,
  status: Extract<
    ExceptionStatus,
    | "containment_in_progress"
    | "action_plan_required"
    | "remediation_in_progress"
    | "pending_verification"
  >,
): Promise<ExceptionRow> {
  const preCheck = await getCurrentMembership();
  const existing = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnException(tx, preCheck.organization.id, exceptionId),
  );
  const membership = await requirePermission("exceptions.investigate", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<ExceptionRow[]>`
      update exceptions set status = ${status}, updated_at = now() where id = ${exceptionId} returning *
    `;
    await recordHistory(tx, updated, "exception.status_changed", membership.member.id, { status });
    return updated;
  });
}

export interface CloseExceptionInput {
  closureReason: string;
  /** Required unless allowClosureWithoutRootCause is set — "prevent closure without a documented root cause unless an authorized exception is recorded." */
  allowClosureWithoutRootCause?: boolean;
  allowClosureWithoutRootCauseReason?: string;
}

export async function closeException(
  exceptionId: string,
  input: CloseExceptionInput,
): Promise<ExceptionRow> {
  if (!input.closureReason?.trim()) throw new AppError("conflict", "A closure reason is required.");
  if (input.allowClosureWithoutRootCause && !input.allowClosureWithoutRootCauseReason?.trim()) {
    throw new AppError(
      "conflict",
      "A reason is required to close without a documented root cause.",
    );
  }

  const preCheck = await getCurrentMembership();
  const existing = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnException(tx, preCheck.organization.id, exceptionId),
  );
  const membership = await requirePermission("exceptions.close", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    if (!input.allowClosureWithoutRootCause) {
      const [rootCause] = await tx<{ id: string }[]>`
        select id from root_cause_analyses where exception_id = ${exceptionId} and primary_root_cause is not null
      `;
      if (!rootCause) {
        throw new AppError(
          "conflict",
          "This exception cannot be closed without a documented root cause, unless closed with an explicit override reason.",
        );
      }
    }

    const [updated] = await tx<ExceptionRow[]>`
      update exceptions set
        status = 'closed', closure_reason = ${input.closureReason.trim()},
        closed_at = now(), closed_by_member_id = ${membership.member.id}, updated_at = now()
      where id = ${exceptionId}
      returning *
    `;
    await recordHistory(tx, updated, "exception.closed", membership.member.id, {
      closureReason: input.closureReason.trim(),
      rootCauseOverride: Boolean(input.allowClosureWithoutRootCause),
    });
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ExceptionClosed,
      resourceType: AuditResourceType.Exception,
      resourceId: exceptionId,
      departmentId: existing.department_id,
      source: "app",
      reason: input.allowClosureWithoutRootCause
        ? input.allowClosureWithoutRootCauseReason
        : undefined,
    });
    return updated;
  });
}

export async function rejectException(exceptionId: string, reason: string): Promise<ExceptionRow> {
  const trimmedReason = reason.trim();
  if (!trimmedReason)
    throw new AppError("conflict", "A reason is required to reject an exception.");

  const preCheck = await getCurrentMembership();
  const existing = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnException(tx, preCheck.organization.id, exceptionId),
  );
  const membership = await requirePermission("exceptions.close", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<ExceptionRow[]>`
      update exceptions set
        status = 'rejected', closure_reason = ${trimmedReason}, closed_at = now(),
        closed_by_member_id = ${membership.member.id}, updated_at = now()
      where id = ${exceptionId}
      returning *
    `;
    await recordHistory(tx, updated, "exception.rejected", membership.member.id, {
      reason: trimmedReason,
    });
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ExceptionRejected,
      resourceType: AuditResourceType.Exception,
      resourceId: exceptionId,
      departmentId: existing.department_id,
      source: "app",
      reason: trimmedReason,
    });
    return updated;
  });
}

export async function reopenException(exceptionId: string, reason: string): Promise<ExceptionRow> {
  const trimmedReason = reason.trim();
  if (!trimmedReason)
    throw new AppError("conflict", "A reason is required to reopen an exception.");

  const preCheck = await getCurrentMembership();
  const existing = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnException(tx, preCheck.organization.id, exceptionId),
  );
  if (existing.status !== "closed" && existing.status !== "rejected") {
    throw new AppError("conflict", "Only a closed or rejected exception can be reopened.");
  }
  const membership = await requirePermission("exceptions.close", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<ExceptionRow[]>`
      update exceptions set
        status = 'reopened', reopen_reason = ${trimmedReason}, closed_at = null,
        closed_by_member_id = null, updated_at = now()
      where id = ${exceptionId}
      returning *
    `;
    await recordHistory(tx, updated, "exception.reopened", membership.member.id, {
      reason: trimmedReason,
    });
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ExceptionReopened,
      resourceType: AuditResourceType.Exception,
      resourceId: exceptionId,
      departmentId: existing.department_id,
      source: "app",
      reason: trimmedReason,
    });
    return updated;
  });
}

export async function addExceptionComment(exceptionId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new AppError("conflict", "Comment body cannot be empty.");

  const preCheck = await getCurrentMembership();
  const existing = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnException(tx, preCheck.organization.id, exceptionId),
  );
  const membership = await requirePermission("exceptions.view", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx`
      insert into exception_comments (organization_id, exception_id, author_member_id, body)
      values (${membership.organization.id}, ${exceptionId}, ${membership.member.id}, ${trimmed})
    `,
  );
}

export async function addExceptionLink(
  exceptionId: string,
  linkedType: ExceptionLinkedType,
  linkedId: string,
): Promise<void> {
  const preCheck = await getCurrentMembership();
  const existing = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnException(tx, preCheck.organization.id, exceptionId),
  );
  const membership = await requirePermission("exceptions.edit", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  await withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx`
      insert into exception_links (organization_id, exception_id, linked_type, linked_id, created_by_member_id)
      values (${membership.organization.id}, ${exceptionId}, ${linkedType}, ${linkedId}, ${membership.member.id})
      on conflict (exception_id, linked_type, linked_id) do nothing
    `,
  );
}

export async function listExceptionComments(exceptionId: string): Promise<ExceptionCommentRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<
        ExceptionCommentRow[]
      >`select * from exception_comments where exception_id = ${exceptionId} and organization_id = ${membership.organization.id} order by created_at asc`,
  );
}

export async function listExceptionHistory(exceptionId: string): Promise<ExceptionHistoryRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<
        ExceptionHistoryRow[]
      >`select * from exception_history where exception_id = ${exceptionId} and organization_id = ${membership.organization.id} order by created_at asc`,
  );
}
