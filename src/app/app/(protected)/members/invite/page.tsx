import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { listRoles } from "@/lib/services/roles";
import { listLocations } from "@/lib/services/locations";
import { listDepartments } from "@/lib/services/departments";
import { listTeams } from "@/lib/services/teams";
import { createInvitationAction } from "../actions";

export default async function InviteMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [roles, locations, departments, teams] = await Promise.all([
    listRoles().catch(() => []),
    listLocations({ status: "active" }).catch(() => []),
    listDepartments({ status: "active" }).catch(() => []),
    listTeams({ status: "active" }).catch(() => []),
  ]);

  return (
    <Stack className="mx-auto max-w-xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Invite a member</Heading>
        <Text className="text-muted">Sends an email invitation to join this organization.</Text>
      </Stack>

      {error && <Alert title="Could not send invitation" description={error} />}

      <form action={createInvitationAction} className="flex flex-col gap-4">
        <Stack className="gap-1">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" required autoFocus />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="roleId">Role</Label>
          <Select id="roleId" name="roleId" required defaultValue="">
            <option value="" disabled>
              Select a role
            </option>
            {roles.map(({ role }) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
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
          <Label htmlFor="teamId">Team (optional)</Label>
          <Select id="teamId" name="teamId" defaultValue="">
            <option value="">No specific team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="personalMessage">Personal message (optional)</Label>
          <Textarea id="personalMessage" name="personalMessage" maxLength={1000} rows={3} />
        </Stack>
        <Cluster className="justify-end gap-3">
          <Button href="/app/members" variant="secondary">
            Cancel
          </Button>
          <Button type="submit">Send invitation</Button>
        </Cluster>
      </form>
    </Stack>
  );
}
