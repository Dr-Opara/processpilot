import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Textarea } from "@/components/ui/Textarea";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { getCurrentMembership } from "@/lib/authz";
import { getCapaPlan, listCapaActions } from "@/lib/services/capa";
import { listMembers } from "@/lib/services/members";
import { memberDisplayName } from "@/lib/services/member-display";
import { AppError } from "@/lib/errors";
import {
  addCapaActionAction,
  closeCapaPlanAction,
  completeCapaActionAction,
  decideCapaPlanApprovalAction,
  recordCapaEffectivenessCheckAction,
  submitCapaPlanForApprovalAction,
} from "./actions";

export default async function CapaPlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ capaId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { capaId } = await params;
  const { error } = await searchParams;

  let plan;
  try {
    plan = await getCapaPlan(capaId);
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

  const [actions, membersResult] = await Promise.all([
    listCapaActions(capaId).catch(() => []),
    listMembers({ status: "active", pageSize: 100 }).catch(() => ({ members: [], total: 0 })),
  ]);
  const memberName = (memberId: string) => {
    const member = membersResult.members.find((m) => m.id === memberId);
    return member ? memberDisplayName(member) : memberId;
  };

  return (
    <Stack className="mx-auto max-w-2xl gap-8">
      <Stack className="gap-1">
        <Cluster className="gap-3">
          <Heading as="h1">{plan.title}</Heading>
          <StatusBadge
            status={plan.status === "closed" || plan.status === "effective" ? "success" : "warning"}
          >
            {plan.status.replace(/_/g, " ")}
          </StatusBadge>
        </Cluster>
        <Text className="text-muted">Owner: {memberName(plan.owner_member_id)}</Text>
        <a href={`/app/exceptions/${plan.exception_id}`} className="text-cobalt">
          View originating exception
        </a>
      </Stack>

      {error && <Alert title="Action could not be completed" description={error} />}

      {plan.status === "draft" && has("capa.edit") && (
        <form action={submitCapaPlanForApprovalAction.bind(null, capaId)}>
          <Button type="submit" variant="secondary">
            Submit for approval
          </Button>
        </form>
      )}

      {plan.status === "pending_approval" && has("capa.approve") && (
        <Stack className="gap-2 rounded-md border border-border p-4">
          <Heading as="h2">Approval</Heading>
          <form
            action={decideCapaPlanApprovalAction.bind(null, capaId, "approved")}
            className="flex flex-col gap-2"
          >
            <Textarea name="comment" rows={2} placeholder="Comment (optional)" />
            <Cluster className="justify-end gap-2">
              <Button type="submit">Approve</Button>
            </Cluster>
          </form>
          <form
            action={decideCapaPlanApprovalAction.bind(null, capaId, "rejected")}
            className="flex flex-col gap-2"
          >
            <Textarea name="comment" rows={2} placeholder="Reason for rejection" />
            <Cluster className="justify-end gap-2">
              <Button type="submit" variant="secondary">
                Reject
              </Button>
            </Cluster>
          </form>
        </Stack>
      )}

      <Stack className="gap-3 rounded-md border border-border p-4">
        <Heading as="h2">Actions</Heading>
        {actions.length === 0 ? (
          <Text className="text-muted">No actions added yet.</Text>
        ) : (
          actions.map((action) => (
            <Cluster
              key={action.id}
              className="justify-between gap-2 rounded-md border border-border/60 p-2"
            >
              <Stack className="gap-0">
                <Text className="text-sm">
                  [{action.action_type}] {action.title}
                </Text>
                <Text className="text-xs text-muted">
                  Owner: {memberName(action.owner_member_id)}
                </Text>
              </Stack>
              <Cluster className="items-center gap-2">
                <StatusBadge status={action.status === "completed" ? "success" : "warning"}>
                  {action.status}
                </StatusBadge>
                {action.status !== "completed" && has("capa.edit") && (
                  <form action={completeCapaActionAction.bind(null, capaId, action.id)}>
                    <Button type="submit" variant="secondary">
                      Complete
                    </Button>
                  </form>
                )}
              </Cluster>
            </Cluster>
          ))
        )}
        {has("capa.edit") && (
          <form action={addCapaActionAction.bind(null, capaId)} className="flex flex-col gap-2">
            <Cluster className="gap-2">
              <Select name="actionType" defaultValue="corrective" className="w-40">
                <option value="corrective">Corrective</option>
                <option value="preventive">Preventive</option>
              </Select>
              <Input name="title" placeholder="Action title" required className="flex-1" />
            </Cluster>
            <Select name="ownerMemberId" required className="w-56">
              <option value="">Select an owner</option>
              {membersResult.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {memberDisplayName(member)}
                </option>
              ))}
            </Select>
            <Cluster className="items-center gap-2">
              <Checkbox id="requiresEvidence" name="requiresEvidence" />
              <Label htmlFor="requiresEvidence">Requires evidence to complete</Label>
            </Cluster>
            <Cluster className="justify-end">
              <Button type="submit" variant="secondary">
                Add action
              </Button>
            </Cluster>
          </form>
        )}
      </Stack>

      {(plan.status === "in_progress" || plan.status === "pending_verification") &&
        has("capa.verify") && (
          <Stack className="gap-2 rounded-md border border-border p-4">
            <Heading as="h2">Effectiveness check</Heading>
            <form
              action={recordCapaEffectivenessCheckAction.bind(null, capaId, "effective")}
              className="flex flex-col gap-2"
            >
              <Textarea name="notes" rows={2} placeholder="Verification notes" />
              <Cluster className="justify-end gap-2">
                <Button type="submit">Mark effective</Button>
              </Cluster>
            </form>
            <form
              action={recordCapaEffectivenessCheckAction.bind(null, capaId, "ineffective")}
              className="flex flex-col gap-2"
            >
              <Textarea name="notes" rows={2} placeholder="Why it wasn't effective" />
              <Cluster className="justify-end gap-2">
                <Button type="submit" variant="secondary">
                  Mark ineffective
                </Button>
              </Cluster>
            </form>
          </Stack>
        )}

      {plan.status === "effective" && has("capa.close") && (
        <form action={closeCapaPlanAction.bind(null, capaId)}>
          <Button type="submit">Close CAPA plan</Button>
        </form>
      )}
    </Stack>
  );
}
