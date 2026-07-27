import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { scoreAssessment } from "@/lib/services/training-assessment";
import { issueCertification } from "@/lib/services/certifications";
import type {
  TrainingAssignedVia,
  TrainingAssignmentRow,
  TrainingCourseVersionRow,
} from "@/lib/db/database.types";

/**
 * Training assignment — fans a published course version out to one row
 * per resolved assignee (role/department/team/individual), tracks
 * completion (with assessment scoring, if the version has one), and
 * triggers certification issuance on a pass. One row per
 * (course_version, assignee) — a retake updates the same row rather
 * than creating a duplicate; training_assignment_history is the
 * append-only log of every status change.
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

async function recordHistory(
  tx: postgres.TransactionSql,
  assignment: Pick<TrainingAssignmentRow, "id" | "organization_id" | "department_id">,
  eventType: string,
  actorMemberId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await tx`
    insert into training_assignment_history (organization_id, department_id, training_assignment_id, event_type, actor_member_id, metadata)
    values (${assignment.organization_id}, ${assignment.department_id}, ${assignment.id}, ${eventType}, ${actorMemberId}, ${tx.json(metadata as unknown as Parameters<typeof tx.json>[0])})
  `;
}

/** Resolves a role/department/team/individual assignment target into concrete active member ids — the training-specific counterpart to approval-resolution.ts's resolveMemberIdsForRule(), which resolves to a single owner/manager rather than every member of the group. */
export async function resolveTrainingAssignees(
  tx: postgres.Sql | postgres.TransactionSql,
  organizationId: string,
  assignedVia: TrainingAssignedVia,
  targetId: string,
): Promise<string[]> {
  switch (assignedVia) {
    case "individual":
      return [targetId];
    case "role": {
      const rows = await tx<{ organization_member_id: string }[]>`
        select mra.organization_member_id from member_role_assignments mra
        join organization_members om on om.id = mra.organization_member_id
        where mra.role_id = ${targetId} and mra.organization_id = ${organizationId} and om.status = 'active'
      `;
      return rows.map((r) => r.organization_member_id);
    }
    case "department": {
      const rows = await tx<{ id: string }[]>`
        select id from organization_members where department_id = ${targetId} and organization_id = ${organizationId} and status = 'active'
      `;
      return rows.map((r) => r.id);
    }
    case "team": {
      const rows = await tx<{ organization_member_id: string }[]>`
        select tm.organization_member_id from team_members tm
        join organization_members om on om.id = tm.organization_member_id
        where tm.team_id = ${targetId} and tm.organization_id = ${organizationId} and om.status = 'active'
      `;
      return rows.map((r) => r.organization_member_id);
    }
  }
}

export const assignTrainingInputSchema = z.object({
  courseVersionId: z.string().uuid(),
  assignedVia: z.enum(["individual", "role", "department", "team"]),
  targetId: z.string().uuid(),
  dueAt: z.string().datetime().optional().nullable(),
});

export type AssignTrainingInput = z.infer<typeof assignTrainingInputSchema>;

/** Fans a course version out to every member resolved from the assignment rule. Existing (course_version, member) pairs are left untouched — re-running the same assignment is a no-op for members already assigned, not a duplicate or a reset. */
export async function assignTraining(input: AssignTrainingInput): Promise<TrainingAssignmentRow[]> {
  const data = assignTrainingInputSchema.parse(input);
  const preCheck = await getCurrentMembership();
  const version = await withTenantContext(toTenantContext(preCheck), async (tx) => {
    const [row] = await tx<TrainingCourseVersionRow[]>`
      select * from training_course_versions where id = ${data.courseVersionId} and organization_id = ${preCheck.organization.id}
    `;
    if (!row) throw new AppError("not_found", "Training course version not found.");
    if (row.status !== "published")
      throw new AppError("conflict", "Only a published course version can be assigned.");
    return row;
  });
  const membership = await requirePermission("training.manage", {
    scope: { departmentId: version.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const memberIds = await resolveTrainingAssignees(
      tx,
      membership.organization.id,
      data.assignedVia,
      data.targetId,
    );
    if (memberIds.length === 0) {
      throw new AppError("conflict", "This assignment rule resolved to no eligible members.");
    }

    const assignments: TrainingAssignmentRow[] = [];
    for (const memberId of memberIds) {
      const [assignment] = await tx<TrainingAssignmentRow[]>`
        insert into training_assignments (organization_id, department_id, course_version_id, assignee_member_id, assigned_via, due_at, created_by)
        values (${membership.organization.id}, ${version.department_id}, ${data.courseVersionId}, ${memberId}, ${data.assignedVia}, ${data.dueAt ?? null}, ${membership.profile.id})
        on conflict (course_version_id, assignee_member_id) do nothing
        returning *
      `;
      if (assignment) {
        await recordHistory(tx, assignment, "training_assignment.created", membership.member.id, {
          assignedVia: data.assignedVia,
        });
        if (data.dueAt) {
          await enqueueJob(tx, membership.organization.id, {
            jobType: "training-assignment-overdue-check",
            payload: { assignmentId: assignment.id },
            idempotencyKey: `training-assignment-overdue-check:${assignment.id}`,
            scheduledAt: new Date(data.dueAt),
          });
        }
        assignments.push(assignment);
      }
    }

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TrainingAssignmentCreated,
      resourceType: AuditResourceType.TrainingAssignment,
      resourceId: data.courseVersionId,
      departmentId: version.department_id,
      source: "app",
    });

    return assignments;
  });
}

