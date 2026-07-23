import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listLocations } from "@/lib/services/locations";
import { AppError } from "@/lib/errors";

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status as "active" | "archived" | "all") ?? "active";

  let locations: Awaited<ReturnType<typeof listLocations>> = [];
  let loadError: string | null = null;
  try {
    locations = await listLocations({ search: params.search, status });
  } catch (error) {
    loadError = error instanceof AppError ? error.message : "Could not load locations.";
  }

  return (
    <Stack className="mx-auto max-w-5xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Heading as="h1">Locations</Heading>
          <Text className="text-muted">Physical or regional sites your organization operates.</Text>
        </Stack>
        <Button href="/app/locations/new">Add location</Button>
      </Cluster>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <Stack className="gap-1">
          <Label htmlFor="search">Search</Label>
          <Input id="search" name="search" defaultValue={params.search ?? ""} placeholder="Location name" />
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

      {loadError && <Alert title="Could not load locations" description={loadError} />}

      {!loadError && locations.length === 0 && (
        <Alert title="No locations yet" description="Add your first location to get started." />
      )}

      {!loadError && locations.length > 0 && (
        <ScrollArea>
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">City</th>
                <th className="py-2 pr-4 font-medium">Country</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => (
                <tr key={location.id} className="border-b border-border/60">
                  <td className="py-3 pr-4">
                    <a href={`/app/locations/${location.id}`} className="font-medium text-cobalt">
                      {location.name}
                    </a>
                  </td>
                  <td className="py-3 pr-4 text-muted">{location.city ?? "—"}</td>
                  <td className="py-3 pr-4 text-muted">{location.country ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={location.archived_at ? "neutral" : "success"}>
                      {location.archived_at ? "Archived" : "Active"}
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
