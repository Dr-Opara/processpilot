import { notFound } from "next/navigation";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { getProcess } from "@/lib/services/processes";
import { listRoles } from "@/lib/services/roles";
import { listTeams } from "@/lib/services/teams";
import { AppError } from "@/lib/errors";
import { ProcessGraphViewer } from "../../../ProcessGraphViewer";

function statusBadgeStatus(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "published") return "success";
  if (status === "in_review" || status === "approved") return "warning";
  if (status === "archived" || status === "rejected") return "danger";
  return "neutral";
}

export default async function ProcessVersionPage({
  params,
}: {
  params: Promise<{ processId: string; versionId: string }>;
}) {
  const { processId, versionId } = await params;

  let detail;
  try {
    detail = await getProcess(processId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }
  const version = detail.versions.find((v) => v.id === versionId);
  if (!version) notFound();

  const [roleRows, teams] = await Promise.all([
    listRoles().catch(() => []),
    listTeams({ status: "all" }).catch(() => []),
  ]);
  const roleNames = new Map(roleRows.map(({ role }) => [role.id, role.name]));
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));

  return (
    <Stack className="mx-auto max-w-2xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Cluster className="gap-3">
            <Heading as="h1">
              {detail.process.title} — v{version.version_number}
            </Heading>
            <StatusBadge status={statusBadgeStatus(version.status)}>{version.status}</StatusBadge>
          </Cluster>
        </Stack>
        <Button href={`/app/processes/${processId}`} variant="secondary">
          Back to process
        </Button>
      </Cluster>

      {version.review_notes && <Alert title="Review notes" description={version.review_notes} />}

      <Stack className="gap-2 rounded-md border border-border p-4">
        <Cluster className="justify-between">
          <Text>Submitted</Text>
          <Text className="text-muted">
            {version.submitted_at ? new Date(version.submitted_at).toLocaleString() : "—"}
          </Text>
        </Cluster>
        <Cluster className="justify-between">
          <Text>Reviewed</Text>
          <Text className="text-muted">
            {version.reviewed_at ? new Date(version.reviewed_at).toLocaleString() : "—"}
          </Text>
        </Cluster>
        <Cluster className="justify-between">
          <Text>Published</Text>
          <Text className="text-muted">
            {version.published_at ? new Date(version.published_at).toLocaleString() : "—"}
          </Text>
        </Cluster>
      </Stack>

      <ProcessGraphViewer graph={version.definition} roleNames={roleNames} teamNames={teamNames} />
    </Stack>
  );
}
