import { Heading, Text } from "@/components/ui/Typography";
import { Stack } from "@/components/ui/Layout";
import { Alert } from "@/components/ui/Alert";
import { getCurrentMembership } from "@/lib/authz";
import { listDepartments } from "@/lib/services/departments";
import { listMembers } from "@/lib/services/members";
import { listRoles } from "@/lib/services/roles";
import { listTeams } from "@/lib/services/teams";
import { listForms } from "@/lib/services/forms";
import { listApprovalPolicies } from "@/lib/services/approval-policies";
import { listSlaDefinitions } from "@/lib/services/sla-config";
import { memberDisplayName } from "@/lib/services/member-display";
import { createProcessAction } from "../actions";
import { ProcessCanvasForm } from "../ProcessCanvasForm";

export default async function NewProcessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const membership = await getCurrentMembership();
  const [
    departments,
    membersResult,
    roleRows,
    teams,
    formRows,
    approvalPolicyRows,
    slaDefinitionRows,
  ] = await Promise.all([
    listDepartments({ status: "active" }).catch(() => []),
    listMembers({ status: "active", pageSize: 100 }).catch(() => ({ members: [], total: 0 })),
    listRoles().catch(() => []),
    listTeams({ status: "active" }).catch(() => []),
    listForms({ status: "published" }).catch(() => []),
    listApprovalPolicies({ status: "active" }).catch(() => []),
    listSlaDefinitions().catch(() => []),
  ]);
  const members = membersResult.members.map((member) => ({
    id: member.id,
    label: memberDisplayName(member),
  }));
  const roles = roleRows.map(({ role }) => ({ id: role.id, name: role.name }));
  const forms = formRows.map((form) => ({ id: form.id, name: form.title }));
  const approvalPolicies = approvalPolicyRows.map((p) => ({ id: p.id, name: p.name }));
  const slaDefinitions = slaDefinitionRows.map((s) => ({ id: s.id, name: s.name }));

  return (
    <Stack className="mx-auto max-w-6xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Add a process</Heading>
        <Text className="text-muted">
          Define the steps, roles, and requirements for a repeatable piece of work.
        </Text>
      </Stack>

      {error && <Alert title="Could not create process" description={error} />}

      <ProcessCanvasForm
        action={createProcessAction}
        mode="create"
        departments={departments}
        members={members}
        roles={roles}
        teams={teams}
        forms={forms}
        approvalPolicies={approvalPolicies}
        slaDefinitions={slaDefinitions}
        cancelHref="/app/processes"
        draftKey={`process-canvas-draft:${membership.member.id}:new`}
      />
    </Stack>
  );
}
