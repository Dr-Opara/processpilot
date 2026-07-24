import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listWorkflows } from "@/lib/services/workflows";
import { listProcesses } from "@/lib/services/processes";
import { AppError } from "@/lib/errors";
import type { WorkflowStatus } from "@/lib/db/database.types";

function statusBadgeStatus(status: WorkflowStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "running") return "neutral";
  if (status === "suspended") return "warning";
  if (status === "cancelled" || status === "failed") return "danger";
  return "neutral";
}

export default async function WorkflowsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; processId?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status as WorkflowStatus | "all") ?? "all";

  let workflows: Awaited<ReturnType<typeof listWorkflows>> = [];
  let processes: Awaited<ReturnType<typeof listProcesses>> = [];
  let loadError: string | null = null;
  try {
    [workflows, processes] = await Promise.all([
      listWorkflows({ status, processId: params.processId || undefined }),
      listProcesses({ status: "all" }),
    ]);
  } catch (error) {
    loadError = error instanceof AppError ? error.message : "Could not load workflows.";
  }

  return (
    <Stack className="mx-auto max-w-5xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Workflows</Heading>
        <Text className="text-muted">Running and completed instances of published processes.</Text>
      </Stack>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <Stack className="gap-1">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={status} className="w-40">
            <option value="all">All</option>
            <option value="running">Running</option>
            <option value="suspended">Suspended</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="failed">Failed</option>
          </Select>
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="processId">Process</Label>
          <Select
            id="processId"
            name="processId"
            defaultValue={params.processId ?? ""}
            className="w-56"
          >
            <option value="">All processes</option>
            {processes.map((process) => (
              <option key={process.id} value={process.id}>
                {process.title}
              </option>
            ))}
          </Select>
        </Stack>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {loadError && <Alert title="Could not load workflows" description={loadError} />}
      {!loadError && workflows.length === 0 && (
        <Alert
          title="No workflows yet"
          description="Start a workflow from a published process to see it here."
        />
      )}

      {!loadError && workflows.length > 0 && (
        <ScrollArea>
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Title</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Started</th>
                <th className="py-2 pr-4 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((workflow) => (
                <tr key={workflow.id} className="border-b border-border/60">
                  <td className="py-3 pr-4">
                    <a href={`/app/workflows/${workflow.id}`} className="font-medium text-cobalt">
                      {workflow.title}
                    </a>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={statusBadgeStatus(workflow.status)}>
                      {workflow.status}
                    </StatusBadge>
                  </td>
                  <td className="py-3 pr-4">{new Date(workflow.started_at).toLocaleString()}</td>
                  <td className="py-3 pr-4">
                    {workflow.due_at ? new Date(workflow.due_at).toLocaleString() : "—"}
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
