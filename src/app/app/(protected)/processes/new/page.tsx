import { Heading, Text } from "@/components/ui/Typography";
import { Stack } from "@/components/ui/Layout";
import { Alert } from "@/components/ui/Alert";
import { listDepartments } from "@/lib/services/departments";
import { listMembers } from "@/lib/services/members";
import { listRoles } from "@/lib/services/roles";
import { listTeams } from "@/lib/services/teams";
import { memberDisplayName } from "@/lib/services/member-display";
import { createProcessAction } from "../actions";
import { ProcessBuilderForm } from "./ProcessBuilderForm";

export default async function NewProcessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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

  return (
    <Stack className="mx-auto max-w-3xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Add a process</Heading>
        <Text className="text-muted">
          Define the steps, roles, and requirements for a repeatable piece of work.
        </Text>
      </Stack>

      {error && <Alert title="Could not create process" description={error} />}

      <ProcessBuilderForm
        action={createProcessAction}
        mode="create"
        departments={departments}
        members={members}
        roles={roles}
        teams={teams}
        cancelHref="/app/processes"
      />
    </Stack>
  );
}
