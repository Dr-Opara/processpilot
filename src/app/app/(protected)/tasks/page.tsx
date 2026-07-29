import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, ScrollArea } from "@/components/ui/Layout";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listMyTasks } from "@/lib/services/workflows";
import { AppError } from "@/lib/errors";
import type { TaskStatus } from "@/lib/db/database.types";

function taskBadgeStatus(status: TaskStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "assigned" || status === "in_progress") return "warning";
  if (status === "rejected" || status === "cancelled" || status === "failed") return "danger";
  return "neutral";
}

export default async function TaskInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status as TaskStatus | "open") ?? "open";

  let tasks: Awaited<ReturnType<typeof listMyTasks>> = [];
  let loadError: string | null = null;
  try {
    tasks = await listMyTasks({ status });
  } catch (error) {
    loadError = error instanceof AppError ? error.message : "Could not load tasks.";
  }

  return (
    <Stack className="mx-auto max-w-5xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">My tasks</Heading>
        <Text className="text-muted">
          Tasks assigned to you, plus unclaimed tasks from teams or roles you belong to.
        </Text>
      </Stack>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <Stack className="gap-1">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={status} className="w-40">
            <option value="open">Open</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
            <option value="skipped">Skipped</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </Stack>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {loadError && <Alert title="Could not load tasks" description={loadError} />}
      {!loadError && tasks.length === 0 && (
        <Alert title="Nothing here" description="You have no tasks matching this filter." />
      )}

      {!loadError && tasks.length > 0 && (
        <>
          <Stack className="gap-2 md:hidden">
            {tasks.map((task) => (
              <a
                key={task.id}
                href={`/app/tasks/${task.id}`}
                className="flex flex-col gap-1 rounded-md border border-border p-4"
              >
                <span className="font-medium text-cobalt">{task.label}</span>
                <span className="text-xs text-muted">{task.node_type}</span>
                <div className="flex items-center justify-between pt-1">
                  <StatusBadge status={taskBadgeStatus(task.status)}>{task.status}</StatusBadge>
                  <span className="text-xs text-muted">
                    {task.due_at ? `Due ${new Date(task.due_at).toLocaleString()}` : "No due date"}
                  </span>
                </div>
              </a>
            ))}
          </Stack>
          <ScrollArea className="hidden md:block">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-4 font-medium">Task</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-b border-border/60">
                    <td className="py-3 pr-4">
                      <a href={`/app/tasks/${task.id}`} className="font-medium text-cobalt">
                        {task.label}
                      </a>
                    </td>
                    <td className="py-3 pr-4">{task.node_type}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={taskBadgeStatus(task.status)}>{task.status}</StatusBadge>
                    </td>
                    <td className="py-3 pr-4">
                      {task.due_at ? new Date(task.due_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </>
      )}
    </Stack>
  );
}
