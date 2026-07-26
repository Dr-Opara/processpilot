import { notFound } from "next/navigation";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack } from "@/components/ui/Layout";
import { Alert } from "@/components/ui/Alert";
import { getProcess } from "@/lib/services/processes";
import { listDepartments } from "@/lib/services/departments";
import { listMembers } from "@/lib/services/members";
import { listRoles } from "@/lib/services/roles";
import { listTeams } from "@/lib/services/teams";
import { listForms } from "@/lib/services/forms";
import { listApprovalPolicies } from "@/lib/services/approval-policies";
import { listSlaDefinitions } from "@/lib/services/sla-config";
import { memberDisplayName } from "@/lib/services/member-display";
import { AppError } from "@/lib/errors";
import { updateDraftVersionAction } from "../../actions";
import { ProcessCanvasForm } from "../../ProcessCanvasForm";

export default async function EditProcessPage({
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
  const draft = detail.versions.find((v) => v.status === "draft");
  if (!draft) notFound();

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
  const action = updateDraftVersionAction.bind(null, processId, draft.id);

  return (
    <Stack className="mx-auto max-w-6xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Edit draft</Heading>
        <Text className="text-muted">{detail.process.title}</Text>
      </Stack>

      {error && <Alert title="Could not save changes" description={error} />}

      <ProcessCanvasForm
        action={action}
        mode="edit"
        initialTitle={draft.title}
        initialGraph={draft.definition}
        departments={departments}
        members={members}
        roles={roles}
        teams={teams}
        forms={forms}
        approvalPolicies={approvalPolicies}
        slaDefinitions={slaDefinitions}
        cancelHref={`/app/processes/${processId}`}
        draftKey={`process-canvas-draft:${processId}:${draft.id}`}
      />
    </Stack>
  );
}