async function getOwnAssignment(
  tx: postgres.TransactionSql,
  organizationId: string,
  assignmentId: string,
): Promise<TrainingAssignmentRow> {
  const [assignment] = await tx<TrainingAssignmentRow[]>`
    select * from training_assignments where id = ${assignmentId} and organization_id = ${organizationId}
  `;
  if (!assignment) throw new AppError("not_found", "Training assignment not found.");
  return assignment;
}

export async function listMyTrainingAssignments(): Promise<TrainingAssignmentRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<TrainingAssignmentRow[]>`
      select * from training_assignments
      where organization_id = ${membership.organization.id} and assignee_member_id = ${membership.member.id}
      order by created_at desc
    `,
  );
}

export async function listAllTrainingAssignments(): Promise<TrainingAssignmentRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<TrainingAssignmentRow[]>`
      select * from training_assignments where organization_id = ${membership.organization.id} order by created_at desc
    `,
  );
}

export async function getTrainingAssignment(assignmentId: string): Promise<TrainingAssignmentRow> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), (tx) =>
    getOwnAssignment(tx, membership.organization.id, assignmentId),
  );
}

export async function startTrainingAssignment(
  assignmentId: string,
): Promise<TrainingAssignmentRow> {
  const preCheck = await getCurrentMembership();
  const assignment = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnAssignment(tx, preCheck.organization.id, assignmentId),
  );
  if (assignment.assignee_member_id !== preCheck.member.id) {
    throw new AppError("forbidden", "You are not the assignee of this training.");
  }
  const membership = await requirePermission("training.complete", {
    scope: { departmentId: assignment.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<TrainingAssignmentRow[]>`
      update training_assignments set status = 'in_progress', started_at = coalesce(started_at, now())
      where id = ${assignmentId} and status in ('assigned', 'overdue')
      returning *
    `;
    if (!updated) throw new AppError("conflict", "This assignment is not open.");
    return updated;
  });
}

export interface CompleteTrainingAssignmentInput {
  answers?: Record<string, string>;
  /** Certification validity, when the course version has no assessment (an automatic pass) or passes one — a caller-supplied value rather than a default, since expiry policy varies per course. */
  certificationExpiresAt?: string | null;
}

