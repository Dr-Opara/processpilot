import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { TrainingCourseRow, TrainingCourseVersionRow } from "@/lib/db/database.types";

/**
 * Training course authoring and versioning — the same mutable-shell/
 * immutable-published-version split ADR-0011 established for
 * Document/Process/Form (forms.ts is the closest precedent). A course
 * version optionally carries a multiple-choice assessment (see
 * training-assessment.ts for the question schema and scoring); a
 * published version can never be edited in place, only superseded by a
 * new one, so an in-progress training-assignment's snapshotted version
 * never changes underneath it.
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

export const trainingCourseInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().trim().max(5000).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  ownerMemberId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
});

export type TrainingCourseInput = z.infer<typeof trainingCourseInputSchema>;

export async function listTrainingCourses(): Promise<TrainingCourseRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<TrainingCourseRow[]>`
      select * from training_courses where organization_id = ${membership.organization.id} order by title asc
    `,
  );
}

async function getOwnCourse(
  tx: postgres.TransactionSql,
  organizationId: string,
  courseId: string,
): Promise<TrainingCourseRow> {
  const [course] = await tx<TrainingCourseRow[]>`
    select * from training_courses where id = ${courseId} and organization_id = ${organizationId}
  `;
  if (!course) throw new AppError("not_found", "Training course not found.");
  return course;
}

export async function getTrainingCourse(courseId: string): Promise<TrainingCourseRow> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), (tx) =>
    getOwnCourse(tx, membership.organization.id, courseId),
  );
}

export async function createTrainingCourse(input: TrainingCourseInput): Promise<TrainingCourseRow> {
  const data = trainingCourseInputSchema.parse(input);
  const membership = await requirePermission("training.manage", {
    scope: { departmentId: data.departmentId ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [course] = await tx<TrainingCourseRow[]>`
      insert into training_courses (organization_id, department_id, title, description, category, owner_member_id, created_by)
      values (
        ${membership.organization.id}, ${data.departmentId ?? null}, ${data.title}, ${data.description ?? null},
        ${data.category ?? null}, ${data.ownerMemberId ?? null}, ${membership.profile.id}
      )
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TrainingCourseCreated,
      resourceType: AuditResourceType.TrainingCourse,
      resourceId: course.id,
      source: "app",
    });
    return course;
  });
}

async function assertNoDraftInProgress(
  tx: postgres.TransactionSql,
  courseId: string,
): Promise<void> {
  const [existing] = await tx<{ id: string }[]>`
    select id from training_course_versions where course_id = ${courseId} and status = 'draft'
  `;
  if (existing) throw new AppError("conflict", "A draft version already exists for this course.");
}

const assessmentOptionSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
});
const assessmentQuestionSchema = z.object({
  id: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
  options: z.array(assessmentOptionSchema).min(2, "At least two options are required."),
  correctOptionKey: z.string().trim().min(1),
});

export const trainingCourseVersionInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(300),
    content: z.string().trim().min(1, "Content is required"),
    hasAssessment: z.boolean().default(false),
    assessmentQuestions: z.array(assessmentQuestionSchema).default([]),
    passingScorePercent: z.number().int().min(0).max(100).optional().nullable(),
  })
  .refine(
    (data) =>
      !data.hasAssessment ||
      (data.assessmentQuestions.length > 0 && data.passingScorePercent != null),
    { message: "An assessment requires at least one question and a passing score." },
  )
  .refine(
    (data) =>
      data.assessmentQuestions.every((q) =>
        q.options.some((option) => option.key === q.correctOptionKey),
      ),
    { message: "Each question's correctOptionKey must match one of its own options." },
  );

export type TrainingCourseVersionInput = z.infer<typeof trainingCourseVersionInputSchema>;

export async function createDraftCourseVersion(
  courseId: string,
  input: TrainingCourseVersionInput,
): Promise<TrainingCourseVersionRow> {
  const data = trainingCourseVersionInputSchema.parse(input);
  const preCheck = await getCurrentMembership();
  const course = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnCourse(tx, preCheck.organization.id, courseId),
  );
  const membership = await requirePermission("training.manage", {
    scope: { departmentId: course.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    await assertNoDraftInProgress(tx, courseId);

    const [{ max_version }] = await tx<{ max_version: number }[]>`
      select coalesce(max(version_number), 0) as max_version from training_course_versions where course_id = ${courseId}
    `;

    const [version] = await tx<TrainingCourseVersionRow[]>`
      insert into training_course_versions (
        organization_id, course_id, version_number, title, content, has_assessment, assessment_questions,
        passing_score_percent, created_by
      ) values (
        ${membership.organization.id}, ${courseId}, ${max_version + 1}, ${data.title}, ${data.content},
        ${data.hasAssessment}, ${tx.json(data.assessmentQuestions as unknown as Parameters<typeof tx.json>[0])},
        ${data.passingScorePercent ?? null}, ${membership.profile.id}
      )
      returning *
    `;
    return version;
  });
}

async function getOwnCourseVersion(
  tx: postgres.TransactionSql,
  organizationId: string,
  versionId: string,
): Promise<TrainingCourseVersionRow> {
  const [version] = await tx<TrainingCourseVersionRow[]>`
    select * from training_course_versions where id = ${versionId} and organization_id = ${organizationId}
  `;
  if (!version) throw new AppError("not_found", "Training course version not found.");
  return version;
}

/** Publishes a draft version: supersedes the course's previously-published version (if any) and points the course at this one — same shape as forms.ts's publishFormVersion(). */
export async function publishCourseVersion(versionId: string): Promise<TrainingCourseVersionRow> {
  const preCheck = await getCurrentMembership();
  const version = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnCourseVersion(tx, preCheck.organization.id, versionId),
  );
  if (version.status !== "draft")
    throw new AppError("conflict", "Only a draft version can be published.");
  const membership = await requirePermission("training.manage", {
    scope: { departmentId: version.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [course] = await tx<TrainingCourseRow[]>`
      select * from training_courses where id = ${version.course_id}
    `;
    if (course.current_version_id) {
      await tx`update training_course_versions set status = 'superseded' where id = ${course.current_version_id}`;
    }

    const [published] = await tx<TrainingCourseVersionRow[]>`
      update training_course_versions set status = 'published', published_by = ${membership.member.id}, published_at = now()
      where id = ${versionId}
      returning *
    `;
    await tx`
      update training_courses set current_version_id = ${versionId}, status = 'published', updated_at = now()
      where id = ${version.course_id}
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TrainingCourseVersionPublished,
      resourceType: AuditResourceType.TrainingCourse,
      resourceId: version.course_id,
      source: "app",
    });
    return published;
  });
}

export async function archiveTrainingCourse(courseId: string): Promise<TrainingCourseRow> {
  const preCheck = await getCurrentMembership();
  const course = await withTenantContext(toTenantContext(preCheck), (tx) =>
    getOwnCourse(tx, preCheck.organization.id, courseId),
  );
  const membership = await requirePermission("training.manage", {
    scope: { departmentId: course.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<TrainingCourseRow[]>`
      update training_courses set status = 'archived', archived_at = now(), updated_at = now()
      where id = ${courseId}
      returning *
    `;
    return updated;
  });
}

export async function listCourseVersions(courseId: string): Promise<TrainingCourseVersionRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<TrainingCourseVersionRow[]>`
      select * from training_course_versions where course_id = ${courseId} and organization_id = ${membership.organization.id}
      order by version_number desc
    `,
  );
}

export async function getCourseVersion(versionId: string): Promise<TrainingCourseVersionRow> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), (tx) =>
    getOwnCourseVersion(tx, membership.organization.id, versionId),
  );
}

export async function getPublishedCourseVersion(
  courseId: string,
): Promise<TrainingCourseVersionRow | null> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [version] = await tx<TrainingCourseVersionRow[]>`
      select tcv.* from training_course_versions tcv
      join training_courses tc on tc.id = tcv.course_id
      where tc.id = ${courseId} and tc.organization_id = ${membership.organization.id} and tcv.id = tc.current_version_id
    `;
    return version ?? null;
  });
}
