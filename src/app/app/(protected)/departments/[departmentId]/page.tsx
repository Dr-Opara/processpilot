import { notFound } from "next/navigation";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getDepartment } from "@/lib/services/departments";
import { AppError } from "@/lib/errors";
import { archiveDepartmentAction, restoreDepartmentAction } from "../actions";

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const { departmentId } = await params;

  let department;
  try {
    department = await getDepartment(departmentId);
  } catch (error) {
    if (error instanceof AppError && error.code === "not_found") notFound();
    throw error;
  }

  return (
    <Stack className="mx-auto max-w-2xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Cluster className="gap-3">
            <Heading as="h1">{department.name}</Heading>
            <StatusBadge status={department.archived_at ? "neutral" : "success"}>
              {department.archived_at ? "Archived" : "Active"}
            </StatusBadge>
          </Cluster>
          <Text className="text-muted">
            {department.parent_department_id ? "Has a parent department" : "Top-level department"}
          </Text>
        </Stack>
        <Cluster className="gap-2">
          <Button href={`/app/departments/${department.id}/edit`} variant="secondary">
            Edit
          </Button>
          {department.archived_at ? (
            <form action={restoreDepartmentAction.bind(null, department.id)}>
              <Button type="submit" variant="secondary">
                Restore
              </Button>
            </form>
          ) : (
            <form action={archiveDepartmentAction.bind(null, department.id)}>
              <Button type="submit" variant="secondary">
                Archive
              </Button>
            </form>
          )}
        </Cluster>
      </Cluster>
    </Stack>
  );
}
