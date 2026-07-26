import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { Textarea } from "@/components/ui/Textarea";
import { getCurrentMembership } from "@/lib/authz";
import { getTaskDetail } from "@/lib/services/workflows";
import { getFormSubmissionForTask } from "@/lib/services/form-submissions";
import { listEvidenceForTask } from "@/lib/services/evidence";
import { isDecisionActionable, listApprovalDecisionsForTask } from "@/lib/services/approvals";
import { getApprovalPolicy } from "@/lib/services/approval-policies";
import { listMembers } from "@/lib/services/members";
import { memberDisplayName } from "@/lib/services/member-display";
import { AppError } from "@/lib/errors";
import type { ApprovalDecisionStatus, EvidenceStatus, TaskStatus } from "@/lib/db/database.types";
import {
  claimTaskAction,
  completeTaskAction,
  decideApprovalAction,
  decideApprovalChainAction,
  delegateApprovalDecisionAction,
  overrideApprovalDecisionAction,
  pauseTaskSlaAction,
  reassignTaskAction,
  recalculateTaskDueAtAction,
  resumeTaskSlaAction,
  reviewEvidenceAction,
  saveFormDraftAction,
  skipTaskAction,
  submitFormAction,
} from "../actions";
import { DynamicFormRenderer } from "./DynamicFormRenderer";
import { EvidenceFileField } from "./EvidenceFileField";

function taskBadgeStatus(status: TaskStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "assigned" || status === "in_progress") return "warning";
  if (status === "rejected" || status === "cancelled" || status === "failed") return "danger";
  return "neutral";
}

function evidenceBadgeStatus(status: EvidenceStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "accepted") return "success";
  if (status === "pending_review") return "warning";
  return "danger";
}

