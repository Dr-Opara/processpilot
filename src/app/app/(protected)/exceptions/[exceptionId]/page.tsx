import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { getCurrentMembership } from "@/lib/authz";
import {
  getException,
  listExceptionComments,
  listExceptionHistory,
} from "@/lib/services/exceptions";
import { getRootCauseAnalysis } from "@/lib/services/exception-root-cause";
import { listContainmentActions } from "@/lib/services/exception-containment";
import { listCapaPlansForException } from "@/lib/services/capa";
import { listWaiversForException } from "@/lib/services/waivers";
import { listMembers } from "@/lib/services/members";
import { memberDisplayName } from "@/lib/services/member-display";
import { AppError } from "@/lib/errors";
import type { ExceptionSeverity, ExceptionStatus } from "@/lib/db/database.types";
import {
  addExceptionCommentAction,
  addRootCauseFactorAction,
  closeExceptionAction,
  completeContainmentActionAction,
  createCapaPlanAction,
  createContainmentActionAction,
  reopenExceptionAction,
  rejectExceptionAction,
  requestWaiverAction,
  saveRootCauseAction,
  startInvestigationAction,
  triageExceptionAction,
} from "./actions";

function severityBadgeStatus(
  severity: ExceptionSeverity,
): "success" | "warning" | "danger" | "neutral" {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "moderate") return "warning";
  return "neutral";
}

function statusBadgeStatus(status: ExceptionStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "closed") return "success";
  if (status === "rejected") return "danger";
  if (status === "reported") return "neutral";
  return "warning";
}

