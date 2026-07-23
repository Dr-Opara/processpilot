import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listImportHistory } from "@/lib/services/member-import";
import { AppError } from "@/lib/errors";

function statusBadgeStatus(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "partially_failed") return "warning";
  if (status === "failed") return "danger";
  return "neutral";
}

export default async function ImportHistoryPage() {
  let batches: Awaited<ReturnType<typeof listImportHistory>> = [];
  let loadError: string | null = null;
  try {
    batches = await listImportHistory();
  } catch (error) {
    loadError = error instanceof AppError ? error.message : "Could not load import history.";
  }

  return (
    <Stack className="mx-auto max-w-3xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Heading as="h1">Import history</Heading>
          <Text className="text-muted">Past CSV member-import batches.</Text>
        </Stack>
        <Button href="/app/members/import" variant="secondary">
          New import
        </Button>
      </Cluster>

      {loadError && <Alert title="Could not load import history" description={loadError} />}
      {!loadError && batches.length === 0 && (
        <Alert title="No imports yet" description="Import a CSV file to bulk-invite employees." />
      )}

      {!loadError && batches.length > 0 && (
        <ScrollArea>
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">File</th>
                <th className="py-2 pr-4 font-medium">Started</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Succeeded</th>
                <th className="py-2 pr-4 font-medium">Duplicate</th>
                <th className="py-2 pr-4 font-medium">Failed</th>
                <th className="py-2 pr-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} className="border-b border-border/60">
                  <td className="py-2 pr-4">{batch.original_filename ?? "—"}</td>
                  <td className="py-2 pr-4">{new Date(batch.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={statusBadgeStatus(batch.status)}>
                      {batch.status}
                    </StatusBadge>
                  </td>
                  <td className="py-2 pr-4">{batch.succeeded_rows}</td>
                  <td className="py-2 pr-4">{batch.duplicate_rows}</td>
                  <td className="py-2 pr-4">{batch.failed_rows}</td>
                  <td className="py-2 pr-4">
                    {batch.failed_rows > 0 && (
                      <a
                        href={`/app/members/import/history/${batch.id}/error-report`}
                        className="text-cobalt font-medium"
                      >
                        Error report
                      </a>
                    )}
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
