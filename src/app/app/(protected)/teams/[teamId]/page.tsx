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
import { listRoles } from "@/lib/services/roles";
import { listTeamRoleAssignments } from "@/lib/services/team-role-assignments";
import { AppError } from "@/lib/errors";
import { archiveTeamAction, restoreTeamAction, setTeamMembersAction } from "../actions";
import { assignRoleToTeamAction, unassignRoleFromTeamAction } from "../team-role-actions";

export default async function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;

  let team;
  try {
    team = await getTeam(teamId);
  } catch (error) {
    if (error instanceof AppError && error.code === "not_found") notFound();
    throw error;
  }

  const [departments, locations, activeMembers, currentTeamMembers, allRoles, teamRoleAssignments] =
    await Promise.all([
      listDepartments({ status: "all" }).catch(() => []),
      listLocations({ status: "all" }).catch(() => []),
      listMembers({ status: "active", pageSize: 100 }).catch(() => ({ members: [], total: 0 })),
      listMembers({ teamId, status: "all", pageSize: 100 }).catch(() => ({
        members: [],
        total: 0,
      })),
      listRoles().catch(() => []),
      listTeamRoleAssignments(teamId).catch(() => []),
    ]);
  const assignedRoleIds = new Set(teamRoleAssignments.map((a) => a.role.id));
  const assignableRoles = allRoles.filter(({ role }) => !assignedRoleIds.has(role.id));

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

      <Stack className="gap-3">
        <Heading as="h2">Roles granted to this team</Heading>
        <Text className="text-xs text-muted">
          Granting a role here fans it out to every current team member. A member added to the team
          afterward doesn&apos;t automatically pick it up — this is a known gap, see
          docs/architecture/organization-administration.md.
        </Text>
        {teamRoleAssignments.length === 0 ? (
          <Text className="text-sm text-muted">No roles granted via this team yet.</Text>
        ) : (
          <Stack className="gap-2">
            {teamRoleAssignments.map(({ assignment, role }) => (
              <Cluster
                key={assignment.id}
                className="justify-between rounded-md border border-border p-3"
              >
                <Text className="font-medium">{role.name}</Text>
                <form action={unassignRoleFromTeamAction.bind(null, team.id, role.id)}>
                  <Button type="submit" variant="quiet">
                    Remove
                  </Button>
                </form>
              </Cluster>
            ))}
          </Stack>
        )}
        {assignableRoles.length > 0 && (
          <form
            action={assignRoleToTeamAction.bind(null, team.id)}
            className="flex items-end gap-2"
          >
            <Stack className="flex-1 gap-1">
              <Label htmlFor="roleId">Grant a role</Label>
              <select
                id="roleId"
                name="roleId"
                required
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              >
                {assignableRoles.map(({ role }) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </Stack>
            <Button type="submit" variant="secondary">
              Grant
            </Button>
          </form>
        )}
      </Stack>
    </Stack>
  );
}
