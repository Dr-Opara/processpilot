import { notFound } from "next/navigation";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { getTaskDetail } from "@/lib/services/workflows";
import { listExternalAccessGrants } from "@/lib/services/external-access";
import { AppError } from "@/lib/errors";
import type { ExternalAccessGrantStatus } from "@/lib/db/database.types";
import { inviteExternalUserAction, revokeExternalAccessGrantAction } from "./actions";

const inputClassName =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/20";

function grantBadgeStatus(
  status: ExternalAccessGrantStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "active") return "success";
  if (status === "pending") return "warning";
  if (status === "revoked" || status === "expired") return "danger";
  return "neutral";
}

export default async function TaskExternalAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { taskId } = await params;
  const { error } = await searchParams;

  let task: Awaited<ReturnType<typeof getTaskDetail>>["task"];
  try {
    ({ task } = await getTaskDetail(taskId));
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }

  let grants: Awaited<ReturnType<typeof listExternalAccessGrants>> = [];
  let loadError: string | null = null;
  try {
    grants = await listExternalAccessGrants(taskId);
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load external-access grants.";
  }

  const hasLiveGrant = grants.some((g) => g.status === "pending" || g.status === "active");

  return (
    <Stack className="mx-auto max-w-2xl gap-8">
      <Stack className="gap-1">
        <Heading as="h1">External access</Heading>
        <Text className="text-muted">{task.label}</Text>
        <a href={`/app/tasks/${task.id}`} className="text-sm text-cobalt">
          Back to task
        </a>
      </Stack>

      <Alert
        title="One external collaborator per task"
        description="Inviting an external collaborator grants them access to this task only, for a limited time. They are not shown in the regular member directory."
      />

      {(error || loadError) && (
        <Alert title="Something went wrong" description={error ?? loadError ?? ""} />
      )}

      {!loadError && (
        <Stack className="gap-3">
          <Heading as="h2">Grants</Heading>
          {grants.length === 0 ? (
            <Text className="text-sm text-muted">No external-access grants for this task yet.</Text>
          ) : (
            <Stack className="gap-2">
              {grants.map((grant) => (
                <Stack key={grant.id} className="gap-2 rounded-md border border-border p-4">
                  <Cluster className="justify-between">
                    <StatusBadge status={grantBadgeStatus(grant.status)}>
                      {grant.status}
                    </StatusBadge>
                    <Text className="text-sm text-muted">
                      Expires {new Date(grant.expires_at).toLocaleString()}
                    </Text>
                  </Cluster>
                  {(grant.status === "pending" || grant.status === "active") && (
                    <form action={revokeExternalAccessGrantAction.bind(null, task.id, grant.id)}>
                      <Button type="submit" variant="quiet">
                        Revoke
                      </Button>
                    </form>
                  )}
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      )}

      {!hasLiveGrant && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">Invite an external collaborator</Heading>
          <form action={inviteExternalUserAction.bind(null, task.id)} className="grid gap-3">
            <Stack className="gap-1">
              <label htmlFor="email" className="text-xs font-medium text-muted">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="contractor@example.com"
                className={inputClassName}
              />
            </Stack>
            <Stack className="gap-1">
              <label htmlFor="expiresInDays" className="text-xs font-medium text-muted">
                Access expires in (days)
              </label>
              <input
                id="expiresInDays"
                name="expiresInDays"
                type="number"
                min={1}
                max={30}
                defaultValue={7}
                className={inputClassName}
              />
            </Stack>
            <Button type="submit" variant="secondary" className="self-start">
              Send invitation
            </Button>
          </form>
        </Stack>
      )}
    </Stack>
  );
}
