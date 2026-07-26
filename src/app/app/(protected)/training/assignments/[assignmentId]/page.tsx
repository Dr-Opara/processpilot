import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { getCurrentMembership } from "@/lib/authz";
import { getTrainingAssignment } from "@/lib/services/training-assignments";
import { getCourseVersion, getTrainingCourse } from "@/lib/services/training-courses";
import { AppError } from "@/lib/errors";
import { completeTrainingAssignmentAction, startTrainingAssignmentAction } from "./actions";

export default async function TrainingAssignmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { assignmentId } = await params;
  const { error } = await searchParams;

  let assignment;
  try {
    assignment = await getTrainingAssignment(assignmentId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }

  const version = await getCourseVersion(assignment.course_version_id);
  const course = await getTrainingCourse(version.course_id);
  const currentMembership = await getCurrentMembership().catch(() => null);
  const isAssignee = currentMembership?.member.id === assignment.assignee_member_id;
  const isOpen =
    assignment.status === "assigned" ||
    assignment.status === "in_progress" ||
    assignment.status === "overdue";

  return (
    <Stack className="mx-auto max-w-2xl gap-8">
      <Stack className="gap-1">
        <Cluster className="gap-3">
          <Heading as="h1">{course.title}</Heading>
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
        {assignment.due_at && (
          <Text className="text-muted">Due {new Date(assignment.due_at).toLocaleString()}</Text>
        )}
      </Stack>

      {error && <Alert title="Action could not be completed" description={error} />}

      <Stack className="gap-2 rounded-md border border-border p-4">
        <Heading as="h2">Content</Heading>
        <Text className="whitespace-pre-wrap">{version.content}</Text>
      </Stack>

      {isOpen && isAssignee && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          {assignment.status === "assigned" && (
            <form action={startTrainingAssignmentAction.bind(null, assignmentId)}>
              <Button type="submit" variant="secondary">
                Start
              </Button>
            </form>
          )}

          {version.has_assessment ? (
            <form
              action={completeTrainingAssignmentAction.bind(null, assignmentId)}
              className="flex flex-col gap-4"
            >
              <Heading as="h2">Assessment</Heading>
              {version.assessment_questions.map((question) => (
                <Stack key={question.id} className="gap-1">
                  <Label>{question.prompt}</Label>
                  {question.options.map((option) => (
                    <Cluster key={option.key} className="items-center gap-2">
                      <input
                        type="radio"
                        name={`answer_${question.id}`}
                        value={option.key}
                        id={`${question.id}-${option.key}`}
                        required
                      />
                      <label htmlFor={`${question.id}-${option.key}`}>{option.label}</label>
                    </Cluster>
                  ))}
                </Stack>
              ))}
              <Cluster className="justify-end">
                <Button type="submit">Submit assessment</Button>
              </Cluster>
            </form>
          ) : (
            <form action={completeTrainingAssignmentAction.bind(null, assignmentId)}>
              <Cluster className="justify-end">
                <Button type="submit">Mark complete</Button>
              </Cluster>
            </form>
          )}
        </Stack>
      )}

      {assignment.score_percent != null && (
        <Text className="text-sm text-muted">Last score: {assignment.score_percent}%</Text>
      )}
    </Stack>
  );
}
