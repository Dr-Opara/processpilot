import { notFound } from "next/navigation";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack } from "@/components/ui/Layout";
import { Alert } from "@/components/ui/Alert";
import { getProcess } from "@/lib/services/processes";
import { listDepartments } from "@/lib/services/departments";
import { listMembers } from "@/lib/services/members";
import { listRoles } from "@/lib/services/roles";
import { listTeams } from "@/lib/services/teams";
import { memberDisplayName } from "@/lib/services/member-display";
import { AppError } from "@/lib/errors";
import { createNewVersionAction } from "../../actions";
import { ProcessCanvasForm } from "../../ProcessCanvasForm";

export default async function NewProcessVersionPage({
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

  const [departments, membersResult, roleRows, teams] = await Promise.all([
    listDepartments({ status: "active" }).catch(() => []),
    listMembers({ status: "active", pageSize: 100 }).catch(() => ({ members: [], total: 0 })),
    listRoles().catch(() => []),
    listTeams({ status: "active" }).catch(() => []),
  ]);
  const members = membersResult.members.map((member) => ({
    id: member.id,
    label: memberDisplayName(member),
  }));
  const roles = roleRows.map(({ role }) => ({ id: role.id, name: role.name }));
  const action = createNewVersionAction.bind(null, processId);

  return (
    <Stack className="mx-auto max-w-6xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Create a new version</Heading>
        <Text className="text-muted">{detail.process.title}</Text>
      </Stack>

      {error && <Alert title="Could not create version" description={error} />}

      <ProcessCanvasForm
        action={action}
        mode="new-version"
        initialTitle={detail.process.title}
        initialGraph={detail.currentVersion?.definition}
        departments={departments}
        members={members}
        roles={roles}
        teams={teams}
        cancelHref={`/app/processes/${processId}`}
        draftKey={`process-canvas-draft:${processId}:new-version`}
      />
    </Stack>
  );
}
