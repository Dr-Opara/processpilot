import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listMyTrainingAssignments } from "@/lib/services/training-assignments";
import { AppError } from "@/lib/errors";
import type { TrainingAssignmentStatus } from "@/lib/db/database.types";

function statusBadgeStatus(
  status: TrainingAssignmentStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "overdue") return "danger";
  if (status === "waived") return "neutral";
  return "warning";
}

export default async function MyTrainingAssignmentsPage() {
  let assignments: Awaited<ReturnType<typeof listMyTrainingAssignments>> = [];
  let loadError: string | null = null;
  try {
    assignments = await listMyTrainingAssignments();
  } catch (error) {
    loadError =
      error instanceof AppError ? error.message : "Could not load your training assignments.";
  }

  return (
    <Stack className="mx-auto max-w-2xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">My training</Heading>
        <Text className="text-muted">Training assigned to you.</Text>
      </Stack>

      {loadError && <Alert title="Could not load training" description={loadError} />}
      {!loadError && assignments.length === 0 && (
        <Alert title="Nothing assigned" description="You have no training assignments right now." />
      )}

      {!loadError && assignments.length > 0 && (
        <Stack className="gap-2">
          {assignments.map((assignment) => (
            <Cluster
              key={assignment.id}
              className="justify-between rounded-md border border-border p-3"
            >
              <a href={`/app/training/assignments/${assignment.id}`} className="text-cobalt">
                Assignment
              </a>
              <Cluster className="items-center gap-2">
                {assignment.due_at && (
                  <Text className="text-xs text-muted">
                    Due {new Date(assignment.due_at).toLocaleDateString()}
                  </Text>
                )}
                <StatusBadge status={statusBadgeStatus(assignment.status)}>
                  {assignment.status}
                </StatusBadge>
              </Cluster>
            </Cluster>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