function decisionBadgeStatus(
  status: ApprovalDecisionStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected" || status === "changes_requested") return "danger";
  return "neutral";
}

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { taskId } = await params;
  const { error } = await searchParams;

  let detail;
  try {
    detail = await getTaskDetail(taskId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }
  const { task, workflow, history } = detail;

  const currentMembership = await getCurrentMembership().catch(() => null);
  const canAssign = Boolean(
    currentMembership?.permissions.includes("workflow.assign") ||
    currentMembership?.scopedPermissions.includes("workflow.assign"),
  );
  const canManage = Boolean(
    currentMembership?.permissions.includes("workflow.manage") ||
    currentMembership?.scopedPermissions.includes("workflow.manage"),
  );
  const canReviewEvidence = Boolean(
    currentMembership?.permissions.includes("evidence.review") ||
    currentMembership?.scopedPermissions.includes("evidence.review"),
  );

  const isOpen = task.status === "assigned" || task.status === "in_progress";
  const isApproval = task.node_type === "approval";
  const isChainedApproval = isApproval && Boolean(task.approval_policy_id);
  const isUnclaimed = isOpen && !task.assignee_member_id && !isChainedApproval;
  const isLinkedForm = task.node_type === "form" && Boolean(task.form_version_id);
  const isEvidenceNode = task.node_type === "evidence";
  const canOverrideApproval = Boolean(
    currentMembership?.permissions.includes("approval.manage") ||
    currentMembership?.scopedPermissions.includes("approval.manage"),
  );
  const canManageSla = Boolean(
    currentMembership?.permissions.includes("sla.manage") ||
    currentMembership?.scopedPermissions.includes("sla.manage"),
  );
  const showAttachments = isEvidenceNode || isApproval;
  const membersResult =
    canAssign || isChainedApproval
      ? await listMembers({ status: "active", pageSize: 100 }).catch(() => ({
          members: [],
          total: 0,
        }))
      : { members: [], total: 0 };
  const memberName = (memberId: string) => {
    const member = membersResult.members.find((m) => m.id === memberId);
    return member ? memberDisplayName(member) : memberId;
  };

  const formSubmission = isLinkedForm
    ? await getFormSubmissionForTask(taskId).catch(() => null)
    : null;
  const evidenceList = showAttachments ? await listEvidenceForTask(taskId).catch(() => []) : [];
  const [approvalDecisions, approvalPolicy] = isChainedApproval
    ? await Promise.all([
        listApprovalDecisionsForTask(taskId).catch(() => []),
        getApprovalPolicy(task.approval_policy_id as string).catch(() => null),
      ])
    : [[], null];
  const myDecision = approvalDecisions.find(
    (d) => d.approver_member_id === currentMembership?.member.id,
  );
  const myDecisionActionable = Boolean(
    approvalPolicy &&
    myDecision &&
    isDecisionActionable(approvalPolicy, approvalDecisions, myDecision),
  );

  return (
    <Stack className="mx-auto max-w-2xl gap-8">
      <Stack className="gap-1">
        <Cluster className="gap-3">
          <Heading as="h1">{task.label}</Heading>
          <StatusBadge status={taskBadgeStatus(task.status)}>{task.status}</StatusBadge>
        </Cluster>
        <Text className="text-muted">
          {task.node_type}
          {task.due_at ? ` · Due ${new Date(task.due_at).toLocaleString()}` : ""}
          {task.sla_paused_at ? " · SLA paused" : ""}
        </Text>
        <a href={`/app/workflows/${workflow.id}`} className="text-cobalt">
          {workflow.title}
        </a>
      </Stack>

      {error && <Alert title="Action could not be completed" description={error} />}

      {workflow.status !== "running" && isOpen && (
        <Alert
          title="Workflow not running"
          description={`This workflow is ${workflow.status}; this task can no longer be acted on.`}
        />
      )}

      {isOpen && workflow.status === "running" && (
        <Stack className="gap-4 rounded-md border border-border p-4">
          {isUnclaimed && (
            <form action={claimTaskAction.bind(null, task.id)}>
              <Button type="submit" variant="secondary">
                Claim
              </Button>
            </form>
          )}

          {isLinkedForm && formSubmission ? (
            <DynamicFormRenderer
              taskId={task.id}
              fields={formSubmission.version.definition.fields}
              initialAnswers={(formSubmission.draft ?? formSubmission.current)?.answers ?? {}}
              submitAction={submitFormAction.bind(null, task.id)}
              saveDraftAction={saveFormDraftAction.bind(null, task.id)}
            />
          ) : isChainedApproval ? (
            <Stack className="gap-4">
              <Stack className="gap-2">
                <Text className="text-sm font-semibold">
                  {approvalPolicy?.name} ({approvalPolicy?.strategy})
                </Text>
                {approvalDecisions.map((d) => (
                  <Cluster
                    key={d.id}
                    className="justify-between gap-2 rounded-md border border-border/60 p-2"
                  >
                    <Text className="text-sm">{memberName(d.approver_member_id)}</Text>
                    <StatusBadge status={decisionBadgeStatus(d.status)}>{d.status}</StatusBadge>
                  </Cluster>
                ))}
              </Stack>

              {myDecisionActionable && (
                <Stack className="gap-3">
                  <form
                    action={decideApprovalChainAction.bind(null, task.id, "approved")}
                    className="flex flex-col gap-2"
                  >
                    <Label htmlFor="chain-approve-comment">Comment (optional)</Label>
                    <Textarea id="chain-approve-comment" name="comment" rows={2} />
                    <Cluster className="justify-end gap-2">
                      <Button type="submit">Approve</Button>
                    </Cluster>
                  </form>
                  <form
                    action={decideApprovalChainAction.bind(null, task.id, "rejected")}
                    className="flex flex-col gap-2"
                  >
                    <Label htmlFor="chain-reject-comment">Rejection reason</Label>
                    <Textarea id="chain-reject-comment" name="comment" rows={2} />
                    <Cluster className="justify-end gap-2">
                      <Button type="submit" variant="secondary">
                        Reject
                      </Button>
                    </Cluster>
                  </form>
                  {approvalPolicy?.allow_delegation && (
                    <form
                      action={delegateApprovalDecisionAction.bind(null, task.id)}
                      className="flex flex-col gap-2"
                    >
                      <Label htmlFor="delegate-to">Delegate to</Label>
                      <Cluster className="gap-2">
                        <Select id="delegate-to" name="toMemberId" className="w-56" required>
                          <option value="">Select a member</option>
                          {membersResult.members.map((member) => (
                            <option key={member.id} value={member.id}>
                              {memberDisplayName(member)}
                            </option>
                          ))}
                        </Select>
                        <Button type="submit" variant="secondary">
                          Delegate
                        </Button>
                      </Cluster>
                    </form>
                  )}
                </Stack>
              )}

              {canOverrideApproval && (
                <Stack className="gap-2 rounded-md border border-border p-3">
                  <Text className="text-xs font-semibold text-muted">Administrative override</Text>
                  <form
                    action={overrideApprovalDecisionAction.bind(null, task.id, "approved")}
                    className="flex flex-col gap-2"
                  >
                    <Textarea name="reason" rows={2} placeholder="Reason for override" required />
                    <Cluster className="justify-end gap-2">
                      <Button type="submit" variant="secondary">
                        Override: Approve
                      </Button>
                    </Cluster>
                  </form>
                  <form
                    action={overrideApprovalDecisionAction.bind(null, task.id, "rejected")}
                    className="flex flex-col gap-2"
                  >
                    <Textarea name="reason" rows={2} placeholder="Reason for override" required />
                    <Cluster className="justify-end gap-2">
                      <Button type="submit" variant="secondary">
                        Override: Reject
                      </Button>
                    </Cluster>
                  </form>
                </Stack>
              )}
            </Stack>
          ) : isApproval ? (
            <Stack className="gap-3">
              <form
                action={decideApprovalAction.bind(null, task.id, "approved")}
                className="flex flex-col gap-2"
              >
                <Label htmlFor="approve-comment">Comment (optional)</Label>
                <Textarea id="approve-comment" name="comment" rows={2} />
                <Cluster className="justify-end gap-2">
                  <Button type="submit">Approve</Button>
                </Cluster>
              </form>
              <form
                action={decideApprovalAction.bind(null, task.id, "rejected")}
                className="flex flex-col gap-2"
              >
                <Label htmlFor="reject-comment">Rejection reason</Label>
                <Textarea id="reject-comment" name="comment" rows={2} />
                <Cluster className="justify-end gap-2">
                  <Button type="submit" variant="secondary">
                    Reject
                  </Button>
                </Cluster>
              </form>
            </Stack>
          ) : (
            <form action={completeTaskAction.bind(null, task.id)} className="flex flex-col gap-2">
              <Label htmlFor="output">Output (optional JSON)</Label>
              <Textarea id="output" name="output" rows={3} placeholder="{}" />
              <Cluster className="justify-end">
                <Button type="submit">Complete</Button>
              </Cluster>
            </form>
          )}

          {canAssign && (
            <form action={reassignTaskAction.bind(null, task.id)} className="flex flex-col gap-2">
              <Label htmlFor="newAssigneeMemberId">Reassign to</Label>
              <Cluster className="gap-2">
                <Select
                  id="newAssigneeMemberId"
                  name="newAssigneeMemberId"
                  className="w-56"
                  required
                >
                  <option value="">Select a member</option>
                  {membersResult.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {memberDisplayName(member)}
                    </option>
                  ))}
                </Select>
                <Button type="submit" variant="secondary">
                  Reassign
                </Button>
              </Cluster>
            </form>
          )}

          {canManage && !task.required && (
            <form action={skipTaskAction.bind(null, task.id)}>
              <Button type="submit" variant="secondary">
                Skip
              </Button>
            </form>
          )}

          {canManageSla && task.sla_definition_id && (
            <Cluster className="gap-2">
              {task.sla_paused_at ? (
                <form action={resumeTaskSlaAction.bind(null, task.id)}>
                  <Button type="submit" variant="secondary">
                    Resume SLA
                  </Button>
                </form>
              ) : (
                <form action={pauseTaskSlaAction.bind(null, task.id)}>
                  <Button type="submit" variant="secondary">
                    Pause SLA
                  </Button>
                </form>
              )}
              <form action={recalculateTaskDueAtAction.bind(null, task.id)}>
                <Button type="submit" variant="secondary">
                  Recalculate due date
                </Button>
              </form>
            </Cluster>
          )}
        </Stack>
      )}

      {showAttachments && (
        <Stack className="gap-3">
          <Heading as="h2">{isApproval ? "Attachments" : "Evidence"}</Heading>
          {isOpen && workflow.status === "running" && (
            <Stack className="gap-2 rounded-md border border-border p-4">
              <Text className="text-sm">
                {isApproval
                  ? "Attach a supporting file to this approval step."
                  : "Upload a file to attach as evidence for this step."}
              </Text>
              <EvidenceFileField taskId={task.id} onUploaded={() => {}} />
            </Stack>
          )}
          {evidenceList.length === 0 ? (
            <Text className="text-muted">
              {isApproval ? "No attachments yet." : "No evidence uploaded yet."}
            </Text>
          ) : (
            <Stack className="gap-3">
              {evidenceList.map((item) => (
                <Stack key={item.id} className="gap-2 rounded-md border border-border p-3">
                  <Cluster className="justify-between">
                    <a
                      href={`/app/evidence/${item.id}/download`}
                      className="font-medium text-cobalt"
                    >
                      {item.original_filename}
                    </a>
                    <StatusBadge status={evidenceBadgeStatus(item.status)}>
                      {item.status}
                    </StatusBadge>
                  </Cluster>
                  <Text className="text-xs text-muted">
                    {new Date(item.created_at).toLocaleString()} · sha256:
                    {item.sha256_hash.slice(0, 12)}…
                  </Text>
                  {item.review_notes && <Text className="text-sm">{item.review_notes}</Text>}
                  {canReviewEvidence && item.status === "pending_review" && (
                    <Cluster className="gap-2">
                      <form action={reviewEvidenceAction.bind(null, task.id, item.id, "accepted")}>
                        <Button type="submit" variant="secondary">
                          Accept
                        </Button>
                      </form>
                      <form action={reviewEvidenceAction.bind(null, task.id, item.id, "rejected")}>
                        <Button type="submit" variant="secondary">
                          Reject
                        </Button>
                      </form>
                    </Cluster>
                  )}
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      )}

      {!isLinkedForm && Object.keys(task.output ?? {}).length > 0 && (
        <Stack className="gap-2">
          <Heading as="h2">Output</Heading>
          <pre className="overflow-x-auto rounded-md border border-border bg-paper p-3 text-sm">
            {JSON.stringify(task.output, null, 2)}
          </pre>
        </Stack>
      )}

      <Stack className="gap-3">
        <Heading as="h2">History</Heading>
        {history.length === 0 ? (
          <Text className="text-muted">No history yet.</Text>
        ) : (
          <ScrollArea>
            <table className="w-full min-w-[420px] border-collapse text-left text-sm">
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
