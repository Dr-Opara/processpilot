import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { listDepartments } from "@/lib/services/departments";
import { listLocations } from "@/lib/services/locations";
import { createDepartmentAction } from "../actions";

export default async function NewDepartmentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [departments, locations] = await Promise.all([
    listDepartments({ status: "active" }).catch(() => []),
    listLocations({ status: "active" }).catch(() => []),
  ]);

  return (
    <Stack className="mx-auto max-w-xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Add a department</Heading>
        <Text className="text-muted">Departments group employees by function.</Text>
      </Stack>

      {error && <Alert title="Could not create department" description={error} />}

      <form action={createDepartmentAction} className="flex flex-col gap-4">
        <Stack className="gap-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required maxLength={200} autoFocus />
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
          <Label htmlFor="parentDepartmentId">Parent department (optional)</Label>
          <Select id="parentDepartmentId" name="parentDepartmentId" defaultValue="">
            <option value="">No parent</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </Stack>
        <Cluster className="justify-end gap-3">
          <Button href="/app/departments" variant="secondary">
            Cancel
          </Button>
          <Button type="submit">Save department</Button>
        </Cluster>
      </form>
    </Stack>
  );
}