/** Completes an assignment — scores the linked assessment (if any), and on a pass, issues a certification for the parent course. Failing does not close the assignment; retakeTrainingAssignment() resets it for another attempt. */
export async function completeTrainingAssignment(
  assignmentId: string,
  input: CompleteTrainingAssignmentInput = {},
): Promise<TrainingAssignmentRow> {
  const preCheck = await getCurrentMembership();
  const assignment = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnAssignment(tx, preCheck.organization.id, assignmentId),
  );
  if (assignment.assignee_member_id !== preCheck.member.id) {
    throw new AppError("forbidden", "You are not the assignee of this training.");
  }
  if (
    assignment.status !== "in_progress" &&
    assignment.status !== "assigned" &&
    assignment.status !== "overdue"
  ) {
    throw new AppError("conflict", "This assignment is not open.");
  }
  const membership = await requirePermission("training.complete", {
    scope: { departmentId: assignment.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [version] = await tx<TrainingCourseVersionRow[]>`
      select * from training_course_versions where id = ${assignment.course_version_id}
    `;
    const answers = input.answers ?? {};
    const { scorePercent, passed } = version.has_assessment
      ? scoreAssessment(version.assessment_questions, answers, version.passing_score_percent ?? 100)
      : { scorePercent: 100, passed: true };

    const [updated] = await tx<TrainingAssignmentRow[]>`
      update training_assignments set
        status = ${passed ? "completed" : "assigned"},
        attempt_count = attempt_count + 1,
        completed_at = ${passed ? new Date() : null},
        score_percent = ${scorePercent},
        passed = ${passed},
        answers = ${tx.json(answers as unknown as Parameters<typeof tx.json>[0])}
      where id = ${assignmentId}
      returning *
    `;

    await recordHistory(
      tx,
      updated,
      passed ? "training_assignment.completed" : "training_assignment.failed_attempt",
      membership.member.id,
      {
        scorePercent,
      },
    );

    if (passed) {
      await recordAuditEvent(tx, {
        organizationId: membership.organization.id,
        actorProfileId: membership.profile.id,
        action: AuditAction.TrainingAssignmentCompleted,
        resourceType: AuditResourceType.TrainingAssignment,
        resourceId: assignmentId,
        departmentId: assignment.department_id,
        source: "app",
      });
      await issueCertification(tx, {
        organizationId: membership.organization.id,
        departmentId: assignment.department_id,
        memberId: membership.member.id,
        courseId: version.course_id,
        trainingAssignmentId: assignmentId,
        expiresAt: input.certificationExpiresAt ?? null,
        actorProfileId: membership.profile.id,
      });
    }

    return updated;
  });
}

export async function retakeTrainingAssignment(
  assignmentId: string,
): Promise<TrainingAssignmentRow> {
  const preCheck = await getCurrentMembership();
  const assignment = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnAssignment(tx, preCheck.organization.id, assignmentId),
  );
  if (assignment.assignee_member_id !== preCheck.member.id) {
    throw new AppError("forbidden", "You are not the assignee of this training.");
  }
  if (assignment.passed) throw new AppError("conflict", "This assignment has already been passed.");
  const membership = await requirePermission("training.complete", {
    scope: { departmentId: assignment.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<TrainingAssignmentRow[]>`
      update training_assignments set status = 'in_progress' where id = ${assignmentId} returning *
    `;
    return updated;
  });
}

export async function waiveTrainingAssignment(
  assignmentId: string,
  reason: string,
): Promise<TrainingAssignmentRow> {
  const trimmedReason = reason.trim();
  if (!trimmedReason)
    throw new AppError("conflict", "A reason is required to waive a training assignment.");

  const preCheck = await getCurrentMembership();
  const assignment = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnAssignment(tx, preCheck.organization.id, assignmentId),
  );
  const membership = await requirePermission("training.manage", {
    scope: { departmentId: assignment.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<TrainingAssignmentRow[]>`
      update training_assignments set status = 'waived', waived_reason = ${trimmedReason}, waived_by = ${membership.member.id}
      where id = ${assignmentId}
      returning *
    `;
    await recordHistory(tx, updated, "training_assignment.waived", membership.member.id, {
      reason: trimmedReason,
    });
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TrainingAssignmentWaived,
      resourceType: AuditResourceType.TrainingAssignment,
      resourceId: assignmentId,
      departmentId: assignment.department_id,
      source: "app",
      reason: trimmedReason,
    });
    return updated;
  });
}

/** Marks a single past-due assignment 'overdue' — called by the training-assignment-overdue-check background job, scheduled per-assignment at its due_at (see assignTraining()). Idempotent, same "check before acting" shape as waivers.ts's expireWaiver: a no-op if the assignment was since completed/waived or is no longer past due. */
export async function markAssignmentOverdue(
  tx: postgres.TransactionSql,
  assignmentId: string,
  organizationId: string,
): Promise<void> {
  const [assignment] = await tx<TrainingAssignmentRow[]>`
    select * from training_assignments where id = ${assignmentId} and organization_id = ${organizationId}
  `;
  if (!assignment) return;
  if (assignment.status !== "assigned" && assignment.status !== "in_progress") return;
  if (!assignment.due_at || new Date(assignment.due_at) > new Date()) return;

  await tx`update training_assignments set status = 'overdue' where id = ${assignmentId}`;
  await recordHistory(tx, assignment, "training_assignment.overdue", null);
}
