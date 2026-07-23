import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { getTeam } from "@/lib/services/teams";
import { listDepartments } from "@/lib/services/departments";
import { listLocations } from "@/lib/services/locations";
import { listMembers } from "@/lib/services/members";
import { memberDisplayName } from "@/lib/services/member-display";
import { AppError } from "@/lib/errors";
import { updateTeamAction } from "../../actions";

export default async function EditTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { teamId } = await params;
  const { error } = await searchParams;

  let team;
  try {
    team = await getTeam(teamId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }

  const [departments, locations, membersResult] = await Promise.all([
    listDepartments({ status: "active" }).catch(() => []),
    listLocations({ status: "active" }).catch(() => []),
    listMembers({ status: "active", pageSize: 100 }).catch(() => ({ members: [], total: 0 })),
  ]);
  const updateAction = updateTeamAction.bind(null, teamId);

  return (
    <Stack className="mx-auto max-w-xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Edit team</Heading>
        <Text className="text-muted">{team.name}</Text>
      </Stack>

      {error && <Alert title="Could not update team" description={error} />}

      <form action={updateAction} className="flex flex-col gap-4">
        <Stack className="gap-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required maxLength={200} defaultValue={team.name} />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="departmentId">Department (optional)</Label>
          <Select id="departmentId" name="departmentId" defaultValue={team.department_id ?? ""}>
            <option value="">No specific department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="locationId">Location (optional)</Label>
          <Select id="locationId" name="locationId" defaultValue={team.location_id ?? ""}>
            <option value="">No specific location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </Select>
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="managerMemberId">Manager (optional)</Label>
          <Select id="managerMemberId" name="managerMemberId" defaultValue={team.manager_member_id ?? ""}>
            <option value="">No manager assigned</option>
            {membersResult.members.map((member) => (
              <option key={member.id} value={member.id}>
                {memberDisplayName(member)}
              </option>
            ))}
          </Select>
        </Stack>
        <Cluster className="justify-end gap-3">
          <Button href={`/app/teams/${team.id}`} variant="secondary">
            Cancel
          </Button>
          <Button type="submit">Save changes</Button>
        </Cluster>
      </form>
    </Stack>
  );
}
