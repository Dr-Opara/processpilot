import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { Textarea } from "@/components/ui/Textarea";
import { getCurrentMembership } from "@/lib/authz";
import { getProcess } from "@/lib/services/processes";
import { listDepartments } from "@/lib/services/departments";
import { listMembers } from "@/lib/services/members";
import { listRoles } from "@/lib/services/roles";
import { listTeams } from "@/lib/services/teams";
import { memberDisplayName } from "@/lib/services/member-display";
import { AppError } from "@/lib/errors";
import {
  approveVersionAction,
  archiveProcessAction,
  publishVersionAction,
  rejectReviewAction,
  restoreProcessAction,
  submitForReviewAction,
} from "../actions";
import { startWorkflowAction } from "../../workflows/actions";
import { ProcessGraphViewer } from "../ProcessGraphViewer";

function statusBadgeStatus(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "published") return "success";
  if (status === "in_review" || status === "approved") return "warning";
  if (status === "archived" || status === "rejected") return "danger";
  if (status === "superseded") return "neutral";
  return "neutral";
}

export default async function ProcessDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ processId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { processId } = await params;
  const { error } = await searchParams;

  let detail;
  try {
    detail = await getProcess(processId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }
  const { process, currentVersion, versions } = detail;

  const [departments, membersResult, roleRows, teams, currentMembership] = await Promise.all([
    listDepartments({ status: "all" }).catch(() => []),
    listMembers({ status: "all", pageSize: 100 }).catch(() => ({ members: [], total: 0 })),
    listRoles().catch(() => []),
    listTeams({ status: "all" }).catch(() => []),
    getCurrentMembership().catch(() => null),
  ]);

  const departmentName = process.department_id
    ? (departments.find((d) => d.id === process.department_id)?.name ?? "—")
    : null;
  const owner = process.owner_member_id
    ? membersResult.members.find((m) => m.id === process.owner_member_id)
    : null;
  const roleNames = new Map(roleRows.map(({ role }) => [role.id, role.name]));
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));

  const draftVersion = versions.find((v) => v.status === "draft");
  const inReviewVersion = versions.find((v) => v.status === "in_review");
  const approvedVersion = versions.find((v) => v.status === "approved");
  const canReview = Boolean(
    currentMembership?.permissions.includes("process.review") ||
    currentMembership?.scopedPermissions.includes("process.review"),
  );
  const canPublish = Boolean(
    currentMembership?.permissions.includes("process.publish") ||
    currentMembership?.scopedPermissions.includes("process.publish"),
  );
  const canStartWorkflow = Boolean(
    currentMembership?.permissions.includes("workflow.start") ||
    currentMembership?.scopedPermissions.includes("workflow.start"),
  );

  return (
    <Stack className="mx-auto max-w-3xl gap-8">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Cluster className="gap-3">
            <Heading as="h1">{process.title}</Heading>
            <StatusBadge status={statusBadgeStatus(process.status)}>{process.status}</StatusBadge>
          </Cluster>
          <Text className="text-muted">{departmentName ?? "Organization-wide"}</Text>
          {owner && <Text className="text-muted">Owner: {memberDisplayName(owner)}</Text>}
        </Stack>
        <Cluster className="gap-2">
          {process.status === "published" && canStartWorkflow && (
            <form action={startWorkflowAction.bind(null, process.id)}>
              <Button type="submit">Start workflow</Button>
            </form>
          )}
          {process.archived_at ? (
            <form action={restoreProcessAction.bind(null, process.id)}>
              <Button type="submit" variant="secondary">
                Restore
              </Button>
            </form>
          ) : (
            <form action={archiveProcessAction.bind(null, process.id)}>
              <Button type="submit" variant="secondary">
                Archive
              </Button>
            </form>
          )}
        </Cluster>
      </Cluster>

      {error && <Alert title="Action could not be completed" description={error} />}

      <Stack className="gap-2 rounded-md border border-border p-4">
        <Heading as="h2">Current published version</Heading>
        {currentVersion ? (
          <Stack className="gap-3">
            <Text>Version {currentVersion.version_number}</Text>
            <ProcessGraphViewer
              graph={currentVersion.definition}
              roleNames={roleNames}
              teamNames={teamNames}
            />
          </Stack>
        ) : (
          <Text className="text-muted">No version has been published yet.</Text>
        )}
      </Stack>

      {draftVersion && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">Draft in progress — version {draftVersion.version_number}</Heading>
          <Cluster className="gap-3">
            <Button href={`/app/processes/${process.id}/edit`} variant="secondary">
              Edit draft
            </Button>
            <form action={submitForReviewAction.bind(null, process.id, draftVersion.id)}>
              <Button type="submit">Submit for review</Button>
            </form>
          </Cluster>
        </Stack>
      )}

      {inReviewVersion && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">In review — version {inReviewVersion.version_number}</Heading>
          <ProcessGraphViewer
            graph={inReviewVersion.definition}
            roleNames={roleNames}
            teamNames={teamNames}
          />
          <Cluster className="gap-3">
            {canReview && (
              <form action={approveVersionAction.bind(null, process.id, inReviewVersion.id)}>
                <Button type="submit">Approve</Button>
              </form>
            )}
          </Cluster>
          {canReview && (
            <form
              action={rejectReviewAction.bind(null, process.id, inReviewVersion.id)}
              className="flex flex-col gap-2"
            >
              <Label htmlFor="reviewNotes">Rejection notes</Label>
              <Textarea id="reviewNotes" name="reviewNotes" rows={2} />
              <Cluster className="justify-end">
                <Button type="submit" variant="secondary">
                  Reject
                </Button>
              </Cluster>
            </form>
          )}
        </Stack>
      )}

      {approvedVersion && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">Approved — version {approvedVersion.version_number}</Heading>
          <ProcessGraphViewer
            graph={approvedVersion.definition}
            roleNames={roleNames}
            teamNames={teamNames}
          />
          {canPublish && (
            <Cluster className="gap-3">
              <form action={publishVersionAction.bind(null, process.id, approvedVersion.id)}>
                <Button type="submit">Publish</Button>
              </form>
            </Cluster>
          )}
        </Stack>
      )}

      {!draftVersion && !inReviewVersion && !approvedVersion && (
        <Cluster>
          <Button href={`/app/processes/${process.id}/new-version`} variant="secondary">
            Create a new version
          </Button>
        </Cluster>
      )}

      <Stack className="gap-3">
        <Heading as="h2">Version history</Heading>
        <ScrollArea>
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Version</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id} className="border-b border-border/60">
                  <td className="py-2 pr-4">
                    <a
                      href={`/app/processes/${process.id}/versions/${version.id}`}
                      className="font-medium text-cobalt"
                    >
                      v{version.version_number}
                    </a>
                  </td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={statusBadgeStatus(version.status)}>
                      {version.status}
                    </StatusBadge>
                  </td>
                  <td className="py-2 pr-4">{new Date(version.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </Stack>
    </Stack>
  );
}
