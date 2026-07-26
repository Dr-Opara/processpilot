import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listTrainingCourses } from "@/lib/services/training-courses";
import { AppError } from "@/lib/errors";
import type { TrainingCourseStatus } from "@/lib/db/database.types";

function statusBadgeStatus(
  status: TrainingCourseStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "published") return "success";
  if (status === "archived") return "neutral";
  return "warning";
}

export default async function TrainingCoursesPage() {
  let courses: Awaited<ReturnType<typeof listTrainingCourses>> = [];
  let loadError: string | null = null;
  try {
    courses = await listTrainingCourses();
  } catch (error) {
    loadError = error instanceof AppError ? error.message : "Could not load training courses.";
  }

  return (
    <Stack className="mx-auto max-w-4xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Heading as="h1">Training courses</Heading>
          <Text className="text-muted">Author, publish, and assign training.</Text>
        </Stack>
        <Cluster className="gap-2">
          <Button href="/app/training/my" variant="secondary">
            My assignments
          </Button>
          <Button href="/app/training/new">Add course</Button>
        </Cluster>
      </Cluster>

      {loadError && <Alert title="Could not load training courses" description={loadError} />}
      {!loadError && courses.length === 0 && (
        <Alert title="No training courses yet" description="Add one to start assigning training." />
      )}

      {!loadError && courses.length > 0 && (
        <ScrollArea>
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Title</th>
                <th className="py-2 pr-4 font-medium">Category</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-medium">
                    <a href={`/app/training/${course.id}`} className="text-cobalt">
                      {course.title}
                    </a>
                  </td>
                  <td className="py-3 pr-4">{course.category ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={statusBadgeStatus(course.status)}>
                      {course.status}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </Stack>
  );
}
