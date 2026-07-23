import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listDocuments } from "@/lib/services/knowledge-documents";
import { AppError } from "@/lib/errors";

function statusBadgeStatus(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "published") return "success";
  if (status === "in_review") return "warning";
  if (status === "archived") return "danger";
  return "neutral";
}

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; category?: string }>;
}) {
  const params = await searchParams;
  const status =
    (params.status as "draft" | "in_review" | "published" | "archived" | "all") ?? "all";

  let documents: Awaited<ReturnType<typeof listDocuments>> = [];
  let loadError: string | null = null;
  try {
    documents = await listDocuments({ search: params.search, status, category: params.category });
  } catch (error) {
    loadError = error instanceof AppError ? error.message : "Could not load the knowledge base.";
  }

  return (
    <Stack className="mx-auto max-w-5xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Heading as="h1">Knowledge base</Heading>
          <Text className="text-muted">Policies, SOPs, and reference documents.</Text>
        </Stack>
        <Button href="/app/knowledge/new">Add document</Button>
      </Cluster>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <Stack className="gap-1">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            name="search"
            defaultValue={params.search ?? ""}
            placeholder="Title or content"
          />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            name="category"
            defaultValue={params.category ?? ""}
            placeholder="e.g. HR"
          />
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

      {loadError && <Alert title="Could not load the knowledge base" description={loadError} />}
      {!loadError && documents.length === 0 && (
        <Alert
          title="No documents yet"
          description="Add your first policy or reference document."
        />
      )}

      {!loadError && documents.length > 0 && (
        <ScrollArea>
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Title</th>
                <th className="py-2 pr-4 font-medium">Category</th>
                <th className="py-2 pr-4 font-medium">Tags</th>
                <th className="py-2 pr-4 font-medium">Version</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id} className="border-b border-border/60">
                  <td className="py-3 pr-4">
                    <a href={`/app/knowledge/${document.id}`} className="font-medium text-cobalt">
                      {document.title}
                    </a>
                  </td>
                  <td className="py-3 pr-4">{document.category ?? "—"}</td>
                  <td className="py-3 pr-4">{document.tags.join(", ") || "—"}</td>
                  <td className="py-3 pr-4">
                    {document.current_version_number ? `v${document.current_version_number}` : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={statusBadgeStatus(document.status)}>
                      {document.status}
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
