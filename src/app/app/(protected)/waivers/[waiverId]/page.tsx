import { notFound } from "next/navigation";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { getCurrentMembership } from "@/lib/authz";
import { getWaiver } from "@/lib/services/waivers";
import { AppError } from "@/lib/errors";
import { decideWaiverAction, renewWaiverAction, revokeWaiverAction } from "./actions";

export default async function WaiverDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ waiverId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { waiverId } = await params;
  const { error } = await searchParams;

  let waiver;
  try {
    waiver = await getWaiver(waiverId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }

  const currentMembership = await getCurrentMembership().catch(() => null);
  const canApprove = Boolean(
    currentMembership?.permissions.includes("waivers.approve") ||
    currentMembership?.scopedPermissions.includes("waivers.approve") ||
    currentMembership?.permissions.includes("waivers.manage"),
  );

  return (
    <Stack className="mx-auto max-w-2xl gap-8">
      <Stack className="gap-1">
        <Cluster className="gap-3">
          <Heading as="h1">Waiver</Heading>
          <StatusBadge
            status={
              waiver.status === "active" || waiver.status === "renewed" ? "success" : "warning"
            }
          >
            {waiver.status}
          </StatusBadge>
        </Cluster>
        <Text>{waiver.business_justification}</Text>
        <Text className="text-muted">Expires {new Date(waiver.expires_at).toLocaleString()}</Text>
        <a href={`/app/exceptions/${waiver.exception_id}`} className="text-cobalt">
          View originating exception
        </a>
      </Stack>

      {error && <Alert title="Action could not be completed" description={error} />}

      {waiver.compensating_controls && (
        <Stack className="gap-1">
          <Heading as="h2">Compensating controls</Heading>
          <Text>{waiver.compensating_controls}</Text>
        </Stack>
      )}

      {waiver.status === "requested" && canApprove && (
        <Stack className="gap-2 rounded-md border border-border p-4">
          <Heading as="h2">Decision</Heading>
          <form
            action={decideWaiverAction.bind(null, waiverId, "approved")}
            className="flex flex-col gap-2"
          >
            <Textarea name="comment" rows={2} placeholder="Comment (optional)" />
            <Cluster className="justify-end">
              <Button type="submit">Approve</Button>
            </Cluster>
          </form>
          <form
            action={decideWaiverAction.bind(null, waiverId, "rejected")}
            className="flex flex-col gap-2"
          >
            <Textarea name="comment" rows={2} placeholder="Reason for rejection" />
            <Cluster className="justify-end">
              <Button type="submit" variant="secondary">
                Reject
              </Button>
            </Cluster>
          </form>
        </Stack>
      )}

      {(waiver.status === "active" || waiver.status === "renewed") && canApprove && (
        <Stack className="gap-2 rounded-md border border-border p-4">
          <Heading as="h2">Manage</Heading>
          <form action={renewWaiverAction.bind(null, waiverId)} className="flex flex-col gap-2">
            <Input name="newExpiresAt" type="date" required />
            <Cluster className="justify-end">
              <Button type="submit" variant="secondary">
                Renew
              </Button>
            </Cluster>
          </form>
          <form action={revokeWaiverAction.bind(null, waiverId)}>
            <Button type="submit" variant="secondary">
              Revoke
            </Button>
          </form>
        </Stack>
      )}
    </Stack>
  );
}
