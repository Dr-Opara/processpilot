import Link from "next/link";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { getOrganizationDetailForPlatformAdmin } from "@/lib/services/platform-admin";
import { AppError } from "@/lib/errors";
import {
  addSupportNoteAction,
  markOrganizationAsDemoAction,
  reactivateOrganizationAction,
  resetDemoWorkspaceAction,
  suspendOrganizationAction,
  unmarkOrganizationAsDemoAction,
} from "../../actions";

export default async function PlatformAdminOrganizationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { organizationId } = await params;
  const { error } = await searchParams;

  let detail: Awaited<ReturnType<typeof getOrganizationDetailForPlatformAdmin>> | null = null;
  let loadError: string | null = null;
  try {
    detail = await getOrganizationDetailForPlatformAdmin(organizationId);
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load organization.";
  }

  return (
    <Stack className="mx-auto max-w-3xl gap-8">
      <Stack className="gap-1">
        <Link href="/app/platform-admin/organizations" className="text-sm text-cobalt">
          ← Organizations
        </Link>
        {detail && (
          <Cluster className="items-center gap-3">
            <Heading as="h1">{detail.organization.name}</Heading>
            <StatusBadge status={detail.activeSuspension ? "danger" : "success"}>
              {detail.activeSuspension ? "Suspended" : "Active"}
            </StatusBadge>
          </Cluster>
        )}
      </Stack>

      {(loadError || error) && (
        <Alert title="Could not complete that action" description={loadError ?? error ?? ""} />
      )}

      {detail && (
        <>
          <Stack className="gap-2 rounded-md border border-border p-4">
            <Cluster className="justify-between">
              <Text>Members</Text>
              <Text className="text-muted">{detail.memberCount}</Text>
            </Cluster>
            <Cluster className="justify-between">
              <Text>Subscription status</Text>
              <Text className="text-muted">{detail.subscriptionStatus ?? "—"}</Text>
            </Cluster>
            <Cluster className="justify-between">
              <Text>Slug</Text>
              <Text className="text-muted">{detail.organization.slug}</Text>
            </Cluster>
          </Stack>

          <Stack className="gap-3">
            <Heading as="h2">Suspension</Heading>
            {detail.activeSuspension ? (
              <Stack className="gap-2">
                <Text className="text-sm text-muted">
                  Suspended {new Date(detail.activeSuspension.suspended_at).toLocaleString()} —{" "}
                  {detail.activeSuspension.reason}
                </Text>
                <form action={reactivateOrganizationAction.bind(null, organizationId)}>
                  <Button type="submit" variant="secondary">
                    Reactivate organization
                  </Button>
                </form>
              </Stack>
            ) : (
              <form
                action={suspendOrganizationAction.bind(null, organizationId)}
                className="flex flex-col gap-3"
              >
                <Text className="text-sm text-muted">
                  Suspending blocks every member&apos;s access to this organization immediately.
                  Requires a reason.
                </Text>
                <Textarea name="reason" required placeholder="Reason for suspension" rows={2} />
                <Cluster className="justify-end">
                  <Button type="submit" variant="secondary">
                    Suspend organization
                  </Button>
                </Cluster>
              </form>
            )}
          </Stack>

          <Stack className="gap-3">
            <Heading as="h2">Support notes</Heading>
            {detail.supportNotes.length === 0 ? (
              <Text className="text-sm text-muted">No notes yet.</Text>
            ) : (
              <Stack className="gap-2">
                {detail.supportNotes.map((note) => (
                  <Stack key={note.id} className="gap-1 rounded-md border border-border/60 p-3">
                    <Text className="text-sm">{note.note}</Text>
                    <Text className="text-xs text-muted">
                      {new Date(note.created_at).toLocaleString()}
                    </Text>
                  </Stack>
                ))}
              </Stack>
            )}
            <form
              action={addSupportNoteAction.bind(null, organizationId)}
              className="flex flex-col gap-2"
            >
              <Textarea name="note" required placeholder="Add a support note" rows={2} />
              <Cluster className="justify-end">
                <Button type="submit" variant="secondary">
                  Add note
                </Button>
              </Cluster>
            </form>
          </Stack>

          <Stack className="gap-3">
            <Heading as="h2">Demo workspace</Heading>
            {detail.organization.is_demo ? (
              <Stack className="gap-2">
                <Text className="text-sm text-muted">
                  This organization is the flagged demo workspace. Resetting restores the seeded
                  baseline content; it does not purge ad-hoc content created during a demo session.
                </Text>
                <Cluster className="gap-2">
                  <form action={resetDemoWorkspaceAction.bind(null, organizationId)}>
                    <Button type="submit" variant="secondary">
                      Reset demo workspace
                    </Button>
                  </form>
                  <form action={unmarkOrganizationAsDemoAction.bind(null, organizationId)}>
                    <Button type="submit" variant="secondary">
                      Unmark as demo workspace
                    </Button>
                  </form>
                </Cluster>
              </Stack>
            ) : (
              <Stack className="gap-2">
                <Text className="text-sm text-muted">
                  Flagging this organization as the demo workspace seeds it with deterministic,
                  clearly-synthetic content and blocks real email/webhook/AI-provider calls from it.
                  Only one organization can be flagged at a time.
                </Text>
                <form action={markOrganizationAsDemoAction.bind(null, organizationId)}>
                  <Button type="submit" variant="secondary">
                    Mark as demo workspace
                  </Button>
                </form>
              </Stack>
            )}
          </Stack>

          <Stack className="gap-3">
            <Heading as="h2">Recent activity</Heading>
            {detail.recentAuditEvents.length === 0 ? (
              <Text className="text-sm text-muted">No recorded activity.</Text>
            ) : (
              <Stack className="gap-2">
                {detail.recentAuditEvents.map((event, index) => (
                  <Cluster key={index} className="justify-between border-b border-border/60 pb-2">
                    <Text>{event.action}</Text>
                    <Text className="text-xs text-muted">
                      {new Date(event.created_at).toLocaleString()}
                    </Text>
                  </Cluster>
                ))}
              </Stack>
            )}
          </Stack>
        </>
      )}
    </Stack>
  );
}
