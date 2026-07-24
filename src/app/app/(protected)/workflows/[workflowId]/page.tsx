import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { Textarea } from "@/components/ui/Textarea";
import { getCurrentMembership } from "@/lib/authz";
import { getWorkflowDetail } from "@/lib/services/workflows";
import { AppError } from "@/lib/errors";
import type { TaskStatus, WorkflowStatus } from "@/lib/db/database.types";
import {
  cancelWorkflowAction,
  restartWorkflowAction,
  resumeWorkflowAction,
  suspendWorkflowAction,
} from "./actions";

function workflowBadgeStatus(status: WorkflowStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "suspended") return "warning";
  if (status === "cancelled" || status === "failed") return "danger";
  return "neutral";
}

function taskBadgeStatus(status: TaskStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "assigned" || status === "in_progress") return "warning";
  if (status === "rejected" || status === "cancelled" || status === "failed") return "danger";
  return "neutral";
}

export default async function WorkflowDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ workflowId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { workflowId } = await params;
  const { error } = await searchParams;

  let detail;
  try {
    detail = await getWorkflowDetail(workflowId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }
  const { workflow, tasks, history } = detail;

  const currentMembership = await getCurrentMembership().catch(() => null);
  const canManage = Boolean(
    currentMembership?.permissions.includes("workflow.manage") ||
    currentMembership?.scopedPermissions.includes("workflow.manage"),
  );

  return (
    <Stack className="mx-auto max-w-3xl gap-8">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Cluster className="gap-3">
            <Heading as="h1">{workflow.title}</Heading>
            <StatusBadge status={workflowBadgeStatus(workflow.status)}>
              {workflow.status}
            </StatusBadge>
          </Cluster>
          <Text className="text-muted">
            Started {new Date(workflow.started_at).toLocaleString()}
            {workflow.due_at ? ` · Due ${new Date(workflow.due_at).toLocaleString()}` : ""}
          </Text>
          {workflow.failure_reason && (
            <Text className="text-danger">{workflow.failure_reason}</Text>
          )}
        </Stack>

        {canManage && (
          <Cluster className="gap-2">
            {workflow.status === "running" && (
              <form action={suspendWorkflowAction.bind(null, workflow.id)}>
                <Button type="submit" variant="secondary">
                  Suspend
                </Button>
              </form>
            )}
            {workflow.status === "suspended" && (
              <form action={resumeWorkflowAction.bind(null, workflow.id)}>
                <Button type="submit" variant="secondary">
                  Resume
                </Button>
              </form>
            )}
            {(workflow.status === "running" || workflow.status === "suspended") && (
              <form action={cancelWorkflowAction.bind(null, workflow.id)}>
                <Button type="submit" variant="secondary">
                  Cancel
                </Button>
              </form>
            )}
            <form action={restartWorkflowAction.bind(null, workflow.id)}>
              <Button type="submit" variant="secondary">
                Restart
              </Button>
            </form>
          </Cluster>
        )}
      </Cluster>

      {error && <Alert title="Action could not be completed" description={error} />}

      {canManage && (workflow.status === "running" || workflow.status === "suspended") && (
        <form action={cancelWorkflowAction.bind(null, workflow.id)} className="flex flex-col gap-2">
          <Label htmlFor="reason">Cancellation reason (optional)</Label>
          <Textarea id="reason" name="reason" rows={2} />
        </form>
      )}

      <Stack className="gap-3">
        <Heading as="h2">Tasks</Heading>
        {tasks.length === 0 ? (
          <Text className="text-muted">No tasks yet.</Text>
        ) : (
          <ScrollArea>
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-4 font-medium">Step</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-b border-border/60">
                    <td className="py-2 pr-4">
                      <a href={`/app/tasks/${task.id}`} className="font-medium text-cobalt">
                        {task.label}
                      </a>
                    </td>
                    <td className="py-2 pr-4">{task.node_type}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={taskBadgeStatus(task.status)}>{task.status}</StatusBadge>
                    </td>
                    <td className="py-2 pr-4">
                      {task.due_at ? new Date(task.due_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </Stack>

      <Stack className="gap-3">
        <Heading as="h2">History</Heading>
        {history.length === 0 ? (
          <Text className="text-muted">No history yet.</Text>
        ) : (
          <ScrollArea>
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-4 font-medium">Event</th>
                  <th className="py-2 pr-4 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/60">
                    <td className="py-2 pr-4">{entry.event_type}</td>
                    <td className="py-2 pr-4">{new Date(entry.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </Stack>
    </Stack>
  );
}
