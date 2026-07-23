import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listProcesses } from "@/lib/services/processes";
import { AppError } from "@/lib/errors";

function statusBadgeStatus(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "published") return "success";
  if (status === "in_review") return "warning";
  if (status === "archived") return "danger";
  return "neutral";
}

export default async function ProcessesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const params = await searchParams;
  const status =
    (params.status as "draft" | "in_review" | "published" | "archived" | "all") ?? "all";

  let processes: Awaited<ReturnType<typeof listProcesses>> = [];
  let loadError: string | null = null;
  try {
    processes = await listProcesses({ search: params.search, status });
  } catch (error) {
    loadError = error instanceof AppError ? error.message : "Could not load processes.";
  }

  return (
    <Stack className="mx-auto max-w-5xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Heading as="h1">Processes</Heading>
          <Text className="text-muted">Governed, versioned definitions of repeatable work.</Text>
        </Stack>
        <Button href="/app/processes/new">Add process</Button>
      </Cluster>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <Stack className="gap-1">
          <Label htmlFor="search">Search</Label>
          <Input id="search" name="search" defaultValue={params.search ?? ""} placeholder="Title" />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={status} className="w-40">
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="in_review">In review</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </Stack>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {loadError && <Alert title="Could not load processes" description={loadError} />}
      {!loadError && processes.length === 0 && (
        <Alert title="No processes yet" description="Add your first process to get started." />
      )}

      {!loadError && processes.length > 0 && (
        <ScrollArea>
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Title</th>
                <th className="py-2 pr-4 font-medium">Version</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((process) => (
                <tr key={process.id} className="border-b border-border/60">
                  <td className="py-3 pr-4">
                    <a href={`/app/processes/${process.id}`} className="font-medium text-cobalt">
                      {process.title}
                    </a>
                  </td>
                  <td className="py-3 pr-4">
                    {process.current_version_number ? `v${process.current_version_number}` : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={statusBadgeStatus(process.status)}>
                      {process.status}
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
