import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { listDepartments } from "@/lib/services/departments";
import { listLocations } from "@/lib/services/locations";
import { listMembers } from "@/lib/services/members";
import { memberDisplayName } from "@/lib/services/member-display";
import { createTeamAction } from "../actions";

export default async function NewTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [departments, locations, membersResult] = await Promise.all([
    listDepartments({ status: "active" }).catch(() => []),
    listLocations({ status: "active" }).catch(() => []),
    listMembers({ status: "active", pageSize: 100 }).catch(() => ({ members: [], total: 0 })),
  ]);

  return (
    <Stack className="mx-auto max-w-xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Add a team</Heading>
        <Text className="text-muted">Teams group members for assignment.</Text>
      </Stack>

      {error && <Alert title="Could not create team" description={error} />}

      <form action={createTeamAction} className="flex flex-col gap-4">
        <Stack className="gap-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required maxLength={200} autoFocus />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="departmentId">Department (optional)</Label>
          <Select id="departmentId" name="departmentId" defaultValue="">
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
          <Select id="locationId" name="locationId" defaultValue="">
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
          <Select id="managerMemberId" name="managerMemberId" defaultValue="">
            <option value="">No manager assigned</option>
            {membersResult.members.map((member) => (
              <option key={member.id} value={member.id}>
                {memberDisplayName(member)}
              </option>
            ))}
          </Select>
        </Stack>
        <Cluster className="justify-end gap-3">
          <Button href="/app/teams" variant="secondary">
            Cancel
          </Button>
          <Button type="submit">Save team</Button>
        </Cluster>
      </form>
    </Stack>
  );
}
