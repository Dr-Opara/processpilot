import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { getTeam } from "@/lib/services/teams";
import { listDepartments } from "@/lib/services/departments";
import { listLocations } from "@/lib/services/locations";
import { listMembers } from "@/lib/services/members";
import { memberDisplayName } from "@/lib/services/member-display";
import { AppError } from "@/lib/errors";
import { archiveTeamAction, restoreTeamAction, setTeamMembersAction } from "../actions";

export default async function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;

  let team;
  try {
    team = await getTeam(teamId);
  } catch (error) {
    if (error instanceof AppError && error.code === "not_found") notFound();
    throw error;
  }

  const [departments, locations, activeMembers, currentTeamMembers] = await Promise.all([
    listDepartments({ status: "all" }).catch(() => []),
    listLocations({ status: "all" }).catch(() => []),
    listMembers({ status: "active", pageSize: 100 }).catch(() => ({ members: [], total: 0 })),
    listMembers({ teamId, status: "all", pageSize: 100 }).catch(() => ({ members: [], total: 0 })),
  ]);

  const departmentName = team.department_id
    ? departments.find((d) => d.id === team.department_id)?.name
    : undefined;
  const locationName = team.location_id
    ? locations.find((l) => l.id === team.location_id)?.name
    : undefined;
  const manager = team.manager_member_id
    ? activeMembers.members.find((m) => m.id === team.manager_member_id)
    : undefined;
  const currentMemberIds = new Set(currentTeamMembers.members.map((m) => m.id));

  return (
    <Stack className="mx-auto max-w-2xl gap-8">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Cluster className="gap-3">
            <Heading as="h1">{team.name}</Heading>
            <StatusBadge status={team.archived_at ? "neutral" : "success"}>
              {team.archived_at ? "Archived" : "Active"}
            </StatusBadge>
          </Cluster>
          <Text className="text-muted">
            {[departmentName, locationName].filter(Boolean).join(" · ") ||
              "No department or location assigned"}
          </Text>
          {manager && <Text className="text-muted">Manager: {memberDisplayName(manager)}</Text>}
        </Stack>
        <Cluster className="gap-2">
          <Button href={`/app/teams/${team.id}/edit`} variant="secondary">
            Edit
          </Button>
          {team.archived_at ? (
            <form action={restoreTeamAction.bind(null, team.id)}>
              <Button type="submit" variant="secondary">
                Restore
              </Button>
            </form>
          ) : (
            <form action={archiveTeamAction.bind(null, team.id)}>
              <Button type="submit" variant="secondary">
                Archive
              </Button>
            </form>
          )}
        </Cluster>
      </Cluster>

      <Stack className="gap-3">
        <Heading as="h2">Members</Heading>
        {activeMembers.members.length === 0 ? (
          <Alert
            title="No active members"
            description="Invite members to this organization before assigning a team."
          />
        ) : (
          <form action={setTeamMembersAction.bind(null, team.id)} className="flex flex-col gap-4">
            <Stack className="max-h-80 gap-2 overflow-y-auto rounded-md border border-border p-3">
              {activeMembers.members.map((member) => (
                <Cluster key={member.id} className="items-center gap-2">
                  <Checkbox
                    id={`member-${member.id}`}
                    name="memberIds"
                    value={member.id}
                    defaultChecked={currentMemberIds.has(member.id)}
                  />
                  <Label htmlFor={`member-${member.id}`}>{memberDisplayName(member)}</Label>
                </Cluster>
              ))}
            </Stack>
            <Cluster className="justify-end">
              <Button type="submit" variant="secondary">
                Save members
              </Button>
            </Cluster>
          </form>
        )}
      </Stack>
    </Stack>
  );
}
