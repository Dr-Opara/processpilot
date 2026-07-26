import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { getCurrentMembership } from "@/lib/authz";
import { getTrainingCourse, listCourseVersions } from "@/lib/services/training-courses";
import { listAllTrainingAssignments } from "@/lib/services/training-assignments";
import { listMembers } from "@/lib/services/members";
import { listRoles } from "@/lib/services/roles";
import { listDepartments } from "@/lib/services/departments";
import { listTeams } from "@/lib/services/teams";
import { memberDisplayName } from "@/lib/services/member-display";
import { AppError } from "@/lib/errors";
import type { TrainingCourseVersionStatus } from "@/lib/db/database.types";
import {
  assignTrainingAction,
  createDraftCourseVersionAction,
  publishCourseVersionAction,
} from "./actions";
import { TrainingAssignForm } from "./TrainingAssignForm";

function versionBadgeStatus(
  status: TrainingCourseVersionStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "published") return "success";
  if (status === "superseded") return "neutral";
  return "warning";
}

export default async function TrainingCourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { courseId } = await params;
  const { error } = await searchParams;

  let course;
  try {
    course = await getTrainingCourse(courseId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }

  const currentMembership = await getCurrentMembership().catch(() => null);
  const canManage = Boolean(
    currentMembership?.permissions.includes("training.manage") ||
    currentMembership?.scopedPermissions.includes("training.manage"),
  );

  const [versions, assignments, membersResult, roles, departments, teams] = await Promise.all([
    listCourseVersions(courseId).catch(() => []),
    listAllTrainingAssignments().catch(() => []),
    listMembers({ status: "active", pageSize: 100 }).catch(() => ({ members: [], total: 0 })),
    listRoles().catch(() => []),
    listDepartments().catch(() => []),
    listTeams().catch(() => []),
  ]);
  const courseAssignments = assignments.filter((a) =>
    versions.some((v) => v.id === a.course_version_id),
  );
  const draftVersion = versions.find((v) => v.status === "draft");
  const publishedVersion = versions.find((v) => v.id === course.current_version_id);
  const memberName = (memberId: string) => {
    const member = membersResult.members.find((m) => m.id === memberId);
    return member ? memberDisplayName(member) : memberId;
  };

  return (
    <Stack className="mx-auto max-w-3xl gap-8">
      <Stack className="gap-1">
        <Cluster className="gap-3">
          <Heading as="h1">{course.title}</Heading>
          <StatusBadge status={course.status === "published" ? "success" : "neutral"}>
            {course.status}
          </StatusBadge>
        </Cluster>
        {course.description && <Text className="text-muted">{course.description}</Text>}
      </Stack>

      {error && <Alert title="Action could not be completed" description={error} />}

      {publishedVersion && (
        <Stack className="gap-2 rounded-md border border-border p-4">
          <Heading as="h2">Current content (v{publishedVersion.version_number})</Heading>
          <Text className="whitespace-pre-wrap">{publishedVersion.content}</Text>
          {publishedVersion.has_assessment && (
            <Text className="text-sm text-muted">
              Includes an assessment · passing score {publishedVersion.passing_score_percent}%
            </Text>
          )}
        </Stack>
      )}

      {canManage && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">{draftVersion ? "Edit draft version" : "Author a new version"}</Heading>
          {draftVersion ? (
            <>
              <Text className="text-sm">
                A draft version (v{draftVersion.version_number}) is ready to publish.
              </Text>
              <form action={publishCourseVersionAction.bind(null, courseId, draftVersion.id)}>
                <Button type="submit">Publish this version</Button>
              </form>
            </>
          ) : (
            <form
              action={createDraftCourseVersionAction.bind(null, courseId)}
              className="flex flex-col gap-3"
            >
              <Input name="title" placeholder="Version title" required />
              <Textarea name="content" rows={6} placeholder="Course content" required />
              <Cluster className="items-center gap-2">
                <Checkbox id="hasAssessment" name="hasAssessment" />
                <Label htmlFor="hasAssessment">Include an assessment</Label>
              </Cluster>
              <Input
                name="passingScorePercent"
                type="number"
                min={0}
                max={100}
                placeholder="Passing score % (if assessed)"
              />
              <Textarea
                name="assessmentQuestions"
                rows={4}
                placeholder='[{"id":"q1","prompt":"...","options":[{"key":"a","label":"..."}],"correctOptionKey":"a"}]'
              />
              <Cluster className="justify-end">
                <Button type="submit" variant="secondary">
                  Save draft
                </Button>
              </Cluster>
            </form>
          )}
        </Stack>
      )}

      {canManage && publishedVersion && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">Assign training</Heading>
          <TrainingAssignForm
            action={assignTrainingAction.bind(null, courseId)}
            courseVersionId={publishedVersion.id}
            members={membersResult.members}
            roles={roles.map((r) => r.role)}
            departments={departments}
            teams={teams}
          />
        </Stack>
      )}

      <Stack className="gap-3">
        <Heading as="h2">Assignments</Heading>
        {courseAssignments.length === 0 ? (
          <Text className="text-muted">No one has been assigned this course yet.</Text>
        ) : (
          <Stack className="gap-2">
            {courseAssignments.map((assignment) => (
              <Cluster
                key={assignment.id}
                className="justify-between rounded-md border border-border/60 p-2"
              >
                <Text className="text-sm">{memberName(assignment.assignee_member_id)}</Text>
                <StatusBadge
                  status={
                    assignment.status === "completed"
                      ? "success"
                      : assignment.status === "overdue"
                        ? "danger"
                        : "warning"
                  }
                >
                  {assignment.status}
                </StatusBadge>
              </Cluster>
            ))}
          </Stack>
        )}
      </Stack>

      <Stack className="gap-3">
        <Heading as="h2">Versions</Heading>
        {versions.map((version) => (
          <Cluster
            key={version.id}
            className="justify-between rounded-md border border-border/60 p-2"
          >
            <Text className="text-sm">
              v{version.version_number} — {version.title}
            </Text>
            <StatusBadge status={versionBadgeStatus(version.status)}>{version.status}</StatusBadge>
          </Cluster>
        ))}
      </Stack>
    </Stack>
  );
}
