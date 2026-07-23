import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listDepartments } from "@/lib/services/departments";
import { AppError } from "@/lib/errors";

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status as "active" | "archived" | "all") ?? "active";

  let departments: Awaited<ReturnType<typeof listDepartments>> = [];
  let loadError: string | null = null;
  try {
    departments = await listDepartments({ search: params.search, status });
  } catch (error) {
    loadError = error instanceof AppError ? error.message : "Could not load departments.";
  }

  return (
    <Stack className="mx-auto max-w-5xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Heading as="h1">Departments</Heading>
          <Text className="text-muted">Functional groups within your organization.</Text>
        </Stack>
        <Button href="/app/departments/new">Add department</Button>
      </Cluster>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <Stack className="gap-1">
          <Label htmlFor="search">Search</Label>
          <Input id="search" name="search" defaultValue={params.search ?? ""} placeholder="Department name" />
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

      {loadError && <Alert title="Could not load departments" description={loadError} />}
      {!loadError && departments.length === 0 && (
        <Alert title="No departments yet" description="Add your first department to get started." />
      )}

      {!loadError && departments.length > 0 && (
        <ScrollArea>
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((department) => (
                <tr key={department.id} className="border-b border-border/60">
                  <td className="py-3 pr-4">
                    <a href={`/app/departments/${department.id}`} className="font-medium text-cobalt">
                      {department.name}
                    </a>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={department.archived_at ? "neutral" : "success"}>
                      {department.archived_at ? "Archived" : "Active"}
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
