import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listTeams } from "@/lib/services/teams";
import { listDepartments } from "@/lib/services/departments";
import { listLocations } from "@/lib/services/locations";
import { AppError } from "@/lib/errors";

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status as "active" | "archived" | "all") ?? "active";

  let teams: Awaited<ReturnType<typeof listTeams>> = [];
  let loadError: string | null = null;
  let departmentNames = new Map<string, string>();
  let locationNames = new Map<string, string>();
  try {
    const [teamRows, departments, locations] = await Promise.all([
      listTeams({ search: params.search, status }),
      listDepartments({ status: "all" }).catch(() => []),
      listLocations({ status: "all" }).catch(() => []),
    ]);
    teams = teamRows;
    departmentNames = new Map(departments.map((department) => [department.id, department.name]));
    locationNames = new Map(locations.map((location) => [location.id, location.name]));
  } catch (error) {
    loadError = error instanceof AppError ? error.message : "Could not load teams.";
  }

  return (
    <Stack className="mx-auto max-w-5xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Heading as="h1">Teams</Heading>
          <Text className="text-muted">Groups of members used for assignment.</Text>
        </Stack>
        <Button href="/app/teams/new">Add team</Button>
      </Cluster>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <Stack className="gap-1">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            name="search"
            defaultValue={params.search ?? ""}
            placeholder="Team name"
          />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={status} className="w-40">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </Select>
        </Stack>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {loadError && <Alert title="Could not load teams" description={loadError} />}
      {!loadError && teams.length === 0 && (
        <Alert title="No teams yet" description="Add your first team to get started." />
      )}

      {!loadError && teams.length > 0 && (
        <ScrollArea>
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Department</th>
                <th className="py-2 pr-4 font-medium">Location</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id} className="border-b border-border/60">
                  <td className="py-3 pr-4">
                    <a href={`/app/teams/${team.id}`} className="font-medium text-cobalt">
                      {team.name}
                    </a>
                  </td>
                  <td className="py-3 pr-4">
                    {team.department_id ? (departmentNames.get(team.department_id) ?? "—") : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    {team.location_id ? (locationNames.get(team.location_id) ?? "—") : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={team.archived_at ? "neutral" : "success"}>
                      {team.archived_at ? "Archived" : "Active"}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </Stack>
  );
}
