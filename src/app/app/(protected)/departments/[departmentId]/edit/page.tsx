import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { getDepartment, listDepartments } from "@/lib/services/departments";
import { listLocations } from "@/lib/services/locations";
import { AppError } from "@/lib/errors";
import { updateDepartmentAction } from "../../actions";

export default async function EditDepartmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ departmentId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { departmentId } = await params;
  const { error } = await searchParams;

  let department;
  try {
    department = await getDepartment(departmentId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }

  const [departments, locations] = await Promise.all([
    listDepartments({ status: "active" }).catch(() => []),
    listLocations({ status: "active" }).catch(() => []),
  ]);
  const otherDepartments = departments.filter((d) => d.id !== departmentId);
  const updateAction = updateDepartmentAction.bind(null, departmentId);

  return (
    <Stack className="mx-auto max-w-xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Edit department</Heading>
        <Text className="text-muted">{department.name}</Text>
      </Stack>

      {error && <Alert title="Could not update department" description={error} />}

      <form action={updateAction} className="flex flex-col gap-4">
        <Stack className="gap-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required maxLength={200} defaultValue={department.name} />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="locationId">Location (optional)</Label>
          <Select id="locationId" name="locationId" defaultValue={department.location_id ?? ""}>
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
          <Select id="parentDepartmentId" name="parentDepartmentId" defaultValue={department.parent_department_id ?? ""}>
            <option value="">No parent</option>
            {otherDepartments.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </Select>
        </Stack>
        <Cluster className="justify-end gap-3">
          <Button href={`/app/departments/${department.id}`} variant="secondary">
            Cancel
          </Button>
          <Button type="submit">Save changes</Button>
        </Cluster>
      </form>
    </Stack>
  );
}