export default async function ExceptionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ exceptionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { exceptionId } = await params;
  const { error } = await searchParams;

  let exception;
  try {
    exception = await getException(exceptionId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }

  const currentMembership = await getCurrentMembership().catch(() => null);
  const has = (permission: string) =>
    Boolean(
      currentMembership?.permissions.includes(permission) ||
      currentMembership?.scopedPermissions.includes(permission),
    );
  const canTriage = has("exceptions.triage") || has("exceptions.manage");
  const canInvestigate = has("exceptions.investigate") || has("exceptions.manage");
  const canClose = has("exceptions.close") || has("exceptions.manage");
  const canCreateCapa = has("capa.create");
  const canRequestWaiver = has("waivers.create");
  const isOpen = exception.status !== "closed" && exception.status !== "rejected";

  const [comments, history, rootCause, containmentActions, capaPlans, waivers, membersResult] =
    await Promise.all([
      listExceptionComments(exceptionId).catch(() => []),
      listExceptionHistory(exceptionId).catch(() => []),
      getRootCauseAnalysis(exceptionId).catch(() => null),
      listContainmentActions(exceptionId).catch(() => []),
      listCapaPlansForException(exceptionId).catch(() => []),
      listWaiversForException(exceptionId).catch(() => []),
      listMembers({ status: "active", pageSize: 100 }).catch(() => ({ members: [], total: 0 })),
    ]);
  const memberName = (memberId: string | null) => {
    if (!memberId) return "Unassigned";
    const member = membersResult.members.find((m) => m.id === memberId);
    return member ? memberDisplayName(member) : memberId;
  };

  return (
    <Stack className="mx-auto max-w-3xl gap-8">
      <Stack className="gap-1">
        <Cluster className="gap-3">
          <Heading as="h1">{exception.title}</Heading>
          <StatusBadge status={statusBadgeStatus(exception.status)}>
            {exception.status.replace(/_/g, " ")}
          </StatusBadge>
          <StatusBadge status={severityBadgeStatus(exception.severity)}>
            {exception.severity}
          </StatusBadge>
        </Cluster>
        <Text className="text-muted">
          {exception.exception_type.replace(/_/g, " ")} · reported{" "}
          {new Date(exception.created_at).toLocaleString()}
        </Text>
        {exception.description && <Text>{exception.description}</Text>}
      </Stack>

      {error && <Alert title="Action could not be completed" description={error} />}

      <Stack className="gap-2 rounded-md border border-border p-4">
        <Text className="text-sm">
          <strong>Owner:</strong> {memberName(exception.owner_member_id)}
        </Text>
        <Text className="text-sm">
          <strong>Investigator:</strong> {memberName(exception.investigator_member_id)}
        </Text>
        <Text className="text-sm">
          <strong>Priority:</strong> {exception.priority ?? "—"}
          {exception.priority_overridden ? " (manually overridden)" : ""}
        </Text>
      </Stack>

      {isOpen && canTriage && (
        <form
          action={triageExceptionAction.bind(null, exceptionId)}
          className="flex flex-col gap-3 rounded-md border border-border p-4"
        >
          <Heading as="h2">Triage</Heading>
          <Cluster className="flex-wrap gap-3">
            <Stack className="gap-1">
              <Label htmlFor="severity">Severity</Label>
              <Select
                id="severity"
                name="severity"
                defaultValue={exception.severity}
                className="w-40"
              >
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            </Stack>
            <Stack className="gap-1">
              <Label htmlFor="ownerMemberId">Owner</Label>
              <Select
                id="ownerMemberId"
                name="ownerMemberId"
                className="w-56"
                defaultValue={exception.owner_member_id ?? ""}
              >
                <option value="">Unassigned</option>
                {membersResult.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {memberDisplayName(member)}
                  </option>
                ))}
              </Select>
            </Stack>
            <Stack className="gap-1">
              <Label htmlFor="investigatorMemberId">Investigator</Label>
              <Select
                id="investigatorMemberId"
                name="investigatorMemberId"
                className="w-56"
                defaultValue={exception.investigator_member_id ?? ""}
              >
                <option value="">Unassigned</option>
                {membersResult.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {memberDisplayName(member)}
                  </option>
                ))}
              </Select>
            </Stack>
          </Cluster>
          <Cluster className="justify-end">
            <Button type="submit" variant="secondary">
              Save triage
            </Button>
          </Cluster>
        </form>
      )}

      {isOpen && canInvestigate && exception.status !== "under_investigation" && (
        <form action={startInvestigationAction.bind(null, exceptionId)}>
          <Button type="submit" variant="secondary">
            Start investigation
          </Button>
        </form>
      )}

      {isOpen && canInvestigate && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">Root-cause analysis</Heading>
          <form
            action={saveRootCauseAction.bind(null, exceptionId)}
            className="flex flex-col gap-2"
          >
            <Select
              name="method"
              defaultValue={rootCause?.analysis.method ?? "five_whys"}
              className="w-40"
            >
              <option value="five_whys">Five whys</option>
              <option value="fishbone">Fishbone</option>
              <option value="other">Other</option>
            </Select>
            <Textarea
              name="primaryRootCause"
              placeholder="Primary root cause"
              defaultValue={rootCause?.analysis.primary_root_cause ?? ""}
              rows={2}
            />
            <Textarea
              name="investigatorNotes"
              placeholder="Investigator notes"
              defaultValue={rootCause?.analysis.investigator_notes ?? ""}
              rows={3}
            />
            <Cluster className="justify-end">
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </Cluster>
          </form>
          {rootCause && rootCause.factors.length > 0 && (
            <Stack className="gap-1">
              {rootCause.factors.map((factor) => (
                <Text key={factor.id} className="text-sm">
                  {factor.factor_type.replace(/_/g, " ")}: {factor.description}
                </Text>
              ))}
            </Stack>
          )}
          {rootCause && (
            <form
              action={addRootCauseFactorAction.bind(null, exceptionId, rootCause.analysis.id)}
              className="flex flex-col gap-2"
            >
              <Select name="factorType" defaultValue="five_why_step" className="w-48">
                <option value="five_why_step">Five-why step</option>
                <option value="secondary_root_cause">Secondary root cause</option>
                <option value="contributing_factor">Contributing factor</option>
              </Select>
              <Input name="description" placeholder="Description" required />
              <Cluster className="justify-end">
                <Button type="submit" variant="secondary">
                  Add factor
                </Button>
              </Cluster>
            </form>
          )}
        </Stack>
      )}

      <Stack className="gap-3 rounded-md border border-border p-4">
        <Heading as="h2">Containment</Heading>
        {containmentActions.map((action) => (
          <Cluster
            key={action.id}
            className="justify-between gap-2 rounded-md border border-border/60 p-2"
          >
            <Stack className="gap-0">
              <Text className="text-sm">{action.action}</Text>
              <Text className="text-xs text-muted">
                Owner: {memberName(action.owner_member_id)}
              </Text>
            </Stack>
            <Cluster className="items-center gap-2">
              <StatusBadge status={action.status === "completed" ? "success" : "warning"}>
                {action.status}
              </StatusBadge>
              {isOpen && canInvestigate && action.status === "open" && (
                <form action={completeContainmentActionAction.bind(null, exceptionId, action.id)}>
                  <Button type="submit" variant="secondary">
                    Complete
                  </Button>
                </form>
              )}
            </Cluster>
          </Cluster>
        ))}
        {isOpen && canInvestigate && (
          <form
            action={createContainmentActionAction.bind(null, exceptionId)}
            className="flex flex-col gap-2"
          >
            <Input name="action" placeholder="Containment action" required />
            <Select name="ownerMemberId" required className="w-56">
              <option value="">Select an owner</option>
              {membersResult.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {memberDisplayName(member)}
                </option>
              ))}
            </Select>
            <Cluster className="justify-end">
              <Button type="submit" variant="secondary">
                Add containment action
              </Button>
            </Cluster>
          </form>
        )}
      </Stack>

      <Stack className="gap-3 rounded-md border border-border p-4">
        <Cluster className="justify-between">
          <Heading as="h2">Corrective and preventive actions</Heading>
          {isOpen && canCreateCapa && (
            <form action={createCapaPlanAction.bind(null, exceptionId)} className="flex gap-2">
              <Input name="title" placeholder="CAPA plan title" required className="w-56" />
              <Select name="ownerMemberId" required className="w-48">
                <option value="">Owner</option>
                {membersResult.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {memberDisplayName(member)}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="secondary">
                Create CAPA plan
              </Button>
            </form>
          )}
        </Cluster>
        {capaPlans.length === 0 ? (
          <Text className="text-muted">No CAPA plans yet.</Text>
        ) : (
          capaPlans.map((plan) => (
            <Cluster
              key={plan.id}
              className="justify-between rounded-md border border-border/60 p-2"
            >
              <a href={`/app/capa/${plan.id}`} className="text-cobalt">
                {plan.title}
              </a>
              <StatusBadge
                status={
                  plan.status === "closed" || plan.status === "effective" ? "success" : "warning"
                }
              >
                {plan.status.replace(/_/g, " ")}
              </StatusBadge>
            </Cluster>
          ))
        )}
      </Stack>

      <Stack className="gap-3 rounded-md border border-border p-4">
        <Cluster className="justify-between">
          <Heading as="h2">Waivers</Heading>
          {isOpen && canRequestWaiver && (
            <form
              action={requestWaiverAction.bind(null, exceptionId)}
              className="flex flex-wrap gap-2"
            >
              <Input
                name="businessJustification"
                placeholder="Business justification"
                required
                className="w-64"
              />
              <Input name="expiresAt" type="date" required />
              <Button type="submit" variant="secondary">
                Request waiver
              </Button>
            </form>
          )}
        </Cluster>
        {waivers.length === 0 ? (
          <Text className="text-muted">No waivers requested.</Text>
        ) : (
          waivers.map((waiver) => (
            <Cluster
              key={waiver.id}
              className="justify-between rounded-md border border-border/60 p-2"
            >
              <a href={`/app/waivers/${waiver.id}`} className="text-cobalt">
                {waiver.business_justification}
              </a>
              <StatusBadge
                status={
                  waiver.status === "active" || waiver.status === "renewed" ? "success" : "neutral"
                }
              >
                {waiver.status}
              </StatusBadge>
            </Cluster>
          ))
        )}
      </Stack>

      <Stack className="gap-3 rounded-md border border-border p-4">
        <Heading as="h2">Comments</Heading>
        {comments.map((comment) => (
          <Stack key={comment.id} className="gap-0 rounded-md border border-border/60 p-2">
            <Text className="text-sm">{comment.body}</Text>
            <Text className="text-xs text-muted">
              {new Date(comment.created_at).toLocaleString()}
            </Text>
          </Stack>
        ))}
        <form
          action={addExceptionCommentAction.bind(null, exceptionId)}
          className="flex flex-col gap-2"
        >
          <Textarea name="body" rows={2} placeholder="Add a comment" required />
          <Cluster className="justify-end">
            <Button type="submit" variant="secondary">
              Comment
            </Button>
          </Cluster>
        </form>
      </Stack>

      {isOpen && canClose && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">Resolution</Heading>
          <form
            action={closeExceptionAction.bind(null, exceptionId)}
            className="flex flex-col gap-2"
          >
            <Textarea name="closureReason" placeholder="Closure reason" required rows={2} />
            <Cluster className="justify-end">
              <Button type="submit">Close exception</Button>
            </Cluster>
          </form>
          <form
            action={rejectExceptionAction.bind(null, exceptionId)}
            className="flex flex-col gap-2"
          >
            <Textarea name="reason" placeholder="Rejection reason" required rows={2} />
            <Cluster className="justify-end">
              <Button type="submit" variant="secondary">
                Reject
              </Button>
            </Cluster>
          </form>
        </Stack>
      )}

      {!isOpen && canClose && (
        <form
          action={reopenExceptionAction.bind(null, exceptionId)}
          className="flex flex-col gap-2"
        >
          <Textarea name="reason" placeholder="Reason for reopening" required rows={2} />
          <Cluster className="justify-end">
            <Button type="submit" variant="secondary">
              Reopen
            </Button>
          </Cluster>
        </form>
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
